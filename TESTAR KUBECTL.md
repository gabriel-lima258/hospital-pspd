# TESTAR — Trilha A (Arthur): escala, HPA e balanceamento gRPC

> **Arquivo temporário de handoff.** Apagar depois que as evidências estiverem em
> `docs/evidencias/escala-hpa-grpc-lb.md` e o commit estiver feito.
>
> **Para a IA que ler isto sem o contexto da conversa:** leia a seção
> [Contexto](#contexto-para-quem-chegou-agora) primeiro. O usuário (Arthur) vai colar as saídas dos
> comandos abaixo. A seção [O que fazer com os resultados](#o-que-fazer-com-os-resultados) diz o que
> significa cada saída e o que produzir a partir dela.

---

## Contexto (para quem chegou agora)

**Projeto:** `hospital-pspd` — trabalho acadêmico de PSPD (FGA/UnB). Microsserviços Java 21 /
Spring Boot / gRPC rodando em cluster `kind` (1 control-plane + 3 workers), observabilidade com
`kube-prometheus-stack`. Manual de operação: `CLAUDE.md`. Placar: `docs/CHECKLIST.md`. Enunciado do
professor: `docs/EnunciadoTrabalho.md`.

**Nota:** 80% nível técnico + profundidade · 20% entregas. Os 80% dependem de **números medidos** nas
5 fases: (a) validação funcional ✅, (b) carga, (c) escalabilidade horizontal, (d) autoscaling/HPA,
(e) observabilidade. Hoje **nenhum número medido existe**.

**Divisão:** o Arthur é dono da Trilha A (plataforma/K8S/DevOps). O Carlos é dono da Trilha D
(k6, coleta de métricas, gráficos). O Arthur entrega a infra; o Carlos mede.

### O que acabou de ser implementado (código pronto, NÃO testado)

Uma sessão anterior escreveu, mas **nada rodou no cluster ainda**:

| Arquivo | O que é |
|---|---|
| `k8s/base/grpc-headless.yaml` (novo) | 3 Services headless (`clusterIP: None`), porta gRPC 9090 |
| `services/api-gateway/src/main/resources/application.yml` | endereço gRPC e LB policy parametrizados por env |
| `docker-compose.yml` | envs no `api-gateway` (os nomes `*-headless` não existem no compose) |
| `k8s/base/api-gateway.yaml` | `JAVA_TOOL_OPTIONS` com TTL de DNS |
| `k8s/base/{api-gateway,authorization,patient-data,data-transform}.yaml` | `replicas:` **removido** |
| `k8s/hpa/hpa.yaml` (novo) | 4 HPAs, `autoscaling/v2`, min 1 / max 10, CPU 60% |
| `k8s/base/*.yaml` | `topologySpreadConstraints` (`maxSkew: 1`, soft) — espalha réplicas pelos 3 workers |
| `scripts/watch-hpa.sh` (novo) | amostra réplicas/CPU num CSV; `make watch-hpa SCENARIO=…` |
| `Makefile` | alvos `scale`, `pods-wide`, `watch-hpa`, `grpc-lb-on/off`, `hpa-on/off`, `rebuild`, `demo` reais |

### As duas descobertas técnicas por trás disso

**1. O diagnóstico do grupo estava errado sobre o gRPC.**

`docs/CHECKLIST.md` e `docs/Roteiro_PSPD_Observabilidade_K8S.md` §7.3 diziam: *"falta setar
`defaultLoadBalancingPolicy: round_robin` no cliente"*. **Falso.** O
`net.devh:grpc-client-spring-boot-starter:3.1.0.RELEASE` **já usa `round_robin` como default**
(verificado extraindo as strings de `GrpcChannelProperties.class`).

A causa real: um `Service` **ClusterIP** resolve para **um único IP virtual**. O `round_robin` faz
round-robin sobre a lista de endereços que o resolver DNS devolveu — e essa lista tem 1 elemento.
Somado a isso, o gRPC abre **uma** conexão HTTP/2 de longa duração e multiplexa todos os streams
nela, enquanto o `kube-proxy` só balanceia no *estabelecimento* da conexão. Resultado: 3 réplicas,
**1 pod recebe ~100% da carga**.

Fix: `Service` **headless** (`clusterIP: None`) → o DNS devolve um registro A por pod.

Isso conecta com o enunciado, §3 linha 150: *"dependendo da arquitetura da aplicação, **nem todos os
arranjos são admitidos** e, em alguns casos, a aplicação pode não funcionar adequadamente."*

**2. `-Dnetworkaddress.cache.ttl` não funciona.**

É uma *security property* (lida de `$JAVA_HOME/conf/security/java.security`), **não** uma system
property — passar via `-D` é ignorado. A equivalente configurável por `-D` é `sun.net.inetaddr.ttl`.
Isso importa porque, com Service headless, um pod novo criado pelo HPA demora a entrar na rotação:
EndpointSlice atualiza → registro A muda → cache de `InetAddress` da JVM expira → o
`DnsNameResolver` do grpc-java re-resolve (ele **não** re-resolve periodicamente em background).

### Por que existe o toggle `grpc-lb-on` / `grpc-lb-off`

A descoberta §7.3 precisa de um **"antes"** (sem balanceamento) e um **"depois"** (com). Se o fix
fosse uma edição destrutiva, o "antes" só poderia ser medido numa janela de tempo antes do commit —
dependência de calendário entre Arthur e Carlos, marcada como risco 🔴 no checklist.

O toggle converte isso em **flag de runtime**. Os dois estados coexistem no repo.

⚠️ **Pegadinha:** o **default virou o sistema correto** (headless + `round_robin`). Logo a rodada
"antes" exige `make grpc-lb-off` **explícito**. Se o Carlos esquecer, ele mede "depois" duas vezes e
a descoberta §7.3 desaparece.

---

## Comandos a rodar (WSL)

`kind` e `kubectl` só funcionam no WSL nesta máquina. `cd /mnt/e/GitHub/hospital-pspd`.

Cole a saída de **cada bloco** de volta para a IA, identificando o número do bloco.

### Bloco 0 — Pré-condição (não pule)

O toggle depende do `application.yml` novo estar **dentro da imagem**. `kubectl set env` sozinho não
adianta se a imagem carrega o `application.yml` antigo.

```bash
make images && make deploy
kubectl get pods
```

**Esperado:** `db`, `keycloak` e os 4 serviços `Running`/`Ready`.

---

### Bloco 1 — Causa-raiz do §7.3: o DNS

```bash
make scale N=3

kubectl run dns --rm -it --restart=Never --image=busybox:1.36 -- \
  nslookup patient-data.default.svc.cluster.local

kubectl run dns --rm -it --restart=Never --image=busybox:1.36 -- \
  nslookup patient-data-headless.default.svc.cluster.local
```

**Esperado:** o primeiro devolve **1** endereço (o IP virtual do Service). O segundo devolve **3**
(um por pod).

---

### Bloco 2 — O toggle funciona

```bash
make grpc-lb-off
kubectl set env deploy/api-gateway --list | grep GRPC
kubectl get pods -l app=api-gateway

make grpc-lb-on
kubectl set env deploy/api-gateway --list | grep GRPC
kubectl get pods -l app=api-gateway
```

**Esperado:** depois do `off`, 4 variáveis `GRPC_*` listadas e o pod volta `Ready`. Depois do `on`,
nenhuma variável (volta ao default do `application.yml`) e o pod volta `Ready`.

**Risco conhecido, não eliminado offline:** se `pick_first` não for uma policy registrada no
grpc-java 1.63, o gateway não sobe após `grpc-lb-off`. Deveria estar registrada
(`PickFirstLoadBalancerProvider`). Se o pod ficar em `CrashLoopBackOff`:

```bash
kubectl logs deploy/api-gateway --tail=50
```

---

### Bloco 3 — HPA reporta `%`, não `<unknown>`

```bash
make hpa-on
sleep 60
kubectl get hpa
```

**Esperado:** coluna `TARGETS` com `<n>%/60%`.
`<unknown>/60%` = `metrics-server` ainda populando (espere mais) ou `requests.cpu` ausente (os 4
Deployments já têm `250m`, então não deveria acontecer).

---

### Bloco 4 — Distribuição de pods (Portão 5 — **tire screenshot**)

```bash
make pods-wide
kubectl top nodes
```

**Esperado:** pods de um mesmo Deployment em workers diferentes (os 4 Deployments declaram
`topologySpreadConstraints` com `maxSkew: 1`). Como o constraint é *soft* (`ScheduleAnyway`), um
desbalanceamento residual é possível se um nó estiver sem recursos — nesse caso `kubectl describe
pod <p> | grep -A3 Events` explica.

---

### Bloco 5 — Smoke ponta-a-ponta

```bash
make hpa-off && make scale N=1
make demo
```

**Esperado:** 3 linhas `OK` — médico/FULL, pesquisador/AGGREGATED, DENY 403.

---

### Bloco 6 — Inner loop local não regrediu

O default do `application.yml` mudou para `*-headless`, que **não existe** no docker-compose. Foram
adicionadas envs no `docker-compose.yml` para compensar. Confirmar:

```bash
make down && make rebuild
TOKEN=$(keycloak/get-token.sh med.cardoso)
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:9000/fhir/Patient/P000001 | jq -r '.entry[].resource.resourceType'
```

**Esperado:** `Patient` na lista.
Erro de DNS para `authorization-headless` = as envs do compose não pegaram.

---

### Bloco 7 — §7.3 antes × depois (**precisa do Carlos rodando k6**)

Só faz sentido com carga. Combinar horário com o Carlos. **Uma variável muda por vez**: mesmo seed,
mesmo nº de VUs, mesma rampa.

```bash
# ANTES
make grpc-lb-off && make hpa-off && make scale N=3
#   ... Carlos roda a bateria k6 ...
kubectl top pods -l app=patient-data

# DEPOIS
make grpc-lb-on && make hpa-off && make scale N=3
#   ... mesma bateria ...
kubectl top pods -l app=patient-data
```

**Esperado:** antes → 1 pod saturado, 2 quase ociosos. Depois → CPU comparável nos 3.

---

### Bloco 8 — Fase (d): HPA sob carga (**gráfico-assinatura, precisa do Carlos**)

O `kubectl get hpa -w` gera texto, não dado. O CSV é o que vira gráfico.

```bash
make grpc-lb-on && make scale N=1 && make hpa-on

make watch-hpa SCENARIO=hpa &     # <- amostra a cada 5s -> docs/evidencias/hpa-timeline.csv
kubectl get hpa -w                # noutro terminal, para o screenshot do vídeo

#   ... Carlos roda a rampa até 1000 VUs ...

kill %1                           # para o watch-hpa
kubectl get events --sort-by=.lastTimestamp | grep -E 'Scheduled|Started|Ready'
head -5 docs/evidencias/hpa-timeline.csv; tail -5 docs/evidencias/hpa-timeline.csv
```

**Esperado:** `TARGETS` sobe → `REPLICAS` sobe → latência p95 **piora antes de melhorar** (cold-start
da JVM + defasagem de DNS). Isso é a descoberta §7.2, não um bug.

No CSV, a distância entre as colunas `replicas` e `ready` é o cold-start: um pod contado em
`replicas` mas ausente de `ready` está subindo e não atende ninguém.

**Rode `make watch-hpa SCENARIO=1replica` / `SCENARIO=3replicas` também nas baterias de réplica
fixa.** Ali o CSV prova que a contagem **não** variou durante a medição — é a evidência de "mesmas
condições de teste", exigida pelo enunciado ("Garantir as mesmas condições de teste de
infraestrutura [...] de modo a não contaminar os resultados").

---

## O que fazer com os resultados

Instruções para a IA que receber as saídas coladas.

### 1. Diagnosticar antes de registrar

Para cada bloco, compare a saída com o "Esperado". **Se divergir, é bug — investigue e conserte, não
registre como evidência.** Falhas prováveis e onde olhar:

| Sintoma | Causa provável | Onde olhar |
|---|---|---|
| Bloco 1: headless devolve 1 endereço | `grpc-headless.yaml` não aplicado, ou `make scale N=3` não subiu 3 pods | `kubectl get svc`, `kubectl get endpoints patient-data-headless` |
| Bloco 2: gateway em `CrashLoopBackOff` após `grpc-lb-off` | `pick_first` não registrada, ou imagem antiga sem os placeholders | `kubectl logs deploy/api-gateway` |
| Bloco 2: `set env --list` não muda nada | imagem antiga — faltou `make images` | rodar o Bloco 0 |
| Bloco 3: `<unknown>/60%` persistente | `metrics-server` fora do ar | `kubectl -n kube-system get deploy metrics-server` |
| Bloco 5: `make demo` falha no smoke | port-forward, seed, ou regressão funcional | logs dos 4 serviços |
| Bloco 6: erro DNS `authorization-headless` | envs do compose não aplicadas | `docker compose config` |

### 2. Preencher as evidências

O arquivo `docs/evidencias/escala-hpa-grpc-lb.md` **já existe**, estruturado, com blocos marcados
`(pendente)`. Cole cada saída no bloco correspondente.

**Regras (do `CLAUDE.md`, seção Convenções):**
- **Nunca invente número.** Se um bloco não rodou, deixe `(pendente)`.
- Evidências antigas **não são reescritas** quando o código evolui — elas registram o que era verdade
  na data.
- Screenshot vai como PNG em `docs/evidencias/`.

### 3. Atualizar o checklist

`docs/CHECKLIST.md`, Portão 5 — hoje estes dois estão `[ ]` **de propósito**, porque manifesto sem
print não vale nota:

```
- [ ] **Arthur** `kubectl get hpa` mostra `%/60%` ... — **falta rodar e capturar**
- [ ] **Arthur** Distribuição de pods entre os 3 workers (`make pods-wide`, screenshot) — **falta capturar**
```

Marcar `[x]` **só** depois da evidência colada. Idem o `make demo` no Portão 2 (exige
`DEMO_FRESH=1` rodado ponta-a-ponta ao menos uma vez).

### 4. Escrever as seções §7.2 e §7.3 do relatório

São o que o Arthur apresenta no vídeo (bloco 4: *"Cluster, escala e HPA"*). Cada gráfico entra
**acompanhado de um parágrafo de leitura** — gráfico sem interpretação vale metade.

- **§7.3** — a história é: diagnóstico do grupo estava errado; a policy já era `round_robin`; o
  gargalo era o DNS devolver 1 endereço; HTTP/2 multiplexa; `kube-proxy` balanceia conexões, não
  requisições. Evidência: `nslookup` + `kubectl top pods` antes/depois.
  Se o ganho de throughput `off`→`on` for **pequeno**, isso **não** é falha do fix — é o Postgres
  saturando (descoberta §7.1, 1 réplica *stateful*, gargalo esperado e desejado). Nesse caso a
  evidência do balanceamento é o `kubectl top pods`, não o throughput. **Registrar os dois.**
- **§7.2** — o autoscaling não é gratuito nem instantâneo. Separar os dois efeitos: (i) cold-start da
  JVM (`Scheduled` → `Ready`, esperado 20–40 s) e (ii) defasagem de re-resolução DNS (`Ready` → o
  gateway realmente mandar tráfego). Citar a armadilha do `networkaddress.cache.ttl`.

### 5. Commitar

Nada foi commitado ainda. Contexto que importa: `docs/CHECKLIST.md` §7 registra como risco 🔴 a
*"distribuição desigual do trabalho"* — o Gabriel adiantou código de 4 trilhas, incluindo `k8s/base/`.
O enunciado avalia *"percepção de equilíbrio na distribuição das tarefas"* (linha 208) e o vídeo expõe
quem fez o quê. Este commit é o que torna a peça do Arthur.

Commits pequenos e frequentes na `main` (convenção do projeto). Não commitar antes de ver funcionar.

---

## Pendências que não dependem destes testes

- **Avisar o Carlos** (Trilha D): o default agora é o sistema **correto**. A rodada "antes" do §7.3
  exige `make grpc-lb-off` explícito. O contrato de cenários está no `README.md`, seção
  *"Cenários de teste (interface entre Trilha A e Trilha D)"*.
- **Portão 0:** `grpcurl` não instalado no host — contornado via container `fullstorydev/grpcurl`.
- **Portão 7:** `make demo DEMO_FRESH=1` nunca rodou do zero. O professor vai querer replicar.
- **Apagar este arquivo** quando tudo acima estiver fechado.
