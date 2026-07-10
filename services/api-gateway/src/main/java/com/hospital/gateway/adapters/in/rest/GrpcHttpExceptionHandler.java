package com.hospital.gateway.adapters.in.rest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import io.grpc.StatusRuntimeException;

/**
 * Tradução central gRPC→HTTP. Sem isto, qualquer {@link StatusRuntimeException} que escape de um
 * controller vira 500 genérico — inclusive "paciente inexistente", que o Patient Data já sinaliza
 * como {@code NOT_FOUND}. Mapeia o código gRPC para o status HTTP semanticamente correto.
 *
 * <p>Escopo: só as rotas cujo controller <b>não</b> captura o erro localmente. O
 * {@link FhirCohortController} mantém o próprio {@code try/catch} (validado no M2) e, por capturar
 * antes, não passa por aqui — este advice é aditivo e não altera aquele comportamento.
 */
@RestControllerAdvice
public class GrpcHttpExceptionHandler {

    @ExceptionHandler(StatusRuntimeException.class)
    public ResponseEntity<Void> handleGrpc(StatusRuntimeException e) {
        HttpStatus http = switch (e.getStatus().getCode()) {
            case NOT_FOUND         -> HttpStatus.NOT_FOUND;            // 404
            case INVALID_ARGUMENT  -> HttpStatus.BAD_REQUEST;         // 400
            case PERMISSION_DENIED -> HttpStatus.FORBIDDEN;           // 403
            case UNAUTHENTICATED   -> HttpStatus.UNAUTHORIZED;        // 401
            case UNAVAILABLE       -> HttpStatus.SERVICE_UNAVAILABLE; // 503 — upstream fora do ar
            case DEADLINE_EXCEEDED -> HttpStatus.GATEWAY_TIMEOUT;     // 504
            default                -> HttpStatus.BAD_GATEWAY;         // 502 — falha upstream não classificada
        };
        return ResponseEntity.status(http).build();
    }
}
