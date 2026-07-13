# RUNBOOK — Carga (bloco 1) + Escala/HPA ao vivo (bloco 2)

Passo a passo ordenado, com **📸 quando tirar print e de quê**. Tudo no **WSL**. É o núcleo dos 80% da
nota (fases b/c/d + descobertas §7.1/§7.3). **Dura ~1,5–2h** (4 baterias × 5 níveis × ~4,5 min).

> Fecha os blocos **1 e 2** de [`CHECKLIST-PENDENTE.md`](CHECKLIST-PENDENTE.md). Todo print vai para
> `docs/evidencias/` **no mesmo dia**.

---

## 0. Pré-requisitos (uma vez)

- [ ] **PARE o `make forward`** → o `make load` faz o próprio port-forward em **8080/9000** (conflita):
  ```bash
  make forward-stop
  ```
- [ ] Cluster no ar e semeado (`kubectl get nodes` = 4 Ready; se faltar: `make deploy && make seed`).
- [ ] `k6` e `jq` instalados (ver `loadtest/README.md`).
- [ ] Dashboard importado: `make dashboard`.
- [ ] Prometheus/Grafana de pé (vêm do `make cluster`) — o `collect-metrics.sh` coleta CPU/mem sozinho.

### Layout de terminais (deixa abertos)
| Terminal | Uso |
|---|---|
| **T1** | `make grafana` (Grafana em :3000, fica aberto o tempo todo) |
| **T2** | roda as baterias `make load ...` |
| **T3** | HPA ao vivo (`watch-hpa` + `get hpa -w`) — só na bateria `hpa` |
| **T4** | snapshots pontuais (`kubectl top pods`, `make pods-wide`) |

**T1 agora:**
```bash
make grafana        # abre http://localhost:3000 (admin + senha impressa)
```
No browser → Dashboards → **"Hospital PSPD — RED / USE"**. Deixa aberto.

---

## 1. Bateria 1 réplica — baseline (fase b)  ·  ~22 min

**T2:**
```bash
make load SCENARIO=1replica
```
Roda 10→50→100→500→1000 VUs (3 min cada). Summaries em `loadtest/out/`.

**📸 Durante (nos níveis 500 e 1000 VUs):**
- **PRINT 1** — Grafana RED do Gateway: **req/s, erro 5xx, latência p95/p99**. → `docs/evidencias/dashboard-red-use.md`
- **PRINT 2** — Grafana USE: **CPU/mem por pod** + saturação HikariCP. → `dashboard-red-use.md`
- **PRINT 3** — terminal do k6 (resumo do nível 1000): throughput, latência, `http_req_failed`. → `dashboard-red-use.md`

**T4 (no pico, ~1000 VUs):**
```bash
kubectl top pods            # CPU/mem instantâneo
```
**📸 PRINT 4** — `kubectl top pods` no pico. → `dashboard-red-use.md`

---

## 2. Bateria 3 réplicas — §7.3 ANTES (gRPC não balanceia)  ·  ~22 min

**T2:**
```bash
make load SCENARIO=3replicas-off
```
(ClusterIP + `pick_first` → 1 conexão HTTP/2 → **1 pod downstream recebe ~100%**.)

**📸 Durante (500/1000 VUs) — a PROVA do §7.3 "antes":**
- **PRINT 5** — Grafana USE, CPU **por pod do `patient-data`** (ou `authorization`): **1 pod ~100%, os outros 2 quase 0**. → `docs/evidencias/escala-hpa-grpc-lb.md`

**T4 (no pico):**
```bash
kubectl top pods -l app=patient-data
```
**📸 PRINT 6** — `top pods` do patient-data: 1 pod alto, 2 ociosos. → `escala-hpa-grpc-lb.md`

---

## 3. Bateria 3 réplicas — §7.3 DEPOIS (headless balanceia)  ·  ~22 min

**T2:**
```bash
make load SCENARIO=3replicas-on
```
(Service headless + `round_robin` → carga distribuída entre as 3 réplicas.)

**📸 Durante (500/1000 VUs) — a PROVA do §7.3 "depois":**
- **PRINT 7** — Grafana USE, CPU por pod do `patient-data`: **os 3 pods equilibrados**. Contraste com o PRINT 5. → `escala-hpa-grpc-lb.md`

**T4:**
```bash
kubectl top pods -l app=patient-data     # 3 pods com CPU parecida
make pods-wide                           # distribuição 1 pod/worker entre os 3 nós
```
**📸 PRINT 8** — `top pods` equilibrado. **📸 PRINT 9** — `make pods-wide` (1 pod por worker). → `escala-hpa-grpc-lb.md`

> **Descoberta §7.3:** compare PRINT 5 (1 pod 100%) × PRINT 7 (3 balanceados) — é a evidência de que o
> Service headless corrige o balanceamento gRPC. Também aparece no throughput do `make plot` (1v3).

---

## 4. Bateria HPA — autoscaling ao vivo (fase d + bloco 2)  ·  ~22 min

Aqui os terminais T3 entram **ANTES** de disparar a carga.

**T3 — série temporal (deixa rodando):**
```bash
make watch-hpa SCENARIO=hpa
```
(Amostra réplicas/CPU a cada 5s → `docs/evidencias/hpa-timeline.csv`. Ctrl+C só no fim da bateria.)

**Outra aba T3b — HPA ao vivo:**
```bash
kubectl get hpa -w
```

**T2 — dispara a bateria (só agora):**
```bash
make load SCENARIO=hpa
```
(min 1 / max 10 / CPU 60% — sob a rampa, o HPA cria pods automaticamente.)

**📸 Durante — o coração da fase (d):**
- **PRINT 10** — `kubectl get hpa -w` mostrando **CPU subindo além de 60% e `REPLICAS` indo de 1→N**. → `docs/evidencias/escala-hpa-grpc-lb.md`
- **PRINT 11** — Grafana painel **pods-ready / HPA**: a curva de pods subindo com a carga. → `dashboard-red-use.md`
- **PRINT 12** — Grafana RED: **latência p95 caindo** conforme os pods entram (redução de latência = §3.d). → `escala-hpa-grpc-lb.md`
- **PRINT 13** — DB (Postgres) no dashboard: **tps no platô + `hikaricp_connections_pending`>0** no pico = **descoberta §7.1** (Postgres é o gargalo). → `docs/evidencias/postgres-exporter-db.md`

**T3:** ao terminar a bateria, `Ctrl+C` no `watch-hpa` e no `get hpa -w`.
- **📸 PRINT 14** — abrir o `hpa-timeline.csv` (ou plotar) = **nº de pods × tempo**. → fica como CSV em `docs/evidencias/`.

---

## 5. Gráficos comparativos  ·  `make plot`

```bash
make plot
```
Gera `docs/evidencias/resultados.csv` + PNGs (throughput, latência média + **p95/p99**, CPU, mem, erro,
1v3). Como o `collect-metrics.sh` rodou junto, o CSV já tem **cliente (k6) × servidor (Prometheus)**.

**📸 PRINT 15** — os PNGs gerados (já são arquivos; confira em `docs/evidencias/`). Principais:
throughput × VUs (1v3 réplicas), p95 × VUs, pods × tempo.

---

## 6. Restaurar o estado (importante)

As baterias deixam **rate limiting OFF**, **tracing OFF** e a escala/HPA do último cenário. Para voltar
ao estado normal (ex.: demo do frontend depois):
```bash
make deploy         # reaplica manifests → rate limiting volta, estado normalizado
```
(ou pontual: `make hpa-off && make scale N=1 && kubectl set env deploy/api-gateway GATEWAY_RATELIMIT_ENABLED=true`)

---

## Checklist de prints (consolidado)

| # | O quê | Quando | Destino |
|---|---|---|---|
| 1 | RED Gateway (req/s, 5xx, p95/p99) | 1replica @500-1000 VUs | `dashboard-red-use.md` |
| 2 | USE (CPU/mem por pod, HikariCP) | 1replica @pico | `dashboard-red-use.md` |
| 3 | Resumo k6 (throughput/lat/erro) | 1replica nível 1000 | `dashboard-red-use.md` |
| 4 | `kubectl top pods` | 1replica @pico | `dashboard-red-use.md` |
| 5 | CPU/pod patient-data (**1 pod ~100%**) | 3replicas-**off** @pico | `escala-hpa-grpc-lb.md` |
| 6 | `top pods -l app=patient-data` (desbalanceado) | 3replicas-off @pico | `escala-hpa-grpc-lb.md` |
| 7 | CPU/pod patient-data (**3 balanceados**) | 3replicas-**on** @pico | `escala-hpa-grpc-lb.md` |
| 8 | `top pods` equilibrado | 3replicas-on @pico | `escala-hpa-grpc-lb.md` |
| 9 | `make pods-wide` (1 pod/worker) | 3replicas-on | `escala-hpa-grpc-lb.md` |
| 10 | `kubectl get hpa -w` (1→N pods, %/60%) | bateria hpa | `escala-hpa-grpc-lb.md` |
| 11 | Grafana pods-ready/HPA | bateria hpa | `dashboard-red-use.md` |
| 12 | Grafana p95 caindo com pods | bateria hpa | `escala-hpa-grpc-lb.md` |
| 13 | DB: tps platô + HikariCP pending (**§7.1**) | bateria hpa @pico | `postgres-exporter-db.md` |
| 14 | `hpa-timeline.csv` (pods × tempo) | fim da bateria hpa | `docs/evidencias/` |
| 15 | PNGs do `make plot` (throughput/p95/1v3) | ao final | `docs/evidencias/` |

> **Cobertura da nota:** prints 1-4 = fase (b); 5-9 = fase (c) + §7.3; 10-14 = fase (d) + §7.1;
> 15 = gráficos comparativos. Métricas ≥4 (throughput, p95/p99, CPU, mem, erro) + RED/USE = fase (e).
