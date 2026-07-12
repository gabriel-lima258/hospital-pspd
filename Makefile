# Makefile — Hospital Universitário (PSPD/UnB). Tudo que repete vira alvo (regra de ouro 4).
.PHONY: up rebuild down logs cluster cluster-down grafana front check-cluster-tools images deploy redeploy \
        seed seed-local grpc-lb-on grpc-lb-off hpa-on hpa-off scale pods-wide watch-hpa load plot loki dashboard tracing tracing-off demo help

# Nome do cluster kind (usado por cluster / cluster-down / deploy futuro).
KIND_CLUSTER ?= pspd

help:
	@echo "Alvos disponíveis:"
	@echo "  make up          - sobe Postgres + Keycloak + os 4 serviços (docker-compose)"
	@echo "  make rebuild     - recompila as imagens do compose e sobe (use após mexer em services/**)"
	@echo "  make down        - derruba o ambiente local"
	@echo "  make logs        - segue os logs do ambiente local"
	@echo "  make cluster     - cria kind 1+3 + metrics-server + kube-prometheus-stack [D1 ✓]"
	@echo "  make cluster-down - deleta o cluster kind ($(KIND_CLUSTER))"
	@echo "  make grafana     - port-forward do Grafana em http://localhost:3000 (admin + senha do secret)"
	@echo "  make front       - port-forward do frontend em http://localhost:8088 (SPA React)"
	@echo "  make loki        - Loki + Promtail (bônus): agrega logs JSON no Grafana (LogQL)"
	@echo "  make dashboard   - importa o dashboard RED/USE no Grafana do kps (fase e)"
	@echo "  make tracing     - Tempo + OTel agent (bônus): liga traces REST→gRPC→SQL no Grafana"
	@echo "  make tracing-off - desliga o export de traces (volta ao default inerte)"
	@echo "  make deploy      - build+kind load das imagens + aplica k8s/base + k8s/observability [D2 ✓]"
	@echo "  make redeploy    - rebuild + kind load + rollout restart dos 4 serviços [D2 ✓]"
	@echo "  make seed        - semeia o banco no CLUSTER via Job (SCALE=$(SCALE), seed=42) [D3 ✓]"
	@echo "  make seed-local  - semeia o banco do compose (localhost:5433, SCALE=$(SCALE)) [D3 ✓]"
	@echo ""
	@echo "  Escala e balanceamento (Trilha A — fases c/d):"
	@echo "  make scale N=3   - fixa as réplicas dos 4 serviços"
	@echo "  make pods-wide   - kubectl get pods -o wide (distribuição entre os workers)"
	@echo "  make watch-hpa SCENARIO=hpa - amostra réplicas/CPU num CSV (rode em background na rampa)"
	@echo "  make grpc-lb-on  - gRPC balanceado: Service headless + round_robin (default)"
	@echo "  make grpc-lb-off - gRPC pinado em 1 pod: ClusterIP + pick_first (o 'antes' do §7.3)"
	@echo "  make hpa-on      - aplica o HPA (min 1 / max 10 / CPU 60%)"
	@echo "  make hpa-off     - remove o HPA (siga de 'make scale N=' p/ fixar as réplicas)"
	@echo ""
	@echo "  make load SCENARIO=1replica|3replicas|hpa - bateria k6 [D4/D5 — TODO, Trilha D]"
	@echo "  make demo        - reproduz o esqueleto ambulante (DEMO_FRESH=1 recria o cluster) [D2 ✓]"

# ── Reais (D1) ───────────────────────────────────────────────────────────────
up:
	docker compose up -d

# `up` reusa as imagens existentes; depois de mexer em services/** é preciso reconstruir.
rebuild:
	docker compose up -d --build

down:
	docker compose down -v

logs:
	docker compose logs -f

# ── Cluster K8S (Trilha A, §4.2) ─────────────────────────────────────────────
# Preflight: exige as ferramentas de cluster no PATH antes de tentar qualquer coisa.
check-cluster-tools:
	@command -v kind    >/dev/null 2>&1 || { echo "ERRO: 'kind' não encontrado. Instale: brew install kind";       exit 1; }
	@command -v kubectl >/dev/null 2>&1 || { echo "ERRO: 'kubectl' não encontrado. Instale: brew install kubectl"; exit 1; }
	@command -v helm    >/dev/null 2>&1 || { echo "ERRO: 'helm' não encontrado. Instale: brew install helm";       exit 1; }

# Sobe o cluster completo: kind (1 CP + 3 workers) + metrics-server + kube-prometheus-stack.
# Idempotente: não recria o kind se já existe; usa `helm upgrade --install` para poder re-rodar.
cluster: check-cluster-tools
	@if kind get clusters 2>/dev/null | grep -qx "$(KIND_CLUSTER)"; then \
	  echo ">> cluster kind '$(KIND_CLUSTER)' já existe — pulando create"; \
	else \
	  kind create cluster --name "$(KIND_CLUSTER)" --config k8s/kind-config.yaml; \
	fi
	@echo ">> registrando repositórios Helm"
	helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ --force-update
	helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update
	helm repo update
	@echo ">> instalando metrics-server (--kubelet-insecure-tls é obrigatório no kind)"
	helm upgrade --install metrics-server metrics-server/metrics-server \
	  -n kube-system --set 'args={--kubelet-insecure-tls}'
	@echo ">> instalando kube-prometheus-stack (Prometheus + Grafana + exporters)"
	helm upgrade --install kps prometheus-community/kube-prometheus-stack \
	  -n monitoring --create-namespace
	@echo ">> aguardando metrics-server ficar pronto"
	kubectl rollout status deploy/metrics-server -n kube-system --timeout=120s
	@echo ""
	@echo "OK. Cluster pronto. Confira:"
	@echo "  kubectl get nodes        # 4 nós Ready (1 control-plane + 3 workers)"
	@echo "  kubectl top nodes        # metrics-server (pode levar ~30-60s)"
	@echo "  make grafana             # abre o Grafana em http://localhost:3000"

cluster-down:
	kind delete cluster --name "$(KIND_CLUSTER)"

# Port-forward do Grafana do kube-prometheus-stack (bloqueia até Ctrl+C).
grafana:
	@echo "Grafana: http://localhost:3000  (usuário: admin)"
	@echo -n "senha: "; kubectl -n monitoring get secret kps-grafana -o jsonpath='{.data.admin-password}' | base64 -d; echo
	kubectl port-forward -n monitoring svc/kps-grafana 3000:80

# Loki + Promtail (bônus, §6 observabilidade): agrega os logs JSON de todos os pods e os expõe no
# Grafana do kps como datasource. Promtail (DaemonSet) coleta o stdout dos pods → Loki → LogQL.
# Rodar DEPOIS de `make cluster` (usa a namespace monitoring do kps).
loki: check-cluster-tools
	@echo ">> registrando repositório Helm grafana"
	helm repo add grafana https://grafana.github.io/helm-charts --force-update
	helm repo update
	@echo ">> instalando loki-stack (Loki single-binary + Promtail DaemonSet)"
	helm upgrade --install loki grafana/loki-stack -n monitoring --create-namespace \
	  --set loki.isDefault=false --set promtail.enabled=true
	@echo ">> registrando o Loki como datasource do Grafana (sidecar do kps)"
	kubectl apply -f k8s/observability/loki-datasource.yaml
	@echo ">> aguardando Promtail (1 pod por nó)"
	kubectl rollout status daemonset/loki-promtail -n monitoring --timeout=180s
	@echo "OK. Grafana → Explore → Loki. Ex.: {namespace=\"default\"} | json | nivel=\"FULL\""

# Dashboard RED/USE (fase e da observabilidade). JSON versionado → ConfigMap com o label que o
# sidecar de dashboards do kps-grafana observa e importa. Rodar após `make cluster`.
dashboard: check-cluster-tools
	kubectl create configmap red-use-dashboard -n monitoring \
	  --from-file=red-use.json=k8s/observability/dashboards/red-use.json \
	  --dry-run=client -o yaml | kubectl apply -f -
	kubectl label configmap red-use-dashboard -n monitoring grafana_dashboard=1 --overwrite
	@echo "OK. Grafana → Dashboards → 'Hospital PSPD — RED / USE' (via make grafana)."

# Tracing distribuído (bônus, §6): Tempo + OTel Java agent (já embutido nas imagens, inerte por
# default). Este alvo sobe o Tempo, registra o datasource e LIGA o export nos 4 serviços. O agent é
# auto-instrumentado (HTTP/gRPC/JDBC) → trace REST→gRPC→gRPC→SQL. Requer imagens novas (make redeploy).
tracing: check-cluster-tools
	helm repo add grafana https://grafana.github.io/helm-charts --force-update
	helm repo update
	@echo ">> instalando Tempo (monolítico, receiver OTLP em :4317)"
	helm upgrade --install tempo grafana/tempo -n monitoring --create-namespace \
	  --set 'tempo.receivers.otlp.protocols.grpc.endpoint=0.0.0.0:4317'
	kubectl apply -f k8s/observability/tempo-datasource.yaml
	@echo ">> ligando o export de traces nos 4 serviços (OTEL_SDK_DISABLED=false)"
	@for s in $(SERVICES); do kubectl set env deploy/$$s OTEL_SDK_DISABLED=false; done
	@for s in $(SERVICES); do kubectl rollout status deploy/$$s --timeout=180s; done
	@echo "OK. Gere tráfego (make demo) e veja: Grafana → Explore → Tempo. Trace→log via trace_id."

# Desliga o export de traces (volta ao default inerte). Use antes/entre baterias k6 se ligou o tracing.
tracing-off: check-cluster-tools
	@for s in $(SERVICES); do kubectl set env deploy/$$s OTEL_SDK_DISABLED=true; done
	@for s in $(SERVICES); do kubectl rollout status deploy/$$s --timeout=180s; done
	@echo "OK. Tracing desligado (agent segue carregado, mas inerte)."

# ── Deploy no cluster kind (Trilha A, §4.8) ──────────────────────────────────
SERVICES = api-gateway authorization patient-data data-transform

# Imagens hospital/<svc>:dev, carregadas no kind (sem registry).
# Cada Dockerfile é multi-stage: compila o bootJar num temurin:21-jdk, então não
# depende de Java no host. (Testes de unidade: rode `./gradlew build` onde houver JDK.)
images:
	@for s in $(SERVICES); do \
	  echo ">> docker build hospital/$$s:dev"; \
	  docker build --provenance=false -t hospital/$$s:dev -f services/$$s/Dockerfile . || exit 1; \
	  echo ">> kind load hospital/$$s:dev"; \
	  kind load docker-image hospital/$$s:dev --name $(KIND_CLUSTER) || exit 1; \
	done
	@echo ">> docker build hospital/frontend:dev (contexto = ./frontend)"
	docker build --provenance=false -t hospital/frontend:dev -f frontend/Dockerfile frontend || exit 1
	@echo ">> kind load hospital/frontend:dev"
	kind load docker-image hospital/frontend:dev --name $(KIND_CLUSTER) || exit 1

# Deploy completo: gera ConfigMaps a partir dos arquivos-fonte, aplica manifests e espera os rollouts.
deploy: check-cluster-tools images
	@echo ">> ConfigMaps (schema+seed, realm) a partir dos arquivos-fonte"
	kubectl create configmap pg-initdb \
	  --from-file=01-schema.sql=db/schema.sql \
	  --from-file=02-seed-min.sql=db/seed-min.sql \
	  --dry-run=client -o yaml | kubectl apply -f -
	kubectl create configmap keycloak-realm \
	  --from-file=realm-export.json=keycloak/realm-export.json \
	  --dry-run=client -o yaml | kubectl apply -f -
	@echo ">> aplicando manifests"
	kubectl apply -f k8s/base -f k8s/observability
	@echo ">> aguardando rollouts"
	kubectl rollout status deploy/db       --timeout=180s
	kubectl rollout status deploy/keycloak --timeout=240s
	@for s in $(SERVICES); do kubectl rollout status deploy/$$s --timeout=240s || exit 1; done
	kubectl rollout status deploy/frontend --timeout=180s
	@echo "OK. Confira: kubectl get pods"

# Recarrega o código dos 4 serviços + frontend (rebuild + kind load + rollout restart); manifests já aplicados.
redeploy: check-cluster-tools images
	@for s in $(SERVICES) frontend; do kubectl rollout restart deploy/$$s; done
	@for s in $(SERVICES) frontend; do kubectl rollout status deploy/$$s --timeout=240s || exit 1; done

# Port-forward do frontend (SPA) em http://localhost:8088. Requer também os port-forwards de
# api-gateway (9000) e keycloak (8080, com '127.0.0.1 keycloak' no hosts) — ver docs/RUNBOOK-frontend.md.
front: check-cluster-tools
	kubectl port-forward svc/frontend 8088:80

# ── Seed de volume (Trilha D, §4.4) ──────────────────────────────────────────
# nº de pacientes; encounters/events derivam disto no seed.py. Override: make seed SCALE=200000
SCALE ?= 50000

# CLUSTER: ConfigMap com o script + Job que roda o seed contra db:5432 dentro do cluster.
# O Job é imutável → deleta o anterior antes; injeta SCALE via placeholder.
seed: check-cluster-tools
	@echo ">> ConfigMap seed-script a partir de db/seed.py"
	kubectl create configmap seed-script \
	  --from-file=seed.py=db/seed.py \
	  --dry-run=client -o yaml | kubectl apply -f -
	@echo ">> (re)criando o Job seed (SCALE=$(SCALE))"
	kubectl delete job seed --ignore-not-found
	sed 's/SCALE_PLACEHOLDER/$(SCALE)/' k8s/jobs/seed-job.yaml | kubectl apply -f -
	@echo ">> aguardando o Job concluir (pode levar alguns minutos p/ 50k)"
	kubectl wait --for=condition=complete job/seed --timeout=900s
	kubectl logs job/seed --tail=20

# LOCAL (compose): venv isolada com faker+psycopg2-binary → seed contra localhost:5433.
# Requer `make up` no ar. python3 é pré-requisito documentado.
seed-local:
	@test -d .venv || python3 -m venv .venv
	./.venv/bin/pip install --quiet --upgrade pip
	./.venv/bin/pip install --quiet faker psycopg2-binary
	./.venv/bin/python db/seed.py --dsn "postgresql://app:app@localhost:5433/hospital" --scale $(SCALE)

# ── Escala, balanceamento gRPC e HPA (Trilha A, fases c/d) ───────────────────
# Interface estável consumida pelo loadtest/run-load-tests.sh (Trilha D). Ver README.
#
#   1replica              : make hpa-off && make scale N=1
#   3replicas (§7.3 antes): make grpc-lb-off && make hpa-off && make scale N=3
#   3replicas (§7.3 depois): make grpc-lb-on && make hpa-off && make scale N=3
#   hpa                   : make grpc-lb-on && make scale N=1 && make hpa-on
#
# Não rode `kubectl apply -f k8s/base` no meio de um cenário: recria o estado.

# Fixa o número de réplicas dos 4 serviços. Espera todos ficarem Ready antes de devolver.
scale: check-cluster-tools
	@test -n "$(N)" || { echo "ERRO: uso 'make scale N=<n>'"; exit 1; }
	kubectl scale --replicas=$(N) $(foreach s,$(SERVICES),deploy/$(s))
	@for s in $(SERVICES); do kubectl rollout status deploy/$$s --timeout=180s || exit 1; done

pods-wide:
	kubectl get pods -o wide

# Série temporal de réplicas/CPU dos 4 serviços → CSV. Rode em background ANTES da rampa do k6:
#   make watch-hpa SCENARIO=hpa &   ...rampa...   kill %1
# É o dado do gráfico "nº de pods × tempo" (§4.9 #6), a assinatura da fase (d).
SCENARIO ?= unnamed
INTERVAL ?= 5
watch-hpa:
	INTERVAL=$(INTERVAL) SCENARIO=$(SCENARIO) bash scripts/watch-hpa.sh

# O default do application.yml já é headless+round_robin: `grpc-lb-on` só remove o override.
# `kubectl set env` é idempotente, dispara o rollout sozinho e sobrevive a `kubectl apply`
# (as chaves não são declaradas no Deployment — ver k8s/base/api-gateway.yaml).
grpc-lb-on: check-cluster-tools
	kubectl set env deploy/api-gateway \
	  GRPC_AUTHORIZATION_ADDRESS- GRPC_PATIENT_DATA_ADDRESS- \
	  GRPC_DATA_TRANSFORM_ADDRESS- GRPC_LB_POLICY-
	kubectl rollout status deploy/api-gateway --timeout=120s
	@echo "OK. gRPC via Service headless + round_robin (balanceia entre as réplicas)."

# Reproduz o arranjo que não balanceia: ClusterIP resolve p/ 1 IP virtual e o HTTP/2 multiplexa
# tudo numa conexão só → 1 pod recebe ~100% da carga. É o "antes" da descoberta §7.3.
grpc-lb-off: check-cluster-tools
	kubectl set env deploy/api-gateway \
	  GRPC_AUTHORIZATION_ADDRESS=dns:///authorization:9090 \
	  GRPC_PATIENT_DATA_ADDRESS=dns:///patient-data:9090 \
	  GRPC_DATA_TRANSFORM_ADDRESS=dns:///data-transform:9090 \
	  GRPC_LB_POLICY=pick_first
	kubectl rollout status deploy/api-gateway --timeout=120s
	@echo "OK. gRPC via ClusterIP + pick_first (pinado em 1 pod) — cenário 'antes' do §7.3."

hpa-on: check-cluster-tools
	kubectl apply -f k8s/hpa
	@echo ">> aguardando o metrics-server popular as métricas (pode levar ~60s)"
	kubectl get hpa

# Deletar o HPA NÃO reseta a contagem de réplicas — ela fica onde estava.
hpa-off: check-cluster-tools
	kubectl delete -f k8s/hpa --ignore-not-found
	@echo "OK. HPA removido. As réplicas ficaram onde estavam — use 'make scale N=' p/ fixá-las."

# Bateria k6 dos 5 níveis para um cenário. Prepara o estado do cluster, port-forward efêmero,
# warm-up + 3min + cool-down por nível, summary-export → loadtest/out/. Ver loadtest/README.md.
# SCENARIO: 1replica | 3replicas-off | 3replicas-on | hpa
SCENARIO ?= 1replica
load: check-cluster-tools
	loadtest/run-load-tests.sh $(SCENARIO)

# Gera CSV mestre + PNGs (throughput/p95/1v3) a partir dos summaries em loadtest/out/.
plot:
	python3 loadtest/plot.py

# ── Demo ponta-a-ponta (M1 / Portão 7) ───────────────────────────────────────
# Default reusa o cluster (~2 min). DEMO_FRESH=1 recria do zero (~12 min) — é o que o Portão 7
# pede no ensaio geral, mas destrói o seed de volume, então não é o default.
DEMO_FRESH ?= 0
DEMO_SCALE ?= 5000

demo: check-cluster-tools
	@if [ "$(DEMO_FRESH)" = "1" ]; then \
	  echo ">> DEMO_FRESH=1 — recriando o cluster do zero (lento, ~12 min)"; \
	  $(MAKE) cluster-down || true; \
	  $(MAKE) cluster; \
	fi
	$(MAKE) deploy
	$(MAKE) seed SCALE=$(DEMO_SCALE)
	@echo ""
	@echo ">> smoke das 3 jornadas (port-forward efêmero em 8081/9001)"
	@set -e; \
	kubectl port-forward svc/keycloak 8081:8080 >/dev/null 2>&1 & KC_PF=$$!; \
	kubectl port-forward svc/api-gateway 9001:9000 >/dev/null 2>&1 & GW_PF=$$!; \
	trap 'kill $$KC_PF $$GW_PF 2>/dev/null || true' EXIT; \
	sleep 5; \
	TOKEN=$$(KC_PORT=8081 keycloak/get-token.sh med.cardoso); \
	curl -s -H "Authorization: Bearer $$TOKEN" localhost:9001/fhir/Patient/P000001 \
	  | jq -r '.entry[].resource.resourceType' | grep -q '^Patient$$' \
	  && echo "  OK  medico/FULL        -> Patient no Bundle FHIR"; \
	PTOKEN=$$(KC_PORT=8081 keycloak/get-token.sh pesq.souza); \
	curl -s -H "Authorization: Bearer $$PTOKEN" \
	  'localhost:9001/fhir/cohort/PRJ01?tipo=ResumoCoorte' \
	  | jq -e '.resourceType=="MeasureReport"' >/dev/null \
	  && echo "  OK  pesquisador/AGG    -> MeasureReport (sem dado individual)"; \
	NTOKEN=$$(KC_PORT=8081 keycloak/get-token.sh med.semvinculo); \
	code=$$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $$NTOKEN" \
	  localhost:9001/fhir/Patient/P000001); \
	[ "$$code" = "403" ] && echo "  OK  medico sem vínculo -> DENY (403)"; \
	echo ""; \
	echo "Esqueleto ambulante de pé. Métrica: make grafana -> http_server_requests_seconds_count{application=\"api-gateway\"}"
