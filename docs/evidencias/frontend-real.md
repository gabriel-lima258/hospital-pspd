# Evidência — Frontend REAL integrado ao backend (K8S)

> SPA React/Vite integrada de verdade ao cluster: login OIDC no Keycloak real + 3 jornadas contra o
> gateway. `./gradlew build` e `npm run build` **verdes**. Roteiro de execução passo-a-passo:
> `docs/RUNBOOK-frontend.md`.

## O que a integração prova

| # | Cenário | O que evidencia |
|---|---|---|
| 1 | Login no **Keycloak real** (URL `http://localhost:8080/realms/hospital/...`) | OIDC de verdade, não mock |
| 2 | `med.cardoso` — Patient **FULL** (nome, CPF/CNS) + selo "FULL" | acesso FULL + `meta.security` |
| 3 | `est.almeida` — mesmo paciente **PARTIAL** (`J. da S.`, sem CPF) + selo "PARTIAL" | enforcement de nível ponta-a-ponta |
| 4 | `med.cardoso` — troca `?tipo=` (Resumo/Exames/Medicamentos) muda a fatia | consultas nomeadas |
| 5 | Lista de pacientes (`GET /fhir/Patient`, searchset) | rota de lista |
| 6 | `pesq.souza` — cards "Meus projetos" com `PRJ01 Aprovado`/`PRJ02 Expirado` | `GET /projects` (item iv) |
| 7 | `pesq.souza` — ResumoCoorte: total, %sexo, faixas, HbA1c, **Departamentos** + **Medicamentos** | agregação (item ii) |
| 8 | `pesq.souza` — ExamesCoorte: tabela `hash…`, faixa etária, datas ao ano | anonimização (item iii) |
| 9 | **DevTools → Network:** chamadas a `localhost:9000/fhir/...` e `/projects` com `Authorization: Bearer`, respostas FHIR | integração real (não demo) |
| 10 | Acesso negado (`med.semvinculo` → 403) na UI | DENY visível |

## Prova verificada (offline)
- `./gradlew build` **exit 0** (inclui teste de `Patient.meta.security` FULL/PARTIAL/ANONYMIZED).
- `cd frontend && npm run build` **exit 0** (tsc + vite; adapter `lib/cohort.ts` tipado, sem `any`).

## Arquitetura da integração (para o relatório)
Browser → **Keycloak** (OIDC/PKCE, `AuthContext`) → JWT → **gateway** (`api.ts`, Bearer) → gRPC nos 3
serviços → Postgres → **FHIR** → adapter `lib/cohort.ts` (MeasureReport/Bundle → domínio) → UI. CORS no
gateway libera o browser; `meta.security` carrega o nível no próprio recurso.
