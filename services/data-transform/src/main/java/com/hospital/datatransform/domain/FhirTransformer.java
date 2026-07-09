package com.hospital.datatransform.domain;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Fachada do domínio: recebe o JSON cru do patient-data + o nível autorizado e devolve o FHIR.
 * É o único ponto que o adapter gRPC conhece.
 *
 * <p><b>Dispatch nível × shape</b> — o patient-data emite três shapes distintas:
 * <table>
 *   <tr><th>Chave presente</th><th>Origem</th><th>Níveis</th><th>Saída</th></tr>
 *   <tr><td>{@code demographics}</td><td>individual</td><td>FULL, PARTIAL, ANONYMIZED</td><td>Bundle</td></tr>
 *   <tr><td>{@code pacientes}</td><td>ExamesCoorte</td><td>ANONYMIZED</td><td>Bundle</td></tr>
 *   <tr><td>{@code total}</td><td>ResumoCoorte</td><td>AGGREGATED</td><td>MeasureReport</td></tr>
 * </table>
 *
 * <p>Combinação incompatível é erro, não caso de borda: significa que Gateway e Authorization
 * discordaram, e devolver dado calado no nível errado é o bug que este serviço existe para matar.
 */
public final class FhirTransformer {

    private final ObjectMapper objectMapper;
    private final PatientAnonymizer anonymizer = new PatientAnonymizer();
    private final FhirResourceMapper recursos = new FhirResourceMapper();
    private final MeasureReportBuilder measureReport = new MeasureReportBuilder();

    public FhirTransformer(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String transform(String rawJson, String nivelRaw) throws Exception {
        return transform(rawJson, nivelRaw, LocalDate.now());
    }

    /** Sobrecarga com a data de referência explícita — é o que torna os testes determinísticos. */
    String transform(String rawJson, String nivelRaw, LocalDate referencia) throws Exception {
        Nivel nivel = Nivel.fromProto(nivelRaw);
        JsonNode root = objectMapper.readTree(rawJson);

        Map<String, Object> fhir = switch (nivel) {
            case FULL, PARTIAL -> {
                exigir(root.has("demographics"), nivel, "payload individual (demographics)");
                yield bundleIndividual(root, nivel, referencia);
            }
            case ANONYMIZED -> {
                if (root.has("demographics")) {
                    yield bundleIndividual(root, nivel, referencia);
                }
                exigir(root.has("pacientes"), nivel, "payload individual ou de coorte (pacientes)");
                yield bundleCoorte(root, referencia);
            }
            case AGGREGATED -> {
                exigir(root.has("total") && root.has("porSexo"), nivel, "resumo de coorte (total/porSexo)");
                yield measureReport.build(root);
            }
        };
        return objectMapper.writeValueAsString(fhir);
    }

    /** Bundle de um paciente: Patient (mascarado pelo nível) + os 4 recursos clínicos. */
    private Map<String, Object> bundleIndividual(JsonNode root, Nivel nivel, LocalDate referencia) {
        JsonNode demographics = root.get("demographics");
        String subjectRef = "Patient/" + anonymizer.subjectId(demographics, nivel);

        List<Map<String, Object>> entradas = new ArrayList<>();
        entradas.add(anonymizer.patient(demographics, nivel, referencia));
        for (JsonNode e : root.path("encounters")) {
            entradas.add(recursos.encounter(e, subjectRef, nivel));
        }
        for (JsonNode c : root.path("conditions")) {
            entradas.add(recursos.condition(c, subjectRef, nivel));
        }
        for (JsonNode o : root.path("observations")) {
            entradas.add(recursos.observation(o, subjectRef, nivel));
        }
        for (JsonNode m : root.path("medications")) {
            entradas.add(recursos.medicationRequest(m, subjectRef, nivel));
        }
        return recursos.bundle(entradas);
    }

    /**
     * Bundle da coorte (ExamesCoorte + ANONYMIZED): um Patient pseudonimizado por paciente e um
     * Observation por exame. A fonte não traz genero/estado/condições/medicações — só o que existe
     * é mapeado; a cidade que vem no payload é descartada pelo anonimizador.
     */
    private Map<String, Object> bundleCoorte(JsonNode root, LocalDate referencia) {
        List<Map<String, Object>> entradas = new ArrayList<>();
        for (JsonNode paciente : root.path("pacientes")) {
            String subjectRef = "Patient/" + anonymizer.subjectId(paciente, Nivel.ANONYMIZED);
            entradas.add(anonymizer.patient(paciente, Nivel.ANONYMIZED, referencia));

            JsonNode exames = paciente.path("exames");
            for (Iterator<String> it = exames.fieldNames(); it.hasNext();) {
                String codigo = it.next();
                for (JsonNode exame : exames.get(codigo)) {
                    entradas.add(recursos.observationDeExame(codigo, exame, subjectRef, Nivel.ANONYMIZED));
                }
            }
        }
        return recursos.bundle(entradas);
    }

    private static void exigir(boolean condicao, Nivel nivel, String esperado) {
        if (!condicao) {
            throw new IllegalArgumentException(
                    "nivel " + nivel + " exige " + esperado + " — shape recebida é incompatível");
        }
    }
}
