package com.hospital.gateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Segurança do Gateway (D2 walking skeleton):
 * - /actuator/** liberado (health + scrape do Prometheus);
 * - qualquer outra rota (ex.: /fhir/**) exige JWT válido do Keycloak.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/**").permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
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
