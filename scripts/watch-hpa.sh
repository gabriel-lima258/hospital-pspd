#!/usr/bin/env bash
# watch-hpa.sh — amostra o estado de escala dos 4 serviços e escreve um CSV com série temporal.
#
# Produz o dado do gráfico-assinatura da fase (d) do enunciado (§3.d: "criação automática de pods")
# e do gráfico 6 do roteiro (§4.9): nº de pods × tempo, sobreposto à carga.
#
# Rode em background ANTES de o Carlos disparar a rampa do k6, e mate no fim:
#
#   scripts/watch-hpa.sh &          # ou: make watch-hpa
#   ... rampa k6 ...
#   kill %1
#
# Funciona com e sem HPA aplicado: sem HPA, as colunas cpu_pct/desired ficam vazias e o CSV ainda
# serve para o cenário de réplicas fixas (prova que a contagem NÃO variou durante a bateria).
#
# Variáveis:
#   INTERVAL  segundos entre amostras (default 5)
#   OUT       caminho do CSV (default docs/evidencias/hpa-timeline.csv)
#   SCENARIO  rótulo gravado em cada linha (default "unnamed") — ex.: 1replica, 3replicas, hpa
set -euo pipefail

INTERVAL="${INTERVAL:-5}"
OUT="${OUT:-docs/evidencias/hpa-timeline.csv}"
SCENARIO="${SCENARIO:-unnamed}"
DEPLOYS="api-gateway authorization patient-data data-transform"

command -v kubectl >/dev/null 2>&1 || { echo "ERRO: 'kubectl' não encontrado." >&2; exit 1; }
command -v jq      >/dev/null 2>&1 || { echo "ERRO: 'jq' não encontrado." >&2; exit 1; }

mkdir -p "$(dirname "$OUT")"

# Cabeçalho só na criação: rodadas sucessivas de cenários diferentes acumulam no mesmo arquivo,
# distinguidas pela coluna `scenario`.
if [ ! -s "$OUT" ]; then
  echo "ts_utc,elapsed_s,scenario,deployment,replicas,ready,cpu_pct,desired" > "$OUT"
fi

START="$(date -u +%s)"
echo ">> amostrando a cada ${INTERVAL}s -> $OUT  (scenario=$SCENARIO). Ctrl+C para parar."
trap 'echo; echo ">> parado. $(( $(wc -l < "'"$OUT"'") - 1 )) amostras em '"$OUT"'"; exit 0' INT TERM

while true; do
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  elapsed=$(( $(date -u +%s) - START ))

  # Uma chamada por tick, não uma por serviço: mantém as 4 linhas do mesmo instante coerentes.
  dep_json="$(kubectl get deploy -o json 2>/dev/null || echo '{"items":[]}')"
  hpa_json="$(kubectl get hpa    -o json 2>/dev/null || echo '{"items":[]}')"

  for d in $DEPLOYS; do
    replicas="$(printf '%s' "$dep_json" | jq -r --arg d "$d" \
      '(.items[] | select(.metadata.name==$d) | .status.replicas) // 0' | head -1)"
    ready="$(printf '%s' "$dep_json" | jq -r --arg d "$d" \
      '(.items[] | select(.metadata.name==$d) | .status.readyReplicas) // 0' | head -1)"

    # HPA v2: a utilização vive em status.currentMetrics[].resource.current.averageUtilization.
    # Fica vazia enquanto o metrics-server não popula (o `<unknown>` do kubectl).
    cpu="$(printf '%s' "$hpa_json" | jq -r --arg d "$d" \
      '(.items[] | select(.metadata.name==$d) | .status.currentMetrics[]?
        | select(.type=="Resource") | .resource.current.averageUtilization) // empty' | head -1)"
    desired="$(printf '%s' "$hpa_json" | jq -r --arg d "$d" \
      '(.items[] | select(.metadata.name==$d) | .status.desiredReplicas) // empty' | head -1)"

    printf '%s,%s,%s,%s,%s,%s,%s,%s\n' \
      "$ts" "$elapsed" "$SCENARIO" "$d" "${replicas:-0}" "${ready:-0}" "${cpu:-}" "${desired:-}" \
      >> "$OUT"
  done

  sleep "$INTERVAL"
done
