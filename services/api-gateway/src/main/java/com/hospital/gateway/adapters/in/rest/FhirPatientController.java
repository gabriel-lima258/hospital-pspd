package com.hospital.gateway.adapters.in.rest;

import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
 * Adapter de entrada REST do Gateway — prontuário individual (médico/estagiário). Orquestra a pilha
 * via gRPC: Authorization.Check → (ALLOW) PatientData.Fetch → DataTransform.ToFhir. Só o caminho
 * feliz: erro gRPC ainda vira 500 genérico (o mapeamento gRPC→HTTP global é item de backlog).
 * A coorte do pesquisador tem rota própria em {@link FhirCohortController}.
 */
@RestController
public class FhirPatientController {

    @GrpcClient("authorization")
    private AuthorizationGrpc.AuthorizationBlockingStub authorizationStub;

    @GrpcClient("patient-data")
    private PatientDataGrpc.PatientDataBlockingStub patientDataStub;

    @GrpcClient("data-transform")
    private DataTransformGrpc.DataTransformBlockingStub dataTransformStub;

    @GetMapping("/fhir/Patient/{id}")
    public ResponseEntity<String> getPatient(@PathVariable String id, @AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        String role = JwtRoles.extractRole(jwt);

        // 1) Autorização.
        AuthzReply authz = authorizationStub.check(AuthzRequest.newBuilder()
                .setUsername(username == null ? "" : username)
                .setRole(role)
                .setTipoConsulta("Patient")
                .setPatientId(id)
                .build());
        if (!authz.getAllow()) {
            return ResponseEntity.status(403).build();
        }

        // 2) Busca dos dados clínicos crus.
        ClinicalData data = patientDataStub.fetch(PatientQuery.newBuilder()
                .setPatientId(id)
                .setTipoConsulta("Patient")
                .build());

        // 3) Conversão para FHIR conforme o nível autorizado.
        FhirReply fhir = dataTransformStub.toFhir(TransformRequest.newBuilder()
                .setJsonPayload(data.getJsonPayload())
                .setNivel(authz.getNivel())
                .build());

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(fhir.getFhirJson());
    }
}
