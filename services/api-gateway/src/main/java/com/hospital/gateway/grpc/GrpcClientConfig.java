package com.hospital.gateway.grpc;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import net.devh.boot.grpc.client.interceptor.GrpcGlobalClientInterceptor;

/**
 * Registra o {@link DeadlineClientInterceptor} como interceptor global do client gRPC (net.devh) —
 * uma peça cobre os 3 stubs (Authorization/PatientData/DataTransform) sem tocar nos call sites.
 */
@Configuration
public class GrpcClientConfig {

    /** Deadline default (ms) das chamadas gRPC do Gateway. Override por env GATEWAY_GRPC_DEADLINE_MS. */
    @Bean
    @GrpcGlobalClientInterceptor
    DeadlineClientInterceptor deadlineClientInterceptor(
            @Value("${gateway.grpc.deadline-ms:2000}") long deadlineMs) {
        return new DeadlineClientInterceptor(deadlineMs);
    }
}
