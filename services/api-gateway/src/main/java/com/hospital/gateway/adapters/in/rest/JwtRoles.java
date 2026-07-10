package com.hospital.gateway.adapters.in.rest;

import java.util.List;
import java.util.Set;

import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Extrai o perfil do domínio a partir de {@code realm_access.roles} do JWT do Keycloak.
 *
 * <p>O Gateway não converte roles em {@code GrantedAuthority}: a decisão de acesso é do Authorization
 * Service (fonte única). Aqui só se traduz o claim para a string que viaja no {@code AuthzRequest}.
 * Role ausente ou fora do domínio vira {@code ""} → o Authorization responde DENY.
 */
public final class JwtRoles {

    private static final Set<String> CONHECIDAS = Set.of("MEDICO", "ESTAGIARIO", "PESQUISADOR");

    private JwtRoles() {
    }

    /** Primeira role conhecida em {@code realm_access.roles}; {@code ""} se não houver nenhuma. */
    public static String extractRole(Jwt jwt) {
        Object realmAccess = jwt.getClaim("realm_access");
        if (realmAccess instanceof java.util.Map<?, ?> map && map.get("roles") instanceof List<?> roles) {
            for (Object r : roles) {
                if (r instanceof String s && CONHECIDAS.contains(s)) {
                    return s;
                }
            }
        }
        return "";
    }
}
