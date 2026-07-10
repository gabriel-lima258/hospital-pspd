#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "❌ Erro: 'kubectl' não encontrado. Instale-o antes de continuar." >&2
  exit 1
fi

SCENARIO="${1:-}" # opcional, usado só para logs
if [ -n "$SCENARIO" ]; then
  echo "♻️  Resetando estado para cenário: $SCENARIO"
else
  echo "♻️  Resetando estado do cluster para carga"
fi

for deploy in api-gateway authorization patient-data data-transform; do
  kubectl rollout restart deployment/$deploy >/dev/null 2>&1 || true
  kubectl rollout status deployment/$deploy --timeout=90s >/dev/null 2>&1 || true
done

echo "✅ Reset de estado concluído"
