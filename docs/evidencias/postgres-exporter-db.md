# Métricas do banco — postgres-exporter (fecha o §7.1)

> `postgres-exporter` (`k8s/observability/postgres-exporter.yaml`) conecta no Service `db:5432`, lê
> `pg_stat_*` e expõe como métricas Prometheus. Aplicado por `make deploy`; raspado pelo Prometheus do
> kps via ServiceMonitor dedicado (`/metrics`, label `release: kps`). Atende o enunciado: §5.1
> ("número de consultas ao banco") e §3(c) ("impacto no banco de dados").

## Por que existe (§7.1)

A tese central: **Postgres é 1 réplica, stateful → o gargalo esperado**. O dashboard já tinha o sinal
do **lado da app** (fila do HikariCP = threads esperando conexão). O exporter adiciona o sinal do
**lado do banco**, transformando a afirmação "o DB é a parede" em gráfico. Só conta história **sob
carga** — sem k6 os painéis ficam planos.

## Subir e conferir

```bash
make deploy                                    # aplica k8s/observability (inclui o exporter)
kubectl get pods -l app=postgres-exporter      # Running
kubectl port-forward svc/postgres-exporter 9187:9187 &
curl -s localhost:9187/metrics | grep '^pg_up' # pg_up 1
make dashboard                                 # reimporta o painel com a row "DB (Postgres)"
```

## Métricas / PromQL (row "DB (Postgres)" do dashboard)

```promql
# Transações/s = "consultas ao banco" (§5.1)
sum(rate(pg_stat_database_xact_commit{datname="hospital"}[1m])
  + rate(pg_stat_database_xact_rollback{datname="hospital"}[1m]))

# Conexões ativas (limite default do Postgres = 100 → platô denuncia o teto)
pg_stat_database_numbackends{datname="hospital"}

# Cache hit ratio (%)
100 * rate(pg_stat_database_blks_hit{datname="hospital"}[1m])
    / (rate(pg_stat_database_blks_hit{datname="hospital"}[1m])
     + rate(pg_stat_database_blks_read{datname="hospital"}[1m]))
```

## Evidência

_(pendente — capturar com `make load SCENARIO=1replica` rodando: screenshot da row "DB (Postgres)"
com **tps subindo e achatando**, **conexões batendo no teto** e **cache hit caindo**, no mesmo eixo
temporal em que a **fila do HikariCP** (painel de saturação, lado app) sobe. Esse cruzamento é a prova
do §7.1. Anexar PNG.)_

## Leitura para o relatório

Fecha a análise de escalabilidade (§3c) e a descoberta §7.1: ao passar de 1→3 réplicas dos serviços,
o throughput **não** cresce proporcional porque o gargalo migra para o banco (1 réplica). O exporter
mostra isso pelo lado do servidor — conexões saturadas e tps no teto — enquanto o HikariCP mostra pelo
lado do cliente. Cruzar as duas fontes (app × DB) é o tipo de profundidade que o enunciado premia.
Referência cruzada: `docs/evidencias/dashboard-red-use.md`.
