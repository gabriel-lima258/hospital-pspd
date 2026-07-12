import Keycloak from "keycloak-js"
import { env } from "./config"

const keycloakConfig = {
  url: env.keycloakUrl,
  realm: env.keycloakRealm,
  clientId: env.keycloakClientId,
}

const keycloak = new Keycloak(keycloakConfig)

export default keycloak
