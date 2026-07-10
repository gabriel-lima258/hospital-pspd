#!/usr/bin/env bash
set -euo pipefail

SCENARIO="${1:-}"
BASE_URL="${2:-http://localhost:9000}"

if ! command -v k6 >/dev/null 2>&1; then
  echo "❌ Erro: 'k6' não encontrado. Instale-o e adicione ao PATH antes de continuar." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ Erro: 'jq' não encontrado. Instale-o antes de continuar." >&2
  exit 1
fi

if [ -z "$SCENARIO" ]; then
  echo "❌ Erro: Deves informar o cenário. Uso: ./run-load-tests.sh [1replica | 3replicas | hpa] [BASE_URL]" >&2
  exit 1
fi

cd "$(dirname "$0")"

if [ ! -f "tokens.json" ]; then
  ./generate-tokens.sh
fi

if [ ! -f "tokens.json" ]; then
  echo "❌ Erro: tokens.json não foi gerado." >&2
  exit 1
fi

CSV_FILE="resultados_${SCENARIO}.csv"
VUS_ARRAY=(10 50 100 500 1000)

mkdir -p out

echo "🚀 A iniciar bateria de testes para o cenário: $SCENARIO"
echo "VUs,Throughput_ReqS,Latencia_P95_ms" > "$CSV_FILE"

for vus in "${VUS_ARRAY[@]}"; do
  echo "⏳ A disparar teste com $vus utilizadores simultâneos..."

  ./reset-state.sh "$SCENARIO"
  ./warmup.sh "$BASE_URL" "P000010"

  METRICS_LOG="out/metrics_${SCENARIO}_${vus}.log"
  ./collect-metrics.sh "$SCENARIO" 35 > "$METRICS_LOG" 2>&1 &
  METRICS_PID=$!

  k6 run --vus "$vus" --duration 30s -e BASE_URL="$BASE_URL" --summary-export="out/summary_${SCENARIO}_${vus}.json" k6/scenario.js

  kill "$METRICS_PID" >/dev/null 2>&1 || true
  wait "$METRICS_PID" 2>/dev/null || true

  REQ_S=$(jq -r '.metrics.http_reqs.rate // 0' "out/summary_${SCENARIO}_${vus}.json" | awk '{printf "%.2f", $1}')
  P95_LAT=$(jq -r '.metrics.http_req_duration.values."p(95)" // 0' "out/summary_${SCENARIO}_${vus}.json" | awk '{printf "%.2f", $1}')

  echo "📊 $vus VUs -> Vazão: $REQ_S req/s | Latência P95: ${P95_LAT}ms"
  echo "$vus,$REQ_S,$P95_LAT" >> "$CSV_FILE"

  sleep 30
done

echo "✅ Bateria concluída!"
