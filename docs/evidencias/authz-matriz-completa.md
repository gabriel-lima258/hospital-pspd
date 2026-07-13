# Evidência — matriz de autorização completa

Decisão ALLOW/DENY + nível para os 3 perfis, decidida no domínio puro `AuthorizationPolicy`
(sem Spring/DB) e orquestrada pelo adapter gRPC. Dados do seed do P1.

## Testes de unidade (JUnit puro)

```
./gradlew :services:authorization:test  →  BUILD SUCCESSFUL
```
`AuthorizationPolicyTest`: cobre cada linha da matriz + DENYs, incluindo explicitamente
**projeto Aprovado-mas-vencido → DENY** e **Expirado-mas-na-validade → DENY**.

## Verificação via Gateway (MEDICO / ESTAGIARIO) — HTTP

`GET /fhir/Patient/{id}` com JWT do Keycloak (port-forward keycloak:8081, api-gateway:9001):

| Usuário | Paciente | HTTP | Decisão |
|---|---|---|---|
| `med.cardoso` | `P000001` | **200** | ALLOW/FULL |
| `med.semvinculo` | `P000001` | **403** | DENY |
| `est.almeida` | `P000001` | **200** | ALLOW/PARTIAL (P000001 ∈ supervisionados 1..200) |
| `est.almeida` | `P000500` | **403** | DENY (existe, mas não supervisionado por ela) |

## Verificação do PESQUISADOR — grpcurl direto no Authorization:9090

(`Authorization.Check`, sem gateway — ainda não há rota REST de coorte)

| username | projeto_id | tipo_consulta | Resposta |
|---|---|---|---|
| `pesq.souza` | `PRJ01` (Aprovado/vigente) | `ExamesCoorte` | `allow:true, nivel:ANONYMIZED` |
| `pesq.souza` | `PRJ01` (Aprovado/vigente) | `ResumoCoorte` | `allow:true, nivel:AGGREGATED` |
| `pesq.souza` | `PRJ02` (Expirado) | `ResumoCoorte` | `{}` → **deny** |
| `pesq.souza` | `PRJ99` (inexistente) | `ResumoCoorte` | `{}` → **deny** |
| `pesq.outro` | `PRJ01` (de outro dono) | `ResumoCoorte` | `{}` → **deny** |

> No gRPC, campos com valor default são omitidos: `{}` = `allow:false, nivel:""` = DENY.

## `tipo_consulta` → nível do PESQUISADOR (definido em docs/contratos.md)

`ExamesCoorte → ANONYMIZED` · `ResumoCoorte`/`Estatisticas → AGGREGATED` · default seguro `AGGREGATED`.

## Dívida técnica registrada (fecha no P3)

A **decisão** de nível está correta, mas a **enforcement** (anonimização/agregação real) ainda não
existe — o Data Transform devolve dados FULL para qualquer nível. Um ESTAGIARIO recebe `PARTIAL` mas
vê dados completos. Anotado em `docs/contratos.md`, no `AuthorizationGrpcService` e no README.

## Reproduzir

```bash
./gradlew :services:authorization:test
make redeploy   # ou rebuild só da imagem hospital/authorization:dev + rollout restart
# gateway: port-forward + keycloak/get-token.sh (ver docs/evidencias/seed-volume-cluster.md)
# grpcurl (sem instalar no host): docker run --rm -v "$PWD/proto:/proto:ro" fullstorydev/grpcurl \
#   -plaintext -import-path /proto -proto hospital.proto -d '{...}' \
#   host.docker.internal:9091 hospital.Authorization/Check   # port-forward svc/authorization 9091:9090
```
