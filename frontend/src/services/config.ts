/**
 * Configuração central do frontend.
 *
 * O "modo demonstração" existe para que o dashboard seja totalmente navegável
 * sem um backend/Keycloak reais (ex.: em ambientes de preview). Ele é ligado
 * automaticamente quando nenhuma URL do Keycloak foi configurada, e pode ser
 * forçado através da variável `VITE_DEMO_MODE`.
 *
 * Em produção, basta preencher o `.env` com as variáveis `VITE_KEYCLOAK_*`
 * que o fluxo OAuth2/OIDC real assume o controle.
 */
export const env = {
  apiGatewayUrl: import.meta.env.VITE_API_GATEWAY_URL ?? "",
  keycloakUrl: import.meta.env.VITE_KEYCLOAK_URL ?? "",
  keycloakRealm: import.meta.env.VITE_KEYCLOAK_REALM ?? "",
  keycloakClientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? "",
  demoModeFlag: import.meta.env.VITE_DEMO_MODE,
}

/**
 * Regras:
 *  - `VITE_DEMO_MODE=true`  -> força demo
 *  - `VITE_DEMO_MODE=false` -> força Keycloak real
 *  - ausente                -> demo somente se não houver URL do Keycloak
 */
export const IS_DEMO: boolean = (() => {
  if (env.demoModeFlag === "true") return true
  if (env.demoModeFlag === "false") return false
  return !env.keycloakUrl
})()

/** Papéis (roles) reconhecidos pelo Realm hospitalar. */
export type Role = "MEDICO" | "ESTAGIARIO" | "PESQUISADOR"

export const ROLE_LABELS: Record<Role, string> = {
  MEDICO: "Médico",
  ESTAGIARIO: "Estagiário",
  PESQUISADOR: "Pesquisador",
}
