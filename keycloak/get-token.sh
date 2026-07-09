#!/usr/bin/env bash
# get-token.sh — obtém um access_token (JWT) via password grant no client hospital-loadtest.
# Reutilizável para gerar o pool tokens.json do k6 (§4.9). O Keycloak importa só *.json da pasta,
# então este .sh convive em keycloak/ sem interferir no --import-realm.
#
# Uso:   keycloak/get-token.sh <username> [password]
# Ex.:   keycloak/get-token.sh med.cardoso
#        KC_HOST=keycloak KC_PORT=8080 keycloak/get-token.sh pesq.souza
set -euo pipefail

USERNAME="${1:?uso: get-token.sh <username> [password]}"
PASSWORD="${2:-senha123}"

KC_HOST="${KC_HOST:-localhost}"
KC_PORT="${KC_PORT:-8080}"
KC_REALM="${KC_REALM:-hospital}"
KC_CLIENT="${KC_CLIENT:-hospital-loadtest}"

TOKEN_URL="http://${KC_HOST}:${KC_PORT}/realms/${KC_REALM}/protocol/openid-connect/token"

RESPONSE="$(curl -sS -X POST "$TOKEN_URL" \
  -d grant_type=password \
  -d client_id="$KC_CLIENT" \
  -d username="$USERNAME" \
  -d password="$PASSWORD")"

# Extrai o access_token (jq preferencial; python3 como fallback).
if command -v jq >/dev/null 2>&1; then
  TOKEN="$(printf '%s' "$RESPONSE" | jq -r '.access_token // empty')"
elif command -v python3 >/dev/null 2>&1; then
  TOKEN="$(printf '%s' "$RESPONSE" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("access_token",""))' 2>/dev/null || true)"
else
  echo "ERRO: preciso de 'jq' ou 'python3' para extrair o token." >&2
  exit 1
fi

if [ -z "${TOKEN:-}" ]; then
  echo "ERRO: falha ao obter token para '$USERNAME' em $TOKEN_URL" >&2
  echo "Resposta do Keycloak: $RESPONSE" >&2
  exit 1
fi

printf '%s\n' "$TOKEN"
