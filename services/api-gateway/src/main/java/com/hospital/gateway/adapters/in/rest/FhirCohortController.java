package com.hospital.gateway.adapters.in.rest;

import java.util.Set;

import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import hospital.AuthorizationGrpc;
import hospital.AuthzReply;
import hospital.AuthzRequest;
import hospital.ClinicalData;
import hospital.DataTransformGrpc;
import hospital.FhirReply;
import hospital.PatientDataGrpc;
import hospital.PatientQuery;
import hospital.TransformRequest;
import io.grpc.StatusRuntimeException;

/**
 * Adapter de entrada REST do Gateway — coorte de pesquisa (perfil PESQUISADOR).
 *
 * <p><b>Invariante de segurança.</b> O cliente escolhe o PROJETO (path) e o TIPO de consulta (query);
 * a COORTE vem do {@code AuthzReply}, resolvida pelo Authorization a partir do projeto cujo dono e
 * vigência ele acabou de validar. Não existe parâmetro de coorte nesta rota — se existisse, um
 * pesquisador autorizaria em PRJ01 (Diabetes) e leria a coorte de qualquer outro projeto.
 *
 * <p>O mapeamento gRPC→HTTP aqui é local a esta rota, de propósito: o {@code @ControllerAdvice}
 * global é item de backlog e mudá-lo agora alteraria o comportamento da rota do prontuário (M1).
 */
@RestController
public class FhirCohortController {

    /** Vocabulário compartilhado com Authorization e Patient Data (docs/contratos.md). */
    private static final Set<String> TIPOS = Set.of("ResumoCoorte", "Estatisticas", "ExamesCoorte");

    @GrpcClient("authorization")
    private AuthorizationGrpc.AuthorizationBlockingStub authorizationStub;

    @GrpcClient("patient-data")
    private PatientDataGrpc.PatientDataBlockingStub patientDataStub;

    @GrpcClient("data-transform")
    private DataTransformGrpc.DataTransformBlockingStub dataTransformStub;

    private final ObjectMapper objectMapper;

    public FhirCohortController(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @GetMapping("/fhir/cohort/{projetoId}")
    public ResponseEntity<String> getCohort(@PathVariable String projetoId,
                                            @RequestParam String tipo,
                                            @AuthenticationPrincipal Jwt jwt) {
        if (!TIPOS.contains(tipo)) {
            return ResponseEntity.badRequest().build();
        }
        String username = jwt.getClaimAsString("preferred_username");

        try {
            // 1) Autorização: valida dono + status + vigência do projeto e resolve a coorte.
            AuthzReply authz = authorizationStub.check(AuthzRequest.newBuilder()
                    .setUsername(username == null ? "" : username)
                    .setRole(JwtRoles.extractRole(jwt))
                    .setTipoConsulta(tipo)
                    .setProjetoId(projetoId)
                    .build());
            if (!authz.getAllow()) {
                return ResponseEntity.status(403).build();
            }

            // 2) Dados crus da coorte AUTORIZADA — coorte_codigo vem do AuthzReply, nunca do cliente.
            ClinicalData data = patientDataStub.fetch(PatientQuery.newBuilder()
                    .setCoorteCodigo(authz.getCoorteCodigo())
                    .setTipoConsulta(tipo)
                    .build());

            if (coorteVazia(data.getJsonPayload())) {
                return ResponseEntity.notFound().build();
            }

            // 3) FHIR conforme o nível autorizado: MeasureReport (AGGREGATED) ou Bundle (ANONYMIZED).
            FhirReply fhir = dataTransformStub.toFhir(TransformRequest.newBuilder()
                    .setJsonPayload(data.getJsonPayload())
                    .setNivel(authz.getNivel())
                    .build());

            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(fhir.getFhirJson());

        } catch (StatusRuntimeException | JsonProcessingException e) {
            return ResponseEntity.status(502).build();
        }
    }

    /**
     * Coorte sem pacientes não é erro no Patient Data: o resumo volta com {@code total: 0} e a amostra
     * com {@code pacientes: []}, e ambos viram FHIR válido (MeasureReport zerado / Bundle sem entries).
     * Sem esta guarda o cliente receberia 200 e não distinguiria "projeto sem dados" de "com dados" —
     * daí o 404 aqui, antes de gastar a chamada ao Data Transform. Discrimina pela shape do payload.
     */
    private boolean coorteVazia(String rawPayload) throws JsonProcessingException {
        JsonNode root = objectMapper.readTree(rawPayload);

        JsonNode pacientes = root.get("pacientes");   // ExamesCoorte
        if (pacientes != null) {
            return !pacientes.isArray() || pacientes.isEmpty();
        }
        JsonNode total = root.get("total");           // ResumoCoorte / Estatisticas
        return total == null || total.asLong() == 0L;
    }
}
