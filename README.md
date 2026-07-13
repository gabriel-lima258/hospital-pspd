# Hospital Universitário (PSPD/UnB)

Aplicação de **microsserviços** que expõe dados clínicos no padrão **HL7/FHIR** com controle de
acesso por perfil (Médico / Estagiário / Pesquisador). Trabalho acadêmico de **PSPD (FGA/UnB)** para
explorar **observabilidade e escalabilidade em Kubernetes**.

> **Novo no projeto?** Leia primeiro os **3 contratos congelados** em
> [`docs/contratos.md`](docs/contratos.md). O enunciado do trabalho está em
> [`docs/EnunciadoTrabalho.md`](docs/EnunciadoTrabalho.md) e o relatório em
> [`docs/RELATORIO.md`](docs/RELATORIO.md).

---

## O que o sistema faz

Uma requisição REST autenticada (JWT) chega ao Gateway e atravessa três serviços gRPC até virar um
recurso FHIR, respeitando o nível de acesso do perfil do usuário:

```
Frontend (React/Vite)
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

A **decisão** (ALLOW/DENY + nível) mora no `authorization` (domínio puro `AuthorizationPolicy` +
testes) e a **enforcement** no `data-transform` (`PatientAnonymizer`, `FhirTransformer`) — o nível
autorizado decide a forma da saída, não é anotação. Ver [`docs/contratos.md`](docs/contratos.md).


---



## Stack

Java 21 · Spring Boot (hexagonal) · **Gradle** (wrapper `./gradlew`) · gRPC
(`net.devh:grpc-spring-boot-starter`) · Spring Data JPA · Spring Security OAuth2 (só no Gateway) ·
Micrometer + Actuator (`/actuator/prometheus`) · **Keycloak** (OAuth2/OIDC) · **PostgreSQL 16**.
Cluster: **kind** · Observabilidade: **Prometheus + Grafana** · Logs agregados (extra): **Loki +
Promtail** (`make loki`) · Carga: **k6** · Tracing (extra): OpenTelemetry + Tempo.

---



## Pré-requisitos

- **JDK 21** (o Gradle é resolvido pelo wrapper — não precisa instalar Gradle)
- **Docker** + **Docker Compose v2**
- `psql` (cliente, opcional — para inspecionar o banco)
- Para as fases de cluster: `kubectl`, `kind`, `helm`, `k6`, `jq`, `python3`

---



## Estrutura do repositório

```
proto/            # contrato gRPC (fonte da verdade) — módulo Gradle :proto
db/               # schema.sql · seed.py · seed-min.sql
services/         # api-gateway · authorization · patient-data · data-transform
frontend/         # SPA React/Vite (real: OIDC + 3 jornadas; roda no cluster via k8s/base/frontend.yaml)
k8s/              # base/ (Deployments, Services, headless) · hpa/ · observability/ · jobs/
loadtest/         # k6/scenario.js, gen-tokens.sh, run-load-tests.sh, collect-metrics.sh, plot.py
keycloak/         # realm-export.json + get-token.sh
docs/             # enunciado, relatório, contratos, runbooks, evidências
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



### As 3 jornadas

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

Realm `hospital` importado de [`keycloak/realm-export.json`](keycloak/realm-export.json) no boot do
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

Detalhes dos claims em [`docs/contratos.md`](docs/contratos.md). Para recriar o realm do zero:
`docker compose up -d --force-recreate keycloak`.

---



## Comandos (Makefile)


| Comando                                     | O que faz                                                                                       | Status   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| `make up`                                   | Sobe Postgres + Keycloak + os 4 serviços (reusa imagens)                                        | ✅        |
| `make rebuild`                              | Recompila as imagens do compose e sobe (use após mexer em `services/**`)                        | ✅        |
| `make down`                                 | Derruba o ambiente local (derruba o volume)                                                     | ✅        |
| `make logs`                                 | Segue os logs do ambiente local                                                                 | ✅        |
| `make cluster`                              | Cria kind (1 control-plane + 3 workers) + metrics-server + kube-prometheus-stack                | ✅        |
| `make cluster-down`                         | Deleta o cluster kind (`pspd`)                                                                  | ✅        |
| `make grafana`                              | Port-forward do Grafana em [http://localhost:3000](http://localhost:3000) (imprime user admin + senha do secret) | ✅        |
| `make loki`                                 | **(bônus)** Loki + Promtail: agrega os logs JSON no Grafana; LogQL `\| json \| nivel="FULL"`    | ✅        |
| `make dashboard`                            | Importa o dashboard **RED/USE** no Grafana do kps (fase e da observabilidade)                   | ✅        |
| `make tracing` / `tracing-off`              | **(bônus)** Tempo + OTel agent: liga/desliga traces `REST→gRPC→SQL` no Grafana (trace→log)      | ✅        |
| `make seed`                                 | Semeia o **cluster** via Job k8s (`SCALE=50000`, `seed=42`, `COPY`) — ~50k pacientes, ~1–2M eventos | ✅        |
| `make seed-local`                           | Semeia o banco do **compose** (`localhost:5433`) via venv Python. `SCALE=` ajusta o volume     | ✅        |
| `make deploy`                               | Build das imagens (4 serviços + frontend) + `kind load` + aplica `k8s/base` e `k8s/observability` (**não** o HPA) | ✅        |
| `make redeploy`                             | Rebuild + `kind load` + `rollout restart` dos 4 serviços + frontend (obrigatório se o proto mudou) | ✅        |
| `make forward` / `make forward-stop`        | Sobe/derruba os 3 port-forwards do frontend real (keycloak:8080, gateway:9000, frontend:8088)   | ✅        |
| `make front`                                | Port-forward só do frontend em [http://localhost:8088](http://localhost:8088)                   | ✅        |
| `make scale N=3`                            | Fixa as réplicas dos 4 serviços e espera todas ficarem Ready                                    | ✅        |
| `make pods-wide`                            | `kubectl get pods -o wide` — distribuição dos pods entre os workers                             | ✅        |
| `make watch-hpa SCENARIO=hpa`               | Amostra réplicas/CPU dos 4 serviços num CSV. Rode **em background** durante a rampa do k6        | ✅        |
| `make grpc-lb-on`                           | gRPC balanceado: Service headless + `round_robin` (é o default)                                 | ✅        |
| `make grpc-lb-off`                          | gRPC pinado em 1 pod: ClusterIP + `pick_first` — o "antes" da descoberta de balanceamento (RELATORIO §9.3) | ✅        |
| `make hpa-on` / `make hpa-off`              | Aplica/remove o HPA (`k8s/hpa/`, min 1 / max 10 / CPU 60%)                                      | ✅        |
| `make demo`                                 | Deploy + seed enxuto + smoke das 3 jornadas. `DEMO_FRESH=1` recria o cluster do zero            | ✅        |
| `make load SCENARIO=1replica|3replicas-off|3replicas-on|hpa` | Bateria k6 (10/50/100/500/1000 VUs) — ver `loadtest/README.md`                  | ✅        |
| `make plot`                                 | Summaries do k6 → `docs/evidencias/resultados.csv` + PNGs                                       | ✅        |
| `make help`                                 | Lista os alvos                                                                                  | ✅        |


### Cenários de teste (usados pelo `make load`)

O `loadtest/run-load-tests.sh` prepara o cluster com estes alvos antes de cada bateria k6:


| Cenário                              | Comandos                                                     |
| ------------------------------------ | ------------------------------------------------------------ |
| `1replica`                           | `make hpa-off && make scale N=1`                             |
| `3replicas-off` (gRPC **sem** LB)    | `make grpc-lb-off && make hpa-off && make scale N=3`         |
| `3replicas-on` (gRPC balanceado)     | `make grpc-lb-on && make hpa-off && make scale N=3`          |
| `hpa`                                | `make grpc-lb-on && make scale N=1 && make hpa-on`           |


⚠️ Não rode `kubectl apply -f k8s/base` no meio de um cenário — recria o estado. E `make hpa-off`
**não** reseta a contagem de réplicas: sempre siga de `make scale N=`.

> **Por que `grpc-lb-off` existe.** Um `Service` ClusterIP resolve para **um** IP virtual. O cliente
> gRPC abre **uma** conexão HTTP/2 de longa duração e multiplexa tudo nela; o `kube-proxy` balanceia
> conexões, não requisições. Com 3 réplicas, **1 pod recebe ~100% da carga**. O
> `defaultLoadBalancingPolicy: round_robin` (já é o default do `net.devh` 3.1.0) não resolve — ele
> faz round-robin sobre a lista devolvida pelo DNS, e essa lista tem 1 elemento. O fix é o **Service
> headless** (`clusterIP: None`), em `k8s/base/grpc-headless.yaml`. `grpc-lb-off` reproduz o arranjo
> quebrado para que a descoberta de balanceamento (RELATORIO §9.3) tenha um "antes" medido.


Gradle:

```bash
./gradlew build            # compila, testa e gera os stubs proto de todos os módulos
./gradlew :proto:build     # gera só os stubs Java + gRPC do contrato
./gradlew projects         # lista os módulos do monorepo
```

---



## Contratos (mexeu, avise o grupo no mesmo dia)

1. **Dados** — [`db/schema.sql`](db/schema.sql): 5 tabelas + índices.
2. **gRPC** — [`proto/hospital.proto`](proto/hospital.proto): serviços Authorization / PatientData /
  DataTransform. Stubs gerados pelo módulo `:proto`.
3. **Identidade (JWT)** — [`docs/contratos.md`](docs/contratos.md): claims `preferred_username` +
  `realm_access.roles ∈ {MEDICO, ESTAGIARIO, PESQUISADOR}`.

---



## Documentação (`docs/`)

| Documento | Conteúdo |
|---|---|
| [`docs/EnunciadoTrabalho.md`](docs/EnunciadoTrabalho.md) | Especificação do professor (o que é avaliado) |
| [`docs/RELATORIO.md`](docs/RELATORIO.md) | **Relatório do trabalho** — metodologia, cluster, as 5 fases medidas, descobertas, extras |
| [`docs/contratos.md`](docs/contratos.md) | Os 3 contratos congelados: JWT/roles, gRPC (`proto/`), dados (`db/schema.sql`) + decisões de projeto |
| [`docs/RUNBOOK-carga-hpa.md`](docs/RUNBOOK-carga-hpa.md) | Passo-a-passo das baterias k6 + capturas de escala/HPA |
| [`docs/RUNBOOK-frontend.md`](docs/RUNBOOK-frontend.md) | Passo-a-passo do frontend real (OIDC + gateway no cluster) |
| [`docs/RUNBOOK-consultas-nomeadas.md`](docs/RUNBOOK-consultas-nomeadas.md) | Validação das consultas nomeadas do enunciado via `curl` |
| [`docs/evidencias/`](docs/evidencias/README.md) | Evidências brutas: saídas de comando, prints, CSVs (índice no README da pasta) |

---



## Convenções

- **Evidências no ato:** todo print/CSV/gráfico vai para `docs/evidencias/` no mesmo dia.
- **Observabilidade com método:** métricas em **RED** (por serviço) + **USE** (por recurso); latência em **P95/P99**, não só média.

---

## 💻 Frontend (React / TypeScript / Vite)

O frontend do Hospital PSPD foi totalmente implementado contendo todas as regras de controle de acesso demográfico, consultas individuais e agregadas, e um design moderno.

### Como Instalar
1. Navegue até a pasta do frontend:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```

### Como Executar
- **Modo Desenvolvimento (com Hot-Reload):**
  ```bash
  npm run dev
  ```
- **Compilar para Produção:**
  ```bash
  npm run build
  ```

### Variáveis de Ambiente (`frontend/.env` — já versionado com o modo real)
```env
VITE_API_GATEWAY_URL=http://localhost:9000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=hospital
VITE_KEYCLOAK_CLIENT_ID=hospital-frontend
VITE_DEMO_MODE=false
```
> **Nota:** para o modo demonstração (mockData local, sem backend), copie `frontend/.env.demo` para
> `frontend/.env.local`. O fluxo **real** (Keycloak + gateway no cluster, com port-forwards) está
> passo-a-passo em [`docs/RUNBOOK-frontend.md`](docs/RUNBOOK-frontend.md).

### Fluxo de Autenticação
O sistema implementa o fluxo de autenticação **OAuth2 / OIDC** via Keycloak:
1. Ao carregar a aplicação, o `AuthProvider` inicializa o cliente do Keycloak (`keycloak-js`).
2. Se o usuário não estiver autenticado e o `VITE_DEMO_MODE` estiver desligado, o sistema redireciona automaticamente para a página de login do Keycloak.
3. Após o login bem-sucedido, o token de acesso (JWT) e as claims são salvas e o usuário é redirecionado para o Dashboard.
4. O frontend injeta automaticamente o token `Authorization: Bearer <token>` em todas as requisições HTTP feitas via Axios.
5. Um timer em background monitora o tempo de expiração do token (lido do campo `exp` do JWT) e realiza silent updates / refreshes a cada segundo, atualizando a contagem regressiva da sessão no layout.

### Estrutura de Pastas do Frontend
```
frontend/src/
├── components/          # Componentes reutilizáveis
│   ├── fhir/            # Visualizador de JSON FHIR
│   ├── patient/         # Componentes do prontuário (PatientCard, FilterPanel)
│   └── ui/              # Componentes de base (DataTable, ExportButton, Modals, Toasts)
├── context/             # Provedores de contexto (AuthContext, ThemeContext, ToastContext)
├── hooks/               # Custom React hooks (useLocalStorage)
├── lib/                 # Adapters FHIR→UI (cohort.ts: MeasureReport/Bundle → domínio)
├── layouts/             # Template da página principal (DashboardLayout)
├── pages/               # Páginas da aplicação (Dashboard, Patients, Profile, Settings)
├── routes/              # Configurações de rotas protegidas (ProtectedRoute)
├── services/            # Serviços de API e Configurações (api.ts, keycloak.ts, mockData.ts)
├── types/               # Tipagens TypeScript (fhir.ts)
├── utils/               # Utilitários auxiliares (history.ts, utils.ts)
├── views/               # Telas compostas (prontuário, coorte)
└── index.css            # Estilos globais e suporte ao Dark Mode
```

### Funcionalidades Implementadas
- 🔑 **Login completo via Keycloak:** Com silent login, auto-refresh e proteção de rotas (Protected Routes).
- 📊 **Dashboard Moderno:** KPIs e múltiplos gráficos (Recharts) interativos com opção de zoom e exportação.
- 👥 **Listagem e Prontuários:** Tabela avançada de pacientes com paginação e ordenação local, e busca instantânea.
- 🎛️ **Filtros Avançados:** Filtro por sexo, idade, cidade, estado, diagnóstico, medicamentos e datas integrado à URL.
- 📑 **Detalhamento do Paciente:** Abas (Resumo Clínico, Histórico, Exames, Medicamentos, Consultas, FHIR) carregadas sob demanda.
- 🌳 **Visualizador HL7/FHIR:** Árvore JSON interativa, colapsável, com sintaxe colorida, pesquisa de termos e cópia/download.
- 💾 **Exportações:** Exportação completa de tabelas e prontuários para PDF, CSV, JSON e Excel (XLSX).
- ⭐ **Favoritos & Histórico:** Sistema de favoritos locais e catálogo automático de histórico de buscas efetuadas.
- 🌓 **Tema Claro/Escuro:** Sincronizado e persistido localmente via local storage com suporte nativo em CSS.


