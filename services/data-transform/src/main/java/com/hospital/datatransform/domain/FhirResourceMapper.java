package com.hospital.datatransform.domain;

import static com.hospital.datatransform.domain.PatientAnonymizer.texto;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Mapeia os eventos do prontuário nos recursos clínicos FHIR. Mínimo, porém conforme —
 * sem HAPI: o payload é montado à mão com {@link LinkedHashMap} (ordem determinística).
 *
 * <p>O {@link Nivel} entra aqui só para decidir o truncamento de data: sob ANONYMIZED, a sequência
 * exata de timestamps de exames reidentifica o paciente tão bem quanto o nome dele.
 */
public final class FhirResourceMapper {

    /** encounters → Encounter. */
    public Map<String, Object> encounter(JsonNode e, String subjectRef, Nivel nivel) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("resourceType", "Encounter");
        r.put("id", texto(e, "id"));
        r.put("status", "finished");
        r.put("class", Map.of("code", texto(e, "tipo_atendimento")));
        r.put("serviceType", Map.of("text", texto(e, "setor")));

        Map<String, Object> period = new LinkedHashMap<>();
        period.put("start", data(texto(e, "data_inicio"), nivel));
        period.put("end", data(texto(e, "data_fim"), nivel));
        r.put("period", period);

        r.put("subject", Map.of("reference", subjectRef));
        return r;
    }

    /** clinical_events tipo_evento='Condicao' → Condition. */
    public Map<String, Object> condition(JsonNode c, String subjectRef, Nivel nivel) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("resourceType", "Condition");
        r.put("code", Map.of("text", texto(c, "codigo_tipo")));
        String descricao = texto(c, "descricao");
        if (!descricao.isEmpty()) {
            r.put("note", List.of(Map.of("text", descricao)));
        }
        r.put("recordedDate", data(texto(c, "data"), nivel));
        r.put("subject", Map.of("reference", subjectRef));
        return r;
    }

    /** clinical_events tipo_evento='Observacao' → Observation. */
    public Map<String, Object> observation(JsonNode o, String subjectRef, Nivel nivel) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("resourceType", "Observation");
        r.put("status", "final");
        r.put("code", Map.of("text", texto(o, "codigo_tipo")));

        JsonNode valor = o.get("valor");
        if (valor != null && !valor.isNull()) {
            Map<String, Object> quantity = new LinkedHashMap<>();
            quantity.put("value", valor.decimalValue());
            quantity.put("unit", texto(o, "unidade"));
            r.put("valueQuantity", quantity);
        }
        r.put("effectiveDateTime", data(texto(o, "data"), nivel));
        r.put("subject", Map.of("reference", subjectRef));
        return r;
    }

    /** clinical_events tipo_evento='Medicacao' → MedicationRequest. */
    public Map<String, Object> medicationRequest(JsonNode m, String subjectRef, Nivel nivel) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("resourceType", "MedicationRequest");
        r.put("status", "active");
        r.put("intent", "order");
        // `descricao` ("Antidiabetico") é redundante com o código; fica de fora p/ manter o recurso mínimo.
        r.put("medicationCodeableConcept", Map.of("text", texto(m, "codigo_tipo")));
        r.put("authoredOn", data(texto(m, "data"), nivel));
        r.put("subject", Map.of("reference", subjectRef));
        return r;
    }

    /** Observação sintética a partir de um exame da coorte (shape ExamesCoorte, sem tipo_evento). */
    public Map<String, Object> observationDeExame(String codigo, JsonNode exame, String subjectRef, Nivel nivel) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("resourceType", "Observation");
        r.put("status", "final");
        r.put("code", Map.of("text", codigo));

        JsonNode valor = exame.get("valor");
        if (valor != null && !valor.isNull()) {
            Map<String, Object> quantity = new LinkedHashMap<>();
            quantity.put("value", valor.decimalValue());
            quantity.put("unit", texto(exame, "unidade"));
            r.put("valueQuantity", quantity);
        }
        r.put("effectiveDateTime", data(texto(exame, "data"), nivel));
        r.put("subject", Map.of("reference", subjectRef));
        return r;
    }

    /** Bundle {@code collection} (default): agrupa os recursos de um paciente. */
    public Map<String, Object> bundle(List<Map<String, Object>> recursos) {
        return bundle(recursos, "collection");
    }

    /** Bundle com {@code type} explícito — {@code searchset} para a lista de pacientes (resultado de busca). */
    public Map<String, Object> bundle(List<Map<String, Object>> recursos, String type) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("resourceType", "Bundle");
        b.put("type", type);
        // `total` só é válido (FHIR) em bundles de resultado de busca — não em `collection`.
        if ("searchset".equals(type)) {
            b.put("total", recursos.size());
        }
        b.put("entry", recursos.stream().map(r -> Map.of("resource", r)).toList());
        return b;
    }

    /** Sob ANONYMIZED a data clínica é truncada ao ano; nos demais níveis segue integral. */
    private static String data(String iso, Nivel nivel) {
        return nivel == Nivel.ANONYMIZED ? AgeBuckets.ano(iso) : iso;
    }
}
