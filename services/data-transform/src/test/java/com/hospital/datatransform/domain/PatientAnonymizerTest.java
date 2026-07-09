package com.hospital.datatransform.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** O teste que prova o enforcement: o nível não anota o dado, ele o remove. */
@DisplayName("PatientAnonymizer — enforcement por nível sobre os demográficos")
class PatientAnonymizerTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 7, 9);

    /** Os dados reais de P000001 no seed. */
    private static final String DEMOGRAPHICS = """
            {"id":"P000001","nome":"Joao da Silva","data_nascimento":"1980-05-12","genero":"male",
             "cidade":"Brasilia","estado":"DF","cpf":"000.000.000-00","cns":"700000000000000"}
            """;

    private final PatientAnonymizer anonymizer = new PatientAnonymizer();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private Map<String, Object> patient(Nivel nivel) throws Exception {
        JsonNode demographics = objectMapper.readTree(DEMOGRAPHICS);
        return anonymizer.patient(demographics, nivel, HOJE);
    }

    /** Serializa e procura a agulha — pega vazamento em qualquer profundidade do recurso. */
    private String json(Nivel nivel) throws Exception {
        return objectMapper.writeValueAsString(patient(nivel));
    }

    @Nested
    @DisplayName("FULL — o médico vê tudo")
    class Full {

        @Test
        @DisplayName("mantém nome completo, data exata, cidade e os identificadores CPF/CNS")
        void mantemTudo() throws Exception {
            Map<String, Object> p = patient(Nivel.FULL);

            assertThat(p).containsEntry("id", "P000001").containsEntry("birthDate", "1980-05-12");
            assertThat(p.get("name")).isEqualTo(List.of(Map.of("text", "Joao da Silva")));
            assertThat(json(Nivel.FULL)).contains("000.000.000-00", "700000000000000", "Brasilia", "DF");
        }
    }

    @Nested
    @DisplayName("PARTIAL — o estagiário vê iniciais, sem documentos")
    class Partial {

        @Test
        @DisplayName("o nome vira iniciais")
        void iniciais() throws Exception {
            assertThat(patient(Nivel.PARTIAL).get("name")).isEqualTo(List.of(Map.of("text", "J. da S.")));
        }

        @Test
        @DisplayName("CPF e CNS somem — nem a chave identifier existe")
        void semDocumentos() throws Exception {
            assertThat(patient(Nivel.PARTIAL)).doesNotContainKey("identifier");
            assertThat(json(Nivel.PARTIAL)).doesNotContain("000.000.000-00").doesNotContain("700000000000000");
        }

        @Test
        @DisplayName("a data exata vira só o ano; nome completo não sobrevive")
        void semDataExata() throws Exception {
            assertThat(patient(Nivel.PARTIAL)).containsEntry("birthDate", "1980");
            assertThat(json(Nivel.PARTIAL)).doesNotContain("1980-05-12").doesNotContain("Joao da Silva");
        }

        @Test
        @DisplayName("cidade, estado e sexo permanecem")
        void mantemLocalidade() throws Exception {
            assertThat(patient(Nivel.PARTIAL)).containsEntry("gender", "male");
            assertThat(json(Nivel.PARTIAL)).contains("Brasilia", "DF");
        }
    }

    @Nested
    @DisplayName("ANONYMIZED — o pesquisador não vê quem é")
    class Anonymized {

        @Test
        @DisplayName("o id real é substituído por um pseudônimo estável")
        void pseudonimo() throws Exception {
            Map<String, Object> p = patient(Nivel.ANONYMIZED);

            assertThat((String) p.get("id")).matches("^hash[0-9a-f]{12}$");
            assertThat(json(Nivel.ANONYMIZED)).doesNotContain("P000001");
        }

        @Test
        @DisplayName("nome e cidade somem; o estado permanece")
        void semNomeNemCidade() throws Exception {
            Map<String, Object> p = patient(Nivel.ANONYMIZED);

            assertThat(p).doesNotContainKey("name").doesNotContainKey("identifier");
            assertThat(json(Nivel.ANONYMIZED)).doesNotContain("Joao").doesNotContain("Brasilia");
            assertThat(p.get("address")).isEqualTo(List.of(Map.of("state", "DF")));
        }

        @Test
        @DisplayName("sem birthDate; a idade vira faixa etária numa extension FHIR")
        void faixaEtaria() throws Exception {
            Map<String, Object> p = patient(Nivel.ANONYMIZED);

            assertThat(p).doesNotContainKey("birthDate");
            assertThat(json(Nivel.ANONYMIZED)).doesNotContain("1980");
            assertThat(p.get("extension")).isEqualTo(
                    List.of(Map.of("url", PatientAnonymizer.URL_FAIXA_ETARIA, "valueString", "40-59")));
        }

        @Test
        @DisplayName("o sexo permanece — é o que sustenta a análise da coorte")
        void mantemSexo() throws Exception {
            assertThat(patient(Nivel.ANONYMIZED)).containsEntry("gender", "male");
        }
    }

    @Test
    @DisplayName("AGGREGATED não produz Patient — estatística não tem sujeito")
    void aggregatedRecusa() {
        assertThatThrownBy(() -> patient(Nivel.AGGREGATED))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("MeasureReport");
    }
}
