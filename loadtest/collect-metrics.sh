#!/usr/bin/env bash
# collect-metrics.sh — visão do SERVIDOR (Prometheus) no mesmo instante da rodada k6. Opcional:
# se o Prometheus (kube-prometheus-stack) não estiver acessível, sai 0 sem falhar a bateria.
# Cruzar k6 (cliente) × Prometheus (servidor) é o que dá profundidade à análise (§5.1).
#
# Uso:  loadtest/collect-metrics.sh <cenario> <vus>
# Saída: loadtest/out/<cenario>_vus<vus>_prom.json  (consumido pelo plot.py)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIO="${1:?uso: collect-metrics.sh <cenario> <vus>}"
VUS="${2:?uso: collect-metrics.sh <cenario> <vus>}"
OUT="$HERE/out/${SCENARIO}_vus${VUS}_prom.json"

PROM_SVC="${PROM_SVC:-kps-kube-prometheus-stack-prometheus}"
PROM_PORT="${PROM_PORT:-9090}"
LOCAL_PORT="${PROM_LOCAL_PORT:-9091}"

# port-forward efêmero para a API do Prometheus
kubectl port-forward "svc/$PROM_SVC" "$LOCAL_PORT:$PROM_PORT" >/dev/null 2>&1 &
PF=$!; trap 'kill $PF 2>/dev/null || true' EXIT
for _ in $(seq 1 20); do (exec 3<>/dev/tcp/127.0.0.1/$LOCAL_PORT) 2>/dev/null && break; sleep 0.5; done
API="http://127.0.0.1:$LOCAL_PORT/api/v1/query"

q() {  # roda um PromQL instantâneo, devolve o primeiro valor escalar (ou vazio)
  curl -sS --get "$API" --data-urlencode "query=$1" 2>/dev/null \
    | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin); r=d["data"]["result"]
    print(r[0]["value"][1] if r else "")
except Exception:
    print("")' 2>/dev/null || echo ""
}

if [ -z "$(q 'up')" ]; then
  echo "  (Prometheus inacessível em $PROM_SVC:$PROM_PORT — pulando coleta server-side)" >&2
  exit 0
fi

CPU_GW="$(q 'sum(rate(container_cpu_usage_seconds_total{namespace="default",pod=~"api-gateway.*"}[1m]))')"
CPU_PD="$(q 'sum(rate(container_cpu_usage_seconds_total{namespace="default",pod=~"patient-data.*"}[1m]))')"
MEM_PD="$(q 'sum(container_memory_working_set_bytes{namespace="default",pod=~"patient-data.*"})/1024/1024')"
PODS="$(q 'sum(kube_deployment_status_replicas_ready{namespace="default"})')"
P95="$(q 'histogram_quantile(0.95, sum by (le) (rate(http_server_requests_seconds_bucket[1m])))')"

python3 - "$OUT" "$SCENARIO" "$VUS" "$CPU_GW" "$CPU_PD" "$MEM_PD" "$PODS" "$P95" <<'PY'
import json, sys
_, out, sc, vus, cpu_gw, cpu_pd, mem_pd, pods, p95 = sys.argv
def f(x):
    try: return float(x)
    except: return None
json.dump({"cenario": sc, "vus": int(vus),
           "cpu_gateway": f(cpu_gw), "cpu_patient": f(cpu_pd),
           "mem_patient_mb": f(mem_pd), "pods_ready": f(pods),
           "p95_server_s": f(p95)}, open(out, "w"))
print(f"  server-side -> {out}", file=sys.stderr)
PY
