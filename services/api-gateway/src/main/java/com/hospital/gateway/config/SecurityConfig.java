package com.hospital.gateway.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.hospital.gateway.observability.AccessLogFilter;
import com.hospital.gateway.ratelimit.RateLimitFilter;
import com.hospital.gateway.ratelimit.RateLimitProperties;

/**
 * Segurança do Gateway (D2 walking skeleton):
 * - /actuator/** liberado (health + scrape do Prometheus);
 * - qualquer outra rota (ex.: /fhir/**) exige JWT válido do Keycloak;
 * - rate limiting por usuário DEPOIS da autenticação (precisa do principal para chavear o balde);
 * - CORS habilitado para o frontend SPA (browser) chamar o gateway cross-origin com Bearer.
 */
@Configuration
@EnableConfigurationProperties(RateLimitProperties.class)
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, RateLimitProperties rateLimitProps,
            CorsConfigurationSource corsSource) throws Exception {
        http
            // CORS antes de tudo: o preflight OPTIONS é respondido pelo CorsFilter e não passa pelo
            // AccessLog/RateLimit nem exige token (o browser não manda o Bearer no preflight).
            .cors(cors -> cors.configurationSource(corsSource))
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/**").permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
            // Ordem após o Bearer: AccessLog (externo, loga inclusive o 429) → RateLimit (interno).
            // Ambos precisam do SecurityContext populado, por isso vêm depois da autenticação.
            .addFilterAfter(new AccessLogFilter(), BearerTokenAuthenticationFilter.class)
            .addFilterAfter(new RateLimitFilter(rateLimitProps), AccessLogFilter.class);
        return http.build();
    }

    /**
     * CORS para o frontend SPA. Origens por padrão ({@code http://localhost:*}) cobrem o dev-server e o
     * container do frontend acessado via port-forward; sobrescrevível por {@code GATEWAY_CORS_ORIGINS}
     * (lista separada por vírgula). Sem credenciais (usa Bearer, não cookie), então o wildcard de porta
     * é seguro. Só métodos de leitura — a API é GET.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${gateway.cors.allowed-origins:http://localhost:*}") String origins) {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(Arrays.stream(origins.split(",")).map(String::trim).toList());
        cfg.setAllowedMethods(List.of("GET", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        cfg.setAllowCredentials(false);
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    /**
     * Decoder LAZY de verdade: withIssuerLocation(...).build() resolve o issuer (busca .well-known)
     * de forma EAGER — se o Keycloak ainda não subiu, o boot do Gateway falha. Este wrapper adia a
     * construção do decoder real para a 1ª validação de token; até lá o Keycloak já está pronto.
     * Declarar este bean também faz o auto-config eager do issuer-uri recuar (@ConditionalOnMissingBean).
     */
    @Bean
    public JwtDecoder jwtDecoder(
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer) {
        return new JwtDecoder() {
            private volatile JwtDecoder delegate;

            @Override
            public Jwt decode(String token) throws JwtException {
                JwtDecoder d = delegate;
                if (d == null) {
                    synchronized (this) {
                        if (delegate == null) {
                            delegate = NimbusJwtDecoder.withIssuerLocation(issuer).build();
                        }
                        d = delegate;
                    }
                }
                return d.decode(token);
            }
        };
    }
}
