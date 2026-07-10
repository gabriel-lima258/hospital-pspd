#!/usr/bin/env bash
set -euo pipefail

SCENARIO="${1:-}"
DURATION="${2:-30}"
if [ -z "$SCENARIO" ]; then
  echo "Uso: ./collect-metrics.sh [1replica|3replicas|hpa] [DURACAO_SEGUNDOS]" >&2
  exit 1
fi

cd "$(dirname "$0")"
LOG_FILE="recursos_k8s_${SCENARIO}.log"
END_TIME=$((SECONDS + DURATION))

echo "📊 A recolher métricas do kubectl top pods por $DURATION segundos (cenário: $SCENARIO)"
echo "Iniciado em $(date)" > "$LOG_FILE"

while [ $SECONDS -lt $END_TIME ]; do
  echo "--- $(date '+%H:%M:%S') ---" >> "$LOG_FILE"
  kubectl top pods >> "$LOG_FILE" 2>/dev/null || echo "A aguardar metrics-server..." >> "$LOG_FILE"
  sleep 5
done

echo "✅ Métricas recolhidas em $LOG_FILE"
