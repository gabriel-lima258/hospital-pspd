# CLAUDE.md — Hospital Universitário (PSPD/UnB)

Manual de operação deste repositório. **Toda sessão de IA lê este arquivo primeiro.** É mantido curto de propósito — o detalhe completo está em `docs/Roteiro_PSPD_Observabilidade_K8S.md` (e o passo-a-passo verificável no **Apêndice A** dele).

> **Como usar a referência:** este `CLAUDE.md` fica **sempre no contexto** (por isso é curto). O **roteiro** (`docs/Roteiro_PSPD_Observabilidade_K8S.md`) **não** é carregado automaticamente — de propósito, para manter as sessões enxutas. **Abra-o sob demanda** (Read) quando precisar do detalhe de uma decisão; as referências "§X" espalhadas por este arquivo apontam para as seções dele. Consulte-o obrigatoriamente antes de: montar o cluster (§4.2), gerar o seed (§4.4), mexer em gRPC/proto (§4.6), escrever scripts k6 (§4.9), configurar HPA (§7.2) e ao redigir cada fase do relatório (§9).

## O que é

Aplicação de microsserviços que expõe dados clínicos no padrão **HL7/FHIR** com controle de acesso por perfil (Médico / Estagiário / Pesquisador). Trabalho acadêmico de PSPD (FGA/UnB) para explorar **observabilidade e escalabilidade em Kubernetes**. Nota = **80% profundidade técnica + 20% entregas**; ponto extra por observabilidade além do pedido. **Prazo: 1 semana.**

## Regras de ouro (não viole)

1. **Esqueleto ambulante primeiro.** Uma requisição real atravessa Gateway → gRPC → 3 serviços → Postgres → FHIR → métrica no Grafana **antes** de completar qualquer serviço. Meta: fim do D2. Use mocks onde faltar lógica.
2. **Contratos congelados antes de código:** `db/schema.sql`, `proto/hospital.proto`, claims do JWT. Mudou um contrato? Avise o grupo no mesmo dia.
3. **Números medidos > features bonitas.** Proteja as 5 fases medidas acima de tudo. Um FHIR parcial com 5 testes de carga rodados vale mais que um FHIR perfeito sem carga.
4. **Tudo que repete vira script:** `Makefile`, `db/seed.py`, `loadtest/run-load-tests.sh`, `loadtest/plot.py`.

## Arquitetura

- Frontend (React/Next) → **REST/HTTPS** → API Gateway.
- Gateway → **gRPC/HTTP2** → Authorization, Patient Data, Data Transform.
- Autenticação: **Keycloak** (OAuth2/OIDC). JWT carrega `preferred_username` + `realm_access.roles` ∈ {MEDICO, ESTAGIARIO, PESQUISADOR}.
- **PostgreSQL** — 1 réplica, *stateful* (gargalo esperado; ver §7.1 do roteiro).

| Serviço | Papel |
|---|---|
| **api-gateway** | Recebe REST, valida JWT, roteia via gRPC, consolida, rate limiting/logging. |
| **authorization** | Decide ALLOW/DENY + nível FULL/PARTIAL/ANONYMIZED/AGGREGATED (lê `user_patient_assignments`, `projects`). |
| **patient-data** | Consultas SQL e agregações do prontuário. |
| **data-transform** | Anonimização, agregação e conversão para HL7/FHIR. |

## Stack

Java 21 · Spring Boot (hexagonal) · **Gradle** (wrapper `./gradlew`) · gRPC (`net.devh:grpc-spring-boot-starter`) · Spring Data JPA · Spring Security OAuth2 Resource Server (só no Gateway) · Micrometer + Actuator (`/actuator/prometheus`). Cluster: **kind** (1 control-plane + 3 workers). Observabilidade: **Prometheus + Grafana** (`kube-prometheus-stack`); logs agregados (ponto extra): **Loki + Promtail** (`make loki`). Carga: **k6**. Tracing (ponto extra): **OpenTelemetry + Tempo**.

## Layout do repo

```
proto/            # contrato gRPC (fonte da verdade) — módulo Gradle :proto
db/               # schema.sql + seed.py
services/         # api-gateway, authorization, patient-data, data-transform
frontend/         # React/Next
k8s/              # base/ (Deployments, Services, headless) · hpa/ · observability/ · jobs/
loadtest/         # k6/, run-load-tests.sh, plot.py
keycloak/         # realm-export.json
docs/             # roteiro, prompts.md, evidencias/
```

## Comandos

- `make up` / `make rebuild` — sobe tudo local (docker-compose); `rebuild` recompila as imagens.
- `make cluster` — cria kind 1+3 + metrics-server + kube-prometheus-stack.
- `make seed` — popula o banco no volume-alvo (`seed=42`, reprodutível).
- `make deploy` — build das imagens + `kind load` + aplica `k8s/base` e `k8s/observability` (**não** o HPA).
- `make scale N=3` · `make pods-wide` — fixa réplicas · distribuição dos pods entre workers.
- `make watch-hpa SCENARIO=hpa` — série temporal de réplicas/CPU → CSV (rodar em background na rampa).
- `make grpc-lb-on|off` — headless+`round_robin` (default) × ClusterIP+`pick_first` (o "antes" do §7.3).
- `make hpa-on|off` — aplica/remove `k8s/hpa/` (min 1 / max 10 / CPU 60%). `hpa-off` não reseta réplicas.
- `make load SCENARIO=1replica|3replicas-off|3replicas-on|hpa` — bateria k6 (10/50/100/500/1000 VUs): prepara o estado do cluster, port-forward efêmero, warm-up+3min+cool-down por nível, summary→`loadtest/out/`. **Falta rodar/medir (Trilha D).**
- `make plot` — summaries do k6 → `docs/evidencias/resultados.csv` + PNGs (throughput/p95/1v3). Não depende do Prometheus.
- `make loki` — **(bônus)** Loki + Promtail na namespace `monitoring`; datasource auto-registrado no Grafana do kps. Agrega os logs JSON do Gateway; consulta LogQL `{namespace="default"} | json | nivel="FULL"`.
- `make demo` — deploy + seed enxuto + smoke das 3 jornadas; `DEMO_FRESH=1` recria o cluster.
- `./gradlew build` — compila, testa e gera os stubs proto.

## Convenções

- **Hexagonal proporcional ao domínio** (não igual nos 4 — camada só existe se isola algo real):
  - `authorization` e `data-transform` têm regra de negócio de verdade → `domain/` livre de framework (testável sem Spring/DB) + `application/` (casos de uso) + `adapters/in|out`.
  - `api-gateway` (orquestrador REST→gRPC) e `patient-data` (consulta SQL fina) → **adapters finos**; não crie `port` com uma única implementação nem mappers desnecessários.
  - Regra prática: esqueleto ambulante primeiro; **nunca** deixar "onde mora o código" atrasar o M1. Números medidos > pureza de camadas.
- **Monorepo Gradle multi-project**; módulo `:proto` compartilhado (`implementation project(':proto')`).
- Commits pequenos e frequentes na `main`.
- **Evidências no ato:** todo print/CSV/gráfico vai para `docs/evidencias/` no mesmo dia — não deixe para o fim.
- **Observabilidade com método:** métricas organizadas em **RED** (por serviço) + **USE** (por recurso); latência em **P95/P99**, não só média (Arundel & Domingus, cap. 16).

## Não faça (armadilhas que derrubam a nota)

- ❌ Teste de carga com banco vazio → semeie volume **antes** (`make seed`).
- ❌ Deployment sem `resources.requests.cpu` → **o HPA não funciona** (reporta `<unknown>`).
- ❌ Deployment **com** `replicas:` declarado + HPA → todo `kubectl apply` reseta a escala no meio da medição. Omita o campo.
- ❌ gRPC sobre Service **ClusterIP** → não balanceia entre réplicas. A causa é o DNS devolver 1 IP virtual (o `round_robin` já é default no `net.devh` 3.1.0 e não tem sobre o que rodar); o HTTP/2 multiplexa tudo numa conexão só. Fix: Service **headless** (`clusterIP: None`) — `k8s/base/grpc-headless.yaml`.
- ❌ Keycloak no caminho do teste de carga → gere **JWTs antes** (pool `tokens.json`, TTL longo).
- ❌ Rodar o k6 na mesma máquina saturada pelo cluster → o cliente vira o gargalo.

## Fases e portões (Definition of Done)

D1 fundação → **D2 esqueleto (M1, crítico)** → D3 validação funcional (M2) → D4 observabilidade + carga (M3) → D5 escala + HPA (M4) → D6 ponto extra + análise (M5) → D7 entrega (M6). **Não avance com portão vermelho.** Verificação passo-a-passo: **Apêndice A** do roteiro (`/verify-gate <n>`).

## Referência

Detalhe completo: `docs/Roteiro_PSPD_Observabilidade_K8S.md`. Livro-base: Arundel & Domingus, *Cloud Native DevOps with Kubernetes*, cap. 15–16 (RED/USE, percentis, alertas por SLO, tracing).
