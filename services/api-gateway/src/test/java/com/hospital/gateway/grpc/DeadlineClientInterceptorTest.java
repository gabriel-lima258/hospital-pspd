package com.hospital.gateway.grpc;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;

import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;

import io.grpc.CallOptions;
import io.grpc.Channel;
import io.grpc.ClientCall;
import io.grpc.MethodDescriptor;

/**
 * Testa a lógica do interceptor sem subir Spring nem canal real: um {@link Channel} de captura grava
 * as {@link CallOptions} que o interceptor repassa a {@code newCall}.
 */
class DeadlineClientInterceptorTest {

    /** Canal falso que só captura as CallOptions recebidas. */
    private static final class CapturingChannel extends Channel {
        CallOptions captured;

        @Override
        public <Q, S> ClientCall<Q, S> newCall(MethodDescriptor<Q, S> method, CallOptions callOptions) {
            this.captured = callOptions;
            return null;   // o interceptor apenas repassa; o retorno não é exercido aqui
        }

        @Override
        public String authority() {
            return "test";
        }
    }

    private final DeadlineClientInterceptor interceptor = new DeadlineClientInterceptor(2000);

    @Test
    void aplicaDeadlineQuandoAusente() {
        CapturingChannel ch = new CapturingChannel();
        interceptor.interceptCall(null, CallOptions.DEFAULT, ch);
        assertNotNull(ch.captured.getDeadline(), "sem deadline no call site, o interceptor deve aplicar o default");
    }

    @Test
    void respeitaDeadlineExistente() {
        CapturingChannel ch = new CapturingChannel();
        CallOptions comDeadline = CallOptions.DEFAULT.withDeadlineAfter(60, TimeUnit.SECONDS);
        interceptor.interceptCall(null, comDeadline, ch);
        assertSame(comDeadline.getDeadline(), ch.captured.getDeadline(),
                "deadline já definido no call site não deve ser sobrescrito");
    }
}
