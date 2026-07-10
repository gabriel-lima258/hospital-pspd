package com.hospital.gateway.ratelimit;

import java.util.function.LongSupplier;

/**
 * Token bucket clássico: acumula {@code refillPerSecond} tokens/s até {@code capacity}; cada
 * requisição consome 1. Lógica pura (sem Spring) — o relógio é injetável para o teste ser
 * determinístico. Thread-safe: um bucket é compartilhado por todas as threads de um mesmo usuário.
 *
 * <p>Escolha do algoritmo: absorve rajadas curtas (até {@code capacity}) mas limita a taxa média,
 * que é o comportamento pedido para uma API — ao contrário de uma janela fixa, que deixa passar o
 * dobro na virada da janela.
 */
public final class TokenBucket {

    private final long capacity;
    private final double refillPerSecond;
    private final LongSupplier nanoClock;

    private double tokens;
    private long lastNanos;

    public TokenBucket(long capacity, double refillPerSecond) {
        this(capacity, refillPerSecond, System::nanoTime);
    }

    /** Construtor de teste: relógio injetável. */
    TokenBucket(long capacity, double refillPerSecond, LongSupplier nanoClock) {
        this.capacity = capacity;
        this.refillPerSecond = refillPerSecond;
        this.nanoClock = nanoClock;
        this.tokens = capacity;               // começa cheio (não pune o 1º acesso)
        this.lastNanos = nanoClock.getAsLong();
    }

    /** Consome 1 token se houver. {@code true} = liberado; {@code false} = estourou o limite. */
    public synchronized boolean tryConsume() {
        refill();
        if (tokens >= 1.0) {
            tokens -= 1.0;
            return true;
        }
        return false;
    }

    /** Quanto falta (ms) até o próximo token — vira o header {@code Retry-After}. 0 se já há token. */
    public synchronized long millisUntilNextToken() {
        refill();
        if (tokens >= 1.0) {
            return 0;
        }
        return (long) Math.ceil((1.0 - tokens) / refillPerSecond * 1000.0);
    }

    private void refill() {
        long now = nanoClock.getAsLong();
        double added = (now - lastNanos) / 1_000_000_000.0 * refillPerSecond;
        if (added > 0) {
            tokens = Math.min(capacity, tokens + added);
            lastNanos = now;
        }
    }
}
