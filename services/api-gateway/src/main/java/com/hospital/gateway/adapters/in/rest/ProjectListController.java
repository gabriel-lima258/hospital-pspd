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
import hospital.PatientDataGrpc;
import hospital.PatientQuery;

/**
 * Adapter de entrada REST do Gateway — "quais projetos possui e status de cada um" (enunciado §2.1,
 * item iv do pesquisador). Rota {@code GET /projects} FORA de {@code /fhir} de propósito: o enunciado
 * não mapeia {@code projects} para nenhum recurso HL7/FHIR (a tabela tabela→FHIR cobre só dados
 * clínicos do paciente), então a lista é metadado administrativo devolvido como JSON puro — sem passar
 * pelo Data Transform.
 *
 * <p>Segurança: o {@code username} vem do JWT; o Authorization libera apenas PESQUISADOR e o Patient
 * Data filtra por {@code username_pesquisador}. Um perfil diferente recebe DENY → 403.
 */
@RestController
public class ProjectListController {

    @GrpcClient("authorization")
    private AuthorizationGrpc.AuthorizationBlockingStub authorizationStub;

    @GrpcClient("patient-data")
    private PatientDataGrpc.PatientDataBlockingStub patientDataStub;

    @GetMapping("/projects")
    public ResponseEntity<String> listProjects(@AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        String role = JwtRoles.extractRole(jwt);

        // 1) Autorização: só PESQUISADOR; a lista é escopada por username adiante.
        AuthzReply authz = authorizationStub.check(AuthzRequest.newBuilder()
                .setUsername(username == null ? "" : username)
                .setRole(role)
                .setTipoConsulta("ListaProjetos")
                .build());
        if (!authz.getAllow()) {
            return ResponseEntity.status(403).build();
        }
        org.slf4j.MDC.put("nivel", authz.getNivel());   // auditoria: nível servido (AccessLogFilter loga)

        // 2) Projetos do pesquisador (filtrados por username). JSON puro — não é recurso FHIR.
        ClinicalData data = patientDataStub.fetch(PatientQuery.newBuilder()
                .setUsername(username == null ? "" : username)
                .setTipoConsulta("ListaProjetos")
                .build());

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(data.getJsonPayload());
    }
}
