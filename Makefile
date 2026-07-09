# Makefile — Hospital Universitário (PSPD/UnB). Tudo que repete vira alvo (regra de ouro 4).
# Dia 1: 'up/down/logs' são reais; os demais são stubs a implementar nas fases indicadas.
.PHONY: up rebuild down logs cluster cluster-down grafana check-cluster-tools images deploy redeploy seed seed-local load demo help

# Nome do cluster kind (usado por cluster / cluster-down / deploy futuro).
KIND_CLUSTER ?= pspd

help:
	@echo "Alvos disponíveis:"
	@echo "  make up          - sobe Postgres + Keycloak + os 4 serviços (docker-compose)"
	@echo "  make down        - derruba o ambiente local"
	@echo "  make logs        - segue os logs do ambiente local"
	@echo "  make cluster     - cria kind 1+3 + metrics-server + kube-prometheus-stack [D1 ✓]"
	@echo "  make cluster-down - deleta o cluster kind ($(KIND_CLUSTER))"
	@echo "  make grafana     - port-forward do Grafana em http://localhost:3000 (admin + senha do secret)"
	@echo "  make deploy      - build+kind load das imagens + aplica k8s/ no cluster [D2 ✓]"
	@echo "  make redeploy    - rebuild + kind load + rollout restart dos 4 serviços [D2 ✓]"
	@echo "  make seed        - semeia o banco no CLUSTER via Job (SCALE=$(SCALE), seed=42) [D3 ✓]"
	@echo "  make seed-local  - semeia o banco do compose (localhost:5433, SCALE=$(SCALE)) [D3 ✓]"
	@echo "  make load SCENARIO=1replica|3replicas|hpa - bateria k6 [D4/D5 — TODO]"
	@echo "  make demo        - reproduz o esqueleto ambulante do zero [D2 — TODO]"

# ── Reais (D1) ───────────────────────────────────────────────────────────────
up:
	docker compose up -d

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

# ── Deploy no cluster kind (Trilha A, §4.8) ──────────────────────────────────
SERVICES = api-gateway authorization patient-data data-transform

# Build dos 4 jars + imagens hospital/<svc>:dev, carregadas no kind (sem registry).
images:
	./gradlew build
	@for s in $(SERVICES); do \
	  echo ">> docker build hospital/$$s:dev"; \
	  docker build -t hospital/$$s:dev -f services/$$s/Dockerfile . || exit 1; \
	  echo ">> kind load hospital/$$s:dev"; \
	  kind load docker-image hospital/$$s:dev --name $(KIND_CLUSTER) || exit 1; \
	done

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
	@echo "OK. Confira: kubectl get pods"

# Recarrega só o código dos 4 serviços (rebuild + kind load + rollout restart); manifests já aplicados.
redeploy: check-cluster-tools images
	@for s in $(SERVICES); do kubectl rollout restart deploy/$$s; done
	@for s in $(SERVICES); do kubectl rollout status deploy/$$s --timeout=240s || exit 1; done

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

load:
	@echo "[TODO D4/D5] bateria k6 (10/50/100/500/1000 VUs). SCENARIO=$(SCENARIO)"
	@echo "Próximo passo: prompt P-k6-scripts / §4.9 do roteiro."

demo:
	@echo "[TODO D2] reproduz o esqueleto ambulante: requisição atravessa Gateway->gRPC->3 serviços->Postgres->FHIR->métrica."
	@echo "Próximo passo: P-walking-skeleton (milestone M1)."
