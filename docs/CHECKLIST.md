# ✅ CHECKLIST DE ENTREGA — Hospital Universitário (PSPD/UnB)

> **Painel de controle único** do projeto: o que já foi feito, o que falta, e como cada item pesa na
> **nota** (80% técnico + profundidade · 20% entregas · ➕ ponto extra). Atualize à medida que avança.
>
> **Fontes da verdade:** [`CLAUDE.md`](../CLAUDE.md) · roteiro
> [`docs/Roteiro_PSPD_Observabilidade_K8S.md`](Roteiro_PSPD_Observabilidade_K8S.md) (§3 cronograma,
> §5 métricas, §7 descobertas, §9 entrega, **Apêndice A** portões 0–7).
>
> **Última atualização:** 2026-07-09 · **Fase atual:** **D3 / M2** (validação funcional em andamento —
> P3a ✅ fonte de dados de coorte · P3b ✅ enforcement por nível + FHIR completo (médico e estagiário
> fechados ponta-a-ponta); falta o **P3c**: rota REST de coorte do pesquisador).

**Legenda:** ✅ feito · 🟡 parcial · ⬜ a fazer · ➕ bônus (ponto extra) · 🔴 crítico
**Donos:** 🅰️ Arthur · 🅱️ Mateus · 🅲 Gabriel · 🅳 Carlos · 🅴 Guilherme (ver §0)
**Regra de ouro:** _números medidos > features bonitas_ (proteja as 5 fases medidas acima de tudo).

---

## 0. Divisão do trabalho (5 trilhas, §2.1 do roteiro)

Cinco trilhas desenhadas para **minimizar dependências cruzadas**. Cada aluno apresenta a sua no
vídeo (§9.4) — o enunciado avalia "percepção de equilíbrio na distribuição de tarefas".

| # | Dono | Trilha | Responsável por | Status |
|:--:|---|---|---|:--:|
| 🅰️ | **Arthur** | Plataforma / K8S / DevOps | cluster, manifests, **HPA**, **gRPC headless + round_robin**, `Makefile` (`demo`, `load`) | 🟡 |
| 🅱️ | **Mateus** | Backend Core — Gateway + Auth | rate limiting, logging estruturado, mapeamento de erro gRPC→HTTP, rotas REST | 🟡 |
| 🅲 | **Gabriel** | Backend Dados + **integração** | patient-data, data-transform, **P3c**, guarda dos portões, relatório §9 | ✅ |
| 🅳 | **Carlos** | Dados & Carga (Performance) | k6, `tokens.json`, `collect-metrics.sh`, `plot.py`, CSVs, gráficos, **as 3 descobertas §7** | ⬜ |
| 🅴 | **Guilherme** | Auth Infra + Frontend + Observabilidade viz | frontend React, **dashboards Grafana RED/USE**, tracing OTel+Tempo ➕ | ⬜ |

### Herança do trabalho já feito

O código pronto atravessa trilhas. Quem **assume** cada peça é dono de **evoluí-la e apresentá-la**;
o Gabriel faz o *handoff* (o commit é histórico, a responsabilidade não).

| Peça pronta | Construída por | Passa a ser de | Por quê |
|---|---|---|---|
| `authorization/` (matriz + testes) | Gabriel | 🅱️ **Mateus** | é Trilha B; ele evolui com rate limit/logging e apresenta o DENY no vídeo |
| `db/schema.sql`, `db/seed.py` | Gabriel | 🅳 **Carlos** | é Trilha D; o seed é a base dos testes de carga que ele vai rodar |
| `k8s/base/`, `k8s/observability/` | Gabriel | 🅰️ **Arthur** | é Trilha A; ele adiciona HPA e o fix de gRPC LB |
| `keycloak/` (realm, get-token) | Gabriel | 🅴 **Guilherme** | é Trilha E; o frontend usa o client `hospital-frontend` do mesmo realm |
| `patient-data/`, `data-transform/` | Gabriel | 🅲 **Gabriel** | é Trilha C — permanece com ele |

> ⚠️ **Risco de distribuição:** o Gabriel adiantou muito código fora da Trilha C. Sem o handoff
> acima, Mateus/Carlos/Arthur chegam ao vídeo sem ter o que mostrar como seu. **Cada um deve fazer
> pelo menos um commit substantivo na peça herdada** antes do D7.

### Caminho crítico (quem não pode atrasar)

⭐ **Arthur (🅰️)** e **Carlos (🅳)** carregam os **80%** da nota: sem `round_robin` + HPA (A) não há o
que medir; sem k6 + gráficos (D) não há número medido. Se o prazo apertar, o grupo inteiro ajuda A e
D — e o **frontend (🅴) é o primeiro a cortar** (§ordem de corte).

**Dependência dura:** 🅰️ precisa entregar o `round_robin` **antes** de 🅳 rodar a bateria de 3 réplicas
(senão mede-se o gRPC grudado em 1 pod, não a arquitetura).

---

## 1. Placar geral (D1 → D7)

| Dia | Tema | Milestone | Status | Onde estamos |
|---|---|---|:--:|---|
| **D1** | Fundação (contratos, cluster, scaffolds) | **M1a** | ✅ | Cluster 1+3, 3 contratos, Keycloak, 4 scaffolds |
| **D2** | Esqueleto ambulante ponta a ponta | **M1** 🔴 | ✅ | FHIR real no cluster + métrica no Grafana |
| **D3** | Engordar serviços + seed em volume | **M2** | 🟡 | Seed ✅ + **decisão** authz ✅; falta **enforcement** |
| **D4** | Observabilidade + 1ª bateria de carga | **M3** | ⬜ | Dashboards + carga 1 réplica (10→1000 VUs) |
| **D5** | Escalabilidade horizontal + HPA | **M4** | ⬜ | 3 réplicas + HPA medidos; fix gRPC LB antes |
| **D6** | Ponto extra + reteste + análise | **M5** | ⬜ ➕ | Tracing OTel+Tempo + todos os cenários |
| **D7** | Relatório + gráficos + vídeo | **M6** | ⬜ | Entrega no Moodle (zip) |

**Progresso por fase metodológica** (§9.5 do roteiro):

| Fase | | Status |
|---|---|:--:|
| (a) Validação funcional | `████████░░` decisão ok, enforcement pendente | 🟡 |
| (b) Testes de carga (10/50/100/500/1000 VUs) | `░░░░░░░░░░` | ⬜ |
| (c) Escalabilidade horizontal (1→3 réplicas) | `░░░░░░░░░░` | ⬜ |
| (d) Autoscaling (HPA min1/max10) | `░░░░░░░░░░` | ⬜ |
| (e) Observabilidade (≥5 métricas, RED+USE) | `███░░░░░░░` scrape ok, sem dashboard | 🟡 |

---

## 2. Checklist por PORTÃO (Apêndice A) — o núcleo

### 🚦 Portão 0 — Máquina pronta ✅
- [x] Ferramentas: Docker, kind, kubectl, helm, JDK 21, k6, Python3+psycopg2/faker, jq
- [x] Recursos adequados (cluster kind `pspd` rodando 1CP+3workers)
- [ ] `grpcurl` **não instalado** no host → contornado via container `fullstorydev/grpcurl` (ok p/ testes)

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
- [ ] 🅴 🟡 **PNG do Grafana** ainda **manual** (automação de browser não alcançou o port-forward) · ver `docs/evidencias/README.md`
- [ ] 🅰️ `make demo` reproduz do zero (**stub** — TODO)
- 📎 Evidências: `docs/evidencias/{seed-volume-cluster.md, *http_server_requests*.json}`

### 🚦 Portão 3 = M2 — Validação funcional, Fase (a) (D3) 🟡 ← **AQUI**
- [x] Seed em **volume-alvo** no cluster (Job): patients **50.000**, clinical_events **1.360.406** · `db/seed.py` + `k8s/jobs/seed-job.yaml` + `make seed`
- [x] `SELECT count(*)` bate com o esperado · `docs/evidencias/seed-volume-cluster.md`
- [x] **Decisão** de autorização completa (MEDICO→FULL, ESTAGIARIO→PARTIAL, PESQUISADOR→ANON/AGG) · `authorization/domain/AuthorizationPolicy` + testes JUnit ✅
- [x] Negações: médico sem vínculo → DENY; **projeto Expirado → DENY**; dono errado/inexistente → DENY · `docs/evidencias/authz-matriz-completa.md`
- [x] **(P3a) Fonte de dados de coorte/agregação** em `patient-data` — `Fetch` ramifica por `tipo_consulta`: individual (demográficos + encounters/conditions/observations/medications), `ResumoCoorte`/`Estatisticas` (total, %sexo/faixa/setor, mediaHbA1c, freqMedicamentos) e `ExamesCoorte` (amostra de 100, ainda identificada) · `PatientRepository` + `domain/Percentages` (JUnit ✅) · `docs/evidencias/patient-data-coorte.md`
- [x] **(P3b) Estagiário vê PARTIAL de verdade** — `name` vira `"J. da S."`, **sem** CPF/CNS, `birthDate: "1980"`; recursos clínicos preservados · `PatientAnonymizer` (37 testes JUnit ✅)
- [x] **(P3b) Conversão HL7/FHIR completa** — `Bundle` com Patient/Encounter/Condition/Observation/MedicationRequest; AGGREGATED vira `MeasureReport` · `FhirTransformer`, `FhirResourceMapper`
- [x] **(P3b) Pesquisador vê AGG/ANON de verdade** — ANONYMIZED pseudonimiza (sha256 salgado, estável) e trunca datas ao ano; AGGREGATED devolve `MeasureReport` sem dado individual. Validado via grpcurl (falta só a **rota REST**, no P3c)
- [ ] 🅲 🟡 **(P3c) Rota REST de coorte no gateway** — resolver `projeto_id` → `codigo_condicao`; exige evoluir o `AuthzReply` (**mudança de contrato**, avisar 🅱️ no mesmo dia) · `FhirPatientController`
- [ ] 🅲 As **3 jornadas** validadas ponta-a-ponta no cluster: médico ✅ e estagiário ✅ pela rota REST; pesquisador só por gRPC direto até o P3c
- [ ] 🅲 Seção "Validação funcional" do relatório escrita com prints
- 📎 Evidências: `docs/evidencias/{patient-data-coorte.md, data-transform-niveis.md}`

### 🚦 Portão 4 = M3 — Observabilidade + carga 1 réplica, Fases (e)+(b) (D4) ⬜
- [ ] 🅴 Dashboard Grafana **RED + USE**, **≥5 métricas** ao vivo (JSON versionado + screenshot)
- [ ] 🅱️ Probes _dependency-aware_ (readiness checa o DB)
- [ ] 🅳 Pool de **JWTs pré-gerados** (`loadtest/**/tokens.json`, TTL ~30 min) — Keycloak fora do caminho
- [ ] 🅳 `loadtest/k6/scenario.js` + `warmup.sh` + `reset-state.sh`
- [ ] 🅳 `make load SCENARIO=1replica` roda os **5 níveis (10/50/100/500/1000 VUs)** (`make load` é **stub**)
- [ ] 🅳 `collect-metrics.sh` → `resultados.csv` (throughput, latência méd+**p95/p99**, CPU, mem, erro, db_tps)

### 🚦 Portão 5 = M4 — Escalabilidade + HPA, Fases (c)+(d) (D5) ⬜
- [ ] 🅰️ 🔴 **Fix gRPC LB ANTES de medir**: Service **headless** + `defaultLoadBalancingPolicy: round_robin` (hoje ClusterIP, gruda em 1 pod) — **bloqueia 🅳**
- [ ] 🅳 `make load SCENARIO=3replicas` (3 réplicas) medido nos 5 níveis; comparação vs 1 réplica
- [ ] 🅰️ Distribuição de pods entre os 3 workers (`kubectl get pods -o wide`, screenshot)
- [ ] 🅰️ **HPA** v2 aplicado (min 1 / max 10 / CPU 60%) — **manifesto ausente** (`requests.cpu` já pronto)
- [ ] 🅰️ `kubectl get hpa` mostra `%/60%` (não `<unknown>`); escala automática evidenciada no tempo
- [ ] 🅳 **Limite de escalabilidade** identificado (satura no Postgres) + impacto no banco documentado (USE)

### 🚦 Portão 6 = M5 — Ponto extra + reteste + análise (D6) ⬜ ➕
- [ ] 🅴 ➕ Tracing distribuído: OTel Java agent nos 4 serviços + **Tempo** (trace multi-serviço)
- [ ] 🅴 ➕ `postgres-exporter` (métricas do banco no Prometheus)
- [ ] 🅳 Todos os cenários (1replica/3replicas/hpa) coletados sob condições idênticas (§4.9)
- [ ] 🅳 `loadtest/plot.py` gera todos os gráficos comparativos → `docs/evidencias/*.png`
- [ ] 🅲 Conclusões por fase rascunhadas (consolida o que cada trilha mediu)

### 🚦 Portão 7 = M6 — Entrega (D7) ⬜
- [ ] 🅲 Relatório completo na estrutura §9.6 (todas as fases, resultados, conclusões)
- [ ] **todos** Vídeo (~4–6 min/aluno, todos aparecem, 5 trilhas apresentadas)
- [ ] 🅰️ `make demo` reproduz do zero, limpo
- [ ] 🅲 Zip no Moodle + código no GitHub com link no relatório
- [ ] **todos** Checklist §9 100% marcado + autoavaliação por membro (com nota)

**Roteiro do vídeo** (§9.4 — 5 alunos × 4–6 min; cada um abre com _"sou responsável por X, vou mostrar Y funcionando"_):

| Bloco | Aluno | Mostra na tela |
|---|---|---|
| 1. Abertura + arquitetura | 🅴 **Guilherme** | login no frontend, JWT com role, jornada médico × pesquisador |
| 2. Backend e regras de acesso | 🅱️ **Mateus** | REST→gRPC, validação de JWT, ALLOW+FULL e os **DENY** (sem vínculo, projeto expirado) |
| 3. Dados, SQL e FHIR | 🅲 **Gabriel** | coorte/agregações, PARTIAL × ANONYMIZED, os 5 recursos FHIR, volume do seed |
| 4. Cluster, escala e HPA | 🅰️ **Arthur** | 4 nós, `kubectl scale` 1→3, **HPA criando pods ao vivo** (`get hpa -w`) |
| 5. Carga, métricas e descobertas | 🅳 **Carlos** | k6 rodando, Grafana ao vivo, gráficos comparativos, as **3 descobertas §7** |

---

## 3. Estado dos componentes (real × esperado)

| Componente | Dono | Estado | Veredito | Ponteiro |
|---|:--:|:--:|---|---|
| **api-gateway** | 🅱️ | 🟡 | JWT real + cadeia gRPC, mas **só a rota `/fhir/Patient/{id}`**; sem rate-limit/logging/erro gRPC | `FhirPatientController`, `SecurityConfig` |
| **authorization** | 🅱️ | ✅ | **Completo**: domínio puro + repos + gRPC + testes JUnit | `authorization/domain/*`, `adapters/*` |
| **patient-data** | 🅲 | ✅ | **Completo** (P3a): prontuário individual + agregação de coorte + amostra de exames; testes JUnit | `PatientRepository`, `domain/Percentages` |
| **data-transform** | 🅲 | ✅ | **Completo** (P3b): enforcement por `nivel` + 5 recursos FHIR + `MeasureReport`; 37 testes JUnit | `domain/FhirTransformer`, `domain/PatientAnonymizer` |
| **db** | 🅳 | ✅ | schema (5 tabelas+índices), seed volume + seed-min | `db/*` |
| **keycloak** | 🅴 | ✅ | realm + roles + 4 usuários + get-token | `keycloak/*` |
| **k8s/base** | 🅰️ | ✅ | 6 Deployments/Services, `requests.cpu` setado | `k8s/base/*` |
| **k8s/observability** | 🅴 | 🟡 | só ServiceMonitor; **sem dashboard JSON** | `k8s/observability/servicemonitor.yaml` |
| **HPA** | 🅰️ | ⬜ | manifesto ausente (`requests.cpu` já pronto) | `k8s/base/hpa.yaml` (a criar) |
| **Services gRPC** | 🅰️ | 🟡 | ClusterIP normal — **sem headless + round_robin** (não balanceia) | `k8s/base/*.yaml`, gateway `application.yml` |
| **loadtest** | 🅳 | ⬜ | vazio (só `.gitkeep`) | `loadtest/` |
| **frontend** | 🅴 | ⬜ | vazio (só `.gitkeep`) — **obrigatório mínimo** (§9.1: login OIDC + 3 consultas), mas P2 e 1º a cortar | `frontend/` · client `hospital-frontend` no realm |
| **tracing (OTel+Tempo)** | 🅴 | ⬜ ➕ | inexistente (bônus) | — |
| **Makefile** | 🅰️ | 🟡 | reais menos `load`/`demo` (stubs); `rebuild` no `.PHONY` sem corpo | `Makefile` |

---

## 4. Backlog priorizado até a entrega (o "o que falta" acionável)

> Ordem por impacto na nota. ⭐ = **caminho crítico dos 80%** (fases medidas com números).
> O emoji no início é o **dono** (§0).

1. **🅲 🔴 (P3c) Fechar o M2 — rota de coorte do pesquisador** _(Portão 3)_
   - ~~**patient-data agregação/coorte**~~ ✅ **P3a** · ~~**data-transform por `nivel`**~~ ✅ **P3b** · ~~**FHIR completo**~~ ✅ **P3b**
   - **rota de coorte no gateway**: `projeto_id` → `codigo_condicao` → `PatientQuery.coorte_codigo` · `FhirPatientController`
   - ⚠️ **Mudança de contrato** a comunicar ao grupo: o `AuthzReply` precisa carregar `coorte_codigo`
     (o Authorization já lê `projects.codigo_condicao` para decidir; hoje não o devolve).
   - **DoD:** o pesquisador vê coorte AGG/ANON **pela rota REST**; as 3 jornadas validadas no cluster.
2. **🅰️ ⭐🔴 gRPC round_robin** _(Portão 5, mas pré-requisito de qualquer carga com réplicas)_ — Service headless (`clusterIP: None`) + `defaultLoadBalancingPolicy: round_robin` no client. **Bloqueia o item 5 do 🅳.**
3. **🅰️ ⭐ HPA** _(Portão 5)_ — `k8s/base/hpa.yaml` (autoscaling/v2, min1/max10, CPU 60%).
4. **🅳 ⭐ loadtest + `make load`** _(Portão 4)_ — `scenario.js`, `run-load-tests.sh`, pool `tokens.json`, `collect-metrics.sh`; rodar `1replica`.
5. **🅳 ⭐ 3replicas + HPA medidos** _(Portão 5)_ — as duas baterias restantes. **Depende do item 2 (🅰️).**
6. **🅴 ⭐ Dashboards RED/USE** _(Portão 4)_ — JSON versionado + ≥5 métricas + screenshots.
7. **🅳 ⭐ `plot.py` + CSVs → PNGs** _(Portão 6)_ — gráficos comparativos.
8. **🅴 ➕ Tracing (OTel + Tempo)** _(Portão 6)_ — melhor ROI de bônus.
8b. **🅱️ Gateway maduro** _(Portão 4)_ — rate limiting + logging estruturado + erro gRPC→HTTP (hoje um `onError` vira 500 genérico); readiness que checa o DB.
9. **🅴 frontend mínimo** _(§9.1 / §9.7 · Portão 3+7)_ — **obrigatório, mas mínimo e P2** (baixo valor isolado; **primeiro a cortar** sob pressão — ordem de corte §R9: frontend rico → FHIR 100% → cenários extras).
   - **Objetivo:** 1 SPA enxuta que autentica via **OAuth2/OIDC no Keycloak** (client `hospital-frontend`, Standard Flow) e faz as **3 consultas** (médico→FULL, estagiário→PARTIAL, pesquisador→coorte), renderizando conforme o nível retornado.
   - **Arquivos-alvo:** `frontend/` (hoje só `.gitkeep`) · client `hospital-frontend` já existe no `keycloak/realm-export.json` (`redirectUris`/`webOrigins` = `http://localhost:*`).
   - **DoD:** loga com `med.cardoso`/`est.almeida`/`pesq.souza`, envia `Authorization: Bearer` ao gateway, mostra as 3 respostas (inclusive um DENY→403). Serve principalmente ao **vídeo/demo (D7)**, não aos pontos técnicos.
   - **Depende de:** fechar o M2 (para as respostas por nível terem sentido) e, para o pesquisador, das rotas de coorte no gateway (ainda inexistentes).
10. **🅰️ `make demo`** _(Portão 2/7)_ — reprodução ponta-a-ponta.
11. **🅲 Relatório §9 + vídeo** _(Portão 7)_ — escrever incrementalmente, não deixar p/ o fim. Cada trilha entrega a sua seção; 🅲 consolida.

---

## 5. As 3 descobertas do §7 (garantem os 80% — documentar com evidência)

- [ ] 🅳 **§7.1 — PostgreSQL como gargalo (stateful)** ⭐ _principal_ — throughput satura ao escalar app;
  evidência USE: CPU do Postgres ~100%, `hikaricp_connections_pending > 0`, timeouts, `db_tps` no platô.
  _Insumo já colhido: o Seq Scan de 425 ms em `freqMedicamentos` (§7 abaixo)._
- [ ] 🅰️ **§7.2 — HPA × cold-start da JVM** — pod novo leva 20–40s p/ ficar Ready → latência piora antes de melhorar.
- [ ] 🅰️+🅳 **§7.3 — gRPC sobre Service não balanceia** — HTTP/2 multiplexa 1 conexão → 1 pod recebe ~100%;
  🅰️ faz o fix, 🅳 mede **antes e depois** do `round_robin` (a medição do "antes" precisa acontecer **antes** do fix).

## 6. Métricas mínimas exigidas (§5 / §9.5) — status ⬜

- [ ] 🅳 Carga **≥4**: throughput · latência **média + P95/P99** · CPU/serviço · memória/serviço · taxa de erro
- [ ] 🅴 Observabilidade **≥5**, organizadas em **RED** (Rate/Errors/Duration por serviço) + **USE** (Utilization/Saturation/Errors por recurso) + Golden Signals
- [ ] 🅳 Percentis **P95/P99, não média** (histograma já habilitado no `application.yml`)

---

## 7. Dívida técnica & riscos

- ~~**Enforcement de nível ausente**~~ ✅ **fechado no P3b** — o nível decide a forma da saída; estagiário vê iniciais sem CPF/CNS, pesquisador vê pseudônimo/`MeasureReport`. `docs/evidencias/data-transform-niveis.md`.
- ~~**Fallback de compat no `FhirPatientMapper`**~~ ✅ **removido no P3b** (a classe foi absorvida pelo `PatientAnonymizer`).
- **Sal da pseudonimização é constante no código** 🟡 — `Pseudonymizer.SALT` deveria vir de um Secret. Sem sal, `sha256(id)` sobre `P000001..P050000` cai numa rainbow table em milissegundos. Aceitável no skeleton acadêmico; **citar no relatório**.
- **ANONYMIZED trunca datas clínicas ao ano** — decisão deliberada: a sequência exata de timestamps de exames é quasi-identificador. Custo: perde-se análise longitudinal fina.
- **`freqMedicamentos` conta prescrições, não pacientes** — escolha deliberada p/ a soma fechar 100% (por paciente somaria 225%: um diabético usa vários fármacos). Documentado em `docs/evidencias/patient-data-coorte.md`.
- **Sem índice em `clinical_events(tipo_evento)`** — a agregação de medicamentos faz Seq Scan (~425 ms em 1,36M linhas). É **insumo do §7.1**, não bug: `schema.sql` é contrato congelado. Mitigação (`ix_events_pac_tipo`) documentada, não aplicada.
- **gRPC pin em 1 pod** — até o `round_robin`, testes com réplicas não mostram escala.
- **PNG do Grafana manual** — automação de browser não alcança o port-forward local; capturar à mão.
- **`make demo` / `rebuild`** — pendentes (stub / `.PHONY` sem corpo).
- **Postgres 1 réplica = gargalo esperado** — é **feature** p/ a descoberta §7.1, **não** bug. Não "consertar"; medir e documentar.
- **Prazo: 1 semana** — priorizar trilhas **A (K8S), C (dados/transform), D (carga)** — são os 80% (§2.1). Frontend rico e FHIR 100% são os primeiros cortes (§ ordem de corte).

---

## 8. Entregáveis finais (§9.7) e mapa da nota

| Peso | Item | Status | Observação |
|---|---|:--:|---|
| **80%** técnico+profundidade | 5 fases medidas com números reais | 🟡→⬜ | (a) parcial; (b)(c)(d)(e) pendentes — **prioridade máxima** |
| | 3 descobertas §7 documentadas | ⬜ | dependem da carga |
| | RED+USE+Golden Signals, P95/P99 | ⬜ | rigor estatístico = profundidade |
| **20%** entregas | Relatório §9.6 estruturado | ⬜ | escrever incrementalmente |
| | Vídeo 4–6 min/aluno | ⬜ | todos aparecem; fechar com as 3 descobertas |
| | README reproduzível (`make …`) | 🟡 | falta `make demo` + fases de carga |
| | Frontend mínimo (login OIDC + 3 consultas, §9.1) | ⬜ | P2, baixo peso; serve ao vídeo/demo; 1º a cortar |
| **➕** bônus | Tracing OTel+Tempo | ⬜ ➕ | melhor ROI |
| | Dashboard-radiador (RED dos 4) | ⬜ ➕ | em cima dos dashboards obrigatórios |
| | postgres-exporter · reflexão cap.15–16 | ⬜ ➕ | reflexão é **exigida** pela spec e ainda conta extra |

**Garantido hoje:** fundação sólida (M1a/M1), integração ponta-a-ponta, volume real, decisão de acesso
correta e testada. **Em risco (foco agora):** os **80%** dependem de fechar o M2 e rodar as fases b–e —
é para onde todo o esforço deve ir.
