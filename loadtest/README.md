# loadtest — bateria k6 (Trilha D)

Ferramenta de carga das fases (b) carga, (c) escalabilidade e (d) HPA. Mede a **aplicação**, não o
Keycloak (JWTs pré-gerados, §4.9 do roteiro).

## Pré-requisitos (na WSL)

```bash
# k6
sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D24C6A355A20B1167
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install -y k6 jq
pip install matplotlib      # só para os gráficos (o CSV sai sem ela)
```

Cluster de pé (`make cluster && make deploy && make seed`) e Keycloak com **access token lifespan
≥ 5 min** (o default cobre a rodada de 3 min; se subir a duração, aumente o lifespan no realm).

## Rodar

```bash
make load SCENARIO=1replica        # fase (b)/(c): baseline 1 réplica
make load SCENARIO=3replicas-off   # §7.3 ANTES  (ClusterIP + pick_first — 1 pod satura)
make load SCENARIO=3replicas-on    # §7.3 DEPOIS (headless + round_robin — balanceia)
make load SCENARIO=hpa             # fase (d): autoscaling sob carga
make plot                          # CSV mestre + PNGs em docs/evidencias/
```

Cada `make load` roda os 5 níveis (10/50/100/500/1000 VUs), 3 min cada, com warm-up + cool-down
fixos (condições idênticas). Summaries → `loadtest/out/<cenario>_vus<n>.json`.

> `run-load-tests.sh` desliga o **rate limiting** (`GATEWAY_RATELIMIT_ENABLED=false`) antes da
> bateria — o pool tem só 3 usuários e um limite por-usuário mediria o limitador, não a app. Reseta
> no próximo `make deploy`. A evidência do 429 é capturada à parte (burst num único usuário).

**Fase (d) — série temporal:** rode em outro terminal, ANTES da bateria `hpa`:
```bash
make watch-hpa SCENARIO=hpa        # → docs/evidencias/hpa-timeline.csv
```

## Arquivos

| Arquivo | Papel |
|---|---|
| `k6/scenario.js` | script parametrizado por `VUS`; mix médico/estagiário/pesquisador do pool |
| `gen-tokens.sh` | minta 3 JWTs e monta `k6/tokens.json` (mix 60/20/20, sorteio `seed=42`) |
| `run-load-tests.sh` | orquestra 1 cenário: estado do cluster + port-forward + 5 níveis |
| `collect-metrics.sh` | opcional — PromQL server-side → `out/*_prom.json` (pulado se Prometheus off) |
| `plot.py` | `out/*.json` → `docs/evidencias/resultados.csv` + PNGs |

## Caveat de medição

O k6 alcança o gateway por `kubectl port-forward` (api-gateway é ClusterIP; kind sem NodePort). A
**1000 VUs o port-forward pode virar o teto** — é limite do **cliente**, não da app. Registrar na
leitura do gráfico. Para medir o teto real: expor via NodePort e apontar `BASE`/`GW_PORT`. E rode o
k6 de uma máquina que **não** esteja saturada pelo cluster (senão o cliente compete CPU com a app).
