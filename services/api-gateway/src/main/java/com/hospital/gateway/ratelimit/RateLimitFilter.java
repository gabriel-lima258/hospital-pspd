package com.hospital.gateway.ratelimit;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Rate limiting por usuário no Gateway (exigência do enunciado). Roda DEPOIS da autenticação JWT —
 * a chave é o nome do principal (subject do token) — e ANTES dos controllers. Estourou o balde →
 * responde 429 com {@code Retry-After}, sem tocar na pilha gRPC.
 *
 * <p>Estado em memória, por instância: um {@link TokenBucket} por usuário num {@link ConcurrentHashMap}.
 * Com N réplicas o limite efetivo é N× o configurado (cada pod tem seu mapa) — aceitável para o
 * escopo acadêmico; rate limiting distribuído (Redis) seria o passo seguinte, fora do recorte.
 *
 * <p>/actuator/** não é limitado (o scrape do Prometheus não pode levar 429). Ver
 * {@code shouldNotFilter}.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimitProperties props;
    private final ConcurrentHashMap<String, TokenBucket> buckets = new ConcurrentHashMap<>();

    public RateLimitFilter(RateLimitProperties props) {
        this.props = props;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !props.isEnabled() || request.getRequestURI().startsWith("/actuator");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String key = principalKey(req);
        TokenBucket bucket = buckets.computeIfAbsent(key,
                k -> new TokenBucket(props.getCapacity(), props.getRefillPerSecond()));

        if (bucket.tryConsume()) {
            chain.doFilter(req, res);
        } else {
            long retryMs = bucket.millisUntilNextToken();
            res.setStatus(429);   // Too Many Requests (sem constante no jakarta.servlet)
            res.setHeader("Retry-After", String.valueOf((long) Math.ceil(retryMs / 1000.0)));
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"rate_limited\",\"retry_after_ms\":" + retryMs + "}");
        }
    }

    /** Chave do balde: usuário autenticado; cai para o IP remoto se não houver principal. */
    private String principalKey(HttpServletRequest req) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getName() != null) {
            return "user:" + auth.getName();
        }
        return "ip:" + req.getRemoteAddr();
    }
}
