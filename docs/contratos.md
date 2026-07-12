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

**`tipo_consulta` — vocabulário único, atravessa os 3 serviços.** Definido aqui; os três o consomem
com as **mesmas strings** (`AuthorizationPolicy`, `PatientDataGrpcService.fetch`,
`FhirTransformer.transform`). Não inventar valores novos.

As **consultas nomeadas do enunciado** (§2.1 + footnote ²) são o vocabulário completo:

| `tipo_consulta` | Perfil | Nível (Authorization) | Patient Data | Saída (Data Transform) |
|---|---|---|---|---|
| `ResumoClinico` | MEDICO/ESTAGIARIO | `FULL` / `PARTIAL` | snapshot: diagnósticos + último atendimento + últimos exames + meds em uso | `Bundle` |
| `HistoricoClinico` | MEDICO/ESTAGIARIO | `FULL` / `PARTIAL` | prontuário temporal completo | `Bundle` |
| `Exames` | MEDICO/ESTAGIARIO | `FULL` / `PARTIAL` | só observações | `Bundle` (Patient + Observation) |
| `Medicamentos` | MEDICO/ESTAGIARIO | `FULL` / `PARTIAL` | só medicações | `Bundle` (Patient + MedicationRequest) |
| `ListaPacientes` | MEDICO/ESTAGIARIO | `FULL` / `PARTIAL` | pacientes do cuidador (por `username_cuidador`) | `Bundle` `searchset` de Patient |
| `Patient` (legado) | MEDICO/ESTAGIARIO | `FULL` / `PARTIAL` | = `HistoricoClinico` | `Bundle` |
| `ExamesCoorte` | PESQUISADOR | `ANONYMIZED` | amostra de 100 da coorte | `Bundle` pseudonimizado |
| `ResumoCoorte`, `Estatisticas` | PESQUISADOR | `AGGREGATED` | agregação da coorte | `MeasureReport` |
| `ListaProjetos` | PESQUISADOR | `FULL` (não usado) | projetos do dono (por `username_pesquisador`) | **JSON puro** (não passa pelo Data Transform) |
| _(qualquer outro / vazio no caminho de coorte)_ | PESQUISADOR | `AGGREGATED` | — | **default seguro** (nunca ANONYMIZED sem pedido explícito) |

**Nota de fatia × nível.** As consultas individuais nomeadas (`Resumo/Historico/Exames/Medicamentos`)
mudam só a **fatia** dos dados; o **nível** continua vindo da role (FULL médico / PARTIAL estagiário).
O Patient Data fatia o payload; o Data Transform monta o `Bundle` apenas com os recursos presentes,
então Exames/Medicamentos/Resumo reusam o mesmo caminho de montagem individual.

**Definição operacional (ResumoClinico).** Como o schema não tem flag de "ativo", "medicamentos em
uso"/"últimos exames" = evento **mais recente por `codigo_tipo`**; "último atendimento" = encounter
mais recente; "diagnósticos principais" = todas as Conditions do paciente.

**Listas — escopo por dono.** `ListaPacientes` e `ListaProjetos` não recebem alvo do cliente: o
`username` do JWT é repassado em `PatientQuery.username` e o filtro (`username_cuidador` /
`username_pesquisador`) acontece no Patient Data — um cuidador nunca lista pacientes de outro, um
pesquisador nunca vê projetos de outro. A autorização libera pela **role** (a lista é escopada, não
depende de vínculo/projeto específico); cross-role (ex.: médico pedindo `ListaProjetos`) → DENY.

**Validação de `?tipo=` no Gateway.** A rota individual valida `?tipo=` contra
`{ResumoClinico, HistoricoClinico, Exames, Medicamentos}` (default `HistoricoClinico`), a de coorte
contra `{ResumoCoorte, Estatisticas, ExamesCoorte}`; fora disso → **400**. O default seguro é defesa
em profundidade, não caminho normal.

**Projetos = JSON, de propósito.** A tabela tabela→FHIR do enunciado (§2.1) só mapeia dados clínicos
do paciente; `projects` não tem recurso FHIR. `ListaProjetos` é metadado administrativo → devolvido
como JSON puro na rota `GET /projects` (fora de `/fhir`), sem anonimização. Decisão registrada aqui e
no relatório.

### Resolução da coorte (D3/P3c) — o `coorte_codigo` nasce no servidor

A rota `GET /fhir/cohort/{projetoId}?tipo=…` recebe do cliente **o projeto e o tipo — nunca a coorte**.
O Authorization, que já lê `projects` para checar dono + status + vigência, devolve
`AuthzReply.coorte_codigo` (= `projects.codigo_condicao`) e o gateway o repassa **intacto** como
`PatientQuery.coorte_codigo`. Só é preenchido quando `allow && role == PESQUISADOR`.

> Se a coorte viesse de um parâmetro do cliente, um pesquisador autorizaria em `PRJ01` (Diabetes) e
> leria a coorte de qualquer outro projeto — bypass da autorização. A rota não expõe esse parâmetro.

Erros da rota de coorte: DENY → **403**; `tipo` inválido/ausente → **400**; coorte vazia → **404**;
falha gRPC → **502**. Ver `docs/evidencias/pesquisador-coorte.md`. (Esta rota mapeia localmente, no
próprio `try/catch`.)

### Rotas REST do Gateway (visão completa)

| Rota | Perfil | Consulta(s) | Saída |
|---|---|---|---|
| `GET /fhir/Patient/{id}?tipo=…` | médico/estagiário | `ResumoClinico`\|`HistoricoClinico`\|`Exames`\|`Medicamentos` (default `HistoricoClinico`) | `Bundle` (mascarado por nível) |
| `GET /fhir/Patient` | médico/estagiário | `ListaPacientes` (pacientes do cuidador) | `Bundle` `searchset` de Patient |
| `GET /fhir/cohort/{projetoId}?tipo=…` | pesquisador | `ResumoCoorte`\|`Estatisticas`\|`ExamesCoorte` | `MeasureReport` \| `Bundle` pseudonimizado |
| `GET /projects` | pesquisador | `ListaProjetos` (projetos do dono + status) | **JSON** (não-FHIR, admin) |

Todas exigem `Authorization: Bearer <JWT>`; DENY → **403**. `GET /fhir/Patient/{id}` inexistente →
**404** (`GrpcHttpExceptionHandler`). `?tipo=` inválido → **400**.

**CORS (frontend SPA).** O gateway habilita CORS (`SecurityConfig.corsConfigurationSource`) para o
browser chamar a API cross-origin com `Authorization`. Origens por `allowedOriginPatterns` (default
`http://localhost:*`, env `GATEWAY_CORS_ORIGINS`), métodos `GET,OPTIONS`, sem credenciais (usa Bearer,
não cookie). O preflight `OPTIONS` é respondido antes do AccessLog/RateLimit e não exige token.

**Login OIDC no browser (split-horizon).** O browser alcança o Keycloak em `http://localhost:8080`
(port-forward) e o token sai com `iss=http://localhost:8080/realms/hospital` (`KC_HOSTNAME`). O gateway
**valida esse issuer** (`JWT_ISSUER_URI`) mas **busca as chaves JWKS no Service interno**
`keycloak:8080` (`JWT_JWK_SET_URI`) — padrão split-horizon do Keycloak (frontend público + backchannel
interno), o mesmo usado em prod atrás de ingress. Assinatura, `iss` e `exp` seguem validados; nada de
segurança é afetado. Evita editar `/etc/hosts`. `SecurityConfig.buildDelegate` faz o dispatch (jwk-set-uri
presente → chaves internas + validação de issuer; ausente → discovery, comportamento compose/curl).
`localhost` como host do issuer é acomodação de ambiente local (em prod seria um domínio real). Ver
`docs/RUNBOOK-frontend.md`.

**Mapa gRPC→HTTP global** (`GrpcHttpExceptionHandler`, `@RestControllerAdvice`) — cobre as rotas
**sem** `catch` local, hoje a de prontuário `GET /fhir/Patient/{id}`. Traduz o código do
`StatusRuntimeException`: `NOT_FOUND`→**404**, `INVALID_ARGUMENT`→**400**, `PERMISSION_DENIED`→**403**,
`UNAUTHENTICATED`→**401**, `UNAVAILABLE`→**503**, `DEADLINE_EXCEEDED`→**504**, resto→**502**. Em
particular, **paciente inexistente** → Patient Data sinaliza `NOT_FOUND` → **404** (antes: 500).

**Robustez de chamada gRPC** — o Gateway aplica um **deadline default de 2 s** a toda chamada gRPC
(`DeadlineClientInterceptor`, global; `gateway.grpc.deadline-ms`, env `GATEWAY_GRPC_DEADLINE_MS`).
Sem isso, um downstream travado prenderia a thread indefinidamente → sob carga, exaustão do pool. O
estouro vira `DEADLINE_EXCEEDED` → **504**. **Erros internos não vazam**: os 3 serviços gRPC capturam
o inesperado, **logam com stack** (`log.error`, JSON com `trace_id`) e devolvem `INTERNAL` com
descrição genérica ("erro interno") → **502** ao cliente, nunca a exceção/stack crua. Os branches
específicos (`NOT_FOUND`, `INVALID_ARGUMENT`) são preservados.

**Rate limiting** (`RateLimitFilter`) — token bucket por usuário (chave = subject do JWT), aplicado
após a autenticação a todas as rotas exceto `/actuator/**`. Estourou → **429** com header
`Retry-After` (segundos) e corpo `{"error":"rate_limited","retry_after_ms":N}`. Parâmetros em
`gateway.ratelimit` (`enabled`/`capacity`/`refill-per-second`); `enabled=false` via
`GATEWAY_RATELIMIT_ENABLED` desliga (usado na bateria k6). Estado por instância → com N réplicas o
teto efetivo é N× o configurado.

**Log de acesso** (`AccessLogFilter`) — cada requisição de negócio emite uma linha JSON `http_access`
no stdout (via `logstash-logback-encoder`), com os campos de auditoria: `username`
(`preferred_username`), `role`, `nivel` (do `AuthzReply`), `patient_id`/`projeto_id` (do path),
`method`, `path`, `status`, `duration_ms`. Filtro mais externo da cadeia → captura o 429 do rate
limiting e o 404 de recurso inexistente. Formato pronto para Promtail→Loki (campos consultáveis sem
regex). `/actuator/**` não é logado.

**Tracing** (OTel Java agent, `make tracing`) — quando ligado, o agent propaga o contexto de trace
pelo header **`traceparent`** (W3C Trace Context) sobre HTTP **e** gRPC, então os spans dos 4 serviços
entram no mesmo trace (`REST→gRPC→gRPC→gRPC→SQL`). O agent também injeta `trace_id`/`span_id` no MDC,
que passam a aparecer na linha `http_access` do gateway → correlação trace↔log no Grafana (Tempo→Loki).
Não altera o contrato gRPC (proto) nem o REST — é transporte de metadados, transparente às rotas.

**Enforcement do nível** (Data Transform, desde o P3b) — o nível **decide a forma da saída**, não anota o dado:

| Nível | Saída | Mantém | Remove |
|---|---|---|---|
| `FULL` | `Bundle` | nome completo, data exata, cidade/estado, CPF, CNS, + os 4 recursos clínicos | — |
| `PARTIAL` | `Bundle` | iniciais (`J. da S.`), sexo, `birthDate: "1980"`, cidade/estado, recursos clínicos | nome completo, CPF, CNS, data exata |
| `ANONYMIZED` | `Bundle` | pseudônimo (`hash…`), sexo, faixa etária (`extension`), estado, recursos clínicos com data truncada ao ano | nome, CPF, CNS, cidade, data exata, id real |
| `AGGREGATED` | `MeasureReport` | total, %sexo/faixa/setor, mediaHbA1c, freqMedicamentos | **todo** dado individual |

O pseudônimo é `sha256(SALT + "\|" + id)` truncado — estável (mesmo id ⇒ mesmo hash), para que os
recursos de um paciente continuem ligados dentro do Bundle sem revelar quem ele é.

**`Patient.meta.security`** — o recurso Patient carrega o nível servido no próprio FHIR:
`meta.security = [{ system: ".../v3-Confidentiality", code: FULL|PARTIAL|ANONYMIZED }]`
(`PatientAnonymizer`). O frontend lê esse código para o selo de acesso; a fonte da verdade da decisão
continua no Authorization.

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

> Os demais casos negativos são dados do seed (D3), não do Keycloak: `PRJ02` (**Expirado** → 403),
> `PRJ04` (**de outro dono** → 403) e `PRJ03` (Aprovado, mas condição `Rara` sem pacientes → **404**).

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

- `Authorization.Check(AuthzRequest) → AuthzReply` — `allow` + `nivel` (FULL/PARTIAL/ANONYMIZED/AGGREGATED)
  + `coorte_codigo` (só em ALLOW + PESQUISADOR).
- `PatientData.Fetch(PatientQuery) → ClinicalData` — `json_payload` cru. `PatientQuery` carrega
  `patient_id` (individual), `coorte_codigo` (coorte), `tipo_consulta` e `username` (listas).
- `DataTransform.ToFhir(TransformRequest) → FhirReply` — `fhir_json` (`Bundle` `collection`/`searchset`
  ou `MeasureReport`, conforme o `nivel`/shape).

Stubs Java+gRPC gerados pelo módulo `:proto` (`./gradlew :proto:build`). Os 4 serviços embutem esse
jar ⇒ **toda mudança no proto exige `make redeploy`** (rebuild + `rollout restart` dos 4).

### Log de contratos

Mudanças no proto depois do congelamento do Dia 1. Toda entrada aqui foi **comunicada ao grupo no
mesmo dia** (regra de ouro nº 2 do `CLAUDE.md`).

| Data | Passo | Mudança | Compatibilidade |
|---|---|---|---|
| 2026-07-09 | **D3/P3c** | `AuthzReply` **+** `string coorte_codigo = 3` | **Aditiva.** Campo 3 estava livre; em proto3 o default é `""`. Médico e estagiário ignoram. `AuthzRequest` e `PatientQuery` **não** mudaram. |
| 2026-07-11 | **Consultas nomeadas** | `PatientQuery` **+** `string username = 4` | **Aditiva.** Campo 4 estava livre; default `""`. Usado só nas listas (`ListaPacientes`/`ListaProjetos`); consultas individuais/coorte ignoram. Nenhum campo existente mudou. |

---

## 3. Contrato de dados — resumo

Definido em [`db/schema.sql`](../db/schema.sql): 5 tabelas (`patients`, `encounters`,
`clinical_events`, `user_patient_assignments`, `projects`) + 5 índices. Ver comentários no arquivo.
O `schema.sql` **não mudou** desde o Dia 1; o `db/seed.py` ganhou o projeto `PRJ03` (fixture do 404).
