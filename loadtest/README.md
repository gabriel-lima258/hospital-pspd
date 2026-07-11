# Trilha D — Testes de carga e análise de performance

Esta pasta reúne a infraestrutura de testes de carga do projeto Hospital PSPD.

## Conteúdo
- `generate-tokens.sh`: gera um pool de JWTs usando o client `hospital-loadtest` do Keycloak.
- `k6/scenario.js`: cenário de carga k6 com os 3 perfis (médico, estagiário, pesquisador).
- `run-load-tests.sh`: executa a bateria de 10/50/100/500/1000 VUs e gera um CSV de resultados.
- `warmup.sh`: aquece uma rota de teste por 30s para reduzir a variação de cold start.
- `reset-state.sh`: reinicia os deployments do serviço para manter o estado consistente entre rodadas.
- `collect-metrics.sh`: recolhe métricas de CPU/RAM dos pods com `kubectl top pods`.
- `plot.py`: gera o gráfico comparativo de throughput e latência P95.

## Requisitos
- `k6` instalado e no PATH.
- `jq` instalado.
- `curl` instalado.
- `python3` com `pandas` e `matplotlib` (pode ser instalado com `python -m pip install -r loadtest/requirements.txt`).
- Cluster Kubernetes pronto e `metrics-server` saudável.

## Fluxo sugerido
```bash
# 1) gerar tokens
bash loadtest/generate-tokens.sh

# 2) rodar bateria 1 réplica
bash loadtest/run-load-tests.sh 1replica http://localhost:9000

# 3) gerar gráficos (salva em docs/evidencias)
python loadtest/plot.py
```
