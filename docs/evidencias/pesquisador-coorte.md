# Evidência — jornada do PESQUISADOR pela rota REST

> Colhido em **2026-07-09**, no cluster kind `pspd`, após `make redeploy` + `make seed`.
> Rota nova: `GET /fhir/cohort/{projetoId}?tipo=ResumoCoorte|Estatisticas|ExamesCoorte`.

## Setup

```bash
kubectl port-forward svc/keycloak    8081:8080 &
kubectl port-forward svc/api-gateway 9001:9000 &
PESQ=$(KC_PORT=8081 keycloak/get-token.sh pesq.souza)
```

⚠️ `make deploy` **não** reinicia pods (tag `:dev` + `imagePullPolicy: IfNotPresent`). Como o
`proto` mudou e os 4 serviços embutem o jar do `:proto`, o passo obrigatório é **`make redeploy`**
(rebuild + `kind load` + `rollout restart` dos 4). Depois, `make seed` para materializar o `PRJ03`.

---

## 1. O invariante de segurança: a coorte nasce no servidor

O cliente escolhe o **projeto** e o **tipo**; nunca a coorte. O `coorte_codigo` é resolvido pelo
Authorization a partir do projeto cujo dono, status e vigência ele acabou de validar, e viaja de
volta no `AuthzReply` (campo 3, novo). O gateway o repassa ao Patient Data **sem tocar**.

Se houvesse um `?coorte=` na rota, `pesq.souza` autorizaria em `PRJ01` (Diabetes) e leria a coorte
de qualquer outro projeto — bypass completo. A rota não tem esse parâmetro.

`grpcurl` direto no Authorization (`kubectl port-forward svc/authorization 9090:9090`):

| Entrada | `AuthzReply` |
|---|---|
| `pesq.souza` + `PRJ01` + `ResumoCoorte` | `{allow:true, nivel:"AGGREGATED", coorte_codigo:"Diabetes"}` |
| `pesq.souza` + `PRJ01` + `ExamesCoorte` | `{allow:true, nivel:"ANONYMIZED", coorte_codigo:"Diabetes"}` |
| `pesq.souza` + `PRJ03` + `ResumoCoorte` | `{allow:true, nivel:"AGGREGATED", coorte_codigo:"Rara"}` |
| `pesq.souza` + `PRJ02` (Expirado) | `{}` ← DENY: **nem `nivel` nem `coorte_codigo` vazam** |
| `pesq.souza` + `PRJ04` (dono é `pesq.0002`) | `{}` |
| `med.cardoso` + `PRJ01` | `{}` ← perfil errado não recebe coorte |
| `med.cardoso` + `Patient` + `P000001` | `{allow:true, nivel:"FULL"}` ← **retrocompatível**: campo 3 omitido |

O `{}` do proto3 (defaults omitidos na serialização JSON) é a prova de que a negação devolve
`allow=false`, `nivel=""` e `coorte_codigo=""`.

Dupla proteção: `AuthorizationGrpcService.coorteCodigoDaReply` só preenche o campo quando
`allow && role == PESQUISADOR && projeto.codigoCondicao() != null`. Coberto por 4 testes JUnit puros
em `AuthorizationGrpcServiceTest` — nem um bug no gateway consegue transformar um DENY em consulta.

---

## 2. `ResumoCoorte` → FHIR `MeasureReport` (AGGREGATED)

```bash
curl -s -H "Authorization: Bearer $PESQ" 'localhost:9001/fhir/cohort/PRJ01?tipo=ResumoCoorte' | jq
```

```json
{
  "resourceType": "MeasureReport",
  "measure": "Coorte/Diabetes",
  "total": 8952,
  "mediaHbA1c": 8.76,
  "stratifiers": ["porSexo", "porFaixa", "porSetor", "freqMedicamentos"],
  "porSexo": [{"male": 49.31}, {"female": 46.89}, {"other": 3.8}]
}
```

`measure: "Coorte/Diabetes"` a partir de uma URL que só diz `PRJ01` — é a resolução server-side
visível na saída. `total = 8952` bate com o `SELECT count(DISTINCT id_paciente) FROM clinical_events
WHERE codigo_tipo='Diabetes'`.

**Somas por dimensão** (DoD: ~100 em cada):

```
porSexo: 100        porFaixa: 100        porSetor: 100.01        freqMedicamentos: 99.99999999999999
```

Os desvios são arredondamento a 2 casas (`porSetor`) e ponto flutuante binário (`freqMedicamentos`);
os denominadores estão certos — cada dimensão é *share-of-total* sobre o seu próprio denominador
(pacientes / atendimentos / prescrições).

**Nenhum dado individual escapa:**
```
$ ... | jq '[.. | objects | select(.resourceType? == "Patient")] | length'
0
```

---

## 3. `ExamesCoorte` → `Bundle` pseudonimizado (ANONYMIZED)

```bash
curl -s -H "Authorization: Bearer $PESQ" 'localhost:9001/fhir/cohort/PRJ01?tipo=ExamesCoorte' | jq
```

`Bundle` (`type: collection`) com **3.340 entries**: 100 `Patient` + 3.240 `Observation`.

```json
{"resourceType":"Patient","id":"hashe8de5b5725ab",
 "extension":[{"valueString":"40-59","url":"http://hospital.unb.br/fhir/faixaEtaria"}]}

{"resourceType":"Observation","status":"final","code":{"text":"HbA1c"},
 "valueQuantity":{"value":9.91,"unit":"%"},"effectiveDateTime":"2023",
 "subject":{"reference":"Patient/hashe8de5b5725ab"}}
```

Checagens sobre o Bundle inteiro (215 KB):

| Verificação | Resultado |
|---|---|
| ids no formato `^hash[0-9a-f]{12}$` | **100 de 100** |
| `effectiveDateTime` distintos no Bundle todo | `2023 2024 2025 2026` — só o ano |
| `name`, `identifier`, `cpf`, `cns`, `city`, `address`, `birthDate` | **ausentes** (0 ocorrências) |
| id real (`P0000…`) | **ausente** (0 ocorrências) |

A data exata dos exames é quasi-identificador: com nome e nascimento removidos, a sequência de
timestamps ainda reidentifica. Por isso o truncamento ao ano (custo: perde-se análise longitudinal
fina). O `subject.reference` usa o pseudônimo, então o Bundle segue internamente consistente.

---

## 4. Matriz de status HTTP

| Chamada | HTTP | Por quê |
|---|:--:|---|
| `PRJ01?tipo=ResumoCoorte` | **200** | `MeasureReport` |
| `PRJ01?tipo=Estatisticas` | **200** | idem (mesmo nível AGGREGATED) |
| `PRJ01?tipo=ExamesCoorte` | **200** | `Bundle` pseudonimizado |
| `PRJ02?tipo=ResumoCoorte` | **403** | projeto **Expirado** |
| `PRJ04?tipo=ResumoCoorte` | **403** | projeto de **outro dono** (`pesq.0002`), embora Aprovado |
| `PRJ99?tipo=ResumoCoorte` | **403** | projeto **inexistente** (indistinguível de "de outro dono" — de propósito) |
| `PRJ03?tipo=ResumoCoorte` | **404** | coorte **vazia** (condição `Rara`, 0 pacientes) |
| `PRJ03?tipo=ExamesCoorte` | **404** | idem |
| `PRJ01?tipo=Foo` | **400** | tipo fora do vocabulário |
| `PRJ01` (sem `?tipo`) | **400** | `@RequestParam` obrigatório |
| `PRJ01?tipo=ResumoCoorte` com token de **`med.cardoso`** | **403** | perfil errado — negado pelo Authorization, sem `@PreAuthorize` |
| `PRJ01?tipo=ResumoCoorte` **sem token** | **401** | `SecurityConfig` |

### O 404 precisou de um fixture novo

Coorte vazia **não** estoura exceção: `buildAggregated` devolve `total: 0` (o `Percentages.pct` trata
`denom == 0`) e `buildCohortSample` devolve `pacientes: []` — ambos viram FHIR válido. Sem uma guarda
explícita no gateway, o cliente receberia **200** e não distinguiria "projeto sem dados" de "projeto
com dados". A guarda roda **antes** do Data Transform, economizando a 3ª chamada gRPC.

E o ramo era **inalcançável**: `pesq.souza` só era dono de `PRJ01` (Diabetes) e `PRJ02` (Expirado→403),
e todos os 5 `codigo_condicao` do seed têm pacientes. Daí o `PRJ03` fixo no `db/seed.py` — Aprovado,
vigente, condição `Rara` com 0 eventos. É o irmão do `med.semvinculo`: um fixture negativo permanente
e reproduzível por `make seed`, não um `UPDATE` manual no psql.

```sql
-- confirmação no cluster
SELECT count(*) FROM clinical_events WHERE codigo_tipo='Rara';   -- 0
SELECT id_projeto, username_pesquisador, codigo_condicao, status FROM projects WHERE id_projeto<='PRJ04';
--  PRJ01 | pesq.souza | Diabetes    | Aprovado
--  PRJ02 | pesq.souza | Hipertensao | Expirado
--  PRJ03 | pesq.souza | Rara        | Aprovado
--  PRJ04 | pesq.0002  | Hipertensao | Aprovado
```

### O 502

```bash
kubectl scale deploy/patient-data --replicas=0
curl ... /fhir/cohort/PRJ01?tipo=ResumoCoorte   # 502
curl ... /fhir/cohort/PRJ02?tipo=ResumoCoorte   # 403 — nega ANTES de tocar o patient-data
curl ... /fhir/cohort/PRJ01?tipo=Foo            # 400 — valida ANTES de qualquer gRPC
kubectl scale deploy/patient-data --replicas=1  # volta a 200
```

O `StatusRuntimeException` (`UNAVAILABLE`) vira **502 Bad Gateway** — falha de upstream, não erro do
cliente. Esse `try/catch` é **local a esta rota**: o `@ControllerAdvice` global (que faria
`NOT_FOUND→404`, `INVALID_ARGUMENT→400` para toda a API) é item de backlog de outro integrante, e
mexer nele agora mudaria o comportamento da rota do prontuário — regressão do M1.

---

## 5. Regressão do M1 (as outras duas jornadas continuam de pé)

O `FhirPatientController` só trocou o `extractRole` privado pelo helper `JwtRoles` compartilhado.

| Perfil | Resultado |
|---|---|
| `med.cardoso` (FULL) | **200** `Bundle` — 1 Patient, 5 Encounter, 1 Condition, 28 Observation, 4 MedicationRequest; `name: "Joao da Silva"`, `birthDate: "1980-05-12"`, CPF+CNS presentes |
| `est.almeida` (PARTIAL) | `name: "J. da S."`, `birthDate: "1980"`, `identifier: null`, `city: "Brasilia"` |
| `med.semvinculo` | **403** |

---

## 6. Contagens do seed nesta rodada

```
patients                 : 50,000
encounters               : 199,827
clinical_events          : 1,387,934
user_patient_assignments : 50,200
projects                 : 50
coorte Diabetes          : 8,952 pacientes distintos
```

> **`clinical_events` = 1.387.934, não 1.360.406.** O número antigo circula em documentos anteriores
> e está **defasado desde o fix de `setor` + HbA1c** — não tem relação com o `PRJ03`. Verificado
> rodando os geradores do `seed.py` com e sem a mudança: **1.387.934 nos dois casos**. `gen_projects()`
> é a última função a consumir o RNG (`main()` a chama depois de patients/encounters/events), então
> encurtar o seu laço para `range(4, 51)` não desloca nada a montante. A coorte Diabetes segue
> exatamente **8.952**, como no P3a.

---

## 7. Mudança de contrato registrada

`AuthzReply` ganhou `string coorte_codigo = 3` — **aditivo e retrocompatível** (campo 3 estava livre;
em proto3 o default é `""`). `AuthzRequest` e `PatientQuery` não mudaram. Ver o log em
[`docs/contratos.md`](../contratos.md). Comunicado ao grupo em 2026-07-09.
