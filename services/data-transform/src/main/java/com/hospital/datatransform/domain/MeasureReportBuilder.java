package com.hospital.datatransform.domain;

import static com.hospital.datatransform.domain.PatientAnonymizer.texto;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Formata o resumo de coorte do patient-data como um FHIR {@code MeasureReport} — o recurso que o
 * padrão define para estatística de população. Nível AGGREGATED: <b>nenhum dado individual sai daqui</b>.
 *
 * <p>{@code total} → contagem da população; {@code mediaHbA1c} → {@code measureScore};
 * as quatro distribuições percentuais → {@code stratifier[]}.
 */
public final class MeasureReportBuilder {

    /** Ordem em que as distribuições viram estratificadores. */
    private static final List<String> DISTRIBUICOES =
            List.of("porSexo", "porFaixa", "porSetor", "freqMedicamentos");

    public Map<String, Object> build(JsonNode resumo) {
        Map<String, Object> grupo = new LinkedHashMap<>();
        grupo.put("population", List.of(Map.of(
                "code", Map.of("text", "initial-population"),
                "count", resumo.path("total").asLong())));

        JsonNode media = resumo.get("mediaHbA1c");
        if (media != null && !media.isNull()) {
            grupo.put("measureScore", Map.of(
                    "value", media.decimalValue(), "unit", "%", "code", "mediaHbA1c"));
        }
        grupo.put("stratifier", estratificadores(resumo));

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("resourceType", "MeasureReport");
        report.put("status", "complete");
        report.put("type", "summary");
        report.put("measure", "Coorte/" + texto(resumo, "coorte"));
        report.put("group", List.of(grupo));
        return report;
    }

    private static List<Map<String, Object>> estratificadores(JsonNode resumo) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (String nome : DISTRIBUICOES) {
            JsonNode dist = resumo.get(nome);
            if (dist == null || !dist.isObject()) {
                continue;
            }
            List<Map<String, Object>> strata = new ArrayList<>();
            for (Iterator<String> it = dist.fieldNames(); it.hasNext();) {
                String label = it.next();
                strata.add(Map.of(
                        "value", Map.of("text", label),
                        "measureScore", Map.of("value", dist.get(label).decimalValue(), "unit", "%")));
            }
            out.add(Map.of("code", List.of(Map.of("text", nome)), "stratum", strata));
        }
        return out;
    }
}
