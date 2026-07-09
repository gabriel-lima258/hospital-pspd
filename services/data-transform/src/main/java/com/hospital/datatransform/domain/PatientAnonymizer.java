package com.hospital.datatransform.domain;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Aplica o nível de acesso aos dados demográficos, produzindo o recurso FHIR {@code Patient}.
 * É aqui que o enforcement acontece — o nível não anota o dado, ele o <em>remove</em>.
 *
 * <table>
 *   <tr><th>Nível</th><th>Mantém</th><th>Remove</th></tr>
 *   <tr><td>FULL</td><td>tudo</td><td>—</td></tr>
 *   <tr><td>PARTIAL</td><td>iniciais, sexo, ano de nascimento, cidade/estado</td>
 *       <td>nome completo, CPF, CNS, data exata</td></tr>
 *   <tr><td>ANONYMIZED</td><td>pseudônimo, sexo, faixa etária, estado</td>
 *       <td>nome, CPF, CNS, cidade, data exata, id real</td></tr>
 * </table>
 */
public final class PatientAnonymizer {

    /** Extensão FHIR para a faixa etária — o birthDate não pode carregar um intervalo. */
    static final String URL_FAIXA_ETARIA = "http://hospital.unb.br/fhir/faixaEtaria";

    /** Identificador usado nas referências {@code subject} do Bundle: real ou pseudonimizado. */
    public String subjectId(JsonNode demographics, Nivel nivel) {
        String idReal = texto(demographics, "id");
        return nivel == Nivel.ANONYMIZED ? Pseudonymizer.of(idReal) : idReal;
    }

    public Map<String, Object> patient(JsonNode demographics, Nivel nivel, LocalDate referencia) {
        Map<String, Object> patient = new LinkedHashMap<>();
        patient.put("resourceType", "Patient");
        patient.put("id", subjectId(demographics, nivel));

        String nascimento = texto(demographics, "data_nascimento");

        switch (nivel) {
            case FULL -> {
                patient.put("identifier", identificadores(demographics));
                patient.put("name", List.of(Map.of("text", texto(demographics, "nome"))));
                patient.put("gender", texto(demographics, "genero"));
                patient.put("birthDate", nascimento);
                patient.put("address", List.of(endereco(demographics, true)));
            }
            case PARTIAL -> {
                // Sem identifier: CPF e CNS não saem daqui.
                patient.put("name", List.of(Map.of("text", NameMasker.iniciais(texto(demographics, "nome")))));
                patient.put("gender", texto(demographics, "genero"));
                patient.put("birthDate", AgeBuckets.ano(nascimento)); // "1980" — data parcial válida no FHIR
                patient.put("address", List.of(endereco(demographics, true)));
            }
            case ANONYMIZED -> {
                // Sem name, sem identifier, sem birthDate, sem cidade.
                String faixa = AgeBuckets.faixa(nascimento, referencia);
                if (!faixa.isEmpty()) {
                    patient.put("extension", List.of(Map.of("url", URL_FAIXA_ETARIA, "valueString", faixa)));
                }
                String genero = texto(demographics, "genero");
                if (!genero.isEmpty()) {
                    patient.put("gender", genero);
                }
                Map<String, Object> endereco = endereco(demographics, false);
                if (!endereco.isEmpty()) {
                    patient.put("address", List.of(endereco));
                }
            }
            case AGGREGATED -> throw new IllegalArgumentException(
                    "AGGREGATED não produz Patient — use o MeasureReportBuilder");
        }
        return patient;
    }

    private static List<Map<String, Object>> identificadores(JsonNode demographics) {
        List<Map<String, Object>> ids = new ArrayList<>();
        String cpf = texto(demographics, "cpf");
        String cns = texto(demographics, "cns");
        if (!cpf.isEmpty()) {
            ids.add(Map.of("system", "urn:oid:cpf", "value", cpf));
        }
        if (!cns.isEmpty()) {
            ids.add(Map.of("system", "urn:oid:cns", "value", cns));
        }
        return ids;
    }

    /** ANONYMIZED só conserva o estado; a cidade é identificante. */
    private static Map<String, Object> endereco(JsonNode demographics, boolean comCidade) {
        Map<String, Object> address = new LinkedHashMap<>();
        String cidade = texto(demographics, "cidade");
        String estado = texto(demographics, "estado");
        if (comCidade && !cidade.isEmpty()) {
            address.put("city", cidade);
        }
        if (!estado.isEmpty()) {
            address.put("state", estado);
        }
        return address;
    }

    static String texto(JsonNode node, String campo) {
        if (node == null) {
            return "";
        }
        JsonNode v = node.get(campo);
        return v == null || v.isNull() ? "" : v.asText();
    }
}
