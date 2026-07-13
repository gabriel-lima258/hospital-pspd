# ⏳ CHECKLIST DO QUE FALTA — Hospital Universitário (PSPD/UnB)

> Só o **pendente** até a entrega. Código está pronto (backend + frontend + infra, builds verdes); o que
> resta é **rodar, capturar evidência e entregar**. Ordem por impacto na nota (80% = fases medidas).
>
> 👥 **Fatiado por pessoa (sessões grabbáveis):** [`SESSOES-PENDENTES.md`](SESSOES-PENDENTES.md).
>
> Fontes: [`CHECKLIST.md`](CHECKLIST.md) (panorama) · [`RUNBOOK-frontend.md`](RUNBOOK-frontend.md) ·
> [`RUNBOOK-consultas-nomeadas.md`](RUNBOOK-consultas-nomeadas.md) · [`loadtest/README.md`](../loadtest/README.md).
>
> **Legenda destino:** cada print/CSV vai para `docs/evidencias/` **no mesmo dia**.

---

## 0. Pré-requisitos (uma vez por sessão)

- [ ] Cluster no ar: `make cluster` (ou nós kind reiniciados) → `kubectl get nodes` = 4 Ready.
- [ ] `make deploy` (sobe os 4 serviços **+ frontend**) → `make seed` (patients 50k).
- [ ] `k6` + `jq` disponíveis (WSL) para a bateria de carga.
- [ ] Alias `127.0.0.1 keycloak` no hosts (só p/ o frontend real).

---

<<<<<<< HEAD
> 🧭 **Passo a passo dos blocos 1+2 com os 15 prints (o quê/quando/destino):** [`RUNBOOK-carga-hpa.md`](RUNBOOK-carga-hpa.md).

## 1. ⭐🔴 CARGA k6 — os 80% da nota (Carlos) · Portão 4/5
=======
## 1. ⭐🔴 CARGA k6 — os 80% da nota (**Arthur**) · Portão 4/5
>>>>>>> 2cfb76de49dd7f24d711b9204bc1555e1dadaf32

Nenhum número medido ainda. Sem isto não há nota técnica.

- [ ] `make load SCENARIO=1replica` — 5 níveis (10/50/100/500/1000 VUs). → summaries em `loadtest/out/`
- [ ] `make load SCENARIO=3replicas-on` (headless+round_robin, 3 réplicas).
- [ ] `make load SCENARIO=3replicas-off` (ClusterIP+pick_first = "antes" do §7.3).
- [ ] `make load SCENARIO=hpa` (HPA min1/max10 sob rampa).
- [ ] `make plot` → `docs/evidencias/resultados.csv` + PNGs (throughput, latência **média + P95/P99**, CPU, mem, taxa de erro).
- **Prova:** ≥4 métricas por nível; comparação 1×3 réplicas; platô no Postgres. **Métricas P95/P99, não só média.**

---

## 2. ⭐ Escala + HPA ao vivo (Arthur) · Portão 5

- [ ] `make watch-hpa SCENARIO=hpa` em background durante a rampa → `docs/evidencias/hpa-timeline.csv`.
- [ ] `kubectl get hpa -w` (print da criação automática de pods 1→N). → `escala-hpa-grpc-lb.md`
- [ ] `make pods-wide` sob 3 réplicas (distribuição 1 pod/worker). → PNG
- [ ] gRPC **antes × depois**: `make grpc-lb-off` vs `grpc-lb-on` (1 pod ~100% × distribuído).
- **Prova §3(c/d):** criação de pods, redistribuição de carga, redução de latência, limite de escala.

---

## 3. Observabilidade — screenshots sob carga (**Mateus**) · Portão 4/6

Rodar **durante** a bateria do bloco 1 (senão os gráficos ficam vazios).

- [ ] Grafana **RED/USE** ao vivo (`make dashboard` + `make grafana`). → `dashboard-red-use.md`
- [ ] **Loki** — LogQL `{namespace="default"} | json | nivel="FULL"` (`make loki`). → `loki-logql.md`
- [ ] **Tempo** — trace `REST→gRPC→gRPC→SQL` + salto trace→log (`make tracing`). → `tracing-tempo.md`
- [ ] **postgres-exporter** — tps/conexões no teto + fila HikariCP sob carga. → `postgres-exporter-db.md`
- [ ] PNG do scrape do Gateway no Grafana (Explore). → `docs/evidencias/`
- **Prova §5:** ≥5 métricas organizadas em RED + USE + Golden Signals.

---

## 4. Frontend — prints E2E reais (**Mateus**) · §9.1

Seguir `docs/RUNBOOK-frontend.md`. Salvar em `docs/evidencias/frontend-real.md` (tabela dos 10 prints já lá).

- [ ] Login no Keycloak real (URL `http://keycloak:8080/...`).
- [ ] `med.cardoso` FULL (nome/CPF + selo FULL) × `est.almeida` PARTIAL (iniciais, sem CPF).
- [ ] `?tipo=` (Resumo/Exames/Medicamentos) muda a fatia; lista `GET /fhir/Patient`.
- [ ] `pesq.souza`: lista de projetos c/ status, coorte (setor+medicamentos), exames anonimizados.
- [ ] DevTools → Network: chamadas a `:9000/fhir…` + `/projects` com `Authorization: Bearer` (prova real ≠ demo).
- [ ] Um DENY → 403 na UI.

---

## 5. Validações E2E que faltam confirmar (rápidas)

- [ ] `curl` paciente inexistente → **404** (`GrpcHttpExceptionHandler`).
- [ ] `make demo DEMO_FRESH=1` reproduz do zero, limpo (Portão 7).
- [ ] Consultas nomeadas via `curl` — rodar `docs/RUNBOOK-consultas-nomeadas.md` e colar saídas em `docs/evidencias/consultas-nomeadas.md`.
- [ ] Probes _dependency-aware_ (readiness checa o DB) — **Mateus**, único item de código ainda aberto.

---

## 6. As 3 descobertas do §7 — documentar com evidência (garantem os 80%)

- [ ] **§7.1 PostgreSQL gargalo (stateful)** — throughput satura ao escalar; CPU ~100%, `hikaricp_connections_pending>0`, `db_tps` no platô.
- [ ] **§7.2 HPA × cold-start da JVM** — pod novo 20–40s p/ Ready + defasagem de re-resolução DNS; latência piora antes de melhorar.
- [ ] **§7.3 gRPC sobre ClusterIP não balanceia** — 1 IP virtual, HTTP/2 multiplexa → 1 pod ~100%; fix = Service headless. Medir off×on.

---

## 7. Entrega final (todos) · Portão 7

- [ ] **Relatório §9.6** — cada trilha escreve sua seção; **Mateus consolida**.
- [ ] **Vídeo** ~4–6 min/aluno (todos aparecem, 5 trilhas).
- [ ] Reflexão **cap. 15–16** (RED/USE, percentis, SLO, tracing) no relatório. ➕
- [ ] Cada dono faz **≥1 commit substantivo** na peça herdada (equilíbrio de tarefas).
- [ ] **Zip no Moodle** + link do GitHub no relatório.

---

## Mapa rápido "o que trava a nota"

| Bloco | Peso | Depende de |
|-------|------|------------|
| 1. Carga k6 | ⭐ 80% | cluster no ar + k6 |
| 2. Escala/HPA | ⭐ 80% | rodar junto com a carga |
| 3. Observabilidade | 80% + ➕ | capturar **durante** a carga |
| 4. Frontend prints | 20% (demo/vídeo) | runbook pronto |
| 6. Descobertas §7 | ⭐ 80% | saem da análise da carga |
| 7. Relatório+vídeo | 20% | tudo acima colhido |

> **Regra de ouro:** números medidos > features bonitas. O código está pronto — a nota agora é 100% **execução + evidência**.