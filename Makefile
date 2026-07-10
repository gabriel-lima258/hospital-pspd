# Makefile Corrigido para Git Bash/Windows
.PHONY: up down logs cluster cluster-down grafana images deploy redeploy seed seed-local load demo help

KIND_CLUSTER ?= pspd
KIND_BIN ?= $(shell command -v kind 2>/dev/null || echo /c/Users/carlo/AppData/Local/Microsoft/WinGet/Packages/Kubernetes.kind_Microsoft.Winget.Source_8wekyb3d8bbwe/kind.exe)
KUBECTL_BIN ?= $(shell command -v kubectl 2>/dev/null || echo /c/Users/carlo/AppData/Local/Microsoft/WinGet/Packages/Kubernetes.kubectl_Microsoft.Winget.Source_8wekyb3d8bbwe/kubectl.exe)
HELM_BIN ?= $(shell command -v helm 2>/dev/null || echo /c/Users/carlo/AppData/Local/Microsoft/WinGet/Packages/Helm.Helm_Microsoft.Winget.Source_8wekyb3d8bbwe/windows-amd64/helm.exe)

help:
	@echo "Alvos disponiveis:"
	@echo "  make up          - sobe a stack local"
	@echo "  make down        - derruba a stack local"
	@echo "  make cluster     - cria o cluster kind"
	@echo "  make load        - roda o teste de carga"

check-cluster-tools:
	@if [ -z "$(KIND_BIN)" ]; then echo "ERRO: 'kind' nao encontrado. Instale com: winget install Kubernetes.kind ou exporte KIND_BIN=/c/.../kind.exe"; exit 1; fi
	@if [ -z "$(KUBECTL_BIN)" ]; then echo "ERRO: 'kubectl' nao encontrado. Instale com: winget install Kubernetes.kubectl ou exporte KUBECTL_BIN=/c/.../kubectl.exe"; exit 1; fi
	@if [ -z "$(HELM_BIN)" ]; then echo "ERRO: 'helm' nao encontrado. Instale com: winget install Helm.Helm ou exporte HELM_BIN=/c/.../helm.exe"; exit 1; fi

check-docker:
	@docker info >/dev/null 2>&1 || { echo "ERRO: Docker daemon nao esta ativo. Inicie o Docker Desktop e tente novamente."; exit 1; }

up:
	docker compose up -d

down:
	docker compose down -v

cluster: check-cluster-tools check-docker
	@if "$(KIND_BIN)" get clusters 2>/dev/null | grep -qx "$(KIND_CLUSTER)"; then \
		echo ">> cluster kind '$(KIND_CLUSTER)' ja existe — pulando create"; \
	else \
		"$(KIND_BIN)" create cluster --name "$(KIND_CLUSTER)" --config k8s/kind-config.yaml; \
	fi
	@echo ">> registrando repositorios Helm"
	"$(HELM_BIN)" repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update
	"$(HELM_BIN)" repo update
	@echo ">> instalando kube-prometheus-stack"
	"$(HELM_BIN)" upgrade --install kps prometheus-community/kube-prometheus-stack -n monitoring --create-namespace

cluster-down:
	"$(KIND_BIN)" delete cluster --name "$(KIND_CLUSTER)"

deploy:
	"$(KUBECTL_BIN)" apply -f k8s/base -f k8s/observability --validate=false

seed:
	"$(KUBECTL_BIN)" delete job seed --ignore-not-found
	"$(KUBECTL_BIN)" apply -f k8s/jobs/seed-job.yaml

load:
	cd loadtest && bash run-load-tests.sh $(SCENARIO) $(BASE_URL)