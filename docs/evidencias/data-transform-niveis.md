# Data Transform — enforcement por nível + FHIR completo

Evidência do fechamento da **dívida de enforcement** registrada no M1/P2: o `data-transform`
deixou de ignorar `nivel` (passthrough para um `Patient` mínimo) e passou a **aplicar o nível** e a
mapear os **5 recursos FHIR**. Fecha as jornadas do **MÉDICO (FULL)** e do **ESTAGIÁRIO (PARTIAL)**
ponta-a-ponta.

Coletado em **2026-07-09**, no cluster kind `pspd` com o seed de volume (50k pacientes).

> ⚠️ `make deploy` reporta `unchanged` e **não** troca os pods (tag `:dev` + `IfNotPresent`).
> É preciso `kubectl rollout restart deploy/data-transform`.

```bash
./gradlew :services:data-transform:test     # 37 testes, 0 falhas
make deploy && kubectl rollout restart deploy/data-transform
kubectl port-forward svc/keycloak 8081:8080 &
kubectl port-forward svc/api-gateway 9001:9000 &
```

---

## 1. Jornada do MÉDICO — `FULL`

```bash
TOKEN=$(KC_PORT=8081 keycloak/get-token.sh med.cardoso)
curl -s -H "Authorization: Bearer $TOKEN" localhost:9001/fhir/Patient/P000001 \
  | jq -r '.resourceType, ([.entry[].resource.resourceType]|unique|join(", "))'
```
```
Bundle
Condition, Encounter, MedicationRequest, Observation, Patient
```

**39 entries** = 1 Patient + 5 Encounter + 1 Condition + 28 Observation + 4 MedicationRequest —
bate com o prontuário de P000001 medido no P3a.

Patient (tudo presente):
```json
{"resourceType":"Patient","id":"P000001",
 "identifier":[{"system":"urn:oid:cpf","value":"000.000.000-00"},
               {"system":"urn:oid:cns","value":"700000000000000"}],
 "name":[{"text":"Joao da Silva"}],"gender":"male","birthDate":"1980-05-12",
 "address":[{"city":"Brasilia","state":"DF"}]}
```

---

## 2. Jornada do ESTAGIÁRIO — `PARTIAL` (a prova do enforcement)

```bash
TOKEN=$(KC_PORT=8081 keycloak/get-token.sh est.almeida)
curl -s -H "Authorization: Bearer $TOKEN" localhost:9001/fhir/Patient/P000001 | jq -c '.entry[0].resource'
```
```json
{"resourceType":"Patient","id":"P000001","name":[{"text":"J. da S."}],
 "gender":"male","birthDate":"1980","address":[{"city":"Brasilia","state":"DF"}]}
```

Varredura do Bundle inteiro pelos dados sensíveis:

| Agulha | Resultado |
|---|---|
| `Joao da Silva` | ✅ ausente |
| `000.000.000-00` (CPF) | ✅ ausente |
| `700000000000000` (CNS) | ✅ ausente |
| `1980-05-12` (data exata) | ✅ ausente |

E os recursos clínicos **permanecem**: `Condition, Encounter, MedicationRequest, Observation, Patient`.
O estagiário perde a identidade do paciente, não o prontuário.

> `birthDate: "1980"` é **data parcial válida no FHIR** (`YYYY`) — o recurso continua conforme.

---

## 3. Casos negativos (inalterados)

```
med.semvinculo -> HTTP 403
sem token      -> HTTP 401
```

---

## 4. Jornada do PESQUISADOR (sem rota no gateway — é o P3c)

Alimentando o `data-transform` com os payloads reais do `patient-data` via gRPC direto.
O payload de coorte tem ~215 KB, então o `-d @` (stdin) é obrigatório — `-d '<json>'` estoura o
limite de argumentos do `exec`.

```bash
kubectl port-forward svc/patient-data   9090:9090 &
kubectl port-forward svc/data-transform 9092:9090 &
G() { docker run --rm -i --network host fullstorydev/grpcurl -plaintext -max-msg-sz 20000000 "$@"; }
```

### 4.1 `AGGREGATED` → FHIR `MeasureReport`

```bash
echo '{"coorte_codigo":"Diabetes","tipo_consulta":"ResumoCoorte"}' \
  | G -d @ host.docker.internal:9090 hospital.PatientData/Fetch | jq -r .json_payload > resumo.json
jq -nc --rawfile p resumo.json '{json_payload:$p, nivel:"AGGREGATED"}' \
  | G -d @ host.docker.internal:9092 hospital.DataTransform/ToFhir | jq -r .fhir_json
```
```json
{"resourceType":"MeasureReport","measure":"Coorte/Diabetes",
 "total":8952,"mediaHbA1c":8.76,
 "stratifiers":["porSexo","porFaixa","porSetor","freqMedicamentos"]}
```
Os números batem com o P3a (`docs/evidencias/patient-data-coorte.md`). **Zero dado individual** —
nenhum recurso `Patient` no documento.

### 4.2 `ANONYMIZED` → Bundle pseudonimizado

```bash
echo '{"coorte_codigo":"Diabetes","tipo_consulta":"ExamesCoorte"}' \
  | G -d @ host.docker.internal:9090 hospital.PatientData/Fetch | jq -r .json_payload > coorte.json
jq -nc --rawfile p coorte.json '{json_payload:$p, nivel:"ANONYMIZED"}' \
  | G -d @ host.docker.internal:9092 hospital.DataTransform/ToFhir | jq -r .fhir_json > anon.json
```

Entrada: 215.268 bytes (identificados) → saída: 704.869 bytes (pseudonimizados).
**3.340 entries** = 100 Patient + 3.240 Observation. **100 pseudônimos únicos** (zero colisão).

```json
{"resourceType":"Patient","id":"hashe8de5b5725ab",
 "extension":[{"url":"http://hospital.unb.br/fhir/faixaEtaria","valueString":"40-59"}]}

{"resourceType":"Observation","status":"final","code":{"text":"HbA1c"},
 "valueQuantity":{"value":9.91,"unit":"%"},"effectiveDateTime":"2023",
 "subject":{"reference":"Patient/hashe8de5b5725ab"}}
```

| Agulha | Resultado |
|---|---|
| `P000001` (id real) | ✅ ausente |
| `Joao` | ✅ ausente |
| `Brasilia` (cidade) | ✅ ausente |
| `2023-12-06T02:51:48` (timestamp exato) | ✅ ausente |
| chaves `"nome"` / `"cidade"` | ✅ ausentes |

`effectiveDateTime` só assume `2023 2024 2025 2026` — **truncado ao ano**.

Sem `gender` nem `address`: a fonte `ExamesCoorte` não traz `genero`/`estado`, e nada é inventado.

---

## 5. Decisões de projeto

### 5.1 Datas clínicas truncadas sob ANONYMIZED

O enunciado remove "data exata" dos **demográficos**. Mas cada `Observation` carrega
`effectiveDateTime: "2023-12-06T02:51:48"`. A sequência exata de timestamps de exames é um
**quasi-identificador**: reidentifica o paciente tão bem quanto o nome. Truncamos ao ano.

Custo aceito: o pesquisador perde análise longitudinal fina; mantém coorte transversal.

### 5.2 O sal da pseudonimização não é decoração

`Pseudonymizer.of("P000001")` → `hashe8de5b5725ab`, e a derivação confere de fora:

```python
'hash' + hashlib.sha256(b'pspd-hospital-unb-2026|P000001').hexdigest()[:12]
# -> hashe8de5b5725ab   ✓
```

O espaço de ids é **enumerável e pequeno** (`P000001`..`P050000`). Um `sha256(id)` **sem sal**
(`ed87059acd46` para P000001) é invertido por uma rainbow table de 50 mil hashes calculada em
milissegundos — a pseudonimização seria puramente decorativa. O sal secreto é o que a torna
defensável; o truncamento em 12 hex (48 bits) reduz a ligabilidade sem risco real de colisão nesta
escala (confirmado: 100 pacientes → 100 hashes distintos).

No código o sal é constante, documentado como "em produção viria de um Secret".

### 5.3 Nível × shape incompatível falha alto

`FULL` com payload de coorte, `AGGREGATED` com payload individual, `nivel` vazio ou desconhecido →
`INVALID_ARGUMENT`. Significa que Gateway e Authorization discordaram; devolver dado calado no nível
errado é exatamente o bug que este serviço existe para matar. Coberto por 4 testes.

---

## 6. Regressão do M1: a rota mudou de forma

`GET /fhir/Patient/{id}` agora devolve `resourceType: "Bundle"` (antes `"Patient"`).
O smoke check passa a verificar que o Bundle **contém** um Patient:

```bash
curl -s -H "Authorization: Bearer $TOKEN" localhost:9001/fhir/Patient/P000001 \
  | jq -r '.entry[].resource.resourceType' | grep -q '^Patient$' && echo OK
```

Atualizados na época: `README.md` e `docs/evidencias/README.md`. As evidências históricas
(`seed-volume-cluster.md`, `patient-data-coorte.md`)
não foram reescritas — registram o que era verdade na data em que foram colhidas.
