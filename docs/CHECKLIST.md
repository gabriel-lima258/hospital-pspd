# ✅ CHECKLIST DE ENTREGA — Hospital Universitário (PSPD/UnB)

> **Painel de controle único** do projeto: o que já foi feito, o que falta, e como cada item pesa na
> **nota** (80% técnico + profundidade · 20% entregas · ➕ ponto extra). Atualize à medida que avança.
>
> **Fontes da verdade:** [`CLAUDE.md`](../CLAUDE.md) · roteiro
> [`docs/Roteiro_PSPD_Observabilidade_K8S.md`](Roteiro_PSPD_Observabilidade_K8S.md) (§3 cronograma,
> §5 métricas, §7 descobertas, §9 entrega, **Apêndice A** portões 0–7).
>
> **Última atualização:** 2026-07-09 · **Fase atual:** **D4 / M3** (observabilidade + 1ª bateria de carga).
> O **M2 fechou**: P3a ✅ fonte de dados de coorte · P3b ✅ enforcement por nível + FHIR completo ·
> P3c ✅ rota REST de coorte — as **3 jornadas** (médico/FULL, estagiário/PARTIAL, pesquisador/AGG+ANON)
> validadas ponta-a-ponta no cluster. Daqui em diante a nota vem de **números medidos**.

**Legenda:** ✅ feito · 🟡 parcial · ⬜ a fazer · ➕ bônus (ponto extra) · 🔴 crítico
**Donos:** cada item pendente começa com o nome do responsável — ver a divisão de trilhas no §0.
**Regra de ouro:** _números medidos > features bonitas_ (proteja as 5 fases medidas acima de tudo).

---

## 0. Divisão do trabalho (5 trilhas, §2.1 do roteiro)

Cinco trilhas desenhadas para **minimizar dependências cruzadas**. Cada aluno apresenta a sua no
vídeo (§9.4) — o enunciado avalia "percepção de equilíbrio na distribuição de tarefas".

| Dono | Trilha (§2.1) | Responsável por | Status |
|---|---|---|:--:|
| **Arthur** | (A) Plataforma / K8S / DevOps | cluster, manifests, **HPA**, **gRPC headless + round_robin**, `Makefile` (`demo`, `load`) | 🟡 |
| **Mateus** | (B) Backend Core — Gateway + Auth | rate limiting, logging estruturado, erro gRPC→HTTP, probes, `authorization` | 🟡 |
| **Gabriel** | (C) Backend Dados | patient-data, data-transform, **P3c**, guarda dos portões | ✅ |
| **Carlos** | (D) Dados & Carga (Performance) | k6, `collect-metrics.sh`, `plot.py`, CSVs, gráficos, **as 3 descobertas §7**, `db/` | ⬜ |
| **Guilherme** | (E) Frontend + Observabilidade viz + **entrega** | frontend React, **dashboards Grafana RED/USE**, `keycloak/`, tracing ➕, **relatório §9 + zip** | ⬜ |

> **Relatório:** cada trilha **escreve a sua seção** (é o que cada um apresenta no vídeo);
> o **Guilherme consolida** na estrutura §9.6, fecha as conclusões e entrega o zip no Moodle.

### Herança do trabalho já feito

O código pronto atravessa trilhas. Quem **assume** cada peça é dono de **evoluí-la e apresentá-la**;
o Gabriel faz o *handoff* (o commit é histórico, a responsabilidade não).

| Peça pronta | Construída por | Passa a ser de | Por quê |
|---|---|---|---|
| `authorization/` (matriz + testes) | Gabriel | **Mateus** | é Trilha B; ele evolui com rate limit/logging e apresenta o DENY no vídeo |
| `db/schema.sql`, `db/seed.py` | Gabriel | **Carlos** | é Trilha D; o seed é a base dos testes de carga que ele vai rodar |
| `k8s/base/`, `k8s/observability/` | Gabriel | **Arthur** | é Trilha A; ele adiciona HPA e o fix de gRPC LB |
| `keycloak/` (realm, get-token) | Gabriel | **Guilherme** | é Trilha E; o frontend usa o client `hospital-frontend` do mesmo realm |
| `patient-data/`, `data-transform/` | Gabriel | **Gabriel** | é Trilha C — permanece com ele |

> ⚠️ **Risco de distribuição:** o Gabriel adiantou muito código fora da Trilha C. Sem o handoff
> acima, Mateus/Carlos/Arthur chegam ao vídeo sem ter o que mostrar como seu. **Cada um deve fazer
> pelo menos um commit substantivo na peça herdada** antes do D7.

### Caminho crítico (quem não pode atrasar)

⭐ **Arthur** e **Carlos** carregam os **80%** da nota: sem `round_robin` + HPA não há o que medir;
sem k6 + gráficos não há número medido. Se o prazo apertar, o grupo inteiro ajuda os dois — e o
**frontend do Guilherme é o primeiro a cortar** (§ordem de corte).

**Dependência dura:** **Arthur** precisa entregar o `round_robin` **antes** de **Carlos** rodar a bateria de 3 réplicas
(senão mede-se o gRPC grudado em 1 pod, não a arquitetura).

---

## 1. Placar geral (D1 → D7)

| Dia | Tema | Milestone | Status | Onde estamos |
|---|---|---|:--:|---|
| **D1** | Fundação (contratos, cluster, scaffolds) | **M1a** | ✅ | Cluster 1+3, 3 contratos, Keycloak, 4 scaffolds |
| **D2** | Esqueleto ambulante ponta a ponta | **M1** 🔴 | ✅ | FHIR real no cluster + métrica no Grafana |
| **D3** | Engordar serviços + seed em volume | **M2** | ✅ | Seed ✅ + authz ✅ + enforcement ✅ + **3 jornadas REST** ✅ |
| **D4** | Observabilidade + 1ª bateria de carga | **M3** | ⬜ ← **AQUI** | Dashboards + carga 1 réplica (10→1000 VUs) |
| **D5** | Escalabilidade horizontal + HPA | **M4** | ⬜ | 3 réplicas + HPA medidos; fix gRPC LB antes |
| **D6** | Ponto extra + reteste + análise | **M5** | ⬜ ➕ | Tracing OTel+Tempo + todos os cenários |
| **D7** | Relatório + gráficos + vídeo | **M6** | ⬜ | Entrega no Moodle (zip) |

**Progresso por fase metodológica** (§9.5 do roteiro):

| Fase | | Status |
|---|---|:--:|
| (a) Validação funcional | `██████████` 3 jornadas end-to-end no cluster | ✅ |
| (b) Testes de carga (10/50/100/500/1000 VUs) | `░░░░░░░░░░` | ⬜ |
| (c) Escalabilidade horizontal (1→3 réplicas) | `░░░░░░░░░░` | ⬜ |
| (d) Autoscaling (HPA min1/max10) | `░░░░░░░░░░` | ⬜ |
| (e) Observabilidade (≥5 métricas, RED+USE) | `███░░░░░░░` scrape ok, sem dashboard | 🟡 |

---

## 2. Checklist por PORTÃO (Apêndice A) — o núcleo

### 🚦 Portão 0 — Máquina pronta ✅
- [x] Ferramentas: Docker, kind, kubectl, helm, JDK 21, k6, Python3+psycopg2/faker, jq
- [x] Recursos adequados (cluster kind `pspd` rodando 1CP+3workers)
- [ ] **Arthur** `grpcurl` **não instalado** no host → contornado via container `fullstorydev/grpcurl` (ok p/ testes)

### 🚦 Portão 1 = M1a — Fundação (D1) ✅
- [x] `kubectl get nodes` → **4 nós Ready** (1 control-plane + 3 workers) · `k8s/kind-config.yaml`
- [x] Grafana abre (`make grafana`) + kube-prometheus-stack instalado (`make cluster`)
- [x] Keycloak emite JWT `med.cardoso`/MEDICO · `keycloak/realm-export.json` + `get-token.sh`
- [x] 4 serviços sobem local (`make up`) e respondem `/actuator/health`
- [x] `db/schema.sql` (5 tabelas + índices) e `proto/hospital.proto` congelados e commitados
- [x] Contrato de JWT documentado · [`docs/contratos.md`](contratos.md)

### 🚦 Portão 2 = M1 — Esqueleto ambulante (D2) 🔴 ✅
- [x] Gateway valida JWT (sem token→401, válido→200) · `SecurityConfig` (lazy `JwtDecoder`)
- [x] Cadeia gRPC Gateway→Authorization→PatientData→DataTransform · `FhirPatientController`
- [x] `curl` autenticado → `GET /fhir/Patient/P000001` → **do Postgres**. _Desde o P3b a rota devolve um `Bundle` FHIR; o smoke check virou `jq -r '.entry[].resource.resourceType' \| grep -q '^Patient$'`_
- [x] Caso negativo `med.semvinculo` → **403**
- [x] 4 targets **UP** no Prometheus · `k8s/observability/servicemonitor.yaml`
- [x] Métrica `http_server_requests_seconds_count{application="api-gateway"}` visível no Grafana
- [ ] **Guilherme** 🟡 **PNG do Grafana** ainda **manual** (automação de browser não alcançou o port-forward) · ver `docs/evidencias/README.md`
- [ ] **Arthur** `make demo` reproduz do zero (**stub** — TODO)
- 📎 Evidências: `docs/evidencias/{seed-volume-cluster.md, *http_server_requests*.json}`

### 🚦 Portão 3 = M2 — Validação funcional, Fase (a) (D3) ✅
- [x] Seed em **volume-alvo** no cluster (Job): patients **50.000**, clinical_events **1.387.934** · `db/seed.py` + `k8s/jobs/seed-job.yaml` + `make seed`
- [x] `SELECT count(*)` bate com o esperado · `docs/evidencias/seed-volume-cluster.md`
- [x] **Decisão** de autorização completa (MEDICO→FULL, ESTAGIARIO→PARTIAL, PESQUISADOR→ANON/AGG) · `authorization/domain/AuthorizationPolicy` + testes JUnit ✅
- [x] Negações: médico sem vínculo → DENY; **projeto Expirado → DENY**; dono errado/inexistente → DENY · `docs/evidencias/authz-matriz-completa.md`
- [x] **(P3a) Fonte de dados de coorte/agregação** em `patient-data` — `Fetch` ramifica por `tipo_consulta`: individual (demográficos + encounters/conditions/observations/medications), `ResumoCoorte`/`Estatisticas` (total, %sexo/faixa/setor, mediaHbA1c, freqMedicamentos) e `ExamesCoorte` (amostra de 100, ainda identificada) · `PatientRepository` + `domain/Percentages` (JUnit ✅) · `docs/evidencias/patient-data-coorte.md`
- [x] **(P3b) Estagiário vê PARTIAL de verdade** — `name` vira `"J. da S."`, **sem** CPF/CNS, `birthDate: "1980"`; recursos clínicos preservados · `PatientAnonymizer` (37 testes JUnit ✅)
- [x] **(P3b) Conversão HL7/FHIR completa** — `Bundle` com Patient/Encounter/Condition/Observation/MedicationRequest; AGGREGATED vira `MeasureReport` · `FhirTransformer`, `FhirResourceMapper`
- [x] **(P3b/P3c) Pesquisador vê AGG/ANON de verdade** — ANONYMIZED pseudonimiza (sha256 salgado, estável) e trunca datas ao ano; AGGREGATED devolve `MeasureReport` sem dado individual. Validado **pela rota REST** no P3c
- [x] **(P3c) Rota REST de coorte no gateway** — `GET /fhir/cohort/{projetoId}?tipo=…` · `FhirCohortController` + `JwtRoles` · `projeto_id` → `codigo_condicao` resolvido **no Authorization** (`AuthzReply.coorte_codigo`, campo aditivo) · erros 400/403/404/502
- [x] **(P3c) Coorte vem do servidor, não do cliente** — o `coorte_codigo` só existe no `AuthzReply` do projeto validado; a rota não expõe parâmetro de coorte. `AuthorizationGrpcServiceTest` (4 testes JUnit) prova que DENY e perfil não-pesquisador recebem `""`
- [x] **(P3c) Fixtures negativos do seed**: `PRJ02` Expirado → 403 · `PRJ04` de outro dono → 403 · `PRJ03` (Aprovado, condição `Rara` sem pacientes) → **404**
- [x] **As 3 jornadas validadas ponta-a-ponta no cluster** — médico/FULL ✅ · estagiário/PARTIAL ✅ · pesquisador/AGGREGATED+ANONYMIZED ✅, todas pela REST
- [x] **Mudança de contrato comunicada** — `AuthzReply + coorte_codigo = 3` (aditiva, retrocompatível), registrada no log de [`docs/contratos.md`](contratos.md)
- [ ] **Guilherme** Seção "Validação funcional" do relatório escrita com prints (insumo pronto em `docs/evidencias/`)
- 📎 Evidências: `docs/evidencias/{patient-data-coorte.md, data-transform-niveis.md, pesquisador-coorte.md}`

### 🚦 Portão 4 = M3 — Observabilidade + carga 1 réplica, Fases (e)+(b) (D4) ⬜
- [ ] **Guilherme** Dashboard Grafana **RED + USE**, **≥5 métricas** ao vivo (JSON versionado + screenshot)
- [ ] **Mateus** **Rate limiting** no Gateway (exigido pelo enunciado; hoje inexistente) · `api-gateway`
- [ ] **Mateus** **Logging estruturado** (JSON) com `username`/`role`/`nivel`/`patient_id` — alimenta a auditoria e o tracing ➕
- [ ] **Mateus** **Erro gRPC→HTTP**: hoje qualquer `onError` vira 500. `INVALID_ARGUMENT`→400, `NOT_FOUND`→404 (paciente inexistente hoje estoura 500)
- [ ] **Mateus** Probes _dependency-aware_ (readiness checa o DB)
- [ ] **Mateus** + **Guilherme** Pool de **JWTs pré-gerados** (`loadtest/**/tokens.json`, TTL ~30 min) — Keycloak fora do caminho da carga
- [ ] **Carlos** + **Mateus** `loadtest/k6/scenario.js` (mix dos 3 perfis) + `warmup.sh` + `reset-state.sh` — **Mateus** define as rotas, **Carlos** o perfil de carga
- [ ] **Carlos** `make load SCENARIO=1replica` roda os **5 níveis (10/50/100/500/1000 VUs)** (`make load` é **stub**)
- [ ] **Carlos** `collect-metrics.sh` → `resultados.csv` (throughput, latência méd+**p95/p99**, CPU, mem, erro, db_tps)

### 🚦 Portão 5 = M4 — Escalabilidade + HPA, Fases (c)+(d) (D5) ⬜
- [ ] **Arthur** 🔴 **Fix gRPC LB ANTES de medir**: Service **headless** + `defaultLoadBalancingPolicy: round_robin` (hoje ClusterIP, gruda em 1 pod) — **bloqueia **Carlos****
- [ ] **Carlos** `make load SCENARIO=3replicas` (3 réplicas) medido nos 5 níveis; comparação vs 1 réplica
- [ ] **Arthur** Distribuição de pods entre os 3 workers (`kubectl get pods -o wide`, screenshot)
- [ ] **Arthur** **HPA** v2 aplicado (min 1 / max 10 / CPU 60%) — **manifesto ausente** (`requests.cpu` já pronto)
- [ ] **Arthur** `kubectl get hpa` mostra `%/60%` (não `<unknown>`); escala automática evidenciada no tempo
- [ ] **Carlos** **Limite de escalabilidade** identificado (satura no Postgres) + impacto no banco documentado (USE)

### 🚦 Portão 6 = M5 — Ponto extra + reteste + análise (D6) ⬜ ➕
- [ ] **Guilherme** ➕ Tracing distribuído: OTel Java agent nos 4 serviços + **Tempo** (trace multi-serviço)
- [ ] **Guilherme** ➕ `postgres-exporter` (métricas do banco no Prometheus)
- [ ] **Carlos** Todos os cenários (1replica/3replicas/hpa) coletados sob condições idênticas (§4.9)
- [ ] **Carlos** `loadtest/plot.py` gera todos os gráficos comparativos → `docs/evidencias/*.png`
- [ ] **Guilherme** Conclusões por fase rascunhadas (consolida o que cada trilha mediu)

### 🚦 Portão 7 = M6 — Entrega (D7) ⬜
- [ ] **Guilherme** Relatório completo na estrutura §9.6 — **consolida** as seções que cada trilha escreveu
- [ ] **todos** Cada dono entrega a seção da sua trilha ao Guilherme (Arthur: cluster/HPA · Mateus: regras de acesso · Gabriel: dados/FHIR · Carlos: carga/descobertas · Guilherme: arquitetura/observabilidade)
- [ ] **todos** Vídeo (~4–6 min/aluno, todos aparecem, 5 trilhas apresentadas)
- [ ] **Arthur** `make demo` reproduz do zero, limpo
- [ ] **Guilherme** Zip no Moodle + código no GitHub com link no relatório
- [ ] **todos** Checklist §9 100% marcado + autoavaliação por membro (com nota)

**Roteiro do vídeo** (§9.4 — 5 alunos × 4–6 min; cada um abre com _"sou responsável por X, vou mostrar Y funcionando"_):

| Bloco | Aluno | Mostra na tela |
|---|---|---|
| 1. Abertura + arquitetura | **Guilherme** | login no frontend, JWT com role, jornada médico × pesquisador |
| 2. Backend e regras de acesso | **Mateus** | REST→gRPC, validação de JWT, ALLOW+FULL e os **DENY** (sem vínculo, projeto expirado) |
| 3. Dados, SQL e FHIR | **Gabriel** | coorte/agregações, PARTIAL × ANONYMIZED, os 5 recursos FHIR, volume do seed |
| 4. Cluster, escala e HPA | **Arthur** | 4 nós, `kubectl scale` 1→3, **HPA criando pods ao vivo** (`get hpa -w`) |
| 5. Carga, métricas e descobertas | **Carlos** | k6 rodando, Grafana ao vivo, gráficos comparativos, as **3 descobertas §7** |

---

## 3. Estado dos componentes (real × esperado)

| Componente | Dono | Estado | Veredito | Ponteiro |
|---|:--:|:--:|---|---|
| **api-gateway** | **Mateus** | 🟡 | JWT real + cadeia gRPC + **2 rotas** (prontuário e coorte); falta rate-limit/logging e o erro gRPC→HTTP **global** (a rota de coorte já mapeia 400/403/404/502 localmente) | `FhirPatientController`, `FhirCohortController`, `SecurityConfig` |
| **authorization** | **Mateus** | ✅ | **Completo**: domínio puro + repos + gRPC + 20 testes JUnit; resolve a coorte do projeto (P3c) | `authorization/domain/*`, `adapters/*` |
| **patient-data** | **Gabriel** | ✅ | **Completo** (P3a): prontuário individual + agregação de coorte + amostra de exames; testes JUnit | `PatientRepository`, `domain/Percentages` |
| **data-transform** | **Gabriel** | ✅ | **Completo** (P3b): enforcement por `nivel` + 5 recursos FHIR + `MeasureReport`; 37 testes JUnit | `domain/FhirTransformer`, `domain/PatientAnonymizer` |
| **db** | **Carlos** | ✅ | schema (5 tabelas+índices), seed volume + seed-min, fixtures negativos (`PRJ02`/`PRJ03`/`PRJ04`) | `db/*` |
| **keycloak** | **Guilherme** | ✅ | realm + roles + 4 usuários + get-token | `keycloak/*` |
| **k8s/base** | **Arthur** | ✅ | 6 Deployments/Services, `requests.cpu` setado | `k8s/base/*` |
| **k8s/observability** | **Guilherme** | 🟡 | só ServiceMonitor; **sem dashboard JSON** | `k8s/observability/servicemonitor.yaml` |
| **HPA** | **Arthur** | ⬜ | manifesto ausente (`requests.cpu` já pronto) | `k8s/base/hpa.yaml` (a criar) |
| **Services gRPC** | **Arthur** | 🟡 | ClusterIP normal — **sem headless + round_robin** (não balanceia) | `k8s/base/*.yaml`, gateway `application.yml` |
| **loadtest** | **Carlos** | ⬜ | vazio (só `.gitkeep`) | `loadtest/` |
| **frontend** | **Guilherme** | ⬜ | vazio (só `.gitkeep`) — **obrigatório mínimo** (§9.1: login OIDC + 3 consultas), mas P2 e 1º a cortar | `frontend/` · client `hospital-frontend` no realm |
| **tracing (OTel+Tempo)** | **Guilherme** | ⬜ ➕ | inexistente (bônus) | — |
| **Makefile** | **Arthur** | 🟡 | reais menos `load`/`demo` (stubs); `rebuild` no `.PHONY` sem corpo | `Makefile` |

---

## 4. Backlog priorizado até a entrega (o "o que falta" acionável)

> Ordem por impacto na nota. ⭐ = **caminho crítico dos 80%** (fases medidas com números).
> O emoji no início é o **dono** (§0).

> ~~1. **Gabriel** · (P3c) Fechar o M2 — rota de coorte do pesquisador~~ ✅ **feito** — `AuthzReply.coorte_codigo`
> + `FhirCohortController`; as 3 jornadas validadas no cluster (`docs/evidencias/pesquisador-coorte.md`).
> **O caminho crítico agora é a fase (b): carga.**

1. **Arthur** · **⭐🔴 gRPC round_robin** _(Portão 5, mas pré-requisito de qualquer carga com réplicas)_ — Service headless (`clusterIP: None`) + `defaultLoadBalancingPolicy: round_robin` no client. **Bloqueia o item 4 do Carlos.**
2. **Carlos** · **⭐🔴 loadtest + `make load`** _(Portão 4)_ — `scenario.js`, `run-load-tests.sh`, pool `tokens.json`, `collect-metrics.sh`; rodar `1replica`. **Agora destravado** (as 3 rotas do cenário existem).
3. **Arthur** · **⭐ HPA** _(Portão 5)_ — `k8s/base/hpa.yaml` (autoscaling/v2, min1/max10, CPU 60%).
4. **Carlos** · **⭐ 3replicas + HPA medidos** _(Portão 5)_ — as duas baterias restantes. **Depende do item 1 (Arthur).**
5. **Guilherme** · **⭐ Dashboards RED/USE** _(Portão 4)_ — JSON versionado + ≥5 métricas + screenshots.
6. **Carlos** · **⭐ `plot.py` + CSVs → PNGs** _(Portão 6)_ — gráficos comparativos.
7. **Guilherme** · **➕ Tracing (OTel + Tempo)** _(Portão 6)_ — melhor ROI de bônus.
8. **Mateus** · **Gateway maduro** _(Portão 4)_ — rate limiting + logging estruturado + erro gRPC→HTTP **global** via `@ControllerAdvice` (hoje `/fhir/Patient/{id}` ainda transforma qualquer `onError` em 500: paciente inexistente devolve 500, não 404; o `INVALID_ARGUMENT` do data-transform vira 500, não 400). A rota de coorte já faz isso localmente — usar como referência e **não** regredir os 400/403/404/502 dela; readiness que checa o DB.
9. **Guilherme** · **frontend mínimo** _(§9.1 / §9.7 · Portão 3+7)_ — **obrigatório, mas mínimo e P2** (baixo valor isolado; **primeiro a cortar** sob pressão — ordem de corte §R9: frontend rico → FHIR 100% → cenários extras).
   - **Objetivo:** 1 SPA enxuta que autentica via **OAuth2/OIDC no Keycloak** (client `hospital-frontend`, Standard Flow) e faz as **3 consultas** (médico→FULL, estagiário→PARTIAL, pesquisador→coorte), renderizando conforme o nível retornado.
   - **Arquivos-alvo:** `frontend/` (hoje só `.gitkeep`) · client `hospital-frontend` já existe no `keycloak/realm-export.json` (`redirectUris`/`webOrigins` = `http://localhost:*`).
   - **DoD:** loga com `med.cardoso`/`est.almeida`/`pesq.souza`, envia `Authorization: Bearer` ao gateway, mostra as 3 respostas (inclusive um DENY→403). Serve principalmente ao **vídeo/demo (D7)**, não aos pontos técnicos.
   - **Destravado:** o M2 fechou. As 3 rotas existem: `GET /fhir/Patient/{id}` (médico/estagiário) e `GET /fhir/cohort/{projetoId}?tipo=ResumoCoorte|ExamesCoorte` (pesquisador).
10. **Arthur** · **`make demo`** _(Portão 2/7)_ — reprodução ponta-a-ponta.
11. **Guilherme** · **Relatório §9 + vídeo** _(Portão 7)_ — escrever incrementalmente, não deixar p/ o fim. Cada trilha entrega a sua seção; **o Guilherme consolida** e entrega.

---

## 5. As 3 descobertas do §7 (garantem os 80% — documentar com evidência)

- [ ] **Carlos** **§7.1 — PostgreSQL como gargalo (stateful)** ⭐ _principal_ — throughput satura ao escalar app;
  evidência USE: CPU do Postgres ~100%, `hikaricp_connections_pending > 0`, timeouts, `db_tps` no platô.
  _Insumo já colhido: o Seq Scan de 425 ms em `freqMedicamentos` (§7 abaixo)._
- [ ] **Arthur** **§7.2 — HPA × cold-start da JVM** — pod novo leva 20–40s p/ ficar Ready → latência piora antes de melhorar.
- [ ] **Arthur** + **Carlos** **§7.3 — gRPC sobre Service não balanceia** — HTTP/2 multiplexa 1 conexão → 1 pod recebe ~100%;
  **Arthur** faz o fix, **Carlos** mede **antes e depois** do `round_robin` (a medição do "antes" precisa acontecer **antes** do fix).

## 6. Métricas mínimas exigidas (§5 / §9.5) — status ⬜

- [ ] **Carlos** Carga **≥4**: throughput · latência **média + P95/P99** · CPU/serviço · memória/serviço · taxa de erro
- [ ] **Guilherme** Observabilidade **≥5**, organizadas em **RED** (Rate/Errors/Duration por serviço) + **USE** (Utilization/Saturation/Errors por recurso) + Golden Signals
- [ ] **Carlos** Percentis **P95/P99, não média** (histograma já habilitado no `application.yml`)

---

## 7. Dívida técnica & riscos

- ~~**Enforcement de nível ausente**~~ ✅ **fechado no P3b** — o nível decide a forma da saída; estagiário vê iniciais sem CPF/CNS, pesquisador vê pseudônimo/`MeasureReport`. `docs/evidencias/data-transform-niveis.md`.
- ~~**Fallback de compat no `FhirPatientMapper`**~~ ✅ **removido no P3b** (a classe foi absorvida pelo `PatientAnonymizer`).
- **Sal da pseudonimização é constante no código** 🟡 — `Pseudonymizer.SALT` deveria vir de um Secret. Sem sal, `sha256(id)` sobre `P000001..P050000` cai numa rainbow table em milissegundos. Aceitável no skeleton acadêmico; **citar no relatório**.
- **ANONYMIZED trunca datas clínicas ao ano** — decisão deliberada: a sequência exata de timestamps de exames é quasi-identificador. Custo: perde-se análise longitudinal fina.
- **`freqMedicamentos` conta prescrições, não pacientes** — escolha deliberada p/ a soma fechar 100% (por paciente somaria 225%: um diabético usa vários fármacos). Documentado em `docs/evidencias/patient-data-coorte.md`.
- **Sem índice em `clinical_events(tipo_evento)`** — a agregação de medicamentos faz Seq Scan (~425 ms em 1,36M linhas). É **insumo do §7.1**, não bug: `schema.sql` é contrato congelado. Mitigação (`ix_events_pac_tipo`) documentada, não aplicada.
- **`JwtRoles.extractRole` pega a *primeira* role conhecida** 🟡 — a ordem de `realm_access.roles` não é garantida, então um usuário com duas roles do domínio (ex.: MEDICO + PESQUISADOR) pode ser roteado pela errada. **Não é escalonamento** (o ALLOW ainda exige vínculo ou projeto), mas é arbitrário. Fix natural: escolher a role pelo tipo de rota, ou rejeitar tokens multi-role.
- **Erro gRPC→HTTP só na rota de coorte** 🟡 — `FhirCohortController` mapeia 400/403/404/502; `/fhir/Patient/{id}` ainda devolve 500 genérico. Fecha no item 8 do backlog (**Mateus**).
- **gRPC pin em 1 pod** — até o `round_robin`, testes com réplicas não mostram escala.
- **PNG do Grafana manual** — automação de browser não alcança o port-forward local; capturar à mão.
- **`make demo` / `rebuild`** — pendentes (stub / `.PHONY` sem corpo).
- **Postgres 1 réplica = gargalo esperado** — é **feature** p/ a descoberta §7.1, **não** bug. Não "consertar"; medir e documentar.
- **Distribuição desigual do trabalho** 🔴 — o **Gabriel** adiantou código de 4 trilhas (authorization=B, seed=D, k8s=A, keycloak=E). O enunciado avalia **"percepção de equilíbrio na distribuição de tarefas"**, e o vídeo expõe quem fez o quê. Mitigação: o *handoff* do §0 + **cada dono faz ao menos um commit substantivo** na peça herdada antes do D7.
- **Dependência Arthur → Carlos** 🔴 — sem o `round_robin` do Arthur, a bateria de 3 réplicas do Carlos mede o gRPC grudado em 1 pod. Mas a medição do **"antes"** do §7.3 precisa ser colhida **antes** do fix — combinar a ordem, não improvisar.
- **Prazo: 1 semana** — priorizar trilhas **A (K8S), C (dados/transform), D (carga)** — são os 80% (§2.1). Frontend rico e FHIR 100% são os primeiros cortes (§ ordem de corte).

---

## 8. Entregáveis finais (§9.7) e mapa da nota

| Peso | Item | Status | Observação |
|---|---|:--:|---|
| **80%** técnico+profundidade | 5 fases medidas com números reais | 🟡→⬜ | (a) parcial; (b)(c)(d)(e) pendentes — **prioridade máxima** |
| | 3 descobertas §7 documentadas | ⬜ | dependem da carga |
| | RED+USE+Golden Signals, P95/P99 | ⬜ | rigor estatístico = profundidade |
| **20%** entregas | Relatório §9.6 estruturado | ⬜ | **Guilherme** consolida; cada trilha escreve a sua seção, incrementalmente |
| | Vídeo 4–6 min/aluno | ⬜ | todos aparecem; fechar com as 3 descobertas |
| | README reproduzível (`make …`) | 🟡 | falta `make demo` + fases de carga |
| | Frontend mínimo (login OIDC + 3 consultas, §9.1) | ⬜ | P2, baixo peso; serve ao vídeo/demo; 1º a cortar |
| **➕** bônus | Tracing OTel+Tempo | ⬜ ➕ | melhor ROI |
| | Dashboard-radiador (RED dos 4) | ⬜ ➕ | em cima dos dashboards obrigatórios |
| | postgres-exporter · reflexão cap.15–16 | ⬜ ➕ | reflexão é **exigida** pela spec e ainda conta extra |

**Garantido hoje:** fundação sólida (M1a/M1), **M2 fechado** — integração ponta-a-ponta, volume real,
decisão de acesso correta e testada, e o *enforcement* dela nas 3 jornadas REST.
**Em risco (foco agora):** os **80%** dependem inteiramente das fases **b–e** (carga, escala, HPA,
observabilidade). Nenhum número medido existe ainda — é para onde todo o esforço deve ir.
