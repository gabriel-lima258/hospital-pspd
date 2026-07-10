# Trilha D — Performance, dados e testes de carga

## Objetivo
Implementar uma base reprodutível de testes de carga com k6, coletar métricas do cluster e gerar gráficos comparativos para apoiar as descobertas de escalabilidade e gargalos do sistema.

## Componentes entregues
- `loadtest/generate-tokens.sh`: gera um pool de JWTs a partir do Keycloak para evitar que a autenticação contamine os resultados de carga.
- `loadtest/k6/scenario.js`: cenário k6 que simula os perfis médico, estagiário e pesquisador acessando a rota REST do gateway.
- `loadtest/run-load-tests.sh`: executa a bateria de 10/50/100/500/1000 VUs e gera um CSV com throughput e latência P95.
- `loadtest/collect-metrics.sh`: coleta continuamente `kubectl top pods` para acompanhar CPU e memória no cluster.
- `loadtest/plot.py`: gera um gráfico comparativo de throughput e latência P95 para os cenários 1 réplica, 3 réplicas e HPA.
- `loadtest/requirements.txt`: dependências Python necessárias para os gráficos.

## Pré-requisitos
- `k6` instalado e disponível no PATH.
- `jq` instalado.
- `python` com `pandas` e `matplotlib`.
- Cluster kind ativo com `metrics-server` e o projeto implantado.

## Fluxo recomendado
```bash
python -m pip install -r loadtest/requirements.txt
bash loadtest/generate-tokens.sh
bash loadtest/run-load-tests.sh 1replica http://localhost:8080
bash loadtest/collect-metrics.sh 1replica
python loadtest/plot.py
```

## Artefatos esperados
- `loadtest/resultados_1replica.csv`
- `loadtest/resultados_3replicas.csv`
- `loadtest/resultados_hpa.csv`
- `loadtest/comparativo_performance.png`
- `loadtest/recursos_k8s_*.log`

## Observação importante
Os scripts foram escritos para medir a aplicação e não o Keycloak. Por isso, o pool de tokens pré-gerado é um componente central da estratégia de testes.
