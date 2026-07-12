# RUNBOOK — Frontend REAL (browser → Keycloak → gateway → gRPC → Postgres → FHIR)

Passo a passo para rodar o frontend **integrado de verdade** ao backend no cluster kind. Sem mock.

> **Modo demo (fallback de apresentação):** `cp frontend/.env.demo frontend/.env.local && cd frontend && npm run dev`.
> Roda offline, com dados mockados. Bom pra vitrine de UX, **não** prova integração. O real é abaixo.

---

## 0. Pré-requisitos (uma vez)

### 0a. Issuer via split-horizon (NÃO precisa editar hosts)
O browser acessa o Keycloak em **`localhost:8080`** (port-forward) e o token sai com
`iss=http://localhost:8080/realms/hospital` (`KC_HOSTNAME`). O gateway **aceita esse issuer** mas busca
as **chaves no Service interno** `keycloak:8080` (`JWT_JWK_SET_URI`) — padrão split-horizon do Keycloak,
usado em prod atrás de ingress. Resultado: login OIDC no browser funciona **sem alias no hosts** e sem
acoplar o gateway ao host do browser. (Config em `k8s/base/{keycloak,api-gateway}.yaml` + `SecurityConfig`.)

### 0b. Subir tudo com o frontend
```bash
make deploy      # agora builda e sobe também hospital/frontend:dev (Deployment+Service)
make seed        # popula o banco (pacientes/vínculos/projetos)
kubectl get pods # db, keycloak, os 4 serviços e frontend Running/Ready
```
> Já subiu antes sem o frontend? `make redeploy` reconstrói e faz rollout dos 4 + frontend.

---

## 1. Port-forwards (3 terminais, ou background)

```bash
make forward     # sobe os 3 túneis em background: keycloak:8080, gateway:9000, frontend:8088
# parar depois: make forward-stop
```

Ou manualmente (cada um num terminal, foreground):
```bash
kubectl port-forward svc/keycloak    8080:8080   # OIDC (browser abre em http://localhost:8080)
kubectl port-forward svc/api-gateway 9000:9000   # REST/FHIR (VITE_API_GATEWAY_URL)
make front                                        # svc/frontend 8088:80
```

**Por que port-forward?** Os Services são `ClusterIP` — só existem dentro do cluster (kind roda em
Docker). O host não enxerga ClusterIP; o port-forward é o túnel host→cluster. As portas casam com
`frontend/.env`: gateway `:9000`, keycloak `http://localhost:8080`. Os túneis ficam **rodando**
enquanto usa o app.

---

## 2. Abrir e logar

Browser → **http://localhost:8088**. O app redireciona ao **Keycloak real** (`login-required`, PKCE).

| Usuário | Senha | O que provar |
|---|---|---|
| `med.cardoso` | `senha123` | **FULL** — nome completo, CPF/CNS; selo "FULL" (vindo de `meta.security`) |
| `est.almeida` | `senha123` | **PARTIAL** — iniciais `J. da S.`, **sem** CPF/CNS; selo "PARTIAL" |
| `pesq.souza` | `senha123` | Coorte (gráficos), exames anonimizados, **lista de projetos com status** |
| `med.semvinculo` | `senha123` | **403** ao abrir paciente sem vínculo |

---

## 3. As 3 jornadas (o que ver na tela)

**Médico / Estagiário — prontuário**
- Buscar `P000001`. Médico vê Patient FULL + condições/exames/medicamentos; estagiário vê PARTIAL.
- Trocar o tipo de consulta (Resumo / Histórico / Exames / Medicamentos) muda a fatia (rota `?tipo=`).
- **Lista de pacientes:** a tela de pacientes chama `GET /fhir/Patient` (searchset) — os pacientes do cuidador.

**Pesquisador — coorte + projetos**
- **Meus projetos:** cards com `PRJ01 Aprovado`, `PRJ02 Expirado`, `PRJ03 Aprovado` (de `GET /projects`, item iv). Clicar carrega a coorte.
- `ResumoCoorte` → total, %sexo, faixas, média HbA1c, **Departamentos mais usados** e **Frequência de medicamentos** (item ii).
- `ExamesCoorte` → tabela pseudonimizada (`hash…`, faixa etária, exames), datas truncadas ao ano.

---

## 4. Provar que é REAL (não demo)

Abrir **DevTools → Network**:
- Requisições para `http://localhost:9000/fhir/Patient/...`, `/fhir/Patient`, `/fhir/cohort/...`, `/projects`, todas com header **`Authorization: Bearer eyJ…`**.
- Respostas são **FHIR** (`Bundle`, `MeasureReport`) / JSON de projetos — o adapter (`lib/cohort.ts`) converte pra UI.
- Um acesso negado retorna **403** e a UI mostra "Acesso negado".
- Preflight `OPTIONS` responde 200 (CORS do gateway) — sem erro de CORS no console.

Salvar prints em `docs/evidencias/frontend-real.md`.

---

## 5. Armadilhas

- **Rotas 404 / `?tipo=` ignorado** → imagem velha; rode `make redeploy`.
- **Erro de CORS no console** → origem fora de `http://localhost:*`; ajuste `GATEWAY_CORS_ORIGINS` no gateway.
- **401 após login** → issuer não bate: confirme `KC_HOSTNAME=http://localhost:8080` no keycloak e `JWT_ISSUER_URI`/`JWT_JWK_SET_URI` no gateway (split-horizon). Ou port-forward do keycloak fora do ar.
- **Login não abre / "Falha ao inicializar o Keycloak"** → port-forward do keycloak parado, ou `VITE_KEYCLOAK_URL` ≠ `http://localhost:8080`. Teste `curl -i http://localhost:8080/realms/hospital/.well-known/openid-configuration` (com o port-forward rodando) → deve dar 200.
- **Tela mockada / troca de role por botão** → está em modo demo; garanta `VITE_DEMO_MODE=false` e sem `.env.local` de demo.
- **`deploy/frontend not found` no `make redeploy`** → o manifesto do frontend nunca foi aplicado; `make redeploy` já faz `kubectl apply -f k8s/base/frontend.yaml` antes do restart. Na 1ª vez, prefira `make deploy` (aplica todo o `k8s/base`).
- **Pod em `CrashLoopBackOff`/`Exit 1` logo no boot** → falha de contexto Spring; `kubectl logs -l app=<svc> --tail=120` mostra o `Caused by`. (Já resolvido: ambiguidade de bean CORS — ver §7 do `CHECKLIST.md`.)
- **Pod em `ErrImageNeverPull`/`CreateContainerError`** com a imagem "already present" → attestation manifest do buildkit; `make images` builda com `--provenance=false` para evitar. Rebuild + `kubectl delete pod -l app=<svc>`.
- **Nós kind `NotReady`/pod preso em `Terminating` após reiniciar a máquina** → cluster stale; o mais limpo é recriar: `make cluster-down && make cluster && make deploy && make seed`.
