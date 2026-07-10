package com.hospital.gateway.grpc;

import java.util.concurrent.TimeUnit;

import io.grpc.CallOptions;
import io.grpc.Channel;
import io.grpc.ClientCall;
import io.grpc.ClientInterceptor;
import io.grpc.MethodDescriptor;

/**
 * Aplica um <b>deadline default</b> a toda chamada gRPC do Gateway que não traga um explícito.
 *
 * <p>Sem deadline, um stub <i>blocking</i> contra um downstream lento/travado prende a thread do
 * Gateway indefinidamente — sob carga (1000 VUs) isso esgota o pool de threads e vira falha em
 * cascata. Com deadline, a chamada falha rápido com {@code DEADLINE_EXCEEDED}, que o
 * {@code GrpcHttpExceptionHandler} já traduz em HTTP 504.
 *
 * <p>POJO (deadline injetado) para ser testável sem Spring; registrado globalmente em
 * {@link GrpcClientConfig}.
 */
public class DeadlineClientInterceptor implements ClientInterceptor {

    private final long deadlineMs;

    public DeadlineClientInterceptor(long deadlineMs) {
        this.deadlineMs = deadlineMs;
    }

    @Override
    public <ReqT, RespT> ClientCall<ReqT, RespT> interceptCall(
            MethodDescriptor<ReqT, RespT> method, CallOptions callOptions, Channel next) {
        if (callOptions.getDeadline() == null) {   // respeita um deadline já definido no call site
            callOptions = callOptions.withDeadlineAfter(deadlineMs, TimeUnit.MILLISECONDS);
        }
        return next.newCall(method, callOptions);
    }
}
