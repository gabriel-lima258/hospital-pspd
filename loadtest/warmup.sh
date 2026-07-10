#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
if ! command -v curl >/dev/null 2>&1; then
  echo "❌ Erro: 'curl' não encontrado. Instale-o antes de continuar." >&2
  exit 1
fi

if [ ! -f "tokens.json" ]; then
  ./generate-tokens.sh
fi

TOKEN=$(jq -r '.medico' tokens.json)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Erro: token medico não encontrado em tokens.json." >&2
  exit 1
fi

BASE_URL="${1:-http://localhost:9000}"
PATIENT_ID="${2:-P000010}"
END_TIME=$((SECONDS + 30))

echo "🚿 Warmup por 30s em $BASE_URL/fhir/Patient/$PATIENT_ID"
while [ $SECONDS -lt $END_TIME ]; do
  curl -s -o /dev/null -H "Authorization: Bearer $TOKEN" "$BASE_URL/fhir/Patient/$PATIENT_ID" || true
  sleep 1
done

echo "✅ Warmup concluído"
