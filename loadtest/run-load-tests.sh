#!/usr/bin/env bash
# run-load-tests.sh — bateria k6 dos 5 níveis (10/50/100/500/1000 VUs) para UM cenário, sob o
# protocolo de "condições idênticas" (§4.9). Prepara o estado do cluster, faz port-forward efêmero,
# e para cada nível: gera tokens frescos → warm-up fixo → k6 (3 min) → coleta → cool-down.
#
# Uso:
#   loadtest/run-load-tests.sh <cenario>
#   cenarios: 1replica | 3replicas-off | 3replicas-on | hpa
#
# ⚠️ Alcance ao cluster é por `kubectl port-forward` (api-gateway é ClusterIP; kind sem NodePort).
#    A 1000 VUs o próprio port-forward pode limitar o throughput — é um teto do CLIENTE, não da app.
#    Registrar isso na leitura do gráfico; para medir o teto real, expor via NodePort e apontar BASE.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
cd "$REPO"

SCENARIO="${1:?uso: run-load-tests.sh <1replica|3replicas-off|3replicas-on|hpa>}"
OUTDIR="$HERE/out"
VU_LEVELS="${VU_LEVELS:-10 50 100 500 1000}"
GW_PORT="${GW_PORT:-9000}"
KC_PORT="${KC_PORT:-8080}"
mkdir -p "$OUTDIR"

command -v k6 >/dev/null || { echo "ERRO: k6 não instalado. Ver loadtest/README.md" >&2; exit 1; }

# ── 1. Estado do cluster para o cenário (uma variável muda por vez) ───────────
echo ">>> preparando cenário '$SCENARIO'"
case "$SCENARIO" in
  1replica)      make hpa-off; make scale N=1 ;;
  3replicas-off) make grpc-lb-off; make hpa-off; make scale N=3 ;;   # §7.3 ANTES
  3replicas-on)  make grpc-lb-on;  make hpa-off; make scale N=3 ;;   # §7.3 DEPOIS
  hpa)           make grpc-lb-on;  make scale N=1; make hpa-on ;;
  *) echo "cenário inválido: $SCENARIO" >&2; exit 2 ;;
esac

# Rate limiting OFF durante a medição: o pool tem só 3 usuários; um limite por-usuário mediria o
# limitador, não a aplicação. Reseta no próximo `make deploy`. (Demonstração do 429 é separada.)
echo ">>> desligando rate limiting para a medição (GATEWAY_RATELIMIT_ENABLED=false)"
kubectl set env deploy/api-gateway GATEWAY_RATELIMIT_ENABLED=false >/dev/null
kubectl rollout status deploy/api-gateway --timeout=120s >/dev/null

# Tracing OFF durante a medição (defensivo): o export de spans a 100% adicionaria overhead e
# contaminaria latência/CPU. O default das imagens já é inerte; reforça aqui caso `make tracing`
# tenha sido usado antes.
echo ">>> garantindo tracing desligado (OTEL_SDK_DISABLED=true nos 4 serviços)"
for s in api-gateway authorization patient-data data-transform; do
  kubectl set env deploy/"$s" OTEL_SDK_DISABLED=true >/dev/null
done
# espera estabilizar (set env só reinicia se o valor mudou; no-op nas baterias seguintes)
for s in api-gateway authorization patient-data data-transform; do
  kubectl rollout status deploy/"$s" --timeout=120s >/dev/null
done

# ── 2. Port-forwards efêmeros (Keycloak p/ tokens, gateway p/ k6) ─────────────
PF_PIDS=()
cleanup() { for p in "${PF_PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

wait_port() {  # espera a porta local aceitar conexão (até 30s)
  local port=$1 tries=0
  until (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; do
    tries=$((tries+1)); [ $tries -ge 60 ] && { echo "ERRO: porta $port não subiu" >&2; return 1; }
    sleep 0.5
  done
  exec 3>&- 2>/dev/null || true
}

echo ">>> port-forward svc/keycloak :$KC_PORT e svc/api-gateway :$GW_PORT"
kubectl port-forward svc/keycloak "$KC_PORT:8080"    >/dev/null 2>&1 & PF_PIDS+=("$!")
kubectl port-forward svc/api-gateway "$GW_PORT:9000" >/dev/null 2>&1 & PF_PIDS+=("$!")
wait_port "$KC_PORT"; wait_port "$GW_PORT"

export BASE="http://localhost:$GW_PORT"
export KC_HOST="localhost" KC_PORT

# ── 3. Bateria: 5 níveis, mesmas condições ────────────────────────────────────
for VUS in $VU_LEVELS; do
  echo ">>> [$SCENARIO] VUs=$VUS ─────────────────────────────────────────"
  KC_HOST=localhost KC_PORT="$KC_PORT" "$HERE/gen-tokens.sh" >/dev/null   # tokens frescos (TTL ~5min)

  echo "  warm-up 30s (aquece JVM/JIT — sem isso a rodada de 10 VUs mede cold start)"
  k6 run -e VUS=10 -e DURATION=30s -e BASE="$BASE" -e SCENARIO="$SCENARIO-warmup" \
     --quiet --no-summary "$HERE/k6/scenario.js" >/dev/null 2>&1 || true

  echo "  medição 3min"
  k6 run -e VUS="$VUS" -e BASE="$BASE" -e SCENARIO="$SCENARIO" \
     --summary-export "$OUTDIR/${SCENARIO}_vus${VUS}.json" \
     "$HERE/k6/scenario.js"

  # coleta PromQL (opcional — só se Prometheus estiver acessível)
  if [ -x "$HERE/collect-metrics.sh" ]; then
    "$HERE/collect-metrics.sh" "$SCENARIO" "$VUS" || echo "  (collect-metrics pulado)"
  fi

  echo "  cool-down 60s"
  sleep 60
done

echo ">>> bateria '$SCENARIO' concluída. Summaries em $OUTDIR/. Gráficos: make plot (ou python3 loadtest/plot.py)"
