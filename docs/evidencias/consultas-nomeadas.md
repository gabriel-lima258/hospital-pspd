# Evidência — Consultas nomeadas do enunciado (§2.1 + footnote ²)

> **Escopo.** Fecha as 2 lacunas de conformidade achadas na auditoria contra o enunciado: as consultas
> nomeadas de médico/estagiário (`ResumoClinico`/`HistoricoClinico`/`Exames`/`Medicamentos`/`ListaPacientes`)
> e a lista de projetos do pesquisador (item iv, `ListaProjetos`).
>
> **Prova.** Código + **testes JUnit verdes** (`./gradlew build` exit 0), cobrindo fatias, listas e a
> matriz de autorização (seção 5). Validação E2E via `curl`: roteiro passo-a-passo com saídas esperadas
> em [`docs/RUNBOOK-consultas-nomeadas.md`](../RUNBOOK-consultas-nomeadas.md) (exige `make redeploy` +
> `make seed` — o proto mudou, rebuild obrigatório).

## Contrato (o que mudou)

- **Proto (aditivo):** `PatientQuery` **+** `string username = 4` — usado só nas listas; individual/coorte ignoram. Log em [`docs/contratos.md`](../contratos.md).
- **Rotas novas no Gateway:** `GET /fhir/Patient` (lista, searchset) e `GET /projects` (JSON). A rota individual ganhou `?tipo=`.
- **Vocabulário `tipo_consulta`:** tabela completa em [`docs/contratos.md`](../contratos.md).

## Setup

```bash
kubectl port-forward svc/keycloak    8081:8080 &
kubectl port-forward svc/api-gateway 9001:9000 &
MED=$(KC_PORT=8081 keycloak/get-token.sh med.cardoso)
EST=$(KC_PORT=8081 keycloak/get-token.sh est.almeida)
PESQ=$(KC_PORT=8081 keycloak/get-token.sh pesq.souza)
```

---

## 1. Consultas individuais nomeadas — a MESMA rota, fatias diferentes

O `?tipo=` seleciona a fatia; o **nível** (FULL/PARTIAL) continua vindo da role. O Patient Data fatia o
payload e o Data Transform monta o `Bundle` só com os recursos presentes.

```bash
curl -s -H "Authorization: Bearer $MED" 'localhost:9001/fhir/Patient/P000001?tipo=ResumoClinico'   | jq '[.entry[].resource.resourceType] | group_by(.) | map({(.[0]): length})'
curl -s -H "Authorization: Bearer $MED" 'localhost:9001/fhir/Patient/P000001?tipo=HistoricoClinico' | jq '[.entry[].resource.resourceType] | group_by(.) | map({(.[0]): length})'
curl -s -H "Authorization: Bearer $MED" 'localhost:9001/fhir/Patient/P000001?tipo=Exames'           | jq '[.entry[].resource.resourceType] | unique'
curl -s -H "Authorization: Bearer $MED" 'localhost:9001/fhir/Patient/P000001?tipo=Medicamentos'     | jq '[.entry[].resource.resourceType] | unique'
```

**Shapes esperadas** (footnote ²):

| `?tipo=` | Recursos no Bundle |
|---|---|
| `ResumoClinico` | `Patient` + `Condition[]` (diagnósticos) + **1** `Encounter` (último) + `Observation` (o mais recente por exame) + `MedicationRequest` (o mais recente por fármaco) |
| `HistoricoClinico` (default) | `Patient` + **todos** os `Encounter`/`Condition`/`Observation`/`MedicationRequest` (temporal) |
| `Exames` | `Patient` + só `Observation[]` |
| `Medicamentos` | `Patient` + só `MedicationRequest[]` |

> **Definição operacional (documentar no relatório).** Sem flag de "ativo" no schema, "em uso"/"últimos"
> = evento mais recente por `codigo_tipo`; "último atendimento" = encounter mais recente; "diagnósticos
> principais" = todas as Conditions. Coberto por `FhirTransformerTest` (fatias) + `AuthorizationPolicyTest`.

### Nível continua enforçado na fatia

```bash
curl -s -H "Authorization: Bearer $EST" 'localhost:9001/fhir/Patient/P000001?tipo=Exames' | jq '.entry[0].resource | {name, identifier}'
```
Estagiário (PARTIAL): `name: "J. da S."`, `identifier: null` (sem CPF/CNS), ainda na fatia de exames.

---

## 2. `GET /fhir/Patient` — lista de pacientes do cuidador (searchset)

```bash
curl -s -H "Authorization: Bearer $MED" 'localhost:9001/fhir/Patient' | jq '{type, total, primeiro: .entry[0].resource | {id, name: .name[0].text, identifier: (.identifier != null)}}'
```

Esperado (médico, FULL):
```json
{ "type": "searchset", "total": 100,
  "primeiro": { "id": "P000001", "name": "Joao da Silva", "identifier": true } }
```

Estagiário (PARTIAL) — mesma rota, cada Patient mascarado:
```bash
curl -s -H "Authorization: Bearer $EST" 'localhost:9001/fhir/Patient' | jq '.entry[0].resource | {name: .name[0].text, identifier}'
# → { "name": "J. da S.", "identifier": null }
```

**Segurança.** A rota não recebe alvo: o `username` vem do JWT e o filtro por `username_cuidador` é do
Patient Data — um cuidador nunca lista pacientes de outro. `LIMIT 100` protege a resposta (~1000 vínculos
no seed).

---

## 3. `GET /projects` — projetos do pesquisador + status (item iv)

```bash
curl -s -H "Authorization: Bearer $PESQ" 'localhost:9001/projects' | jq
```

Esperado (JSON puro — `projects` não tem recurso FHIR no enunciado):
```json
{ "projetos": [
  { "id": "PRJ01", "titulo": "Coorte de diabeticos tipo 2", "condicao": "Diabetes",    "status": "Aprovado", "validade": "2027-12-31" },
  { "id": "PRJ02", "titulo": "Estudo hipertensao (encerrado)", "condicao": "Hipertensao", "status": "Expirado", "validade": "2024-01-01" },
  { "id": "PRJ03", "titulo": "Coorte de doenca rara (vazia)", "condicao": "Rara",        "status": "Aprovado", "validade": "2027-12-31" } ] }
```

Traz **todos** os projetos do dono — inclusive `Expirado`/`Suspenso` — porque o status é o dado pedido.

---

## 4. Matriz de status HTTP

| Chamada | HTTP | Por quê |
|---|:--:|---|
| `GET /fhir/Patient/P000001?tipo=ResumoClinico` (med c/ vínculo) | **200** | Bundle fatiado |
| `GET /fhir/Patient/P000001?tipo=Exames` (med) | **200** | Bundle só Observation |
| `GET /fhir/Patient/P000001` (sem `?tipo`) | **200** | default `HistoricoClinico` (retrocompat) |
| `GET /fhir/Patient/P000001?tipo=Foo` | **400** | tipo fora do vocabulário |
| `GET /fhir/Patient/P999999?tipo=Exames` (inexistente, med) | **404** | `NOT_FOUND` → `GrpcHttpExceptionHandler` |
| `GET /fhir/Patient/P000001` com `med.semvinculo` | **403** | sem vínculo → DENY |
| `GET /fhir/Patient` (lista, med/est) | **200** | searchset |
| `GET /fhir/Patient` com `pesq.souza` | **403** | cross-role (pesquisador não lista pacientes) |
| `GET /projects` (pesq) | **200** | JSON com status |
| `GET /projects` com `med.cardoso` | **403** | cross-role (médico não lista projetos) |
| qualquer rota **sem token** | **401** | `SecurityConfig` |

---

## 5. Prova verificada agora (testes JUnit — `./gradlew build` exit 0)

- `AuthorizationPolicyTest` — `ListaPacientes`→FULL/PARTIAL sem vínculo; `ListaProjetos`(PESQUISADOR)→ALLOW; consultas individuais nomeadas mantêm FULL/PARTIAL sse vínculo; cross-role→DENY.
- `FhirTransformerTest` — `Exames`→Bundle só Observation; `Medicamentos`→só MedicationRequest; `ListaPacientes`→Bundle `searchset` (FULL c/ nome+identifier, PARTIAL c/ iniciais sem CPF/CNS).
- Suíte completa segue verde (sem regressão nas 3 jornadas anteriores).

## 6. Decisões registradas (relatório)
- **Bundle filtrado, não `Composition`** — o enunciado congela o escopo FHIR nos 5 recursos da tabela; resumo/histórico = conjunto certo desses recursos.
- **Projetos em JSON** — `projects` não tem recurso FHIR no enunciado; lista é metadado administrativo.
- **`?tipo=` muda fatia, não nível** — nível é sempre da role.
