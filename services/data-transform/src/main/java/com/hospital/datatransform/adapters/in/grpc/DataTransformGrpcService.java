package com.hospital.datatransform.adapters.in.grpc;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.datatransform.domain.FhirTransformer;

import hospital.DataTransformGrpc;
import hospital.FhirReply;
import hospital.TransformRequest;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;

/**
 * Adapter de entrada gRPC do Data Transform. Lê {@code nivel} + {@code json_payload}, delega ao
 * domínio e devolve o FHIR. Sem passthrough: o nível decide a forma da saída.
 */
@GrpcService
public class DataTransformGrpcService extends DataTransformGrpc.DataTransformImplBase {

    private static final Logger log = LoggerFactory.getLogger(DataTransformGrpcService.class);

    private final FhirTransformer transformer;

    public DataTransformGrpcService(ObjectMapper objectMapper) {
        this.transformer = new FhirTransformer(objectMapper);
    }

    @Override
    public void toFhir(TransformRequest request, StreamObserver<FhirReply> responseObserver) {
        try {
            String fhirJson = transformer.transform(request.getJsonPayload(), request.getNivel());
            responseObserver.onNext(FhirReply.newBuilder().setFhirJson(fhirJson).build());
            responseObserver.onCompleted();
        } catch (IllegalArgumentException e) {
            // Nível ausente/desconhecido ou incompatível com a shape recebida: contrato violado pelo
            // chamador, não falha interna. INVALID_ARGUMENT evita mascarar o bug como um 500 genérico.
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription(e.getMessage()).withCause(e).asRuntimeException());
        } catch (Exception e) {
            // Falha inesperada: loga com stack (server-side, correlacionável por trace_id) e devolve
            // INTERNAL genérico — nunca a exceção crua, que vazaria detalhe interno ao cliente.
            log.error("falha inesperada em toFhir", e);
            responseObserver.onError(Status.INTERNAL
                    .withDescription("erro interno").asRuntimeException());
        }
    }
}
