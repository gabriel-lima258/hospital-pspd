# Roteiro de Planejamento — Projeto PSPD: Observabilidade de Microsserviços em Kubernetes

**Disciplina:** Programação para Sistemas Paralelos e Distribuídos (PSPD) — FGA/UnB
**Professor:** Fernando W. Cruz · **Grupo:** 5 alunos · **Prazo:** 1 semana (7 dias)
**Aplicação:** Hospital Universitário — dados clínicos HL7/FHIR com controle de acesso por perfil
**Stack:** Java 21 + Spring Boot (DDD/Hexagonal) · gRPC · PostgreSQL · Keycloak · React/Next.js · Prometheus + Grafana · k6

> **Este roteiro é otimizado para a distribuição real de nota: 80% nível técnico + profundidade, 20% qualidade das entregas, com PONTO EXTRA para funcionalidades não solicitadas.** Cada decisão abaixo indica explicitamente *onde* ela puxa a nota para cima.

---

## ⚠️ Leia primeiro: a realidade de 1 semana muda tudo

Com 7 dias e 5 pessoas, **o inimigo não é a dificuldade técnica isolada de cada peça — é a integração**. A armadilha clássica (e reprovadora) é cada aluno construir seu microsserviço isolado por 5 dias e tentar integrar tudo no dia 6, descobrindo que gRPC não fala com o Gateway, o Keycloak não emite o *claim* certo, e o Prometheus não enxerga métrica nenhuma. Isso resulta em zero teste de carga = zero dos 80% técnicos.

**A filosofia deste roteiro é o "esqueleto ambulante" (*walking skeleton*):** antes de qualquer serviço estar "completo", o grupo faz **uma única requisição atravessar a pilha inteira** ponta a ponta — Frontend/k6 → JWT do Keycloak → Gateway (REST) → gRPC → Authorization → Patient Data → PostgreSQL → Data Transform → FHIR → resposta → **métrica aparecendo no Grafana**. Isso tem que estar de pé no **fim do Dia 2**. Só depois cada trilha "engorda" seu serviço em paralelo. Assim, mesmo que uma peça fique simplória, você garante que as 5 fases (validação, carga, escalabilidade, HPA, observabilidade) rodam e produzem números — que é onde mora a nota.

**Regra de ouro do prazo:** *números medidos > funcionalidades bonitas*. Um FHIR parcial com 5 testes de carga completos e gráficos convincentes tira nota muito maior que um FHIR perfeito sem nenhum teste de carga rodado.

---

## Sumário

1. [Estratégia macro e filosofia de execução](#1-estratégia-macro-e-filosofia-de-execução)
2. [Divisão de trabalho — 5 trilhas paralelas](#2-divisão-de-trabalho--5-trilhas-paralelas)
3. [Cronograma de 7 dias — sprints, milestones e Definition of Done](#3-cronograma-de-7-dias--sprints-milestones-e-definition-of-done)
4. [Roteiro técnico passo a passo de cada fase](#4-roteiro-técnico-passo-a-passo-de-cada-fase)
5. [Plano de coleta e apresentação de dados](#5-plano-de-coleta-e-apresentação-de-dados)
6. [Estratégia de ponto extra — tracing distribuído](#6-estratégia-de-ponto-extra--tracing-distribuído)
7. [Descobertas técnicas esperadas](#7-descobertas-técnicas-esperadas-a-documentar)
8. [Matriz de riscos e mitigações](#8-matriz-de-riscos-e-mitigações)
9. [Checklist final de entrega](#9-checklist-final-de-entrega)
10. [Roteiro do vídeo](#10-roteiro-do-vídeo)
- **[Apêndice A — Runbook sequencial: aplicar e verificar cada passo](#apêndice-a--runbook-sequencial-aplicar-e-verificar-cada-passo)** ⬅️ *checklist linear de execução com verificação*

---

## 1. Estratégia macro e filosofia de execução

### 1.1 As três leis que decidem a nota

1. **Integração antes de completude.** Esqueleto ambulante ponta a ponta no Dia 2. Nenhum serviço precisa estar "bonito" — precisa *responder e emitir métrica*. (Puxa os 80%: sem pilha integrada, não há teste de carga; sem teste de carga, não há os 80%.)
2. **Automação de tudo que se repete.** Você vai subir o cluster, semear o banco, rodar 5 níveis de carga em ≥3 cenários (1 réplica, 3 réplicas, com HPA) e coletar métricas dezenas de vezes. Se cada rodada for manual, o prazo estoura. Tudo vira script: `Makefile`, `seed.py`, `run-load-tests.sh`, `collect-metrics.sh`, `plot.py`. (Puxa os 80% *e* os 20%: reprodutibilidade impressiona e permite mais rodadas → mais dados → gráficos melhores.)
3. **Meça o que o enunciado pede, exatamente como pede.** As 5 fases e as métricas mínimas (≥4 na carga, ≥5 na observabilidade) são um *checklist de pontos*. Cada uma tem que virar tabela + gráfico + parágrafo de conclusão. (Puxa os 80% diretamente.)

### 1.2 Onde concentrar esforço (mapa de valor × custo)

| Entregável | Peso na nota | Custo em 1 semana | Prioridade |
|---|---|---|---|
| 5 fases rodadas com números reais | **Altíssimo (80%)** | Médio (se pilha integrada cedo) | **P0 — inegociável** |
| Pilha integrada ponta a ponta | Pré-requisito de tudo | Alto (concentra no início) | **P0** |
| Cluster 1 master + 3 workers + autoscaling | Alto | Médio | **P0** |
| Prometheus + Grafana com ≥5 métricas | Alto | Baixo (Helm faz o pesado) | **P0** |
| Seed de dados em volume | Alto (viabiliza carga real) | Baixo | **P0** |
| Relatório estruturado + vídeo | 20% | Médio (paralelizável) | **P1** |
| Ponto extra: tracing distribuído (OTel) | Bônus | Baixo (agente *zero-code*) | **P1 — melhor ROI de bônus** |
| FHIR 100% conforme / frontend rico | Baixo isoladamente | Alto | **P2 — só depois de P0** |

**Interpretação:** invista o grosso do grupo em ter a pilha de pé e as 5 fases medidas. FHIR e frontend são "bonitos" mas valem pouco isolados — faça a versão mínima que valida a funcionalidade (Fase A) e siga. O ponto extra de tracing tem o melhor retorno porque o **agente Java do OpenTelemetry é *zero-code*** (um `-javaagent`) e entrega tracing distribuído REST→gRPC de graça.

### 1.3 Atalhos deliberados (para caber em 7 dias, com justificativa)

Estes atalhos são *tecnicamente defensáveis* e devem ser **documentados com justificativa** no relatório (o enunciado permite explicitamente alterações justificadas, e isso conta a favor):

- **Cluster com `kind` (Kubernetes in Docker)** em vez de `kubeadm` em VMs. Um `kind` com 1 control-plane + 3 workers sobe em ~2 min a partir de um único arquivo YAML, é 100% reprodutível pelo professor e satisfaz "1 nó mestre + ≥3 workers". (Ver §4.2 para justificativa completa e alternativa k3s.)
- **`kube-prometheus-stack` via Helm** (um comando) em vez de instalar Prometheus/Grafana/exporters à mão. Traz Prometheus + Grafana + node-exporter + kube-state-metrics + dashboards prontos.
- **`net.devh:grpc-spring-boot-starter`** para autoconfigurar servidor/cliente gRPC dentro do Spring — elimina *boilerplate*.
- **Agente OTel *zero-code*** para tracing (ponto extra sem custo de código).
- **JWTs pré-gerados** para o k6 (Keycloak fora do caminho de medição — ver §4.9), evitando que a autenticação vire o gargalo e contamine os números.
- **Monorepo** com um módulo `proto` compartilhado e um `Makefile` na raiz.

### 1.4 Armadilhas comuns a evitar (checklist mental)

- ❌ Testar carga com banco vazio → números sem significado. **Semeie volume antes (§4.4).**
- ❌ Deixar o Keycloak no caminho do teste de carga → você mede o Keycloak, não sua app.
- ❌ Rodar o k6 na mesma máquina saturada pelo cluster → o cliente vira o gargalo. **Rode o k6 de um nó/máquina separada ou limite recursos (§4.9).**
- ❌ Esquecer `resources.requests.cpu` nos Deployments → **HPA não funciona** (ele precisa de *request* de CPU para calcular %). Erro fatal na Fase D.
- ❌ Não fixar condições entre rodadas (dataset, warm-up, réplicas, versão da imagem) → resultados incomparáveis. **§4.9 define o protocolo de condições idênticas.**
- ❌ gRPC sobre `Service` ClusterIP padrão → todas as chamadas grudam num único pod (HTTP/2 multiplexa numa conexão só) e a escalabilidade "não aparece". Isso é, na verdade, uma **descoberta valiosa** se documentada (§7.3) — mas precisa ser tratada para os testes de escalabilidade fazerem sentido.

---

## 2. Divisão de trabalho — 5 trilhas paralelas

Cinco trilhas, uma por pessoa, desenhadas para **minimizar dependências cruzadas** depois que o esqueleto ambulante estiver de pé. Os nomes são papéis; ajustem aos nomes reais.

### 2.1 Trilhas e responsabilidades

| # | Trilha (papel) | Dono de… | Entregáveis principais |
|---|---|---|---|
| **A** | **Plataforma / K8S / DevOps** | Cluster, CI local, Helm, manifests, HPA, `Makefile` | `kind-config.yaml`, `k8s/` (Deployments, Services, HPA), instalação do stack de observabilidade, `metrics-server` |
| **B** | **Backend Core — Gateway + Auth** | API Gateway (REST+JWT) e Authorization Service | Validação de JWT (Resource Server), roteamento, rate limiting, lógica ALLOW/DENY + níveis FULL/PARTIAL/ANON/AGG |
| **C** | **Backend Dados — Patient Data + Transform** | Patient Data Service (SQL) e Data Transform Service | Consultas JPA/SQL, agregações, anonimização e mapeamento HL7/FHIR |
| **D** | **Dados & Carga (Performance Engineer)** | Modelagem do banco, seed em volume, scripts k6, coleta e gráficos | `schema.sql`, `seed.py`, scripts k6 dos 5 níveis, `collect-metrics.sh`, `plot.py`, CSVs, gráficos |
| **E** | **Auth Infra + Frontend + Observabilidade viz** | Keycloak (realm/roles/users), frontend React, dashboards Grafana, tracing (ponto extra) | Realm exportado, telas de consulta, dashboards Grafana (JSON), OTel + Tempo/Jaeger |

> **Se o grupo for de 4:** funda-se **E em B** (Auth infra + dashboards vão para quem cuida de Gateway/Auth) e o frontend vira "mínimo funcional" (uma página que loga e faz 3 tipos de consulta). O ponto extra de tracing passa para a Trilha A. Priorize sempre A, C e D — são as que produzem os 80%.

### 2.2 Contratos que destravam o paralelismo (definir no Dia 1)

Para as 5 trilhas andarem sem se bloquear, **três contratos são congelados no Dia 1** (reunião de fundação):

1. **Contrato de dados (`schema.sql`)** — as 5 tabelas exatas do enunciado (`patients`, `encounters`, `clinical_events`, `user_patient_assignments`, `projects`), com tipos e chaves. Trava as Trilhas C e D.
2. **Contrato gRPC (`*.proto`)** — mensagens e serviços entre Gateway↔Auth, Gateway↔PatientData, Gateway↔Transform (ou Auth→PatientData→Transform em cadeia). Trava B e C. Ver §4.6 para o `.proto` inicial.
3. **Contrato de token (claims do JWT)** — `preferred_username` (ex.: `med.cardoso`) e `realm_access.roles` = `["MEDICO"|"ESTAGIARIO"|"PESQUISADOR"]`. Trava B e E.

Com esses três contratos escritos e commitados, cada trilha *mocka* o que ainda não existe (Gateway responde com stub gRPC fake; Auth retorna ALLOW fixo; Transform devolve JSON fixo) e todos avançam. Os mocks vão sendo substituídos por implementação real ao longo da semana.

### 2.3 Pontos de sincronização (cerimônias)

Com prazo de 1 semana, sincronização é curta e frequente:

- **Daily stand-up (15 min, todo dia de manhã):** cada um diz o que fez, o que fará, e **o que está bloqueando** (bloqueio some no mesmo dia). Formato assíncrono no grupo de mensagens se necessário.
- **Sync de integração (fim do Dia 2):** todos param e validam o esqueleto ambulante junto. Milestone M1 (§3).
- **Sync de "congelamento de features" (fim do Dia 5):** para de desenvolver funcionalidade; a partir daí só testes, coleta, gráficos e relatório.
- **Ensaio geral (Dia 7 manhã):** roda a demo do zero (`make demo`) e grava o vídeo.

### 2.4 Convenções de repositório (Trilha A define no Dia 1)

```
repo/
├── Makefile                 # make cluster | seed | deploy | load | collect | demo
├── docker-compose.yml       # ambiente local (Fase A rápida, sem K8S)
├── proto/                   # contratos gRPC compartilhados (fonte da verdade)
├── services/
│   ├── api-gateway/         # Trilha B
│   ├── authorization/       # Trilha B
│   ├── patient-data/        # Trilha C
│   └── data-transform/      # Trilha C
├── db/
│   ├── schema.sql           # Trilha D — contrato de dados
│   └── seed.py              # Trilha D — geração de volume
├── frontend/                # Trilha E
├── k8s/                     # Trilha A — manifests + HPA
│   ├── base/
│   └── observability/       # ServiceMonitors, dashboards, Tempo
├── loadtest/                # Trilha D — scripts k6 + coleta + plots
│   ├── k6/
│   ├── collect-metrics.sh
│   └── plot.py
├── keycloak/realm-export.json  # Trilha E
└── docs/                    # relatório, figuras, evidências (prints)
```

Commits pequenos e frequentes na `main` (ou PRs curtos). **Todo print/gráfico/CSV vai para `docs/evidencias/` no ato** — não deixe para o Dia 7 "achar as evidências".

---

## 3. Cronograma de 7 dias — sprints, milestones e Definition of Done

Sete "sprints" de um dia. Cada dia tem blocos manhã/tarde, um **milestone (M)** e um **Definition of Done (DoD)** verificável. Se um DoD não fecha, ele vira a primeira prioridade da manhã seguinte (não se acumula silenciosamente).

### Visão geral

| Dia | Tema | Milestone | Fase(s) do enunciado |
|---|---|---|---|
| **D1** | Fundação: contratos, cluster, scaffolds | **M1a** — cluster de pé + 3 contratos congelados | Fundação |
| **D2** | Esqueleto ambulante ponta a ponta | **M1** — 1 requisição atravessa tudo + métrica no Grafana | Fundação → A |
| **D3** | Engordar serviços + seed em volume | **M2** — Fase A (validação funcional) fechada | (a) Validação funcional |
| **D4** | Observabilidade + 1ª bateria de carga | **M3** — dashboards ≥5 métricas + carga 1 réplica | (b) Carga · (e) Observabilidade |
| **D5** | Escalabilidade horizontal + HPA | **M4** — 1×3 réplicas e HPA medidos | (c) Escalabilidade · (d) HPA |
| **D6** | Ponto extra + reteste + análise | **M5** — tracing distribuído + todos os cenários coletados | Bônus + consolidação |
| **D7** | Relatório + gráficos + vídeo | **M6** — entrega no Moodle (zip) | Fechamento |

> **Trabalho contínuo em paralelo:** o **relatório** é escrito incrementalmente desde o Dia 1 (cada trilha documenta sua parte no dia em que a faz). Não é uma tarefa do Dia 7 — no Dia 7 só se *monta e revisa*. Isso protege os 20% de qualidade.

---

### D1 — Fundação (todos juntos de manhã, depois paralelo)

**Manhã (juntos):** reunião de fundação. Congelar os **3 contratos** (§2.2): `schema.sql`, `proto/*.proto`, claims do JWT. Definir estrutura do repo (§2.4) e o `Makefile` esqueleto.

**Tarde (paralelo por trilha):**
- **A:** subir `kind` 1 CP + 3 workers (§4.2); instalar `metrics-server` e `kube-prometheus-stack`; validar Grafana acessível.
- **B:** scaffold Spring Boot do Gateway e do Authorization (Spring Initializr); Gateway já validando JWT contra o Keycloak (mesmo que rota devolva mock).
- **C:** scaffold Patient Data e Data Transform; conectar Patient Data a um Postgres local via JPA.
- **D:** finalizar `schema.sql` e começar `seed.py` (volume pequeno primeiro, 100 pacientes, para desenvolvimento).
- **E:** subir Keycloak local (docker-compose), criar realm `hospital`, roles e 3 usuários de teste; exportar `realm-export.json`.

**M1a / DoD do D1:**
- [ ] `kubectl get nodes` mostra **4 nós** (1 control-plane, 3 workers) `Ready`.
- [ ] Grafana abre no navegador (`kubectl port-forward`) e mostra métricas de nó.
- [ ] Keycloak emite um JWT para `med.cardoso` com role `MEDICO` (validado em jwt.io).
- [ ] Os 4 serviços sobem localmente (`docker-compose up`) e respondem `/actuator/health`.
- [ ] `schema.sql` e `proto/*.proto` commitados na `main`.

---

### D2 — Esqueleto ambulante (o dia mais importante da semana)

**Objetivo único:** fazer **uma** requisição real percorrer a pilha inteira e virar métrica. Concretamente: `GET /fhir/Patient/P000001` com o JWT do médico → Gateway valida JWT → chama Authorization (gRPC) que devolve ALLOW+FULL → chama Patient Data (gRPC) que busca no Postgres → chama Data Transform (gRPC) que devolve um `Patient` FHIR mínimo → Gateway responde 200 → Prometheus coleta `http_server_requests_seconds` → aparece no Grafana.

**Paralelo:** cada trilha implementa **só o caminho feliz** do seu pedaço desse fluxo. Nada de casos de borda ainda.

**M1 / DoD do D2 (milestone crítico — todos validam juntos):**
- [ ] `curl` autenticado retorna um recurso FHIR `Patient` real do banco, atravessando os 4 serviços via gRPC.
- [ ] A latência dessa chamada aparece num painel do Grafana (via `/actuator/prometheus` + ServiceMonitor).
- [ ] Um `make demo` (ou passo documentado) reproduz isso do zero.

> **Gate rígido:** se M1 não fechar no D2, **corte escopo imediatamente** (ex.: Transform devolve JSON fixo; Auth devolve ALLOW fixo) para destravar. A pilha integrada é inegociável; o realismo de cada peça é negociável.

---

### D3 — Engordar serviços + seed em volume → Fase A fechada

**Paralelo:**
- **B:** implementar de verdade a matriz de autorização — Médico→FULL (só pacientes vinculados, senão DENY), Estagiário→PARTIAL, Pesquisador→ANON/AGG (só projetos aprovados/vigentes). Rate limiting + logging estruturado no Gateway.
- **C:** Patient Data com as consultas reais (pacientes por médico, supervisionados, coortes, agregações: contagem de diabéticos, distribuição por sexo/faixa, média de HbA1c, frequência de medicamentos). Data Transform com anonimização (PARTIAL/ANON) e agregação (AGG) + mapeamento FHIR (`Patient`, `Encounter`, `Condition`, `Observation`, `MedicationRequest`).
- **D:** rodar `seed.py` em **volume de produção-de-teste** (ver §4.4: ~50k pacientes, ~200k encounters, ~1–2M clinical_events) via `COPY`. Validar tempos de consulta.
- **E:** frontend com login Keycloak + 3 telas de consulta (uma por perfil); começar dashboards Grafana.
- **A:** empacotar imagens Docker dos 4 serviços; primeiros manifests `Deployment`/`Service` (1 réplica cada) no cluster.

**M2 / DoD do D3 — encerra a Fase (a) Validação funcional:**
- [ ] Com **1 réplica de cada serviço + 1 PostgreSQL** no cluster, as 3 jornadas funcionam: médico vê dado FULL; estagiário vê PARTIAL (anonimizado); pesquisador vê AGG/ANON.
- [ ] Regras de negação funcionam: médico sem vínculo → DENY; projeto expirado → DENY.
- [ ] Conversão HL7/FHIR validada (JSON do recurso confere com o mapeamento do enunciado).
- [ ] Banco semeado com volume-alvo; `SELECT count(*)` bate com o esperado.
- [ ] Seção "Validação funcional" do relatório escrita com prints.

---

### D4 — Observabilidade + primeira bateria de carga → Fases E (início) e B

**Paralelo:**
- **E + A:** dashboards Grafana com **≥5 métricas** (req/s, latência p50/p95/p99, CPU, memória, nº de pods, consultas ao banco, erros HTTP/gRPC). ServiceMonitors para os 4 serviços. Isso já cumpre boa parte da Fase (e).
- **D:** finalizar os 5 scripts k6 (10/50/100/500/1000 VUs) com pool de JWTs pré-gerados e protocolo de condições idênticas (§4.9). Rodar a **bateria completa com 1 réplica** e coletar CSV.
- **B/C:** *tuning* de pool de conexões (HikariCP), *timeouts* gRPC, *probes* de readiness/liveness (crítico para HPA no D5).

**M3 / DoD do D4:**
- [ ] Dashboard Grafana com ≥5 métricas exibindo dados ao vivo sob carga (screenshot salvo).
- [ ] Bateria de carga **1 réplica** rodada nos 5 níveis; CSV com throughput, latência média/p95, CPU, memória, taxa de erro por nível.
- [ ] `probes` configurados e serviços marcados `Ready` corretamente.
- [ ] Seção "Observabilidade" e início da seção "Testes de carga" escritas.

---

### D5 — Escalabilidade horizontal + Autoscaling → Fases C e D

**Paralelo:**
- **A + D:** escalar para **3 réplicas** por serviço (`kubectl scale`/manifest); repetir a bateria dos 5 níveis (cenário "3 réplicas"). Depois configurar **HPA (min 1 / max 10, CPU alvo ~60–70%)** nos serviços de negócio; repetir a bateria (cenário "HPA"). Capturar `kubectl get hpa -w` e nº de pods ao longo do tempo.
- **C:** observar e registrar o **impacto no PostgreSQL** (é 1 réplica *stateful* — ver descoberta §7.1): conexões, CPU do pod do banco, latência de query sob carga.
- **B:** registrar comportamento do gRPC sob escala (descoberta §7.3: distribuição de carga entre réplicas — verificar se está balanceando).
- **E:** anexar tracing (ponto extra) se sobrar tempo hoje; senão, D6.

**M4 / DoD do D5 — encerra Fases (c) e (d):**
- [ ] Cenário **3 réplicas** medido nos 5 níveis; comparação de desempenho vs 1 réplica tabulada.
- [ ] Distribuição de pods entre os 3 workers evidenciada (`kubectl get pods -o wide`, screenshot).
- [ ] HPA demonstrado: **criação automática de pods** sob carga (evidência temporal), redistribuição, redução de latência e **limite de escalabilidade** identificado (onde o ganho satura — provavelmente o banco).
- [ ] Impacto no banco documentado com métricas.
- [ ] Seções "Escalabilidade horizontal" e "Autoscaling" escritas.

---

### D6 — Ponto extra + reteste + análise consolidada

**Paralelo:**
- **E + A:** finalizar **tracing distribuído** (OTel Java agent → Tempo, visualizado no Grafana) — §6. Screenshot de um trace REST→gRPC→gRPC→DB. Opcional de alto valor: **postgres-exporter** para métricas do banco e **remote write do k6** para o Prometheus.
- **D:** refazer qualquer rodada suspeita para garantir **condições idênticas**; gerar todos os gráficos comparativos finais (`plot.py`): throughput×VUs, p95×VUs, CPU/mem×VUs, **1 vs 3 réplicas**, **com vs sem HPA**, pods×tempo.
- **Todos:** rodada de análise — escrever as **conclusões** de cada fase (o "porquê" dos números; ver descobertas §7).

**M5 / DoD do D6:**
- [ ] Tracing distribuído funcionando (screenshot de trace multi-serviço).
- [ ] Todos os cenários (1 réplica, 3 réplicas, HPA) coletados sob condições idênticas.
- [ ] Conjunto completo de gráficos comparativos gerado e salvo em `docs/evidencias/`.
- [ ] Rascunho de todas as seções do relatório pronto (só falta revisão e conclusão geral).

---

### D7 — Fechamento: relatório, gráficos, vídeo, entrega

**Manhã:**
- Montar o relatório final na estrutura obrigatória (§9 checklist); inserir gráficos e prints; escrever Conclusão + **autoavaliação individual de cada membro**.
- Ensaio geral: `make demo` do zero para conferir reprodutibilidade (o professor vai querer replicar).

**Tarde:**
- Gravar o **vídeo** (4–6 min por aluno, roteiro §10).
- Revisão cruzada do relatório (cada um lê a seção do outro).
- Montar o **zip** (código + instruções + relatório + link do vídeo/GitHub) e postar no Moodle. **Um** aluno posta.

**M6 / DoD do D7 — ENTREGA:**
- [ ] Relatório completo na estrutura exigida (§9), com todas as fases, resultados e conclusões.
- [ ] Vídeo gravado (todos os membros aparecem; ~4–6 min cada).
- [ ] `README`/instruções permitem replicar do zero.
- [ ] Zip postado no Moodle antes do prazo; código pesado no GitHub com link no relatório.
- [ ] Checklist §9 100% marcado.

---

## 4. Roteiro técnico passo a passo de cada fase

Esta seção é o coração dos 80%. Cada subseção traz comandos, nomes de arquivo e parâmetros concretos. Trate como um *runbook*.

### 4.1 Ambiente local com `docker-compose` (desenvolvimento e Fase A rápida)

**Por quê:** o desenvolvimento diário e a primeira validação funcional (Fase A) devem rodar **sem Kubernetes**, porque o ciclo de build→deploy no cluster é lento demais para iterar. O `docker-compose` dá o *inner loop* rápido; o cluster entra quando o assunto é escala/HPA/observabilidade.

`docker-compose.yml` (raiz do repo) — Postgres + Keycloak + os 4 serviços:

```yaml
services:
  postgres:
    image: postgres:16
    environment: { POSTGRES_DB: hospital, POSTGRES_USER: app, POSTGRES_PASSWORD: app }
    ports: ["5432:5432"]
    volumes: ["./db/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql"]
  keycloak:
    image: quay.io/keycloak/keycloak:latest   # fixe a versão estável atual no relatório
    command: ["start-dev", "--import-realm"]
    environment: { KEYCLOAK_ADMIN: admin, KEYCLOAK_ADMIN_PASSWORD: admin }
    ports: ["8080:8080"]
    volumes: ["./keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json"]
  api-gateway:      { build: ./services/api-gateway,   ports: ["9000:9000"], depends_on: [keycloak, authorization] }
  authorization:    { build: ./services/authorization, depends_on: [postgres] }
  patient-data:     { build: ./services/patient-data,  depends_on: [postgres] }
  data-transform:   { build: ./services/data-transform }
```

`make up` (alias para `docker-compose up --build`) é o comando de todo dia até o Dia 3.

### 4.2 Cluster Kubernetes — escolha e justificativa

**Decisão recomendada: `kind` (Kubernetes IN Docker).** Justificativa a documentar no relatório (o enunciado premia decisões justificadas):

| Opção | Prós | Contras | Veredito p/ 1 semana |
|---|---|---|---|
| **`kind`** | Sobe 1 CP + 3 workers em ~2 min de 1 arquivo; 100% reprodutível; roda numa máquina só; ótimo p/ CI/demo | "Nós" são containers no mesmo host (não é distribuição física real) | ✅ **Escolhido** — reprodutibilidade e velocidade vencem |
| `k3s` | Distribuição real leve; dá pra usar VMs/máquinas separadas → "cluster de verdade" | Setup multi-nó consome mais tempo de rede/VM | 🥈 Alternativa se quiserem distribuição física (rode se sobrar tempo — bônus de credibilidade) |
| `kubeadm` | "Produção", o mais fiel | Setup lento e frágil; alto risco de queimar 1–2 dias | ❌ Risco alto demais p/ o prazo |

> **Justificativa para o relatório:** "Optamos por `kind` por prover um cluster multi-nó (1 control-plane + 3 workers) reprodutível por um único arquivo declarativo, garantindo que o professor consiga replicar o laboratório com um comando, sem depender de infraestrutura física específica. O escalonador do K8S, o HPA e a distribuição de pods entre nós funcionam normalmente, pois cada nó é um kubelet independente." Isso cobre o requisito "1 mestre + ≥3 workers + autoscaling + interface web".

`k8s/kind-config.yaml`:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
  - role: worker
  - role: worker
```

Comandos de fundação (Trilha A, Dia 1):

```bash
kind create cluster --name pspd --config k8s/kind-config.yaml
kubectl get nodes                                  # deve listar 4 nós Ready

# metrics-server (OBRIGATÓRIO p/ HPA e p/ 'kubectl top')
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm install metrics-server metrics-server/metrics-server -n kube-system \
  --set 'args={--kubelet-insecure-tls}'            # necessário no kind

# Prometheus + Grafana + node-exporter + kube-state-metrics (um comando)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kps prometheus-community/kube-prometheus-stack -n monitoring --create-namespace

# Interface web de monitoramento do cluster (requisito): Kubernetes Dashboard OU o próprio Grafana
kubectl port-forward -n monitoring svc/kps-grafana 3000:80   # Grafana (admin/prom-operator)
```

> **Requisito "interface web de monitoramento":** atendido pelo **Grafana** (dashboards do cluster já vêm no kube-prometheus-stack) e opcionalmente pelo **Kubernetes Dashboard**. Mostre ambos no vídeo.

### 4.3 Modelagem do banco — `db/schema.sql` (contrato de dados)

As 5 tabelas exatas do enunciado. Congelado no Dia 1. Note os índices — **eles importam para os testes de carga** (sem índice em `clinical_events(id_paciente)` e `(codigo_tipo)`, as agregações do pesquisador ficam lentas e você mede o índice faltando, não a arquitetura).

```sql
CREATE TABLE patients (
  id_paciente   VARCHAR(12) PRIMARY KEY,       -- ex.: P000001
  nome          TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  genero        VARCHAR(10) NOT NULL,          -- male|female|other
  cidade        TEXT, estado VARCHAR(2),
  cpf           VARCHAR(14), cns VARCHAR(20)
);
CREATE TABLE encounters (
  id_atendimento SERIAL PRIMARY KEY,
  id_paciente    VARCHAR(12) REFERENCES patients,
  data_inicio TIMESTAMP, data_fim TIMESTAMP,
  tipo_atendimento VARCHAR(20),                -- Ambulatorial|Emergencia|Internacao|Retorno
  setor VARCHAR(30)                            -- Cardiologia|Endocrinologia|Pediatria...
);
CREATE TABLE clinical_events (
  id_evento SERIAL PRIMARY KEY,
  id_paciente VARCHAR(12) REFERENCES patients,
  id_atendimento INT REFERENCES encounters,
  tipo_evento VARCHAR(12),                      -- Condicao|Observacao|Medicacao
  codigo_tipo VARCHAR(30),                      -- Diabetes|Hipertensao|Creatinina|Insulina...
  descricao TEXT, data_evento TIMESTAMP,
  valor NUMERIC, unidade VARCHAR(15)
);
CREATE TABLE user_patient_assignments (
  id_vinculo SERIAL PRIMARY KEY,
  username_cuidador VARCHAR(40),
  id_paciente VARCHAR(12) REFERENCES patients,
  tipo_vinculo VARCHAR(12),                     -- medico|estagiario
  username_supervisor VARCHAR(40),
  status VARCHAR(12)                            -- ativo|inativo
);
CREATE TABLE projects (
  id_projeto VARCHAR(12) PRIMARY KEY,           -- ex.: PRJ01
  titulo TEXT,
  username_pesquisador VARCHAR(40),
  codigo_condicao VARCHAR(30),                  -- igual a clinical_events.codigo_tipo
  status VARCHAR(12),                           -- Aprovado|Expirado|Suspenso
  data_validade DATE
);
-- Índices que salvam os testes de carga:
CREATE INDEX ix_events_paciente ON clinical_events(id_paciente);
CREATE INDEX ix_events_codigo   ON clinical_events(codigo_tipo);
CREATE INDEX ix_enc_paciente    ON encounters(id_paciente);
CREATE INDEX ix_assign_cuidador ON user_patient_assignments(username_cuidador);
CREATE INDEX ix_projects_pesq   ON projects(username_pesquisador);
```

### 4.4 Seed de dados sintéticos em volume — `db/seed.py`

**Por que é crítico (documentar no relatório):** teste de carga sobre banco vazio ou minúsculo é **inválido** — o Postgres serve tudo de cache, latência de query é irreal, e o gargalo real (I/O, planejamento de query, contenção de conexões) nunca aparece. Volume também é o que dá sentido à **agregação** do pesquisador (uma coorte de 14 mil casos com distribuições) e à **anonimização** em escala. Sem volume, as Fases B/C/D produzem números bonitos e mentirosos.

**Volumes-alvo (realistas e ainda semeáveis em minutos):**

| Tabela | Volume | Racional |
|---|---|---|
| `patients` | **50.000** | grande p/ coortes significativas, pequeno p/ caber em laptop |
| `encounters` | **~200.000** | ~4 por paciente |
| `clinical_events` | **~1.000.000–2.000.000** | ~20–40 por paciente → agregações "pesam" de verdade |
| `user_patient_assignments` | ~55.000 | cada paciente com médico + parte com estagiário |
| `projects` | ~50 | coortes por condição, com mix de status Aprovado/Expirado |

**Técnica:** `Faker` (`pt_BR`) para gerar + **`COPY` via `psycopg2.copy_expert`** (não `INSERT` linha a linha — seria 100× mais lento). Distribua condições clínicas de forma realista (ex.: 18% diabéticos, 25% hipertensos) para as estatísticas ficarem interessantes.

```python
# db/seed.py (esqueleto)
import psycopg2, io, random
from faker import Faker
f = Faker("pt_BR"); Faker.seed(42); random.seed(42)   # seed fixa = reprodutibilidade
N_PAT = 50_000
conn = psycopg2.connect("dbname=hospital user=app password=app host=localhost")
def copy(table, cols, rows):
    buf = io.StringIO()
    for r in rows: buf.write("\t".join(map(str, r)) + "\n")
    buf.seek(0)
    with conn.cursor() as c:
        c.copy_expert(f"COPY {table} ({cols}) FROM STDIN", buf)
    conn.commit()
# ... gerar patients, encounters, clinical_events (mix de condições), assignments, projects ...
```

> **Dica de nota:** deixe o volume **parametrizável** (`--scale`) e rode a carga em 2 tamanhos de banco (ex.: 50k e 200k pacientes) → vira uma descoberta ("o gargalo do Postgres aparece antes com dataset maior"). Baixo custo, alto valor.

### 4.5 Estrutura dos serviços Spring Boot (Java 21, DDD/Hexagonal)

**Scaffold** (Spring Initializr) para cada serviço com as dependências: `Web`, `Actuator`, `Prometheus` (Micrometer registry), `Security` (OAuth2 Resource Server — só no Gateway), `Data JPA` + `PostgreSQL` (Patient Data), e `grpc-spring-boot-starter`. **Escolha Gradle - Groovy como sistema de build** no Initializr — cada serviço já vem com o *wrapper* `./gradlew`, então ninguém precisa instalar o Gradle na máquina (garante build idêntico entre os 5 membros).

**Arquitetura hexagonal (ports & adapters)** por serviço — organize e cite no relatório (mostra maturidade de engenharia):

```
patient-data/src/main/java/.../
├── domain/            # entidades + regras (sem framework)
├── application/       # casos de uso (ports)
└── adapters/
    ├── in/grpc/       # PatientDataGrpcService (adapter de entrada)
    └── out/jpa/       # repositórios JPA (adapter de saída)
```

**`application.yml` — o trecho que garante a observabilidade (obrigatório em TODOS os serviços):**

```yaml
management:
  endpoints.web.exposure.include: health,info,prometheus
  metrics.tags.application: ${spring.application.name}   # separa métricas por serviço
  metrics.distribution.percentiles-histogram.http.server.requests: true  # habilita p95/p99 e heatmap
server.port: 9000
```

Isso expõe `/actuator/prometheus` — o alvo que o Prometheus vai raspar. `metrics.tags.application` é o que permite fazer "tempo de resposta **por serviço**" (métrica exigida na Fase E). O histograma habilita percentis reais (p95/p99), muito mais convincentes que média.

**Imagem Docker enxuta (mitiga o problema de JVM pesada — ver §7.2):** use *multi-stage build* com JRE 21 slim e habilite **AppCDS** (Application Class-Data Sharing) para reduzir cold start:

```dockerfile
FROM eclipse-temurin:21-jre-jammy
COPY build/libs/app.jar /app.jar          # Gradle: saída do bootJar (veja build.gradle em §4.6)
# AppCDS reduz o tempo de partida da JVM (importante p/ o HPA — §7.2)
ENTRYPOINT ["java","-XX:+UseParallelGC","-XX:SharedArchiveFile=/app.jsa","-jar","/app.jar"]
```

### 4.6 gRPC / protobuf (comunicação entre serviços)

**Contrato `proto/hospital.proto`** (fonte da verdade; congelado no Dia 1). Comunicação Gateway→serviços em gRPC/HTTP-2, conforme a Figura 1 do enunciado:

```protobuf
syntax = "proto3";
option java_multiple_files = true;
package hospital;

// Authorization Service
message AuthzRequest { string username = 1; string role = 2; string tipo_consulta = 3;
                       string patient_id = 4; string projeto_id = 5; }
message AuthzReply   { bool allow = 1; string nivel = 2; }   // nivel: FULL|PARTIAL|ANONYMIZED|AGGREGATED
service Authorization { rpc Check(AuthzRequest) returns (AuthzReply); }

// Patient Data Service
message PatientQuery { string patient_id = 1; string coorte_codigo = 2; string tipo_consulta = 3; }
message ClinicalData { string json_payload = 1; }   // dados clínicos crus (serializados)
service PatientData { rpc Fetch(PatientQuery) returns (ClinicalData); }

// Data Transform Service
message TransformRequest { string json_payload = 1; string nivel = 2; }
message FhirReply        { string fhir_json = 1; }
service DataTransform { rpc ToFhir(TransformRequest) returns (FhirReply); }
```

**Build (Gradle):** o plugin `com.google.protobuf` gera os stubs Java a partir dos `.proto` (equivalente ao antigo `protobuf-maven-plugin`). Com `net.devh:grpc-spring-boot-starter`, o **servidor** é só anotar `@GrpcService` na classe adapter, e o **cliente** injeta stub com `@GrpcClient("patient-data")`. Trecho essencial do `build.gradle` de cada serviço (confirme as versões estáveis atuais):

```groovy
plugins {
  id 'org.springframework.boot' version '3.3.+'
  id 'io.spring.dependency-management' version '1.1.+'
  id 'com.google.protobuf' version '0.9.4'
  id 'java'
}
java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }
dependencies {
  implementation 'org.springframework.boot:spring-boot-starter-web'
  implementation 'org.springframework.boot:spring-boot-starter-actuator'
  implementation 'io.micrometer:micrometer-registry-prometheus'   // /actuator/prometheus
  implementation 'net.devh:grpc-spring-boot-starter:3.1.0.RELEASE'
  // Gateway:      implementation 'org.springframework.boot:spring-boot-starter-oauth2-resource-server'
  // Patient Data: implementation 'org.springframework.boot:spring-boot-starter-data-jpa'; runtimeOnly 'org.postgresql:postgresql'
}
protobuf {
  protoc { artifact = 'com.google.protobuf:protoc:3.25.+' }
  plugins { grpc { artifact = 'io.grpc:protoc-gen-grpc-java:1.64.+' } }
  generateProtoTasks { all()*.plugins { grpc {} } }
}
bootJar { archiveFileName = 'app.jar' }   // gera build/libs/app.jar (usado no Dockerfile §4.5)
```

Coloque os `.proto` em `src/main/proto/` de cada serviço (ou aponte `sourceSets.main.proto.srcDir` para o `proto/` compartilhado do monorepo). Compile e teste com `./gradlew build`. Configure o alvo dos clientes no `application.yml`:

```yaml
grpc:
  server.port: 9090
  client:
    patient-data:   { address: 'dns:///patient-data:9090',  negotiationType: plaintext }
    authorization:  { address: 'dns:///authorization:9090', negotiationType: plaintext }
    data-transform: { address: 'dns:///data-transform:9090', negotiationType: plaintext }
```

> **Atenção crítica (vira a descoberta §7.3):** `dns:///` + `Service` ClusterIP faz o cliente gRPC abrir **uma conexão HTTP/2 de longa duração** e multiplexar tudo nela → **todas as chamadas grudam num único pod de destino**, mesmo com 3 réplicas. Para os testes de escalabilidade fazerem sentido, force *client-side round-robin* com **`Service` headless** (`clusterIP: None`) + política de LB no cliente:
> ```yaml
> grpc.client.patient-data.address: 'dns:///patient-data-headless:9090'
> grpc.client.patient-data.defaultLoadBalancingPolicy: round_robin
> ```
> Documente o antes/depois — é ouro para a nota técnica.

### 4.7 Keycloak — realm, roles e emissão de JWT (Trilha E)

**Setup (via UI de admin ou `kcadm.sh`), exportar em `keycloak/realm-export.json` para ser reproduzível:**

1. Realm `hospital`.
2. Client `hospital-frontend` (público, *Standard Flow* p/ o React) e `hospital-api` (p/ validação). Para o k6, um client `hospital-loadtest` com *Direct Access Grants* (password grant) — permite obter token via `curl`.
3. **Realm roles:** `MEDICO`, `ESTAGIARIO`, `PESQUISADOR`.
4. **Usuários de teste** com roles e senha, alinhados ao seed do banco (o `username` do JWT tem que casar com `user_patient_assignments.username_cuidador` / `projects.username_pesquisador`):
   - `med.cardoso` → MEDICO (vinculado a N pacientes no seed)
   - `est.almeida` → ESTAGIARIO (supervisionado por med.cardoso)
   - `pesq.souza` → PESQUISADOR (dono do projeto PRJ01, condição=Diabetes, status=Aprovado)
   - inclua **casos negativos**: um médico sem vínculo, um projeto Expirado → para demonstrar DENY.

**Obter um JWT (usado no esqueleto e no seed de tokens do k6):**

```bash
curl -s -X POST http://localhost:8080/realms/hospital/protocol/openid-connect/token \
  -d grant_type=password -d client_id=hospital-loadtest \
  -d username=med.cardoso -d password=senha123 | jq -r .access_token
```

**Validação no Gateway (Spring Security Resource Server) — `application.yml`:**

```yaml
spring.security.oauth2.resourceserver.jwt.issuer-uri: http://keycloak:8080/realms/hospital
```

Um `JwtAuthenticationConverter` extrai `realm_access.roles` para *authorities* (`ROLE_MEDICO` etc.), e o Gateway repassa `username` + `role` ao Authorization Service via gRPC.

> **Decisão de medição (documentar):** nos testes de carga, o Keycloak fica **fora do caminho** — geramos um **pool de JWTs válidos antes** de cada rodada e o k6 só envia o header `Authorization: Bearer`. Assim medimos a *aplicação*, não o servidor de identidade, e evitamos que o Keycloak vire o gargalo (contaminação de resultado que o enunciado pede para evitar). Valide que o TTL do token cobre a duração da bateria (suba o *access token lifespan* para ~30 min).

### 4.8 Manifests K8S + coleta pelo Prometheus (Trilha A)

**`Deployment` (exemplo `patient-data`) — repare em `resources.requests.cpu`: sem ele o HPA não calcula % e a Fase D falha.**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: patient-data, labels: { app: patient-data } }
spec:
  replicas: 1
  selector: { matchLabels: { app: patient-data } }
  template:
    metadata:
      labels: { app: patient-data }
      annotations: { prometheus.io/scrape: "true", prometheus.io/path: "/actuator/prometheus", prometheus.io/port: "9000" }
    spec:
      containers:
        - name: patient-data
          image: pspd/patient-data:latest
          imagePullPolicy: IfNotPresent          # kind: use 'kind load docker-image'
          ports: [ { containerPort: 9000 }, { containerPort: 9090 } ]
          resources:
            requests: { cpu: "250m", memory: "512Mi" }   # OBRIGATÓRIO p/ HPA
            limits:   { cpu: "1000m", memory: "1Gi" }
          readinessProbe: { httpGet: { path: /actuator/health/readiness, port: 9000 }, initialDelaySeconds: 20, periodSeconds: 5 }
          livenessProbe:  { httpGet: { path: /actuator/health/liveness,  port: 9000 }, initialDelaySeconds: 40, periodSeconds: 10 }
```

Carregar imagens no kind (não há registry): `kind load docker-image pspd/patient-data:latest --name pspd`.

**Fazer o Prometheus raspar os serviços — `ServiceMonitor`** (o kube-prometheus-stack usa o Operator):

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata: { name: hospital-services, namespace: monitoring, labels: { release: kps } }
spec:
  namespaceSelector: { matchNames: [ default ] }
  selector: { matchLabels: { monitored: "true" } }   # rotule os Services com monitored=true
  endpoints: [ { port: http, path: /actuator/prometheus, interval: 5s } ]
```

**PostgreSQL no cluster:** para a Fase A/carga, um `Deployment` de 1 réplica + `PersistentVolumeClaim` (ou `StatefulSet`). **Deixe-o com 1 réplica de propósito** — é a fonte da descoberta §7.1 (gargalo *stateful*). Adicione o **`postgres-exporter`** como *sidecar* para métricas do banco (conexões, TPS) → alimenta a métrica "consultas ao banco" da Fase E e a análise de gargalo.

### 4.9 Scripts k6 — os 5 níveis e o protocolo de condições idênticas

**Estrutura:** um único script parametrizado por variável de ambiente `VUS`, rodado 5 vezes (10/50/100/500/1000). Mix de requisições cobrindo os 3 perfis (médico/estagiário/pesquisador) para exercitar FULL/PARTIAL/ANON/AGG.

`loadtest/k6/scenario.js`:

```javascript
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend, Rate } from 'k6/metrics';

const tokens = new SharedArray('tokens', () => JSON.parse(open('./tokens.json'))); // pool pré-gerado
const errRate = new Rate('erros_negocio');
const VUS = __ENV.VUS || 10;

export const options = {
  scenarios: {
    carga: { executor: 'constant-vus', vus: Number(VUS), duration: '3m' }, // duração IDÊNTICA sempre
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],   // meta (registra, não aborta)
    http_req_failed:   ['rate<0.05'],
  },
};

const BASE = __ENV.BASE || 'http://localhost:9000';
export default function () {
  const t = tokens[Math.floor(Math.random() * tokens.length)];
  const params = { headers: { Authorization: `Bearer ${t.jwt}` } };
  // distribui o mix entre os 3 tipos de consulta
  const r = http.get(`${BASE}${t.endpoint}`, params);
  check(r, { 'status 200': (res) => res.status === 200 });
  errRate.add(r.status >= 400);
}

export function handleSummary(data) {                // exporta CSV/JSON p/ o plot.py
  return { [`out/summary_vus${VUS}.json`]: JSON.stringify(data) };
}
```

Orquestração `loadtest/run-load-tests.sh` — garante **condições idênticas** entre rodadas:

```bash
#!/usr/bin/env bash
set -euo pipefail
SCENARIO=$1                          # ex.: 1replica | 3replicas | hpa
for VUS in 10 50 100 500 1000; do
  echo ">>> Cenário=$SCENARIO VUs=$VUS"
  ./reset-state.sh                   # 1) mesmo estado: reinicia pods, limpa cache de conexão
  ./warmup.sh                        # 2) warm-up fixo (aquece JVM/JIT) — 30s de tráfego leve
  k6 run -e VUS=$VUS -e BASE=$BASE loadtest/k6/scenario.js \
     --summary-export "out/${SCENARIO}_vus${VUS}.json"
  ./collect-metrics.sh "$SCENARIO" "$VUS"   # 3) coleta PromQL no mesmo instante
  sleep 60                           # 4) cool-down fixo entre rodadas
done
```

**Protocolo de condições idênticas (documentar como metodologia — o enunciado exige "mesmas condições para não contaminar resultados"):**

1. **Mesmo dataset** (seed com `seed=42`, volume fixo) em todas as rodadas.
2. **Mesma imagem** (tag fixa, não `latest` mutável) e **mesmos `requests/limits`**.
3. **Warm-up idêntico** antes de cada medição (aquece JIT da JVM — sem isso, a rodada de 10 VUs mede cold start e a de 1000 não).
4. **Mesma duração** (3 min) e **cool-down** (60 s) entre rodadas.
5. **k6 fora do cluster** (outra máquina, ou um nó dedicado com `--taint`) para o cliente não competir CPU com a aplicação.
6. Só **uma variável muda por vez**: nº de VUs (dentro de um cenário) ou nº de réplicas/HPA (entre cenários). Nunca as duas juntas.
7. Registrar versão de tudo (`kubectl version`, imagem, chart) no cabeçalho do CSV.

---

## 5. Plano de coleta e apresentação de dados

Aqui é onde os números viram nota. Duas fontes: **k6** (visão do cliente: throughput, latência, taxa de erro) e **Prometheus** (visão do servidor: CPU, memória, nº de pods, consultas ao banco, erros gRPC). Cruzar as duas é o que dá profundidade.

### 5.1 Métricas a capturar (cobre ≥4 na carga e ≥5 na observabilidade)

| Métrica | Fonte | Como obter |
|---|---|---|
| **Throughput** (req/s) | k6 | `http_reqs` / duração |
| **Latência** média e **p95/p99** | k6 + Prometheus | `http_req_duration`; `histogram_quantile` |
| **Taxa de erro** | k6 + Prometheus | `http_req_failed`; erros HTTP 5xx / gRPC |
| **Uso de CPU** por serviço | Prometheus | `container_cpu_usage_seconds_total` (rate) |
| **Uso de memória** por serviço | Prometheus | `container_memory_working_set_bytes` |
| **Saturação** (USE / Golden Signal) | Micrometer/Prometheus | fila do pool HikariCP (`hikaricp_connections_pending`), threads ocupadas (`executor_active_threads`), requisições em voo |
| **Réplicas indisponíveis** | Prometheus | `kube_deployment_status_replicas_unavailable` (sinal de problema de capacidade — cap. 16) |
| **Nº de pods** (chave p/ HPA) | Prometheus | `kube_deployment_status_replicas` |
| **Tempo de resposta por serviço** | Prometheus | `http_server_requests_seconds` por `application` |
| **Consultas ao banco** | postgres-exporter | `pg_stat_database_xact_commit` (rate) |
| **Erros gRPC** | Micrometer/gRPC | `grpc_server_requests` por status |

**Consultas PromQL prontas** (coloque no `collect-metrics.sh` para extrair via API HTTP do Prometheus, `/api/v1/query`):

```promql
# CPU por serviço (cores)
sum by (app) (rate(container_cpu_usage_seconds_total{namespace="default"}[1m]))
# Memória por serviço (MiB)
sum by (app) (container_memory_working_set_bytes{namespace="default"}) / 1024 / 1024
# Latência p95 por serviço (s)
histogram_quantile(0.95, sum by (le, application) (rate(http_server_requests_seconds_bucket[1m])))
# Throughput agregado (req/s)
sum(rate(http_server_requests_seconds_count[1m]))
# Nº de réplicas prontas
sum by (deployment) (kube_deployment_status_replicas_ready)
# Taxa de erro HTTP
sum(rate(http_server_requests_seconds_count{status=~"5.."}[1m])) / sum(rate(http_server_requests_seconds_count[1m]))
```

### 5.2 Tabulação (CSV) — esquema único para tudo

Um CSV mestre `docs/evidencias/resultados.csv` com **uma linha por (cenário × nível de VUs)**:

```csv
cenario,vus,throughput_rps,lat_media_ms,lat_p95_ms,cpu_gateway,cpu_patient,mem_patient_mb,pods_total,erro_pct,db_tps
1replica,10,142,68,120,0.12,0.20,410,4,0.0,180
1replica,50,610,79,190,0.55,0.88,520,4,0.0,760
...
3replicas,1000,...,...
hpa,1000,...,...
```

`collect-metrics.sh` acrescenta uma linha por rodada. Esse formato único é o que torna trivial gerar **todos** os gráficos comparativos com um `plot.py`.

### 5.3 Gráficos que convencem (gerados por `loadtest/plot.py`, matplotlib)

O enunciado premia "bons testes/descobertas" e comparação. Gere no mínimo:

1. **Throughput × VUs** (curva por cenário: 1 réplica, 3 réplicas, HPA sobrepostas) — mostra o platô de saturação e o ganho da escala.
2. **Latência p95 × VUs** (3 curvas) — mostra o "joelho" onde a latência dispara e como 3 réplicas/HPA empurram o joelho para a direita.
3. **CPU e memória × VUs** por serviço — mostra qual serviço satura primeiro.
4. **1 vs 3 réplicas** (barras lado a lado por nível de VUs) — o ganho de escalabilidade horizontal (Fase C) em uma figura.
5. **Com vs sem HPA** (latência e nº de pods no mesmo eixo temporal, durante a rampa de 1000 VUs) — a "história" do HPA: carga sobe → pods sobem → latência cai. **Este é o gráfico-assinatura da Fase D.**
6. **Nº de pods × tempo** (HPA) sobreposto à carga — evidência de "criação automática de pods".
7. **db_tps / conexões × VUs** — evidência do gargalo do Postgres (§7.1).

```python
# loadtest/plot.py (esqueleto)
import pandas as pd, matplotlib.pyplot as plt
df = pd.read_csv('docs/evidencias/resultados.csv')
for metric, ylabel in [('throughput_rps','Throughput (req/s)'), ('lat_p95_ms','Latência p95 (ms)')]:
    plt.figure()
    for cen, g in df.groupby('cenario'):
        plt.plot(g['vus'], g[metric], marker='o', label=cen)
    plt.xlabel('Usuários simultâneos (VUs)'); plt.ylabel(ylabel); plt.legend(); plt.grid(True)
    plt.savefig(f'docs/evidencias/{metric}.png', dpi=150, bbox_inches='tight')
```

> **Dica de apresentação:** cada gráfico entra no relatório **acompanhado de um parágrafo de leitura** ("observa-se que a partir de 500 VUs a latência p95 com 1 réplica sobe de 190 ms para 2,1 s, enquanto com HPA permanece em 340 ms, ao custo de escalar de 1 para 6 pods"). Gráfico sem interpretação vale metade.

### 5.4 Enquadramento no livro-texto (Arundel & Domingus, cap. 15–16) — e por que isso vale nota

> **A especificação exige isto explicitamente:** "sugere-se a leitura dos Capítulos 15 e 16 [...] e veja se o que está proposto na Seção 3 se encaixa. Caso contrário, veja que outras mudanças poderiam ser propostas para viabilizar ou melhorar aspectos de monitoramento e observabilidade." Ou seja: **refletir sobre a metodologia à luz do livro e propor melhorias justificadas é um item avaliado** (e conta como ponto extra de observabilidade). Esta seção faz exatamente isso e deve virar uma subseção do relatório.

**O que o livro ensina (síntese dos dois capítulos):**

- **Observabilidade = união de monitoramento + logs + métricas + tracing** (cap. 15). Monitoramento responde *"está funcionando?"*; observabilidade responde *"por quê não está?"*. Nosso trabalho precisa dos **três pilares**, não só métricas.
- **Sistemas distribuídos nunca estão "up"** — vivem em estado de degradação parcial (*gray failures*). Métrica binária up/down não basta; por isso medimos latência/erro contínuos.
- **Padrão RED para serviços** (cap. 16, o mais importante): **R**ate (req/s), **E**rrors (% de requisições com erro), **D**uration (latência). Trate **todo serviço igual** → reduz carga cognitiva e permite automação.
- **Padrão USE para recursos**: **U**tilization, **S**aturation, **E**rrors — abordagem *bottom-up* para achar **gargalos**. (Saturação = tamanho da fila de espera pelo recurso.)
- **Four Golden Signals** (Google SRE) = RED + **Saturação**.
- **Percentis, não média**: a média é enganada por *outliers*; use **P95/P99** ("normalmente queremos saber o pior caso"). Em sistema distribuído, o P99 de cada salto **se compõe** ao longo da cadeia.
- **Dashboards com layout padrão** por serviço + um **"information radiator"** (dashboard mestre com RED de todos os serviços = sinais vitais do sistema).
- **Alertar com parcimônia**: alerta = *"ação humana necessária AGORA"*. Alerta demais gera *alert fatigue*. Alerte em **sintomas** (RED/golden signals) e, de preferência, quando o **SLO** é violado (% de requisições acima do limiar). Se a ação é automatizável, **automatize** — o próprio HPA é isso.
- **Readiness que checa dependências** (ex.: conexão com o banco) → habilita **circuit breaker** e **degradação graciosa** numa cadeia de microsserviços.
- **Prometheus é o formato padrão de fato**; a "pipeline de observabilidade" desacopla fontes de destinos e exige **formato de métricas padrão + logs estruturados (JSON)**.

**Encaixe com a Seção 3 da especificação:** as 5 fases (validação, carga, escalabilidade, HPA, observabilidade) **encaixam bem** com o livro — carga/escala exercitam RED e USE, o HPA é exatamente a "ação automatizada" que o livro prega, e a Fase E é o pilar de métricas. **O que falta na Seção 3, e o livro cobre, são os outros dois pilares (logs estruturados e tracing) e o rigor estatístico (percentis, SLO).** É aí que propomos melhorias.

### 5.5 Mudanças propostas à especificação (justificadas) — cada uma puxa nota

O enunciado premia alterações com justificativa e "funcionalidades não solicitadas". Estas são baratas (a maioria é reorganizar o que já coletamos) e diretamente ancoradas no livro:

| # | Mudança proposta | Ancoragem no livro | Onde ganha nota | Custo |
|---|---|---|---|---|
| M-1 | **Organizar as métricas em RED (por serviço) + USE (por recurso)** em vez de lista solta. Dashboards com layout padrão. | Cap. 16 — RED/USE | Fase E fica "profissional"; cumpre ≥5 métricas com método | Baixo (relabel) |
| M-2 | **Adotar P95/P99 como métrica primária de latência**, mantendo a média que o enunciado cita (Fase B), mas justificando que a média engana. | Cap. 16 — "média engana; queremos o pior" | Rigor estatístico = profundidade (80%) | Baixo (histograma já ligado, §4.5) |
| M-3 | **Adicionar Saturação** como métrica de 1ª classe (fila do pool de conexões, threads ocupadas, requests pendentes). | Cap. 16 — USE + Golden Signals | **Prova o gargalo do Postgres (§7.1)**; métrica além do pedido = ponto extra | Baixo |
| M-4 | **Tracing distribuído** (OpenTelemetry → Tempo/Jaeger). | Cap. 15 — tracing p/ achar o salto lento | **Ponto extra** + valida descobertas | Baixo (agente *zero-code*, §6) |
| M-5 | **Logs estruturados em JSON** no Gateway (e opcional Loki). | Cap. 15 — pipeline exige log estruturado | Fecha os 3 pilares = ponto extra | Baixo |
| M-6 | **Readiness que checa dependência** (health do banco/serviços) + discutir circuit breaker (Resilience4j) e degradação graciosa. | Cap. 15 — readiness dependente + circuit breaker | Profundidade + melhora comportamento sob falha/HPA | Médio |
| M-7 | **Alerta baseado em SLO** no Alertmanager (ex.: "99% < 1 s"; dispara se >1% viola por 2 min), poucos e acionáveis. | Cap. 16 — alertar em sintoma/SLO, sem ruído | "Pipeline de observabilidade adicional" = ponto extra | Baixo (Alertmanager já vem no stack) |
| M-8 | **Black-box check externo** (blackbox_exporter ou uptime probe) além do white-box interno. | Cap. 15 — monitorar de fora da infra | Demonstra domínio black-box × white-box | Baixo |
| M-9 | **Dashboard mestre "information radiator"** com RED dos 4 serviços numa tela. | Cap. 16 — master dashboard | Apresentação/vídeo impactante (20%) | Baixo |

> **Como escrever isso no relatório (rende os pontos):** abra uma subseção "Reflexão sobre observabilidade à luz de Arundel & Domingus (cap. 15–16)" na Fase E, cite RED/USE/Golden Signals/percentis/SLO **com a referência**, e apresente a tabela acima como "melhorias que propusemos e implementamos". Implemente pelo menos **M-1, M-2, M-3, M-4** (baixo custo, alto valor); M-5/M-7/M-8/M-9 conforme sobrar tempo no D6.

---

## 6. Estratégia de ponto extra — tracing distribuído

**Melhor ROI de bônus para 1 semana:** *tracing* distribuído com **OpenTelemetry + Grafana Tempo**, porque o **agente Java do OTel é *zero-code*** (nenhuma linha a mais no código) e o Tempo se integra ao Grafana que você já tem. Isso ataca diretamente o "ponto extra para pipeline de observabilidade adicional / métricas não discutidas".

### 6.1 Implementação (Trilha E/A, Dia 6)

1. **Instalar Tempo** no cluster: `helm install tempo grafana/tempo -n monitoring`. Adicionar Tempo como *data source* no Grafana (o kube-prometheus-stack já tem o Grafana).
2. **Anexar o agente OTel a cada serviço** — só variáveis de ambiente no Deployment, zero código:
   ```yaml
   env:
     - { name: JAVA_TOOL_OPTIONS, value: "-javaagent:/otel/opentelemetry-javaagent.jar" }
     - { name: OTEL_SERVICE_NAME, value: "patient-data" }
     - { name: OTEL_EXPORTER_OTLP_ENDPOINT, value: "http://tempo:4317" }
     - { name: OTEL_TRACES_EXPORTER, value: "otlp" }
   ```
   O agente instrumenta **automaticamente** Spring MVC, JDBC, e **gRPC** — o contexto de trace propaga REST→gRPC→gRPC→SQL sem esforço.
3. **Evidência:** um trace único mostrando `Gateway → Authorization → PatientData → (SQL no Postgres) → DataTransform`, com o tempo gasto em cada *span*. Screenshot no relatório e no vídeo.

### 6.2 Por que isso vale muito (documentar o valor)

- Revela **onde o tempo é gasto** na cadeia (ex.: "78% da latência está no span de SQL do PatientData" → conecta com a descoberta do gargalo do banco §7.1). Ou seja: o tracing **prova** a descoberta que as métricas apenas sugerem.
- Demonstra domínio de observabilidade além do pedido (métricas → *logs* → *traces*, os "três pilares").
- **Endossado pelo livro-texto:** o cap. 15 recomenda tracing (Zipkin/Jaeger/OpenTracing) justamente para o nosso cenário e usa como exemplo um caso em que "o salto do banco de dados é 100× mais lento" — que é **exatamente** a descoberta §7.1 que esperamos. Citar isso no relatório conecta a prática à referência (nota). Nota: **OpenTelemetry é o sucessor do OpenTracing** (CNCF) — usar OTel mostra que estamos atualizados em relação a 2019.

### 6.3 Bônus adicionais de baixo custo (se sobrar tempo, em ordem de ROI)

1. **postgres-exporter** — métricas do banco no Grafana (já usado na análise de gargalo). *Custo: baixíssimo, valor alto.*
2. **k6 → remote write no Prometheus** (`k6 run -o experimental-prometheus-rw`) — métricas de carga e de servidor no **mesmo** dashboard. *Vira um painel único "carga vs recursos".*
3. **Exemplars** ligando métricas a traces (clicar num pico de latência e cair no trace correspondente).
4. **Alertas no Grafana/Alertmanager** (ex.: p95 > 2s por 1 min) — fecha o ciclo de observabilidade.
5. **Loki** para logs estruturados do Gateway → os três pilares completos.

> Não faça todos. Faça **tracing (6.1) + postgres-exporter + k6 remote-write**. Isso já é um "pipeline de observabilidade adicional" robusto e narrável em 1 minuto de vídeo.

---

## 7. Descobertas técnicas esperadas a documentar

Estas são as descobertas que **elevam a nota** porque mostram entendimento profundo — não só "rodou", mas "entendemos por quê". Vá atrás delas de propósito e documente cada uma com evidência (gráfico + trace + parágrafo).

### 7.1 PostgreSQL como gargalo por ser *stateful* (a descoberta principal)

**Hipótese a comprovar:** ao escalar os serviços de aplicação (1→3 réplicas, ou HPA até 10 pods), o ganho de throughput **satura** porque todos os pods convergem para **um único PostgreSQL de 1 réplica**. O banco é *stateful* e não escala horizontalmente do mesmo jeito que os serviços *stateless*.

**Evidências a capturar (enquadradas no padrão USE do livro):** **Utilization** — CPU do pod do Postgres perto de 100% enquanto os serviços de app estão ociosos; **Saturation** — fila do pool HikariCP (`hikaricp_connections_pending` > 0) e conexões batendo no teto de `max_connections`; **Errors** — timeouts de conexão; além disso `db_tps` estabilizando enquanto VUs crescem e o span de SQL dominando o trace (§6). Aplicar USE ao banco é o caminho *bottom-up* que o cap. 16 prescreve para achar gargalos. 

**Discussão de nota (mostra maturidade):** por que não escala trivialmente (consistência, estado em disco); mitigações reais — *connection pooling* (PgBouncer), **réplicas de leitura** (as consultas do pesquisador/estagiário são read-only → poderiam ir para réplicas), cache (Redis) para agregações repetidas, e por que o *sharding* seria complexo. Conclua que **a arquitetura de microsserviços escala a computação, mas o dado compartilhado vira o limite** — exatamente a lição que o enunciado insinua ("dependendo da arquitetura, nem todos os arranjos são admitidos").

### 7.2 HPA × *cold start* da JVM (comportamento não óbvio do autoscaling)

**Hipótese:** quando o HPA cria um pod novo sob pico, ele **não alivia a carga imediatamente** — a JVM leva 20–40 s para subir, fazer JIT e ficar `Ready`. Resultado: durante a rampa, a latência **piora antes de melhorar**, e o HPA pode *overshoot* (criar pods demais) por reagir a métricas defasadas.

**Evidências:** sobreponha no tempo — carga, nº de pods e latência p95. Você verá o "vale-e-pico": latência dispara, pods sobem com atraso, latência cai depois. Meça o **tempo até `Ready`** de um pod novo (`kubectl get events`).

**Mitigações a demonstrar/discutir (cada uma vale pontos):**
- **AppCDS / CDS** (§4.5) para reduzir cold start; medir antes/depois do tempo de startup.
- `readinessProbe` bem ajustado para o Service não mandar tráfego a um pod ainda "frio".
- `behavior.scaleUp/scaleDown.stabilizationWindowSeconds` no HPA para evitar *thrashing*.
- **`minReplicas` > 1** para absorver o pico enquanto novos pods sobem (trade-off custo × latência).
- Mencionar **GraalVM native image** como solução de fundo (startup em ms) e por que **não** foi adotada em 1 semana (tempo de build/compatibilidade) — atalho justificado.

**HPA manifest (Fase D):**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: patient-data }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: patient-data }
  minReplicas: 1
  maxReplicas: 10
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 60 } }
  behavior:
    scaleUp:   { stabilizationWindowSeconds: 30, policies: [ { type: Pods, value: 2, periodSeconds: 30 } ] }
    scaleDown: { stabilizationWindowSeconds: 120 }
```

### 7.3 gRPC sobre `Service` K8S não balanceia (o *pitfall* de HTTP/2)

**Hipótese:** com `Service` ClusterIP (L4) e cliente gRPC padrão, o HTTP/2 multiplexa numa conexão persistente → **uma réplica recebe ~100% do tráfego** e as outras duas ficam ociosas. A "escalabilidade horizontal" da Fase C **não aparece** até isso ser corrigido.

**Evidências:** `kubectl top pods` mostrando 1 réplica saturada e 2 ociosas; depois de aplicar *client-side round-robin* + Service headless (§4.6), CPU distribui e o throughput escala. **Documente o antes/depois** — é uma das descobertas mais impressionantes possíveis neste trabalho, porque explica *por que* uma arquitetura "distribuída" pode não distribuir.

**Discussão:** L4 vs L7 load balancing; por que gRPC precisa de LB ciente de HTTP/2; alternativas (proxy L7 como Envoy/Linkerd, ou `defaultLoadBalancingPolicy: round_robin` no cliente).

### 7.4 Outras descobertas de menor porte (cada uma um parágrafo)

- **Custo de CPU da anonimização/agregação** no Data Transform — o serviço que faz FHIR/anonimização satura antes dos outros sob carga do perfil pesquisador (agregações são caras). Visível na métrica de CPU por serviço.
- **Ponto de saturação e Lei de Little** — relacionar VUs, throughput e latência: quando throughput satura, aumentar VUs só aumenta latência (fila), não vazão. Bom para a conclusão da Fase B.
- **Distribuição de pods entre workers** — o *scheduler* espalha réplicas pelos 3 workers; mostrar `-o wide` e discutir `podAntiAffinity` para forçar espalhamento.
- **Taxa de erro sob estresse** — em 1000 VUs sem HPA, aparecem timeouts/5xx (pool esgotado, filas cheias); com HPA, a taxa de erro cai. Conecta Fase B ↔ D.

---

## 8. Matriz de riscos e mitigações

Probabilidade (P) e Impacto (I): Alto/Médio/Baixo. Ordenada por severidade para o prazo de 1 semana.

| # | Risco | P | I | Mitigação | Contingência (plano B) |
|---|---|---|---|---|---|
| R1 | **Integração falha tarde** (serviços não conversam via gRPC no fim da semana) | A | A | Esqueleto ambulante no D2 (gate rígido); 3 contratos congelados no D1; mocks desde o início | Cortar realismo: Auth ALLOW fixo, Transform JSON fixo — desde que a pilha rode e meça |
| R2 | **JVM pesada / cold start** atrapalha build e HPA | A | M | AppCDS (§4.5); imagens slim; `minReplicas>1`; `stabilizationWindow`; probes | Documentar como **descoberta** (§7.2) em vez de "problema" — vira nota |
| R3 | **Postgres vira gargalo** e mascara escalabilidade | A | M | Índices (§4.3); HikariCP dimensionado; postgres-exporter p/ enxergar | Documentar como **descoberta principal** (§7.1) — é resultado, não falha |
| R4 | **gRPC não balanceia** entre réplicas | A | A | Service headless + `round_robin` no cliente (§4.6) | Documentar antes/depois como **descoberta** (§7.3) |
| R5 | **k6 satura a máquina** e falseia latência | M | A | Rodar k6 fora do cluster / nó dedicado; monitorar CPU do gerador | Reduzir VUs máximos; usar `constant-arrival-rate` p/ controlar taxa |
| R6 | **Recursos do laptop insuficientes** (10 pods + Postgres + stack) | M | A | `kind` com limites; testar teto real de pods antes; fechar apps | Reduzir `maxReplicas`; rodar HPA só no serviço mais leve; usar 1 nuvem gratuita |
| R7 | **HPA não escala** (esqueceram `requests.cpu` ou metrics-server) | M | A | Checklist: `requests.cpu` em todos; `kubectl top` funcionando no D1 | `kubectl describe hpa` mostra `<unknown>` → corrigir requests |
| R8 | **Keycloak vira gargalo** no teste | M | M | JWT pré-gerado, fora do caminho (§4.7); TTL longo | Trocar por validação de JWT com chave estática (mock issuer) |
| R9 | **Escopo grande demais p/ 7 dias** | A | A | Priorização P0/P1/P2 (§1.2); congelar features no D5 | Ordem de corte: frontend rico → FHIR 100% → nº de cenários extras. **Nunca** corte as 5 fases medidas |
| R10 | **Membro do grupo indisponível** | M | M | Contratos e `Makefile` permitem outro assumir; commits frequentes | Redistribuir trilha; E funde em B (§2.1) |
| R11 | **Resultados não reproduzíveis** (condições diferentes) | M | A | Protocolo de condições idênticas (§4.9); seed fixa; tags fixas | Refazer rodadas suspeitas no D6 (buffer previsto) |
| R12 | **Demo ao vivo falha** na apresentação | M | A | `make demo` testado no D7; gravar vídeo de backup | Mostrar gravação + evidências salvas em `docs/evidencias/` |

**Buffer de prazo:** o D6 tem folga proposital para absorver estouros e retestes. Se D2 (esqueleto) atrasar, ele **consome** o buffer de D6 — por isso o gate de D2 é o mais rígido da semana.

---

## 9. Checklist final de entrega

Mapeia **cada requisito da especificação** a um item verificável. Marque tudo antes de postar no Moodle. A coluna "Fonte" aponta o item do enunciado.

### 9.1 Aplicação e arquitetura

- [ ] Frontend autentica via OAuth2/OpenID (Keycloak) e obtém **JWT com username + role** — *§2.1 enunciado*
- [ ] JWT enviado em toda chamada à API Gateway; tela montada conforme resposta
- [ ] Backend = **1 API Gateway + 3 microsserviços** (Authorization, Patient Data, Data Transform)
- [ ] Comunicação **frontend↔Gateway em REST (HTTPS/1.1)** e **Gateway↔serviços em gRPC (HTTP/2)**
- [ ] **API Gateway:** recebe REST, valida JWT, roteia, consolida, + rate limiting/logging/segurança
- [ ] **Authorization Service:** decide ALLOW/DENY e nível FULL/PARTIAL/ANONYMIZED/AGGREGATED pelo JWT + tabelas
- [ ] **Patient Data Service:** consultas SQL (pacientes por médico, supervisionados, coortes, agregações)
- [ ] **Data Transform Service:** anonimização + agregação + conversão HL7/FHIR

### 9.2 Regras de perfil (validar com casos positivos E negativos)

- [ ] **Médico** → FULL; só pacientes vinculados; **sem vínculo = DENY**
- [ ] **Estagiário** → PARTIAL (anonimizado); só pacientes de atividade supervisionada; senão DENY
- [ ] **Pesquisador** → ANONYMIZED/AGGREGATED; só coortes de projeto **Aprovado e vigente**; senão DENY
- [ ] Níveis de dados corretos: FULL/PARTIAL/ANONYMIZED/AGGREGATED conforme campos do enunciado

### 9.3 Modelo de dados e FHIR

- [ ] 5 tabelas: `patients`, `encounters`, `clinical_events`, `user_patient_assignments`, `projects`
- [ ] Mapeamento FHIR: patients→**Patient**, encounters→**Encounter**, clinical_events→**Condition/Observation/MedicationRequest**
- [ ] Exemplo de conversão (registro → JSON FHIR) demonstrado no relatório

### 9.4 Infraestrutura K8S e ferramentas

- [ ] Cluster com **1 control-plane + ≥3 workers** (`kubectl get nodes` = 4 nós)
- [ ] **Interface web de monitoramento** (Grafana e/ou K8S Dashboard)
- [ ] Recursos de **autoscaling** habilitados (metrics-server + HPA)
- [ ] **Prometheus** instalado e coletando; **Grafana** visualizando
- [ ] Todos os passos de criação do cluster **documentados** (runbook no relatório)
- [ ] Ferramenta de carga **k6 e/ou Locust** usada

### 9.5 As 5 fases metodológicas (cada uma com cenário + resultado + conclusão)

- [ ] **(a) Validação funcional:** 1 réplica/serviço + 1 Postgres; autenticação, anonimização, FHIR validados
- [ ] **(b) Testes de carga:** **10, 50, 100, 500, 1000** VUs; **≥4 métricas** (throughput, latência, CPU, memória, taxa de erro)
- [ ] **(c) Escalabilidade horizontal:** 1→3 réplicas; ganho, uso dos nós, distribuição de pods, impacto no banco
- [ ] **(d) Autoscaling (HPA):** min 1/max 10 por CPU; criação automática de pods, redistribuição, redução de latência, limite de escala
- [ ] **(e) Observabilidade:** todos expõem métricas ao Prometheus, visualizadas no Grafana; **≥5 métricas**
- [ ] "Mesmas condições" garantidas entre testes (protocolo §4.9 documentado)

### 9.6 Relatório (estrutura obrigatória do enunciado)

- [ ] Dados do curso, disciplina/turma, data, identificação dos alunos
- [ ] Introdução (descrição da solicitação + visão geral do relatório)
- [ ] Metodologia (organização do grupo + **roteiro dos encontros** e o que ficou resolvido em cada um)
- [ ] Seção sobre **montagem do cluster K8S**
- [ ] **Uma seção por fase** (cenários, resultados, conclusões)
- [ ] Conclusão (dificuldades, soluções) + **subseção pessoal de autoavaliação por membro** (com nota)
- [ ] Referências (incluindo Arundel & Domingus, cap. 15–16) — sem uso de terceiros sem citação
- [ ] Anexos (opcional): configs, instruções de replicação; código pesado no GitHub com link

### 9.7 Entregáveis finais

- [ ] **Código** + instruções de uso completas (README com `make` reproduzível)
- [ ] **Relatório** estruturado
- [ ] **Vídeo** (4–6 min por aluno; todos aparecem)
- [ ] Zip postado no **Moodle** por um dos alunos; extras no GitHub

### 9.8 Diferenciais (pontos extras)

- [ ] **Tracing distribuído** (OpenTelemetry + Tempo) com trace multi-serviço demonstrado
- [ ] postgres-exporter e/ou k6 remote-write (pipeline de observabilidade adicional)
- [ ] Descobertas §7 documentadas com evidência (gargalo do banco, cold start, gRPC LB)
- [ ] **Reflexão sobre cap. 15–16 (Arundel & Domingus)** no relatório: métricas organizadas em **RED + USE + Golden Signals**, **percentis P95/P99** justificados vs média, e tabela de **mudanças propostas** (§5.5) — *item exigido pela especificação*
- [ ] Logs estruturados (JSON) e/ou alerta baseado em SLO (Alertmanager) — os 3 pilares de observabilidade
- [ ] Dashboard mestre ("information radiator") com RED dos 4 serviços

---

## 10. Roteiro do vídeo

**Formato:** 5 alunos × 4–6 min = **~20–30 min total**. Cada aluno apresenta a trilha que dominou (mostra a "percepção de equilíbrio na distribuição de tarefas" que o enunciado valora). Grave telas reais (cluster, Grafana, trace), não só slides. Todo aluno deve dizer **o que fez, o que aprendeu e mostrar funcionando**.

| Bloco | Aluno (trilha) | ~min | Conteúdo (mostrar na tela) |
|---|---|---|---|
| **1. Abertura + arquitetura** | E (frontend/auth) | 5 | Problema, arquitetura (Figura 1), login no frontend, JWT emitido pelo Keycloak com role; jornada do médico vs pesquisador na tela |
| **2. Backend e regras de acesso** | B (Gateway/Auth) | 5 | Fluxo REST→gRPC; validação de JWT; demo ALLOW+FULL (médico) e **DENY** (médico sem vínculo, projeto expirado); FHIR de saída |
| **3. Dados, SQL e FHIR** | C (Patient/Transform) | 5 | Consultas e agregações; anonimização PARTIAL vs ANONYMIZED; conversão para Patient/Condition/Observation; volume do seed |
| **4. Cluster, escala e HPA** | A (plataforma) | 5–6 | `kubectl get nodes` (4 nós); deploy; `kubectl scale` 1→3; **HPA criando pods ao vivo sob carga** (`kubectl get hpa -w`); distribuição de pods |
| **5. Carga, métricas e descobertas** | D (performance) | 5–6 | k6 rodando; dashboard Grafana ao vivo; **gráficos comparativos** (1×3 réplicas, com×sem HPA); **descobertas** (gargalo do Postgres, cold start); **tracing distribuído** (ponto extra) |

**Dicas de nota no vídeo:**
- Comece cada bloco com "eu sou responsável por X, e vou mostrar Y funcionando" — deixa a contribuição individual explícita (o vídeo avalia participação).
- Priorize **mostrar rodando** sobre explicar código. Um HPA criando pods ao vivo e a latência caindo no Grafana vale mais que 3 min de slides.
- Feche com as **3 descobertas** (§7) — é o que demonstra profundidade e garante os 80%.
- Ensaie o `make demo` antes; tenha um vídeo de backup das telas caso a demo ao vivo falhe.

---

### Fecho

Se você seguir a ordem — **contratos no D1, esqueleto ambulante no D2, 5 fases medidas até o D5, descobertas e ponto extra no D6, relatório e vídeo no D7** — você entrega os 80% técnicos com folga e ainda anexa diferenciais. O que separa a nota máxima da mediana neste trabalho não é ter o FHIR mais bonito: é ter **números reais das 5 fases, gráficos comparativos com interpretação, e 3 descobertas bem explicadas**. Proteja isso acima de tudo.

---

## Apêndice A — Runbook sequencial: aplicar e verificar cada passo

Checklist **linear e ordenado**, do zero à entrega. Execute de cima para baixo. Cada passo tem uma **ação** e uma **✔ verificação** com comando e resultado esperado. **Regra dos portões (🚦):** não avance para o próximo estágio enquanto o portão não passar — é o que impede o "descobrir no dia 6 que nada integra".

> Como usar: marque `[x]` ao concluir **e verificar**. Se a verificação falha, o passo **não** está pronto. Os portões 🚦 correspondem aos milestones M1a–M6 do §3.

### Estágio 0 — Pré-requisitos da máquina (antes do D1)

- [ ] **0.1** Instalar ferramentas: Docker, `kind`, `kubectl`, `helm`, JDK 21, **Gradle** (ou usar o *wrapper* `./gradlew` de cada serviço — dispensa instalação global), Node 20+, `k6`, Python 3 + `psycopg2`/`faker`, `jq`.
  ✔ `docker --version && kind --version && kubectl version --client && helm version && java -version && k6 version` — todos respondem sem erro.
- [ ] **0.2** Conferir recursos: ≥ 8 vCPU e ≥ 16 GB RAM livres (10 pods + Postgres + stack de observabilidade pesam).
  ✔ `docker info | grep -E "CPUs|Total Memory"` — compatível com o alvo.

🚦 **Portão 0:** máquina pronta. Sem isso, o cluster ou o k6 vão falsear resultados.

### Estágio 1 — Fundação (D1)

- [ ] **1.1** Criar o repositório na estrutura do §2.4 e o `Makefile` esqueleto.
  ✔ `tree -L 2` mostra `services/ db/ k8s/ loadtest/ proto/ keycloak/ docs/`.
- [ ] **1.2** Congelar `db/schema.sql` (5 tabelas + índices, §4.3).
  ✔ `psql -h localhost -U app -d hospital -f db/schema.sql` sem erro; `\dt` lista as 5 tabelas.
- [ ] **1.3** Congelar `proto/hospital.proto` (§4.6).
  ✔ `protoc --proto_path=proto --java_out=/tmp proto/hospital.proto` compila sem erro (ou `./gradlew generateProto` num serviço).
- [ ] **1.4** Documentar o contrato de *claims* do JWT (`preferred_username`, `realm_access.roles`).
  ✔ Trecho commitado em `docs/contratos.md`.
- [ ] **1.5** Subir Keycloak (docker-compose), criar realm `hospital`, roles `MEDICO/ESTAGIARIO/PESQUISADOR`, usuários de teste (positivos **e** negativos), exportar `keycloak/realm-export.json`.
  ✔ `curl -s -X POST .../realms/hospital/protocol/openid-connect/token -d grant_type=password -d client_id=hospital-loadtest -d username=med.cardoso -d password=senha123 | jq -r .access_token` retorna um JWT; colado em jwt.io mostra a role correta.
- [ ] **1.6** Criar cluster `kind` 1 control-plane + 3 workers (§4.2).
  ✔ `kubectl get nodes` → **4 nós** `Ready` (1 control-plane, 3 workers).
- [ ] **1.7** Instalar `metrics-server` (com `--kubelet-insecure-tls`).
  ✔ `kubectl top nodes` retorna CPU/memória (não "error: metrics not available"). **Este passo é pré-requisito do HPA.**
- [ ] **1.8** Instalar `kube-prometheus-stack` via Helm no namespace `monitoring`.
  ✔ `kubectl -n monitoring get pods` todos `Running`; `kubectl -n monitoring port-forward svc/kps-grafana 3000:80` abre o Grafana e há dashboards de nó com dados.

🚦 **Portão 1 = M1a:** `kubectl get nodes` = 4 Ready · `kubectl top nodes` funciona · Grafana abre · Keycloak emite JWT · `schema.sql` e `.proto` commitados.

### Estágio 2 — Esqueleto ambulante (D2) — *o portão mais importante*

- [ ] **2.1** Scaffold dos 4 serviços Spring Boot com `Actuator` + `Prometheus` + (Gateway) `OAuth2 Resource Server` + `grpc-spring-boot-starter`.
  ✔ `docker-compose up --build` sobe os 4; `curl localhost:9000/actuator/health` → `{"status":"UP"}` em cada um.
- [ ] **2.2** Gateway valida JWT (caminho feliz).
  ✔ Sem token: `curl -o /dev/null -w "%{http_code}" localhost:9000/fhir/Patient/P000001` → **401**. Com `Authorization: Bearer <jwt>` → **200** (ou segue à cadeia).
- [ ] **2.3** Cadeia gRPC Gateway→Authorization→PatientData→DataTransform (mocks permitidos nesta etapa).
  ✔ `curl -H "Authorization: Bearer <jwt>" localhost:9000/fhir/Patient/P000001 | jq -r '.entry[].resource.resourceType' | grep -q '^Patient$'` → o **Bundle** FHIR contém um `Patient` (dado real vindo do Postgres). _Até o P3a a rota devolvia um `Patient` na raiz; o P3b passou a devolver um `Bundle` com os 5 recursos, mascarado pelo nível._
- [ ] **2.4** Cada serviço expõe `/actuator/prometheus`.
  ✔ `curl -s localhost:9000/actuator/prometheus | grep http_server_requests_seconds_count` retorna linhas.
- [ ] **2.5** Aplicar `ServiceMonitor` (após subir os serviços no cluster) e ver o alvo no Prometheus.
  ✔ No Prometheus (`port-forward svc/kps-kube-prometheus-prometheus 9090`), *Status → Targets* mostra os 4 serviços **UP**; a latência da chamada aparece num painel do Grafana.
- [ ] **2.6** `make demo` reproduz 2.3 do zero.
  ✔ Rodar `make demo` numa máquina limpa retorna o `Patient` FHIR.

🚦 **Portão 2 = M1 (crítico):** uma requisição autenticada atravessa os 4 serviços via gRPC, lê o Postgres, volta FHIR **e** vira métrica no Grafana. **Se não passar, corte realismo (mocks) até passar — não avance.**

### Estágio 3 — Engordar serviços + seed → Fase (a) Validação funcional (D3)

- [ ] **3.1** Rodar `db/seed.py` no volume-alvo (§4.4: ~50k pacientes, ~1–2M eventos, `seed=42`).
  ✔ `psql -c "select count(*) from patients"` ≈ 50000 e `select count(*) from clinical_events` na casa do milhão.
- [ ] **3.2** Implementar a matriz de autorização real (ALLOW/DENY + FULL/PARTIAL/ANONYMIZED/AGGREGATED).
  ✔ Médico com paciente vinculado → 200 + dados FULL. Médico **sem** vínculo → **403/DENY**. Projeto **Expirado** → **DENY**.
- [ ] **3.3** Patient Data com consultas e agregações reais (coorte, distribuição, média de HbA1c).
  ✔ Consulta de coorte do pesquisador retorna estatística agregada (total, % por sexo/faixa).
- [ ] **3.4** Data Transform com anonimização + mapeamento FHIR (`Patient/Encounter/Condition/Observation/MedicationRequest`).
  ✔ Estagiário (PARTIAL) → nome vem como iniciais, sem CPF/CNS. JSON do `Patient` bate com o exemplo do enunciado.
- [ ] **3.5** Empacotar imagens e subir 1 réplica de cada + 1 Postgres no cluster.
  ✔ `kubectl get pods` → todos `Running`/`Ready`; `kind load docker-image` feito para cada imagem.
- [ ] **3.6** Validar as 3 jornadas ponta a ponta no cluster.
  ✔ Médico/estagiário/pesquisador retornam o nível de dado correto; casos negativos negam.

🚦 **Portão 3 = M2:** Fase (a) fechada — autenticação, anonimização e conversão HL7/FHIR validadas com 1 réplica + 1 Postgres, sobre banco com volume. Seção "Validação funcional" escrita com prints.

### Estágio 4 — Observabilidade + carga com 1 réplica → Fases (e) e (b) (D4)

- [ ] **4.1** Dashboards **RED + USE**, ≥ 5 métricas (req/s, latência p95/p99, CPU, memória, saturação, nº de pods, erros).
  ✔ Painel do Grafana mostra dados ao vivo por serviço; screenshot salvo em `docs/evidencias/`.
- [ ] **4.2** Probes readiness/liveness *dependency-aware* (readiness checa o banco).
  ✔ Derrubar o Postgres → pod fica `NotReady` e sai do Service (não recebe tráfego). Subir → volta `Ready`.
- [ ] **4.3** Gerar pool de JWTs (`loadtest/k6/tokens.json`) com TTL longo (~30 min).
  ✔ `jq length tokens.json` > 0; tokens validam no Gateway.
- [ ] **4.4** Finalizar `scenario.js` + `warmup.sh` + `reset-state.sh` (§4.9).
  ✔ `k6 run -e VUS=10 scenario.js` completa sem erro de script; taxa de erro ~0.
- [ ] **4.5** Rodar a bateria **1 réplica** (10/50/100/500/1000) via `run-load-tests.sh 1replica`.
  ✔ `docs/evidencias/resultados.csv` ganha 5 linhas com throughput, latência média/p95, CPU, memória, erro.
- [ ] **4.6** `collect-metrics.sh` extrai PromQL no mesmo instante de cada rodada.
  ✔ CSV traz colunas de CPU/memória/saturação/db_tps preenchidas.

🚦 **Portão 4 = M3:** dashboard com ≥5 métricas ao vivo + bateria de 1 réplica completa nos 5 níveis, sob condições idênticas.

### Estágio 5 — Escalabilidade horizontal + HPA → Fases (c) e (d) (D5)

- [ ] **5.1** Corrigir o LB de gRPC (Service *headless* + `round_robin`, §4.6/§7.3) **antes** de medir escala.
  ✔ Sob carga com 3 réplicas, `kubectl top pods` mostra CPU **distribuída** entre os 3 pods (não 1 saturado e 2 ociosos).
- [ ] **5.2** Escalar para 3 réplicas por serviço.
  ✔ `kubectl get pods -o wide` → 3 réplicas de cada, **espalhadas** pelos 3 workers (coluna NODE varia).
- [ ] **5.3** Rodar a bateria **3 réplicas** (`run-load-tests.sh 3replicas`).
  ✔ CSV ganha as linhas do cenário `3replicas`.
- [ ] **5.4** Confirmar `resources.requests.cpu` em **todos** os Deployments (pré-requisito do HPA).
  ✔ `kubectl describe deploy <svc> | grep -A2 Requests` mostra `cpu`. **Sem isso o HPA reporta `<unknown>`.**
- [ ] **5.5** Aplicar o HPA (min 1 / max 10 / CPU 60%, §7.2).
  ✔ `kubectl get hpa` → coluna TARGETS mostra `<pct>%/60%` (e **não** `<unknown>/60%`).
- [ ] **5.6** Rodar a bateria **HPA** e observar a escala automática.
  ✔ `kubectl get hpa -w` e `kubectl get pods -w` mostram réplicas subindo sob carga; anotar tempo até `Ready` do pod novo (evidência de cold start §7.2). CSV ganha o cenário `hpa`.
- [ ] **5.7** Registrar o impacto no Postgres pelo padrão USE.
  ✔ Métricas de saturação do pool (`hikaricp_connections_pending`) e CPU do pod do banco capturadas no pico.

🚦 **Portão 5 = M4:** cenários 1×3 réplicas e HPA medidos; distribuição de pods evidenciada; criação automática de pods, redução de latência e **limite de escala** (gargalo) identificados.

### Estágio 6 — Ponto extra + reteste + análise (D6)

- [ ] **6.1** Anexar o agente OTel aos 4 serviços + instalar Tempo (§6).
  ✔ No Grafana → Explore → Tempo, um trace mostra `Gateway→Authorization→PatientData→(SQL)→DataTransform` com tempo por span.
- [ ] **6.2** Instalar `postgres-exporter`.
  ✔ Métrica `pg_stat_database_xact_commit` aparece no Prometheus.
- [ ] **6.3** (Opcional, ordem de ROI) k6 remote-write → Prometheus · alerta por SLO no Alertmanager · logs JSON.
  ✔ Painel único "carga vs recursos"; alerta dispara em teste; log sai estruturado.
- [ ] **6.4** Refazer rodadas suspeitas garantindo condições idênticas (§4.9).
  ✔ Repetição da mesma rodada varia < ~10% — resultados estáveis.
- [ ] **6.5** `plot.py` gera todos os gráficos comparativos (§5.3).
  ✔ `docs/evidencias/*.png`: throughput×VUs, p95×VUs, CPU/mem×VUs, 1×3 réplicas, com×sem HPA, pods×tempo.
- [ ] **6.6** Escrever as **conclusões** de cada fase (o "porquê", ancorado nas descobertas §7).

🚦 **Portão 6 = M5:** tracing distribuído demonstrado; todos os cenários coletados; conjunto completo de gráficos; rascunho de todas as seções pronto.

### Estágio 7 — Fechamento e entrega (D7)

- [ ] **7.1** Montar o relatório na estrutura obrigatória (conferir com §9.6).
  ✔ Todos os itens de 9.6 marcados.
- [ ] **7.2** Escrever Conclusão + **autoavaliação individual por membro** (com nota).
  ✔ 5 subseções pessoais presentes.
- [ ] **7.3** Ensaio: `make demo` do zero numa máquina limpa.
  ✔ Reproduz sem intervenção manual (o professor vai replicar).
- [ ] **7.4** Gravar o vídeo (4–6 min por aluno, roteiro §10).
  ✔ Todos aparecem; duração por bloco confere.
- [ ] **7.5** Revisão cruzada do relatório.
  ✔ Cada seção lida por outro membro.
- [ ] **7.6** Montar o zip (código + instruções + relatório + link vídeo/GitHub) e postar no Moodle.
  ✔ Zip abre íntegro; **checklist §9 100% marcado**.

🚦 **Portão 7 = M6 (ENTREGA):** postado no Moodle antes do prazo; código pesado no GitHub com link no relatório.

> **Resumo dos portões:** 0 (máquina) → 1/M1a (fundação) → **2/M1 (esqueleto — crítico)** → 3/M2 (validação) → 4/M3 (observabilidade+carga) → 5/M4 (escala+HPA) → 6/M5 (extra+análise) → 7/M6 (entrega). Nunca pule um portão vermelho.

