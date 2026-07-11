#!/usr/bin/env bash
# gen-tokens.sh — gera o pool loadtest/k6/tokens.json (JWTs pré-gerados + endpoint resolvido).
#
# Por quê: o Keycloak fica FORA do caminho de medição (§4.9). Geramos os tokens ANTES de cada
# rodada k6 e o script só manda `Authorization: Bearer`. Como o access token do Keycloak dura
# ~5 min por default, este script é chamado antes de CADA nível de VUs (cada k6 run é 3 min < 5).
#
# O mix (coerente com db/seed.py) exercita FULL / PARTIAL / AGG:
#   med.cardoso (MEDICO)      -> /fhir/Patient/P000001..P001000  (FULL,    vínculo ativo)  ~60%
#   est.almeida (ESTAGIARIO)  -> /fhir/Patient/P000001..P000200  (PARTIAL, subconjunto)   ~20%
#   pesq.souza  (PESQUISADOR) -> /fhir/cohort/PRJ01              (AGG,     projeto ALLOW)  ~20%
# Cada requisição de médico/estagiário sorteia um paciente distinto → espalha a carga por muitas
# linhas do banco (bater 1 linha só não estressa cache/IO — ver "não faça" do CLAUDE.md).
#
# Uso:  KC_HOST=localhost KC_PORT=8080 loadtest/gen-tokens.sh [POOL_SIZE]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
OUT="$HERE/k6/tokens.json"
POOL_SIZE="${1:-120}"

export KC_HOST="${KC_HOST:-localhost}"
export KC_PORT="${KC_PORT:-8080}"

echo ">> mintando JWTs (Keycloak $KC_HOST:$KC_PORT) — 3 perfis" >&2
JWT_CARDOSO="$("$REPO/keycloak/get-token.sh" med.cardoso)"
JWT_ALMEIDA="$("$REPO/keycloak/get-token.sh" est.almeida)"
JWT_SOUZA="$("$REPO/keycloak/get-token.sh"  pesq.souza)"

# Monta o pool com python3 (sorteio reprodutível: seed fixo → mesmo mix entre rodadas).
JWT_CARDOSO="$JWT_CARDOSO" JWT_ALMEIDA="$JWT_ALMEIDA" JWT_SOUZA="$JWT_SOUZA" \
POOL_SIZE="$POOL_SIZE" python3 - "$OUT" <<'PY'
import json, os, random, sys

out_path = sys.argv[1]
n = int(os.environ["POOL_SIZE"])
random.seed(42)  # condições idênticas entre rodadas

cardoso = os.environ["JWT_CARDOSO"]
almeida = os.environ["JWT_ALMEIDA"]
souza   = os.environ["JWT_SOUZA"]

pool = []
for _ in range(n):
    r = random.random()
    if r < 0.60:                                   # médico FULL — pacientes 1..1000
        pid = random.randint(1, 1000)
        pool.append({"jwt": cardoso, "perfil": "medico",
                     "endpoint": f"/fhir/Patient/P{pid:06d}"})
    elif r < 0.80:                                 # estagiário PARTIAL — pacientes 1..200
        pid = random.randint(1, 200)
        pool.append({"jwt": almeida, "perfil": "estagiario",
                     "endpoint": f"/fhir/Patient/P{pid:06d}"})
    else:                                          # pesquisador AGG — coorte do projeto ALLOW
        pool.append({"jwt": souza, "perfil": "pesquisador",
                     "endpoint": "/fhir/cohort/PRJ01"})

with open(out_path, "w") as f:
    json.dump(pool, f)
print(f">> {len(pool)} entradas -> {out_path}", file=sys.stderr)
PY

echo ">> pool pronto: $OUT" >&2
