# RUNBOOK — Validar as consultas nomeadas (§2.1 do enunciado)

Passo a passo copy-paste. Cada bloco tem **comando** + **saída esperada**. Rodar no cluster kind `pspd`.

> ⚠️ **Rebuild obrigatório.** O proto mudou (`PatientQuery.username = 4`) e os 4 serviços embutem o jar
> do `:proto`. `make deploy` **não** reinicia pods (`:dev` + `IfNotPresent`). Use `make redeploy`.

---

## 0. Preparar (uma vez)

```bash
make redeploy          # rebuild + kind load + rollout restart dos 4
make seed              # popula o volume (patients/encounters/events/assignments/projects)
kubectl get pods       # db, keycloak e os 4 serviços Running/Ready
```

Port-forwards + tokens (portas de host 8081/9001 p/ não colidir com o compose):

```bash
kubectl port-forward svc/keycloak    8081:8080 >/dev/null 2>&1 &
kubectl port-forward svc/api-gateway 9001:9000 >/dev/null 2>&1 &
sleep 3
MED=$(KC_PORT=8081 keycloak/get-token.sh med.cardoso)
EST=$(KC_PORT=8081 keycloak/get-token.sh est.almeida)
PESQ=$(KC_PORT=8081 keycloak/get-token.sh pesq.souza)
echo "${MED:0:20}… ${EST:0:20}… ${PESQ:0:20}…"    # 3 tokens não-vazios
```

---

## 1. Consultas individuais nomeadas (médico) — `?tipo=`

### 1a. ResumoClinico (snapshot)

```bash
curl -s -H "Authorization: Bearer $MED" 'localhost:9001/fhir/Patient/P000001?tipo=ResumoClinico' \
  | jq '[.entry[].resource.resourceType] | group_by(.) | map({(.[0]): length}) | add'
```
**Esperado** — 1 `Encounter` (último), Observations/Medications reduzidos a 1 por código, todas as Conditions:
```json
{ "Patient": 1, "Condition": 1, "Encounter": 1, "Observation": 3, "MedicationRequest": 2 }
```
> Os números de Observation/MedicationRequest = nº de exames/fármacos distintos do paciente (1 por
> `codigo_tipo`). Podem variar por paciente; o que importa: **1 Encounter** e **sem repetição por código**.

### 1b. HistoricoClinico (default, completo)

```bash
curl -s -H "Authorization: Bearer $MED" 'localhost:9001/fhir/Patient/P000001?tipo=HistoricoClinico' \
  | jq '[.entry[].resource.resourceType] | group_by(.) | map({(.[0]): length}) | add'
# idêntico a rodar SEM ?tipo= (default)
```
**Esperado** — prontuário inteiro (muitos Encounters/Observations, temporal):
```json
{ "Patient": 1, "Encounter": 5, "Condition": 1, "Observation": 28, "MedicationRequest": 4 }
```

### 1c. Exames / Medicamentos (fatia de um tipo só)

```bash
curl -s -H "Authorization: Bearer $MED" 'localhost:9001/fhir/Patient/P000001?tipo=Exames'       | jq '[.entry[].resource.resourceType] | unique'
curl -s -H "Authorization: Bearer $MED" 'localhost:9001/fhir/Patient/P000001?tipo=Medicamentos' | jq '[.entry[].resource.resourceType] | unique'
```
**Esperado**:
```json
["Observation", "Patient"]
["MedicationRequest", "Patient"]
```

---

## 2. Nível continua enforçado na fatia (estagiário = PARTIAL)

```bash
curl -s -H "Authorization: Bearer $EST" 'localhost:9001/fhir/Patient/P000001?tipo=Exames' \
  | jq '.entry[0].resource | {name: .name[0].text, identifier}'
```
**Esperado** — iniciais, sem CPF/CNS:
```json
{ "name": "J. da S.", "identifier": null }
```

---

## 3. Lista de pacientes — `GET /fhir/Patient` (searchset)

```bash
curl -s -H "Authorization: Bearer $MED" 'localhost:9001/fhir/Patient' \
  | jq '{type, total, primeiro: (.entry[0].resource | {id, name: .name[0].text, temIdentifier: (.identifier != null)})}'
```
**Esperado** (médico, FULL):
```json
{ "type": "searchset", "total": 100,
  "primeiro": { "id": "P000001", "name": "Joao da Silva", "temIdentifier": true } }
```

Estagiário (PARTIAL) — mesma rota, mascarado:
```bash
curl -s -H "Authorization: Bearer $EST" 'localhost:9001/fhir/Patient' \
  | jq '.entry[0].resource | {name: .name[0].text, identifier}'
```
**Esperado**:
```json
{ "name": "J. da S.", "identifier": null }
```

---

## 4. Lista de projetos — `GET /projects` (JSON, item iv)

```bash
curl -s -H "Authorization: Bearer $PESQ" 'localhost:9001/projects' | jq
```
**Esperado** — todos os projetos do dono, com status (inclui Expirado):
```json
{ "projetos": [
  { "id": "PRJ01", "titulo": "Coorte de diabeticos tipo 2",    "condicao": "Diabetes",    "status": "Aprovado", "validade": "2027-12-31" },
  { "id": "PRJ02", "titulo": "Estudo hipertensao (encerrado)", "condicao": "Hipertensao", "status": "Expirado", "validade": "2024-01-01" },
  { "id": "PRJ03", "titulo": "Coorte de doenca rara (vazia)",  "condicao": "Rara",        "status": "Aprovado", "validade": "2027-12-31" } ] }
```

---

## 5. Matriz de status HTTP (negativos)

Imprime só o código HTTP de cada caso:

```bash
code() { curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $1" "localhost:9001$2"; echo "  $2"; }

code "$MED"  '/fhir/Patient/P000001?tipo=ResumoClinico'   # 200
code "$MED"  '/fhir/Patient/P000001'                      # 200  (default HistoricoClinico)
code "$MED"  '/fhir/Patient/P000001?tipo=Foo'             # 400  (tipo inválido)
code "$MED"  '/fhir/Patient/P999999?tipo=Exames'          # 404  (paciente inexistente)
code "$MED"  '/fhir/Patient'                              # 200  (lista)
code "$PESQ" '/fhir/Patient'                              # 403  (cross-role: pesquisador não lista pacientes)
code "$PESQ" '/projects'                                  # 200  (lista de projetos)
code "$MED"  '/projects'                                  # 403  (cross-role: médico não lista projetos)
curl -s -o /dev/null -w "%{http_code}" 'localhost:9001/projects'; echo "  /projects (sem token)"   # 401
```

**Esperado** (coluna de códigos):
```
200  /fhir/Patient/P000001?tipo=ResumoClinico
200  /fhir/Patient/P000001
400  /fhir/Patient/P000001?tipo=Foo
404  /fhir/Patient/P999999?tipo=Exames
200  /fhir/Patient
403  /fhir/Patient
200  /projects
403  /projects
401  /projects (sem token)
```

`med.semvinculo` (sem vínculo) → **403** em qualquer `/fhir/Patient/{id}`:
```bash
SEM=$(KC_PORT=8081 keycloak/get-token.sh med.semvinculo)
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $SEM" 'localhost:9001/fhir/Patient/P000001?tipo=ResumoClinico'   # 403
```

---

## 6. Auditoria — a linha de log JSON

```bash
kubectl logs deploy/api-gateway --tail=20 | grep http_access | tail -3
```
**Esperado** — cada requisição vira uma linha com `nivel`/`role`/`status`:
```json
{"...":"...","logger":"http_access","username":"med.cardoso","role":"MEDICO","nivel":"FULL","patient_id":"P000001","status":200,"duration_ms":...}
```

---

## Notas
- Se `make redeploy` não foi rodado, as rotas novas devolvem **404** (código antigo) ou `?tipo=` é ignorado — sinal de imagem velha.
- Prova já verificada offline: `./gradlew build` (exit 0) com testes JUnit das fatias, listas e matriz de autorização.
- Detalhe de contrato e decisões: [`docs/contratos.md`](contratos.md) · [`docs/evidencias/consultas-nomeadas.md`](evidencias/consultas-nomeadas.md).
