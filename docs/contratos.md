# Contratos congelados — Dia 1 (PSPD/UnB)

Os **3 contratos** que destravam o paralelismo entre as trilhas (§2.2 do roteiro). **Mudou um
contrato? Avise o grupo no mesmo dia.** Esta página é o índice único; o detalhe de cada um está
no seu arquivo-fonte.

| Contrato | Fonte da verdade | Trava |
|---|---|---|
| Dados | [`db/schema.sql`](../db/schema.sql) | Patient Data (SQL), seed |
| gRPC | [`proto/hospital.proto`](../proto/hospital.proto) | Gateway ↔ Auth/PatientData/Transform |
| Identidade (JWT) | este documento | Gateway (validação), Authorization |

---

## 1. Claims do JWT (Keycloak → Gateway)

O Keycloak (realm `hospital`) emite um JWT OIDC. O Gateway valida a assinatura (Spring Security
OAuth2 Resource Server, `issuer-uri` do realm) e extrai **dois claims** que atravessam toda a pilha:

### `preferred_username`
Identifica o usuário. **É a chave de junção com o banco** — tem que casar exatamente com:

- `user_patient_assignments.username_cuidador` (Médico / Estagiário), e
- `projects.username_pesquisador` (Pesquisador).

O Gateway repassa esse valor ao Authorization Service como `AuthzRequest.username`.

### `realm_access.roles`
Array de *realm roles*. Exatamente **uma** das três importa para o domínio:

| Role no JWT | Perfil | Nível de acesso (decidido pelo Authorization) |
|---|---|---|
| `MEDICO` | Médico | `FULL` — apenas pacientes vinculados; senão `DENY` |
| `ESTAGIARIO` | Estagiário | `PARTIAL` — apenas pacientes supervisionados |
| `PESQUISADOR` | Pesquisador | `ANONYMIZED` / `AGGREGATED` — apenas projetos Aprovados e vigentes |

Um `JwtAuthenticationConverter` no Gateway mapeia cada role para a *authority*
`ROLE_MEDICO` / `ROLE_ESTAGIARIO` / `ROLE_PESQUISADOR` (§4.7).

### Decisão de autorização (Authorization Service, D3 · P-authz)

A regra vive no domínio puro `AuthorizationPolicy` (testável sem Spring/DB). Dada a `role`, os vínculos
(`user_patient_assignments`) e o projeto (`projects`), decide `allow` + `nivel`:

| Role | Condição para ALLOW | Nível |
|---|---|---|
| `MEDICO` | vínculo `tipo_vinculo='medico'`, `status='ativo'` com o paciente | `FULL` |
| `ESTAGIARIO` | vínculo `tipo_vinculo='estagiario'`, `status='ativo'`, `username_supervisor IS NOT NULL` | `PARTIAL` |
| `PESQUISADOR` | é dono do projeto **E** `status='Aprovado'` **E** `data_validade >= hoje` | por `tipo_consulta` ↓ |
| outra / ausente | — | `DENY` |

**`tipo_consulta` → nível do PESQUISADOR** (vocabulário definido aqui; hoje só consumido por chamadas
gRPC diretas — o gateway ainda não tem rota de coorte):

| `tipo_consulta` | Nível | Uso |
|---|---|---|
| `ExamesCoorte` | `ANONYMIZED` | exames por paciente dentro da coorte |
| `ResumoCoorte`, `Estatisticas` | `AGGREGATED` | estatística/resumo agregado da coorte |
| _(qualquer outro / vazio)_ | `AGGREGATED` | **default seguro** (nunca ANONYMIZED sem pedido explícito) |

**Enforcement do nível** (Data Transform, desde o P3b) — o nível **decide a forma da saída**, não anota o dado:

| Nível | Saída | Mantém | Remove |
|---|---|---|---|
| `FULL` | `Bundle` | nome completo, data exata, cidade/estado, CPF, CNS, + os 4 recursos clínicos | — |
| `PARTIAL` | `Bundle` | iniciais (`J. da S.`), sexo, `birthDate: "1980"`, cidade/estado, recursos clínicos | nome completo, CPF, CNS, data exata |
| `ANONYMIZED` | `Bundle` | pseudônimo (`hash…`), sexo, faixa etária (`extension`), estado, recursos clínicos com data truncada ao ano | nome, CPF, CNS, cidade, data exata, id real |
| `AGGREGATED` | `MeasureReport` | total, %sexo/faixa/setor, mediaHbA1c, freqMedicamentos | **todo** dado individual |

O pseudônimo é `sha256(SALT + "\|" + id)` truncado — estável (mesmo id ⇒ mesmo hash), para que os
recursos de um paciente continuem ligados dentro do Bundle sem revelar quem ele é.

Nível ausente/desconhecido, ou incompatível com a shape do payload (ex.: `FULL` com payload de
coorte), devolve `INVALID_ARGUMENT`. Ver `docs/evidencias/data-transform-niveis.md`.

### Exemplo de payload (decodificado)
```json
{
  "preferred_username": "med.cardoso",
  "realm_access": { "roles": ["MEDICO", "offline_access", "uma_authorization"] },
  "iss": "http://keycloak:8080/realms/hospital",
  "exp": 1999999999
}
```

### Usuários de teste (definidos em [`keycloak/realm-export.json`](../keycloak/realm-export.json))
Todos com senha **`senha123`** (não-temporária). Realm `hospital`, `accessTokenLifespan` = 30 min.

| Username | Role | Papel no seed |
|---|---|---|
| `med.cardoso` | `MEDICO` | vinculado a N pacientes |
| `est.almeida` | `ESTAGIARIO` | supervisionado por `med.cardoso` |
| `pesq.souza` | `PESQUISADOR` | dono de `PRJ01` (Diabetes, Aprovado) |
| `med.semvinculo` | `MEDICO` | **caso negativo** — sem pacientes vinculados → `DENY` |

> Outro caso negativo (projeto **Expirado**) é dado do seed (D3), não do Keycloak.

### Obter um JWT — [`keycloak/get-token.sh`](../keycloak/get-token.sh)
Password grant no client **`hospital-loadtest`** (público, Direct Access Grants). Imprime só o `access_token`:

```bash
keycloak/get-token.sh med.cardoso                 # usa senha123 e localhost:8080 por padrão
KC_HOST=keycloak keycloak/get-token.sh pesq.souza # parametrizável: KC_HOST/KC_PORT/KC_REALM/KC_CLIENT
```

Clients do realm: `hospital-loadtest` (password grant p/ curl/k6) e `hospital-frontend` (Standard Flow
p/ o React, `redirectUris`/`webOrigins` = `http://localhost:*`).

> **Decisão de medição:** nos testes de carga o Keycloak fica **fora do caminho** — geramos um pool
> de JWTs válidos (TTL longo, ~30 min) com o `get-token.sh` antes de cada rodada, e o k6 só envia
> `Authorization: Bearer`. Assim medimos a aplicação, não o servidor de identidade (§4.7).

---

## 2. Contrato gRPC — resumo

Definido em [`proto/hospital.proto`](../proto/hospital.proto) (`proto3`, `java_multiple_files=true`,
package `hospital`). Três serviços:

- `Authorization.Check(AuthzRequest) → AuthzReply` — `allow` + `nivel` (FULL/PARTIAL/ANONYMIZED/AGGREGATED).
- `PatientData.Fetch(PatientQuery) → ClinicalData` — `json_payload` cru.
- `DataTransform.ToFhir(TransformRequest) → FhirReply` — `fhir_json` (`Bundle` ou `MeasureReport`, conforme o `nivel`).

Stubs Java+gRPC gerados pelo módulo `:proto` (`./gradlew :proto:build`).

---

## 3. Contrato de dados — resumo

Definido em [`db/schema.sql`](../db/schema.sql): 5 tabelas (`patients`, `encounters`,
`clinical_events`, `user_patient_assignments`, `projects`) + 5 índices. Ver comentários no arquivo.
