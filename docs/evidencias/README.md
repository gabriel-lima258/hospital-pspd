# Evidências

Saídas de comando, prints e CSVs que sustentam o [`docs/RELATORIO.md`](../RELATORIO.md).
Convenção: evidências antigas **não são reescritas** quando o código evolui — registram o que era
verdade na data. Ex.: `seed-volume-cluster.md` cita `clinical_events = 1.360.406`, contagem anterior
ao fix de `setor` + HbA1c; o valor atual (**1.387.934**) está em `pesquisador-coorte.md`.

## Índice

| Arquivo | Fase | O que prova |
|---|---|---|
| `seed-volume-cluster.md` | (a) | volume-alvo semeado no cluster (contagens conferidas no psql) |
| `authz-matriz-completa.md` | (a) | matriz de decisão ALLOW/DENY + nível, com todos os negativos |
| `patient-data-coorte.md` | (a) | agregação de coorte e amostra de exames (com `EXPLAIN` e tempos) |
| `data-transform-niveis.md` | (a) | enforcement por nível + os 5 recursos FHIR |
| `pesquisador-coorte.md` | (a) | as 3 jornadas REST; a coorte nasce no servidor; 400/403/404/502 |
| `consultas-nomeadas.md` | (a) | consultas nomeadas (Resumo/Historico/Exames/Medicamentos), listas de pacientes e projetos |
| `frontend-real.md` | (a) | SPA React real: OIDC + 3 jornadas contra o gateway, CORS, `meta.security` |
| `escala-hpa-grpc-lb.md` | (c)(d) | DNS ClusterIP×headless (1×3 endereços), distribuição de pods, HPA `%/60%` e 1→3 réplicas sob carga, smoke |
| `hpa-timeline.csv` | (d) | série temporal réplicas/CPU × tempo do cenário `hpa` (`make watch-hpa`) |
| `rate-limit-429.md` | extra | rate limiting: 429 sob rajada `-P20` (72×200 + 128×429) |
| `logging-json.md` | extra | log de acesso JSON (auditoria: `username`/`role`/`nivel`/`patient_id`) |
| `dashboard-red-use.md` | (e) | dashboard RED/USE (7 painéis, 6+ métricas) com prints sob tráfego |
| `loki-logql.md` | extra | logs agregados no Loki (LogQL sobre o JSON), com prints |
| `tracing-tempo.md` | extra | tracing OTel+Tempo: trace `REST→gRPC→SQL` multi-serviço, com prints |
| `postgres-exporter-db.md` | extra | métricas do banco (`pg_stat_*`) no dashboard, com print |
| `*http_server_requests*.json` | M1 | scrape do Gateway comprovado no Prometheus e no Grafana |

## Imagens (`imagens/`)

| Arquivos | Conteúdo |
|---|---|
| `grafana_dash1.png`, `grafana_dash2.png` | dashboard RED/USE no Grafana: throughput por status, p95/p99, erro 5xx, pods, CPU/mem por pod, HikariCP e row DB (Postgres) |
| `hpa.png`, `hpa2.png` | `kubectl get hpa -w` sob carga: CPU estourando o alvo (163%/60%) e réplicas 1→3 |
| `hpa10vh*.png`, `hpa50vh*.png` | resumos k6 do cenário `hpa` a 10/50 VUs |
| `k6_1replica_*.png` | resumos k6 do cenário `1replica` (baseline) por nível de VUs |
| `k6_3replica_*.{png,jpeg}` | resumos k6 do cenário 3 réplicas por nível de VUs |
| `k6_prep*.jpeg` | preparação da bateria (`run-load-tests.sh`: estado do cluster + warm-up) |
| `logLoki.png`, `logLoki2.png` | Loki Explore: LogQL `\| json \| nivel="FULL"` e linha `http_access` expandida (com `trace_id`) |
| `traceTempo*.png` | Tempo: busca de traces e trace multi-serviço `REST→gRPC→gRPC→SQL` |

## M1 — esqueleto ambulante no cluster (arquivos JSON)

- **`prometheus-http_server_requests-api-gateway.json`** — resultado da query
  `http_server_requests_seconds_count{application="api-gateway"}` direto no **Prometheus**
  (port-forward `svc/kps-kube-prometheus-stack-prometheus`). Comprova o scrape do Gateway.
- **`grafana-query-http_server_requests-api-gateway.json`** — a **mesma query respondida pelo
  Grafana** (via `/api/datasources/proxy/uid/prometheus/...`). Comprova que o Grafana está ligado
  ao Prometheus e enxerga a métrica. Valores capturados: `status=200 → 17`, `status=403 → 1`
  (o 403 é o caso negativo `med.semvinculo`).

### Como reproduzir a verificação in-cluster

```bash
make deploy                                            # imagens + kind load + manifests
kubectl get pods                                       # db, keycloak e os 4 serviços Running/Ready
kubectl port-forward svc/keycloak 8081:8080 &          # portas de host alternativas p/ não colidir com o compose
kubectl port-forward svc/api-gateway 9001:9000 &
TOKEN=$(KC_PORT=8081 keycloak/get-token.sh med.cardoso)
curl -H "Authorization: Bearer $TOKEN" localhost:9001/fhir/Patient/P000001 \
  | jq -r '.entry[].resource.resourceType' | grep -q '^Patient$' && echo OK   # Bundle contém Patient
```
