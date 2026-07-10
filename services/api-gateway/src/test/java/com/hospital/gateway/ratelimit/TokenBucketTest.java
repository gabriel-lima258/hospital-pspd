package com.hospital.gateway.ratelimit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;

/** Relógio manual → refill determinístico, sem sleeps. */
class TokenBucketTest {

    private final AtomicLong clock = new AtomicLong(0);

    private TokenBucket bucket(long cap, double refill) {
        return new TokenBucket(cap, refill, clock::get);
    }

    private void advanceSeconds(double s) {
        clock.addAndGet((long) (s * 1_000_000_000L));
    }

    @Test
    void comecaCheioEConsomeAteEsgotar() {
        TokenBucket b = bucket(3, 1.0);
        assertTrue(b.tryConsume());
        assertTrue(b.tryConsume());
        assertTrue(b.tryConsume());
        assertFalse(b.tryConsume(), "4ª requisição sem refill deve estourar");
    }

    @Test
    void refillPorTempoLiberaDeNovo() {
        TokenBucket b = bucket(2, 1.0);   // 1 token/s
        assertTrue(b.tryConsume());
        assertTrue(b.tryConsume());
        assertFalse(b.tryConsume());
        advanceSeconds(1.0);              // +1 token
        assertTrue(b.tryConsume());
        assertFalse(b.tryConsume());
    }

    @Test
    void naoPassaDaCapacidadeMesmoOcioso() {
        TokenBucket b = bucket(5, 100.0);
        b.tryConsume();                   // 4 restantes
        advanceSeconds(10.0);             // encheria 1000, mas satura em 5
        for (int i = 0; i < 5; i++) {
            assertTrue(b.tryConsume(), "token " + i + " deveria existir (cap=5)");
        }
        assertFalse(b.tryConsume());
    }

    @Test
    void retryAfterZeroQuandoHaToken() {
        TokenBucket b = bucket(1, 2.0);
        assertEquals(0, b.millisUntilNextToken(), "com token disponível, nada a esperar");
    }

    @Test
    void retryAfterRefleteODeficit() {
        TokenBucket b = bucket(1, 2.0);   // 2 tokens/s → 1 token a cada 500ms
        assertTrue(b.tryConsume());       // esvazia
        long ms = b.millisUntilNextToken();
        assertTrue(ms > 0 && ms <= 500, "esperado ~500ms até o próximo token, veio " + ms);
    }
}
