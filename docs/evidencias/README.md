# Evidências

## Índice

| Arquivo | Passo | O que prova |
|---|---|---|
| `seed-volume-cluster.md` | D3 | volume-alvo semeado no cluster (contagens conferidas no psql) |
| `authz-matriz-completa.md` | D3 · P2 | matriz de decisão + todos os DENYs |
| `patient-data-coorte.md` | D3 · P3a | agregação de coorte e amostra de exames (com `EXPLAIN`) |
| `data-transform-niveis.md` | D3 · P3b | enforcement por nível + os 5 recursos FHIR |
| `pesquisador-coorte.md` | D3 · **P3c** | as **3 jornadas REST**; a coorte nasce no servidor; 400/403/404/502 |
| `*http_server_requests*.json` | D2 · M1 | scrape do Gateway no Prometheus/Grafana |

> Evidências antigas **não são reescritas** quando o código evolui: elas registram o que era verdade
> na data. Ex.: `seed-volume-cluster.md` cita `clinical_events = 1.360.406`, contagem anterior ao fix
> de `setor` + HbA1c; o valor atual (**1.387.934**) está em `pesquisador-coorte.md`.

## M1 — esqueleto ambulante no cluster kind (D2 final)

Requisição real atravessa Gateway → Authorization → Patient Data → Postgres → Data Transform,
**rodando no cluster kind `pspd`**, e a métrica é raspada pelo kube-prometheus-stack.

### Arquivos

- **`prometheus-http_server_requests-api-gateway.json`** — resultado da query
  `http_server_requests_seconds_count{application="api-gateway"}` direto no **Prometheus**
  (port-forward `svc/kps-kube-prometheus-stack-prometheus`). Comprova o scrape do Gateway.
- **`grafana-query-http_server_requests-api-gateway.json`** — a **mesma query respondida pelo
  Grafana** (via `/api/datasources/proxy/uid/prometheus/...`). Comprova que o Grafana está ligado
  ao Prometheus e enxerga a métrica. Valores capturados: `status=200 → 17`, `status=403 → 1`
  (o 403 é o caso negativo `med.semvinculo`).

### Como capturar o screenshot do Grafana (painel/Explore)

O screenshot precisa ser tirado pelo seu navegador (a automação de browser deste ambiente não
alcança o port-forward local). Passos:

```bash
make grafana          # port-forward em http://localhost:3000 e imprime user/senha (admin + senha do secret)
```
No Grafana → **Explore** → datasource **Prometheus** → query:
```
http_server_requests_seconds_count{application="api-gateway"}
```
Salve o PNG aqui como `grafana-http_server_requests-api-gateway.png`.

> A senha do Grafana deste kube-prometheus-stack é **gerada aleatoriamente** (não é `prom-operator`);
> `make grafana` a lê do secret `kps-grafana`.

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
