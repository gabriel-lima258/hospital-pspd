# Escalabilidade, HPA e balanceamento gRPC (Trilha A — Portão 5)

> ⚠️ **Estado: protocolo de captura, ainda SEM medição.** Os manifests e os alvos do `Makefile`
> existem e os YAMLs validam, mas **nenhum comando abaixo foi executado no cluster**. Cada bloco
> `RESULTADO` está vazio de propósito. Preencher no ato da captura (regra de ouro: evidência no
> mesmo dia) — **não** copiar números de outra rodada.
>
> **Dono:** Arthur (Trilha A). **Consumidor:** Carlos (§7.3) e o relatório §9.5 fases (c) e (d).

---

## 0. Pré-condição

O toggle depende do `application.yml` novo estar **dentro da imagem**. `kubectl set env` sozinho não
basta se a imagem carrega o `application.yml` antigo.

```bash
make images && make deploy
```

---

## 1. Causa-raiz do §7.3 — o DNS devolve 1 IP virtual

A afirmação a provar: um `Service` ClusterIP resolve para **um** endereço; o headless resolve para
**um por pod**. É isso, e só isso, que impede o `round_robin` de funcionar.

```bash
make scale N=3

# ClusterIP → 1 IP virtual (o do Service, não o dos pods)
kubectl run dns --rm -it --restart=Never --image=busybox:1.36 -- \
  nslookup patient-data.default.svc.cluster.local

# headless → 3 registros A, um por pod
kubectl run dns --rm -it --restart=Never --image=busybox:1.36 -- \
  nslookup patient-data-headless.default.svc.cluster.local
```

**RESULTADO** _(colar as duas saídas do `nslookup`)_:

```
(pendente)
```

> **Leitura para o relatório.** O `net.devh:grpc-client-spring-boot-starter:3.1.0.RELEASE` já usa
> `round_robin` como `defaultLoadBalancingPolicy` — verificável em `GrpcChannelProperties`. Ele faz
> round-robin **sobre a lista de endereços que o resolver DNS devolveu**. Com ClusterIP essa lista
> tem um elemento. Somado a isso, o gRPC abre **uma** conexão HTTP/2 de longa duração e multiplexa
> todos os streams nela, enquanto o `kube-proxy` só balanceia no estabelecimento da conexão. Logo:
> 3 réplicas, 1 pod trabalhando. O diagnóstico corrente no roteiro (“falta setar `round_robin`”)
> estava incorreto; o fix é o `clusterIP: None`.

---

## 2. §7.3 — antes × depois, com carga

Uma variável muda por vez. Mesmo `SCALE` do seed, mesmo nº de VUs, mesmo tempo de rampa.

```bash
# ── ANTES: ClusterIP + pick_first
make grpc-lb-off && make hpa-off && make scale N=3
#   ... Carlos roda a bateria k6 ...
kubectl top pods -l app=patient-data

# ── DEPOIS: headless + round_robin
make grpc-lb-on && make hpa-off && make scale N=3
#   ... mesma bateria ...
kubectl top pods -l app=patient-data
```

**RESULTADO — `kubectl top pods` (antes)**: espera-se 1 pod saturado, 2 ~ociosos.

```
(pendente)
```

**RESULTADO — `kubectl top pods` (depois)**: espera-se CPU comparável nos 3.

```
(pendente)
```

**RESULTADO — throughput e p95 (do CSV do Carlos)**:

| Cenário | VUs | Throughput (req/s) | p95 (ms) | Erro (%) |
|---|---|---|---|---|
| 3replicas, `grpc-lb-off` | 500 | (pendente) | (pendente) | (pendente) |
| 3replicas, `grpc-lb-on`  | 500 | (pendente) | (pendente) | (pendente) |

> Se o ganho de `off`→`on` for pequeno, **não é falha do fix**: é o Postgres saturando (§7.1). Nesse
> caso a evidência do balanceamento é o `kubectl top pods`, não o throughput. Registrar os dois.

---

## 3. Fase (c) — distribuição dos pods entre os 3 workers

Exigido pelo enunciado §3(c): *"a utilização dos nós do cluster, a distribuição dos pods do K8S"*.

Os 4 Deployments declaram `topologySpreadConstraints` (`maxSkew: 1`, `topologyKey:
kubernetes.io/hostname`, `whenUnsatisfiable: ScheduleAnyway`). Sem isso o default do scheduler é
`maxSkew: 3` e 3 réplicas poderiam cair 2/1/0. É *soft* de propósito: com o HPA indo a 10 réplicas,
um `DoNotSchedule` deixaria pods em `Pending` ao lotar o nó, e `Pending` sob carga contamina a fase (d).

```bash
make scale N=3
make pods-wide          # kubectl get pods -o wide
kubectl top nodes
```

**RESULTADO** _(colar a saída; conferir se os pods de um mesmo Deployment caem em workers diferentes)_:

```
(pendente)
```

---

## 4. Fase (d) — HPA

Exigido pelo enunciado §3(d): demonstrar *"(i) criação automática de pods, (ii) redistribuição da
carga, (iii) redução de latência, (iv) limites de escalabilidade"*.

```bash
make grpc-lb-on && make scale N=1 && make hpa-on
kubectl get hpa                 # o portão exige `<n>%/60%`, NÃO `<unknown>/60%`
kubectl get hpa -w              # sob carga: TARGETS sobe, REPLICAS sobe
kubectl get pods -w             # tempo até Ready de cada pod novo
```

**RESULTADO — `kubectl get hpa`** _(prova de que o `requests.cpu` está sendo lido)_:

```
(pendente)
```

> `<unknown>/60%` significa `metrics-server` ainda populando (aguardar ~60 s) ou `resources.requests.cpu`
> ausente. Os 4 Deployments já têm `requests: { cpu: "250m" }`.

**RESULTADO — `get hpa -w` durante a rampa de 1000 VUs**:

```
(pendente)
```

### 4b. Série temporal (pods × tempo) — o gráfico-assinatura da fase (d)

`kubectl get hpa -w` gera texto, não dado. Para o gráfico 6 do roteiro (§4.9 — *nº de pods × tempo
sobreposto à carga*) é preciso amostrar. Rodar **em background, antes** de o Carlos disparar a rampa:

```bash
make watch-hpa SCENARIO=hpa &
#   ... rampa k6 até 1000 VUs ...
kill %1
```

Gera `docs/evidencias/hpa-timeline.csv` com
`ts_utc,elapsed_s,scenario,deployment,replicas,ready,cpu_pct,desired`. Rodadas de cenários
diferentes acumulam no mesmo arquivo, distinguidas pela coluna `scenario` — o `plot.py` do Carlos
filtra por ela.

Vale rodar **também** nos cenários de réplica fixa: o CSV então prova que a contagem **não** variou
durante a bateria (`replicas` constante, `cpu_pct` vazio), o que valida "mesmas condições de teste"
exigido pelo enunciado.

**RESULTADO — `hpa-timeline.csv`** _(colar as primeiras e as últimas linhas; o arquivo inteiro vai
versionado)_:

```
(pendente)
```

> Repare na coluna `ready` × `replicas`: a distância entre as duas é o **cold-start da JVM** (§7.2).
> Um pod contado em `replicas` mas ausente de `ready` está subindo e não atende ninguém.

---

## 5. §7.2 — HPA × cold-start da JVM (e a defasagem de DNS)

Dois efeitos somados atrasam o alívio que o HPA deveria dar. Medir **os dois**, separados:

1. **Cold-start da JVM.** Do `Scheduled` ao `Ready` de um pod novo. Esperado 20–40 s.
2. **Defasagem de re-resolução DNS.** Do pod ficar `Ready` até o gateway realmente mandar tráfego para
   ele. Encadeia: EndpointSlice atualiza → registro A do Service headless muda → cache de
   `InetAddress` da JVM expira → o `DnsNameResolver` do grpc-java re-resolve (ele **não** re-resolve
   periodicamente em background; só sob churn de subchannel).

Mitigação aplicada no `k8s/base/api-gateway.yaml`:

```yaml
- name: JAVA_TOOL_OPTIONS
  value: "-Dsun.net.inetaddr.ttl=5 -Dsun.net.inetaddr.negative.ttl=0"
```

> ⚠️ **Armadilha que vale o parágrafo no relatório:** `-Dnetworkaddress.cache.ttl` **não tem efeito**.
> É uma *security property*, lida de `$JAVA_HOME/conf/security/java.security`, não uma system property.
> A equivalente configurável por `-D` é `sun.net.inetaddr.ttl`.

```bash
# tempo até Ready dos pods criados pelo HPA
kubectl get events --sort-by=.lastTimestamp | grep -E 'Scheduled|Started|Ready'
# latência p95 no mesmo eixo temporal (Prometheus / painel do Guilherme)
```

**RESULTADO — tempo `Scheduled` → `Ready`**:

```
(pendente)
```

**RESULTADO — p95 ao longo da rampa** (esperado: **piora** enquanto os pods sobem, depois melhora):

```
(pendente)
```

> **Leitura para o relatório.** O autoscaling não é gratuito nem instantâneo. Sob rampa rápida, a
> latência piora antes de melhorar: os pods novos consomem CPU do nó para subir a JVM enquanto ainda
> não atendem, e mesmo depois de `Ready` levam mais alguns segundos para entrar na rotação do cliente
> gRPC. É o argumento a favor de `minReplicas` folgado ou de *pre-scaling* antes de picos previstos —
> exatamente o que Arundel & Domingus (cap. 16) chamam de automatizar a ação, mas com histerese.

---

## 6. Reprodutibilidade

```bash
make demo DEMO_FRESH=1      # cluster do zero → deploy → seed → smoke das 3 jornadas
```

**RESULTADO** _(as 3 linhas `OK` do smoke)_:

```
(pendente)
```
