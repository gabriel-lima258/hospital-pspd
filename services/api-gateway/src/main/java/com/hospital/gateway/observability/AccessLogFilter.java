package com.hospital.gateway.observability;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

import com.hospital.gateway.adapters.in.rest.JwtRoles;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Log de acesso estruturado (auditoria). Roda logo após a autenticação, então enriquece o MDC com
 * {@code username}/{@code role} (do JWT) e {@code patient_id}/{@code projeto_id} (do path); ao fim
 * da requisição acrescenta {@code status}/{@code duration_ms} e emite uma linha {@code http_access}.
 * O {@code nivel} autorizado é posto no MDC pelos controllers durante a cadeia (mesma thread), então
 * aparece aqui também.
 *
 * <p>Como é o filtro mais externo da cadeia de negócio, captura inclusive o 429 do rate limiting.
 * {@code MDC.clear()} no fim evita vazar contexto para a próxima requisição servida pela thread.
 */
public class AccessLogFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger("http.access");

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/actuator");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        long startNanos = System.nanoTime();
        putIfPresent("username", principalName());
        putIfPresent("role", role());
        putIfPresent("patient_id", RequestFields.patientId(req.getRequestURI()));
        putIfPresent("projeto_id", RequestFields.projetoId(req.getRequestURI()));
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.put("method", req.getMethod());
            MDC.put("path", req.getRequestURI());
            MDC.put("status", Integer.toString(res.getStatus()));
            MDC.put("duration_ms", Long.toString((System.nanoTime() - startNanos) / 1_000_000));
            log.info("http_access");
            MDC.clear();
        }
    }

    private String principalName() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        // Auditoria quer o login legível (med.cardoso), não o sub do JWT (UUID do Keycloak).
        if (a instanceof JwtAuthenticationToken jwt) {
            String preferred = jwt.getToken().getClaimAsString("preferred_username");
            if (preferred != null && !preferred.isBlank()) {
                return preferred;
            }
        }
        return (a != null && a.isAuthenticated()) ? a.getName() : null;
    }

    private String role() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return (a instanceof JwtAuthenticationToken jwt) ? JwtRoles.extractRole(jwt.getToken()) : null;
    }

    private void putIfPresent(String key, String value) {
        if (value != null && !value.isBlank()) {
            MDC.put(key, value);
        }
    }
}
