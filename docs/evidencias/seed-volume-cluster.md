# Evidência — D3 Passo 1: seed de volume no cluster (`make seed`, §4.4)

Volume de produção-de-teste semeado no Postgres do cluster kind (`db:5432`) via Job k8s,
`seed=42` (reprodutível), `COPY` em massa (não INSERT). Comando: `make seed SCALE=50000`.

## Contagens (kubectl exec deploy/db -- psql ...)

| Tabela | Linhas | Alvo §4.4 |
|---|---:|---|
| `patients` | **50.000** | 50.000 |
| `encounters` | **199.615** | ~200.000 |
| `clinical_events` | **1.360.406** | 1–2M |
| `user_patient_assignments` | **50.200** | ~55.000 |
| `projects` | **50** | ~50 |

## Distribuições clínicas (dão sentido às agregações do pesquisador)

- Diabéticos: **17,9%** (alvo ~18%)
- Hipertensos: **25,2%** (alvo ~25%)

## Alinhamento com os usuários do Keycloak (validação funcional)

| Verificação | Resultado |
|---|---|
| `med.cardoso` vínculo médico ativo | **1000** pacientes (inclui P000001) |
| `est.almeida` supervisionado por `med.cardoso` | **200** pacientes |
| `med.semvinculo` (caso DENY) | **0** vínculos |
| `P000001` ↔ `med.cardoso` | **1** (paciente-alvo fixado) |
| `pesq.souza` projetos | **PRJ01** Diabetes/Aprovado/2027-12-31 · **PRJ02** Hipertensao/Expirado/2024-01-01 |

## Regressão do esqueleto ambulante (M1 continua verde)

Requisição autenticada in-cluster (`kubectl port-forward svc/keycloak 8081`, `svc/api-gateway 9001`):

```
== ALLOW (med.cardoso → P000001) ==
{"resourceType":"Patient","id":"P000001","name":[{"text":"Joao da Silva"}],"birthDate":"1980-05-12","gender":"male"}

== DENY (med.semvinculo → P000001) ==
HTTP 403
```

## Como reproduzir

```bash
make seed SCALE=50000        # cluster (Job k8s) — default
make seed-local SCALE=50000  # compose (localhost:5433)
# validar:
kubectl exec deploy/db -- psql -U app -d hospital -c "SELECT count(*) FROM clinical_events"
```
