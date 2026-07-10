#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
echo "🔐 A gerar pool de tokens JWT do Keycloak..."

SCRIPT_KC="../keycloak/get-token.sh"
if [ ! -f "$SCRIPT_KC" ]; then
  echo "❌ Erro: Script $SCRIPT_KC não encontrado." >&2
  exit 1
fi

TOKEN_MED="$(bash "$SCRIPT_KC" "med.cardoso" "senha123")"
TOKEN_EST="$(bash "$SCRIPT_KC" "est.almeida" "senha123")"
TOKEN_PESQ="$(bash "$SCRIPT_KC" "pesq.souza" "senha123")"

cat <<EOF > tokens.json
{
  "medico": "$TOKEN_MED",
  "estagiario": "$TOKEN_EST",
  "pesquisador": "$TOKEN_PESQ"
}
EOF

echo "✅ tokens.json gerado com sucesso!"
