package com.hospital.gateway.adapters.in.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

import io.grpc.Status;

/** Prova o contrato gRPC→HTTP sem subir Spring: o handler é lógica pura. */
class GrpcHttpExceptionHandlerTest {

    private final GrpcHttpExceptionHandler handler = new GrpcHttpExceptionHandler();

    private int http(Status grpc) {
        return handler.handleGrpc(grpc.asRuntimeException()).getStatusCode().value();
    }

    @Test void notFoundVira404()         { assertEquals(404, http(Status.NOT_FOUND)); }
    @Test void invalidArgumentVira400()  { assertEquals(400, http(Status.INVALID_ARGUMENT)); }
    @Test void permissionDeniedVira403() { assertEquals(403, http(Status.PERMISSION_DENIED)); }
    @Test void unauthenticatedVira401()  { assertEquals(401, http(Status.UNAUTHENTICATED)); }
    @Test void unavailableVira503()      { assertEquals(503, http(Status.UNAVAILABLE)); }
    @Test void deadlineVira504()         { assertEquals(504, http(Status.DEADLINE_EXCEEDED)); }
    @Test void desconhecidoVira502()     { assertEquals(502, http(Status.INTERNAL)); }
}
