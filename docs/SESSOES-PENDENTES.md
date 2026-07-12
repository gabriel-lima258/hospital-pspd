# 🎯 SESSÕES DE TRABALHO — o que falta, fatiado p/ pessoas diferentes

> Cada **sessão** é auto-contida: uma pessoa pega, faz do início ao fim, entrega os arquivos. Pensadas
> para **minimizar dependência cruzada**. Fonte plana: [`CHECKLIST-PENDENTE.md`](CHECKLIST-PENDENTE.md).
>
> ⚠️ **Regra do cluster:** existe **1 cluster kind só**. As sessões pesadas de medição (**S1/S2/S3/S5-demo**)
> disputam esse cluster → **agende em série** (uma de cada vez), mesmo que donos diferentes. As sessões
> **offline/leves (S4/S6/S7/S8/S9)** rodam **em paralelo** a qualquer momento.

## Mapa de dependências e paralelismo

| Sessão | Dono sugerido | Precisa do cluster? | Roda em paralelo com | Depende de |
|---|---|:--:|---|---|
| **S0** Preparar cluster | Arthur | monta ele | — | — |
| **S1** Bateria de carga ⭐ | Carlos | **exclusivo** (pesado) | S4, S6, S8, S9 | S0 |
| **S2** Escala + HPA ⭐ | Arthur | **exclusivo** (pesado) | S4, S6, S8, S9 | S0 |
| **S3** Screenshots observabilidade | Guilherme | **exclusivo** (carga leve) | S4, S6, S8, S9 | S0 |
| **S4** Prints do frontend | Guilherme/qualquer | sim (leve, sem carga) | tudo | S0 |
| **S5** Validações E2E rápidas | Gabriel/Mateus | sim (leve; demo-fresh recria) | S4, S6, S8, S9 | S0 |
| **S6** Probe dependency-aware (código) | Mateus | não p/ escrever | **tudo** | — |
| **S7** As 3 descobertas §7 (análise) | Carlos + Arthur | não (offline) | tudo | S1, S2 |
| **S8** Relatório | Guilherme consolida | não (offline) | tudo | recebe S1–S7 |
| **S9** Vídeo | todos | não | tudo | S1–S8 colhidos |

> **Atalho esperto:** S2 e S3 podem **pegar carona** na mesma janela em que a S1 roda os cenários
> `3replicas`/`hpa` — 3 pessoas na mesma tela capturam HPA + dashboards enquanto o k6 gera carga. Corta o
> tempo de cluster pela metade. Se preferirem independência total, cada um roda a própria carga (serial).

---

## S0 — Preparar o cluster de medição  ·  ~15 min  ·  Arthur
**Objetivo:** deixar o cluster pronto e semeado para todas as sessões que medem.
- [ ] `make cluster` (ou reiniciar os nós kind) → `kubectl get nodes` = 4 Ready.
- [ ] `make deploy` (sobe os 4 serviços **+ frontend**) → `make seed` (patients 50k).
- [ ] `kubectl get pods` todos Running/Ready.
**Entrega:** cluster no ar. Avisar o grupo que está livre para S1/S2/S3.
**Pré:** Docker + kind + k6 + jq na máquina.

## S1 — ⭐🔴 Bateria de carga + gráficos  ·  Carlos  ·  Portão 4/5
**Objetivo:** os números medidos — o coração dos 80%.
- [ ] `make load SCENARIO=1replica` (10/50/100/500/1000 VUs).
- [ ] `make load SCENARIO=3replicas-on` e `make load SCENARIO=3replicas-off` (§7.3 antes×depois).
- [ ] `make load SCENARIO=hpa`.
- [ ] `make plot` → `docs/evidencias/resultados.csv` + PNGs (throughput, latência **média+P95/P99**, CPU, mem, erro).
**Entrega:** `docs/evidencias/resultados.csv` + PNGs. **Cluster exclusivo enquanto roda.**
**Pré:** S0. Ler `loadtest/README.md`.

## S2 — ⭐ Escala + HPA ao vivo  ·  Arthur  ·  Portão 5
**Objetivo:** evidência de que a escala funciona (criação de pods, distribuição, gRPC LB).
- [ ] `make watch-hpa SCENARIO=hpa` em background na rampa → `docs/evidencias/hpa-timeline.csv`.
- [ ] print de `kubectl get hpa -w` (pods 1→N automáticos).
- [ ] `make pods-wide` com 3 réplicas (1 pod/worker).
- [ ] gRPC `make grpc-lb-off` × `grpc-lb-on` (1 pod ~100% × distribuído).
**Entrega:** prints + CSV em `docs/evidencias/escala-hpa-grpc-lb.md`. **Cluster exclusivo** (ou carona na S1).
**Pré:** S0.

## S3 — Screenshots de observabilidade  ·  Guilherme  ·  Portão 4/6
**Objetivo:** os dashboards **com carga real passando** (senão ficam vazios).
- [ ] Grafana **RED/USE** ao vivo (`make dashboard` + `make grafana`) → `dashboard-red-use.md`.
- [ ] **Loki** LogQL `{namespace="default"} | json | nivel="FULL"` (`make loki`) → `loki-logql.md`.
- [ ] **Tempo** trace `REST→gRPC→gRPC→SQL` + salto trace→log (`make tracing`) → `tracing-tempo.md`.
- [ ] **postgres-exporter** tps/conexões no teto + fila HikariCP → `postgres-exporter-db.md`.
**Entrega:** PNGs nos `.md` citados. **Rodar durante carga** (própria ou carona na S1). **Cluster exclusivo.**
**Pré:** S0. (O tracing desliga sozinho nas baterias k6 — ligar só nesta sessão.)

## S4 — Prints do frontend real  ·  Guilherme/qualquer  ·  §9.1
**Objetivo:** provar a SPA integrada de verdade. **Não precisa de carga** → roda em paralelo às pesadas.
- [ ] Seguir `docs/RUNBOOK-frontend.md` (alias `keycloak` no hosts + 3 port-forwards + `make front`).
- [ ] Colher os 10 prints da tabela em `docs/evidencias/frontend-real.md` (login OIDC, FULL×PARTIAL, `?tipo=`, lista pacientes, projetos+status, coorte rica, Network c/ Bearer, DENY 403).
**Entrega:** `docs/evidencias/frontend-real.md` preenchido.
**Pré:** S0. (Cluster leve — pode coexistir com quem estiver medindo, mas evite competir por CPU durante a S1.)

## S5 — Validações E2E rápidas  ·  Gabriel/Mateus
**Objetivo:** fechar as validações que ainda estão "no papel".
- [ ] `curl` paciente inexistente → **404** (`GrpcHttpExceptionHandler`).
- [ ] Rodar `docs/RUNBOOK-consultas-nomeadas.md` e colar saídas em `docs/evidencias/consultas-nomeadas.md`.
- [ ] `make demo DEMO_FRESH=1` reproduz do zero, limpo (Portão 7). ⚠️ **recria o cluster** → só quando ninguém estiver medindo.
**Entrega:** evidências atualizadas. **Pré:** S0 (exceto demo-fresh, que monta o seu).

## S6 — Probe dependency-aware (código)  ·  Mateus
**Objetivo:** único item de **código** ainda aberto. Escreve offline; testa depois.
- [ ] Readiness do gateway (e/ou dos serviços) checa dependência real (DB/Keycloak) antes de reportar Ready.
- [ ] `./gradlew test` verde; validar no cluster que pod só fica Ready com DB no ar.
**Entrega:** commit + teste. **Paralelo total** (não disputa cluster para escrever).

## S7 — As 3 descobertas do §7 (análise + escrita)  ·  Carlos + Arthur
**Objetivo:** transformar os números da S1/S2 em conclusão (garante profundidade dos 80%).
- [ ] **§7.1** Postgres gargalo — CPU ~100%, `hikaricp_connections_pending>0`, `db_tps` no platô.
- [ ] **§7.2** HPA × cold-start JVM + re-resolução DNS (latência piora antes de melhorar).
- [ ] **§7.3** gRPC ClusterIP não balanceia (1 IP virtual, HTTP/2 multiplexa) → fix headless; off×on.
**Entrega:** texto + gráficos referenciados. **Offline** (usa os arquivos de S1/S2).

## S8 — Relatório  ·  Guilherme consolida (cada trilha escreve a sua)  ·  §9.6
**Objetivo:** montar o relatório na estrutura §9.6.
- [ ] Cada dono escreve sua seção (Arthur cluster/HPA · Mateus acesso · Gabriel dados/FHIR · Carlos carga/descobertas · Guilherme arquitetura/observabilidade/frontend).
- [ ] Reflexão **cap. 15–16** (RED/USE, percentis, SLO, tracing). ➕
- [ ] Guilherme consolida + fecha conclusões. **Offline, incremental** (começar já com arquitetura/metodologia).

## S9 — Vídeo + entrega  ·  todos  ·  Portão 7
- [ ] Vídeo ~4–6 min/aluno (roteiro §9.4, todos aparecem, 5 trilhas).
- [ ] Cada dono faz ≥1 commit substantivo na peça herdada (equilíbrio de tarefas).
- [ ] Zip no Moodle + link do GitHub no relatório.
**Pré:** todo o resto colhido.

---

### Ordem enxuta recomendada
1. **S0** (Arthur) desbloqueia.
2. Em paralelo desde já: **S6** (Mateus, código) · **S4** (frontend prints) · **S8** começa (arquitetura/metodologia).
3. Janela de cluster (série ou carona coordenada): **S1 → S2/S3 juntas → S5**.
4. Com dados: **S7** (descobertas) → alimenta **S8**.
5. **S9** fecha (vídeo + zip).
