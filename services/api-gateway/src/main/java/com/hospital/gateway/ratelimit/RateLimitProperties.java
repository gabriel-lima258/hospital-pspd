package com.hospital.gateway.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Parâmetros do rate limiting (prefixo {@code gateway.ratelimit} no application.yml).
 *
 * <p>{@code enabled} é um toggle de runtime (env {@code GATEWAY_RATELIMIT_ENABLED}): a bateria k6
 * usa um pool de só 3 usuários, então um limite por-usuário estrangularia a medição — o teste de
 * carga desliga o rate limiting para medir a aplicação, não o limitador.
 */
@ConfigurationProperties(prefix = "gateway.ratelimit")
public class RateLimitProperties {

    /** Liga/desliga o filtro. Default ligado; a carga desliga via env. */
    private boolean enabled = true;

    /** Tamanho do balde por usuário — absorve rajadas até este tamanho. */
    private long capacity = 50;

    /** Taxa de reposição (tokens/s) = teto da taxa média sustentada por usuário. */
    private double refillPerSecond = 25.0;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public long getCapacity() { return capacity; }
    public void setCapacity(long capacity) { this.capacity = capacity; }

    public double getRefillPerSecond() { return refillPerSecond; }
    public void setRefillPerSecond(double refillPerSecond) { this.refillPerSecond = refillPerSecond; }
}
