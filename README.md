# Hospital Universitário (PSPD/UnB)

Aplicação de **microsserviços** que expõe dados clínicos no padrão **HL7/FHIR** com controle de
acesso por perfil (Médico / Estagiário / Pesquisador). Trabalho acadêmico de **PSPD (FGA/UnB)** para
explorar **observabilidade e escalabilidade em Kubernetes**.

> **Novo no projeto?** Leia primeiro o `[CLAUDE.md](CLAUDE.md)` (manual de operação, curto) e os
> **3 contratos congelados** em `[docs/contratos.md](docs/contratos.md)`. O detalhe completo está em
> `[docs/Roteiro_PSPD_Observabilidade_K8S.md](docs/Roteiro_PSPD_Observabilidade_K8S.md)`.

---

## O que o sistema faz

Uma requisição REST autenticada (JWT) chega ao Gateway e atravessa três serviços gRPC até virar um
recurso FHIR, respeitando o nível de acesso do perfil do usuário:

```
Frontend (React/Next)
        │  REST/HTTPS  + JWT (Keycloak)
        ▼
   api-gateway ──────────────► authorization    (ALLOW/DENY + nível de acesso)
        │        gRPC/HTTP2 ─► patient-data      (consulta SQL no Postgres)
        │                   ─► data-transform    (anonimiza/agrega → HL7/FHIR)
        ▼
   resposta FHIR (200)
```


| Serviço            | Papel                                                                       |
| ------------------ | --------------------------------------------------------------------------- |
| **api-gateway**    | Recebe REST, valida JWT, roteia via gRPC, consolida, rate limiting/logging. |
| **authorization**  | Decide `ALLOW/DENY` + nível `FULL/PARTIAL/ANONYMIZED/AGGREGATED`.           |
| **patient-data**   | Consultas SQL e agregações do prontuário (PostgreSQL).                      |
| **data-transform** | Anonimização, agregação e conversão para HL7/FHIR.                          |


**Controle de acesso por perfil** (claim `realm_access.roles` do JWT):


| Perfil        | Nível                     | Regra                                                          |
| ------------- | ------------------------- | -------------------------------------------------------------- |
| `MEDICO`      | `FULL`                    | apenas pacientes vinculados; senão `DENY`                      |
| `ESTAGIARIO`  | `PARTIAL`                 | apenas pacientes supervisionados (dados parciais/anonimizados) |
| `PESQUISADOR` | `ANONYMIZED`/`AGGREGATED` | apenas projetos Aprovados e vigentes                           |

A **decisão** (ALLOW/DENY + nível) já está implementada no `authorization` (domínio puro
`AuthorizationPolicy` + testes) — ver [`docs/contratos.md`](docs/contratos.md). ⚠️ **Dívida técnica
(P3):** a **enforcement** (anonimização/agregação real no `data-transform`) ainda não existe — hoje o
nível é decidido corretamente mas os dados voltam sempre `FULL`. Um `ESTAGIARIO` recebe `PARTIAL` e vê
dados completos até o P3 fechar.


---



## Stack

Java 21 · Spring Boot (hexagonal) · **Gradle** (wrapper `./gradlew`) · gRPC
(`net.devh:grpc-spring-boot-starter`) · Spring Data JPA · Spring Security OAuth2 (só no Gateway) ·
Micrometer + Actuator (`/actuator/prometheus`) · **Keycloak** (OAuth2/OIDC) · **PostgreSQL 16**.
Cluster: **kind** · Observabilidade: **Prometheus + Grafana** · Carga: **k6** · Tracing (extra):
OpenTelemetry + Tempo.

---



## Pré-requisitos

- **JDK 21** (o Gradle é resolvido pelo wrapper — não precisa instalar Gradle)
- **Docker** + **Docker Compose v2**
- `psql` (cliente, opcional — para inspecionar o banco)
- Para as fases de cluster: `kubectl`, `kind`, `k6`, `python3`

---



## Estrutura do repositório

```
proto/            # contrato gRPC (fonte da verdade) — módulo Gradle :proto
db/               # schema.sql (+ seed.py, futuro)
services/         # api-gateway · authorization · patient-data · data-transform
frontend/         # React/Next (futuro)
k8s/              # base/ + observability/ (manifests, HPA, ServiceMonitors)
loadtest/         # k6/, run-load-tests.sh, plot.py (futuro)
keycloak/         # realm-export.json (futuro)
docs/             # roteiro, contratos, prompts, evidências
```

Layout **hexagonal** por serviço: `domain/` (regras, sem framework) · `application/` (casos de uso) ·
`adapters/in|out`. Monorepo Gradle multi-project; o módulo `:proto` é compartilhado
(`implementation project(':proto')`).

---



## Como rodar (ambiente local / inner loop)

```bash
# 1) Compila os 4 serviços e gera os stubs gRPC a partir de proto/hospital.proto
./gradlew build            # tudo
./gradlew :proto:build     # só o contrato gRPC

# 2) Sobe Postgres 16 (cria as 5 tabelas + seed mínimo) + Keycloak + os 4 serviços
make up                    # reaproveita as imagens existentes

# 3) Derruba o ambiente
make down                  # para os containers, zera também o volume → schema.sql + seed-min.sql rodam de novo no boot
```

> ⚠️ `make up` **não reconstrói código alterado** (só reusa as imagens). Depois de mexer em qualquer
> `services/**`, use `make rebuild`. E o seed do Postgres só roda em volume novo (`down -v`).



### Serviços locais


| Serviço                | URL / porta (host)                                                       |
| ---------------------- | ------------------------------------------------------------------------ |
| **api-gateway** (REST) | [http://localhost:9000](http://localhost:9000) — único serviço publicado |
| PostgreSQL             | `localhost:5433` — db `hospital`, user `app`, senha `app`                |
| Keycloak (admin)       | [http://localhost:8080](http://localhost:8080) — admin `admin` / `admin` |


Os serviços internos (`authorization`, `patient-data`, `data-transform`) não são publicados no host —
falam entre si pela rede do compose (gRPC em `:9090`, HTTP/actuator em `:8080`). Cada um expõe
`/actuator/health` e `/actuator/prometheus`.

> ⚠️ O Postgres é publicado na porta **5433** do host (a 5432 costuma estar ocupada por um Postgres
> local). Dentro do compose/cluster a porta continua 5432.



### As 3 jornadas (M2)

Toda requisição atravessa Gateway → Authorization → Patient Data → Postgres → Data Transform.
O **nível autorizado decide a forma da saída** — não é anotação, é enforcement.

**1 e 2 — prontuário individual** (`GET /fhir/Patient/{id}`):

```bash
TOKEN=$(keycloak/get-token.sh med.cardoso)
curl -H "Authorization: Bearer $TOKEN" http://localhost:9000/fhir/Patient/P000001 | jq
# → Bundle FHIR (Patient + Encounter/Condition/Observation/MedicationRequest), mascarado pelo nível:
#   MEDICO (FULL)        → name:"Joao da Silva", birthDate:"1980-05-12", identifier:[CPF, CNS]
#   ESTAGIARIO (PARTIAL) → name:"J. da S.",      birthDate:"1980",       sem identifier

# Caso negativo (médico sem vínculo) → HTTP 403:
TOKEN=$(keycloak/get-token.sh med.semvinculo)
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  http://localhost:9000/fhir/Patient/P000001
```

**3 — coorte de pesquisa** (`GET /fhir/cohort/{projetoId}?tipo=…`). O cliente escolhe o **projeto**;
a **coorte** é resolvida pelo Authorization a partir do projeto validado, nunca por parâmetro:

```bash
TOKEN=$(keycloak/get-token.sh pesq.souza)
curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:9000/fhir/cohort/PRJ01?tipo=ResumoCoorte' | jq
# → MeasureReport (AGGREGATED): total 8952, %sexo/faixa/setor, mediaHbA1c — zero dado individual

curl -H "Authorization: Bearer $TOKEN" \
  'http://localhost:9000/fhir/cohort/PRJ01?tipo=ExamesCoorte' | jq
# → Bundle (ANONYMIZED): Patients pseudonimizados ("hash…"), datas truncadas ao ano

# PRJ02 (Expirado) e PRJ04 (de outro dono) → 403 · PRJ03 (coorte vazia) → 404 · tipo inválido → 400
```



### Validar o banco

```bash
# lista as 5 tabelas
docker compose exec db psql -U app -d hospital -c '\dt'
# ou pelo cliente local (porta 5433):
psql -h localhost -p 5433 -U app -d hospital -c '\dt'   # senha: app
```



### Autenticação (Keycloak)

Realm `hospital` importado de `[keycloak/realm-export.json](keycloak/realm-export.json)` no boot do
container. Console admin em [http://localhost:8080](http://localhost:8080) (`admin`/`admin`). Usuários de teste (senha
`senha123`):


| Username         | Role          | Observação                                   |
| ---------------- | ------------- | -------------------------------------------- |
| `med.cardoso`    | `MEDICO`      | vinculado a pacientes no seed                |
| `est.almeida`    | `ESTAGIARIO`  | supervisionado por `med.cardoso`             |
| `pesq.souza`     | `PESQUISADOR` | dono de `PRJ01` (Diabetes, Aprovado)         |
| `med.semvinculo` | `MEDICO`      | caso negativo → `DENY` (sem vínculo no seed) |


Obter um JWT (password grant no client `hospital-loadtest`):

```bash
keycloak/get-token.sh med.cardoso        # imprime o access_token (TTL ~30 min)
# parametrizável: KC_HOST / KC_PORT / KC_REALM / KC_CLIENT
```

Detalhes dos claims em `[docs/contratos.md](docs/contratos.md)`. Para recriar o realm do zero:
`docker compose up -d --force-recreate keycloak`.

---



## Comandos (Makefile)


| Comando                                     | O que faz                                                                                       | Status   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| `make up`                                   | Sobe Postgres + Keycloak + os 4 serviços (reusa imagens)                                        | ✅        |
| `make down`                                 | Derruba o ambiente local (derruba o volume)                                                     | ✅        |
| `make logs`                                 | Segue os logs do ambiente local                                                                 | ✅        |
| `make cluster`                              | Cria kind (1 control-plane + 3 workers) + metrics-server + kube-prometheus-stack                | ✅        |
| `make cluster-down`                         | Deleta o cluster kind (`pspd`)                                                                  | ✅        |
| `make grafana`                              | Port-forward do Grafana em [http://localhost:3000](http://localhost:3000) (imprime user admin + senha do secret) | ✅        |
| `make seed`                                 | Semeia o **cluster** via Job k8s (`SCALE=50000`, `seed=42`, `COPY`) — ~50k pacientes, ~1–2M eventos | ✅        |
| `make seed-local`                           | Semeia o banco do **compose** (`localhost:5433`) via venv Python. `SCALE=` ajusta o volume     | ✅        |
| `make deploy`                               | Build das imagens + `kind load` + aplica `k8s/`                                                 | 🚧 D2/D5 |
| `make load SCENARIO=1replica|3replicas|hpa` | Bateria k6 (10/50/100/500/1000 VUs)                                                             | 🚧 D4/D5 |
| `make demo`                                 | Reproduz o esqueleto ambulante do zero                                                          | 🚧 D2    |
| `make help`                                 | Lista os alvos                                                                                  | ✅        |


Gradle:

```bash
./gradlew build            # compila, testa e gera os stubs proto de todos os módulos
./gradlew :proto:build     # gera só os stubs Java + gRPC do contrato
./gradlew projects         # lista os módulos do monorepo
```

---



## Contratos (mexeu, avise o grupo no mesmo dia)

1. **Dados** — `[db/schema.sql](db/schema.sql)`: 5 tabelas + índices.
2. **gRPC** — `[proto/hospital.proto](proto/hospital.proto)`: serviços Authorization / PatientData /
  DataTransform. Stubs gerados pelo módulo `:proto`.
3. **Identidade (JWT)** — `[docs/contratos.md](docs/contratos.md)`: claims `preferred_username` +
  `realm_access.roles ∈ {MEDICO, ESTAGIARIO, PESQUISADOR}`.

---



## Estado atual (Dia 1 — Fundação)

- ✅ Estrutura do repo + Gradle multi-project (`:proto` + 4 serviços) com wrapper.
- ✅ 3 contratos congelados; `:proto` gerando stubs Java + gRPC.
- ✅ `docker-compose.yml` (Postgres 16 + Keycloak) e `Makefile`.
- 🚧 Serviços ainda são **placeholders** (sem lógica) — próximo: scaffold Spring Boot (P-scaffold),
Keycloak realm (P-keycloak) e o **esqueleto ambulante** (D2, milestone M1).

Roadmap por dia (D1→D7) e Definition of Done: ver `[CLAUDE.md](CLAUDE.md)` e o
[roteiro](docs/Roteiro_PSPD_Observabilidade_K8S.md). Prompts prontos por tarefa em
`[docs/prompts.md](docs/prompts.md)`.

---



## Convenções

- **Evidências no ato:** todo print/CSV/gráfico vai para `docs/evidencias/` no mesmo dia.
- **Observabilidade com método:** métricas em **RED** (por serviço) + **USE** (por recurso); latência
em **P95/P99**, não só média.

