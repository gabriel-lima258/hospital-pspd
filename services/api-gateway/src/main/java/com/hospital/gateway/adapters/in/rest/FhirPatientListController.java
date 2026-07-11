package com.hospital.gateway.adapters.in.rest;

import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import hospital.AuthorizationGrpc;
import hospital.AuthzReply;
import hospital.AuthzRequest;
import hospital.ClinicalData;
import hospital.DataTransformGrpc;
import hospital.FhirReply;
import hospital.PatientDataGrpc;
import hospital.PatientQuery;
import hospital.TransformRequest;

/**
 * Adapter de entrada REST do Gateway — "lista de pacientes sob sua responsabilidade / supervisionados"
 * (enunciado §2.1, médico/estagiário). Rota FHIR-idiomática {@code GET /fhir/Patient} (sem id) → um
 * {@code Bundle searchset} de Patients, cada um mascarado pelo nível da role (FULL × PARTIAL).
 *
 * <p>Segurança: o cliente NÃO informa de quem é a lista — o {@code username} vem do JWT e o filtro por
 * {@code username_cuidador} é feito no Patient Data, então um cuidador jamais lista pacientes de outro.
 * Erros gRPC que escapam são traduzidos pelo {@link GrpcHttpExceptionHandler} global.
 */
@RestController
public class FhirPatientListController {

    @GrpcClient("authorization")
    private AuthorizationGrpc.AuthorizationBlockingStub authorizationStub;

    @GrpcClient("patient-data")
    private PatientDataGrpc.PatientDataBlockingStub patientDataStub;

    @GrpcClient("data-transform")
    private DataTransformGrpc.DataTransformBlockingStub dataTransformStub;

    @GetMapping("/fhir/Patient")
    public ResponseEntity<String> listPatients(@AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        String role = JwtRoles.extractRole(jwt);

        // 1) Autorização: libera pela role (médico/estagiário); a lista é escopada por username adiante.
        AuthzReply authz = authorizationStub.check(AuthzRequest.newBuilder()
                .setUsername(username == null ? "" : username)
                .setRole(role)
                .setTipoConsulta("ListaPacientes")
                .build());
        if (!authz.getAllow()) {
            return ResponseEntity.status(403).build();
        }
        org.slf4j.MDC.put("nivel", authz.getNivel());   // auditoria: nível servido (AccessLogFilter loga)

        // 2) Pacientes do cuidador (filtrados por username no Patient Data).
        ClinicalData data = patientDataStub.fetch(PatientQuery.newBuilder()
                .setUsername(username == null ? "" : username)
                .setTipoConsulta("ListaPacientes")
                .build());

        // 3) Bundle searchset com o Patient de cada um, mascarado conforme o nível.
        FhirReply fhir = dataTransformStub.toFhir(TransformRequest.newBuilder()
                .setJsonPayload(data.getJsonPayload())
                .setNivel(authz.getNivel())
                .build());

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(fhir.getFhirJson());
    }
}
