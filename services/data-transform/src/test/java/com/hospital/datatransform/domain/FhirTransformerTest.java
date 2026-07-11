package com.hospital.datatransform.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@DisplayName("FhirTransformer — dispatch nível × shape e montagem do FHIR")
class FhirTransformerTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 7, 9);

    /** Shape individual do patient-data (P3a), com um recurso de cada tipo. */
    private static final String INDIVIDUAL = """
            {"demographics":{"id":"P000001","nome":"Joao da Silva","data_nascimento":"1980-05-12",
              "genero":"male","cidade":"Brasilia","estado":"DF","cpf":"000.000.000-00","cns":"700000000000000"},
             "encounters":[{"id":3,"data_inicio":"2023-08-03T03:13:19","data_fim":"2023-08-05T08:13:19",
              "tipo_atendimento":"Ambulatorial","setor":"Endocrinologia"}],
             "conditions":[{"codigo_tipo":"Diabetes","descricao":"Diabetes mellitus tipo 2",
              "data":"2025-01-25T06:33:44"}],
             "observations":[{"codigo_tipo":"Creatinina","valor":2.16,"unidade":"mg/dL",
              "data":"2023-09-29T11:20:08"}],
             "medications":[{"codigo_tipo":"Insulina","descricao":"Antidiabetico",
              "data":"2023-09-05T06:30:05"}]}
            """;

    /** Shape ExamesCoorte (P3a) — sem genero/estado/condições/medicações. */
    private static final String COORTE = """
            {"coorte":"Diabetes","pacientes":[
              {"id":"P000001","nome":"Joao da Silva","data_nascimento":"1980-05-12","cidade":"Brasilia",
               "exames":{"HbA1c":[{"valor":9.91,"unidade":"%","data":"2023-12-06T02:51:48"}],
                         "Glicemia":[],"Creatinina":[]}}]}
            """;

    /** Shape ResumoCoorte (P3a), com os números reais medidos no cluster. */
    private static final String RESUMO = """
            {"coorte":"Diabetes","total":8952,
             "porSexo":{"male":49.31,"female":46.89,"other":3.8},
             "porFaixa":{"0-17":0.69,"18-39":29.49,"40-59":27.67,"60+":42.15},
             "porSetor":{"Endocrinologia":79.94,"Ortopedia":4.15},
             "mediaHbA1c":8.76,
             "freqMedicamentos":{"Insulina":40.24,"Metformina":39.89}}
            """;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final FhirTransformer transformer = new FhirTransformer(objectMapper);

    private JsonNode transform(String payload, String nivel) throws Exception {
        return objectMapper.readTree(transformer.transform(payload, nivel, HOJE));
    }

    private static List<String> tiposDeRecurso(JsonNode bundle) {
        List<String> tipos = new ArrayList<>();
        for (JsonNode entry : bundle.get("entry")) {
            tipos.add(entry.get("resource").get("resourceType").asText());
        }
        return tipos;
    }

    @Nested
    @DisplayName("payload individual")
    class Individual {

        @Test
        @DisplayName("FULL devolve um Bundle com os 5 recursos FHIR")
        void fullBundle() throws Exception {
            JsonNode bundle = transform(INDIVIDUAL, "FULL");

            assertThat(bundle.get("resourceType").asText()).isEqualTo("Bundle");
            assertThat(bundle.get("type").asText()).isEqualTo("collection");
            assertThat(tiposDeRecurso(bundle)).containsExactly(
                    "Patient", "Encounter", "Condition", "Observation", "MedicationRequest");
        }

        @Test
        @DisplayName("FULL preserva as datas clínicas exatas")
        void fullDatasIntegrais() throws Exception {
            JsonNode obs = transform(INDIVIDUAL, "FULL").get("entry").get(3).get("resource");
            assertThat(obs.get("effectiveDateTime").asText()).isEqualTo("2023-09-29T11:20:08");
            assertThat(obs.get("valueQuantity").get("value").asDouble()).isEqualTo(2.16);
        }

        @Test
        @DisplayName("PARTIAL mantém os recursos clínicos, mas mascara o Patient")
        void partial() throws Exception {
            JsonNode bundle = transform(INDIVIDUAL, "PARTIAL");
            JsonNode patient = bundle.get("entry").get(0).get("resource");

            assertThat(tiposDeRecurso(bundle)).contains("Encounter", "Condition", "MedicationRequest");
            assertThat(patient.get("name").get(0).get("text").asText()).isEqualTo("J. da S.");
            assertThat(patient.has("identifier")).isFalse();
        }

        @Test
        @DisplayName("ANONYMIZED trunca as datas clínicas ao ano e referencia o pseudônimo")
        void anonymizedTruncaDatas() throws Exception {
            JsonNode bundle = transform(INDIVIDUAL, "ANONYMIZED");
            String pseudo = bundle.get("entry").get(0).get("resource").get("id").asText();

            JsonNode encounter = bundle.get("entry").get(1).get("resource");
            JsonNode observation = bundle.get("entry").get(3).get("resource");

            assertThat(encounter.get("period").get("start").asText()).isEqualTo("2023");
            assertThat(observation.get("effectiveDateTime").asText()).isEqualTo("2023");
            assertThat(observation.get("subject").get("reference").asText()).isEqualTo("Patient/" + pseudo);
        }

        @Test
        @DisplayName("ANONYMIZED não deixa vazar id real, nome nem cidade em nenhum recurso")
        void anonymizedNaoVaza() throws Exception {
            String json = transformer.transform(INDIVIDUAL, "ANONYMIZED", HOJE);

            assertThat(json).doesNotContain("P000001").doesNotContain("Joao").doesNotContain("Brasilia");
            assertThat(json).doesNotContain("000.000.000-00").doesNotContain("2023-09-29T11:20:08");
        }
    }

    @Nested
    @DisplayName("payload de coorte (ExamesCoorte)")
    class Coorte {

        @Test
        @DisplayName("ANONYMIZED pseudonimiza cada paciente e vira Observation por exame")
        void bundlePseudonimizado() throws Exception {
            JsonNode bundle = transform(COORTE, "ANONYMIZED");

            assertThat(tiposDeRecurso(bundle)).containsExactly("Patient", "Observation");

            JsonNode patient = bundle.get("entry").get(0).get("resource");
            assertThat(patient.get("id").asText()).matches("^hash[0-9a-f]{12}$");
            assertThat(patient.has("name")).isFalse();
            // A fonte não traz genero/estado — nada é inventado.
            assertThat(patient.has("gender")).isFalse();
            assertThat(patient.has("address")).isFalse();

            JsonNode hba1c = bundle.get("entry").get(1).get("resource");
            assertThat(hba1c.get("code").get("text").asText()).isEqualTo("HbA1c");
            assertThat(hba1c.get("effectiveDateTime").asText()).isEqualTo("2023");
        }

        @Test
        @DisplayName("a cidade que vem na fonte é descartada")
        void descartaCidade() throws Exception {
            assertThat(transformer.transform(COORTE, "ANONYMIZED", HOJE)).doesNotContain("Brasilia");
        }
    }

    @Nested
    @DisplayName("resumo de coorte (AGGREGATED)")
    class Agregado {

        @Test
        @DisplayName("vira um MeasureReport com população, measureScore e 4 estratificadores")
        void measureReport() throws Exception {
            JsonNode r = transform(RESUMO, "AGGREGATED");

            assertThat(r.get("resourceType").asText()).isEqualTo("MeasureReport");
            assertThat(r.get("measure").asText()).isEqualTo("Coorte/Diabetes");

            JsonNode grupo = r.get("group").get(0);
            assertThat(grupo.get("population").get(0).get("count").asLong()).isEqualTo(8952);
            assertThat(grupo.get("measureScore").get("value").asDouble()).isEqualTo(8.76);

            JsonNode stratifier = grupo.get("stratifier");
            assertThat(stratifier).hasSize(4);
            assertThat(stratifier.get(0).get("code").get(0).get("text").asText()).isEqualTo("porSexo");
            assertThat(stratifier.get(0).get("stratum").get(0).get("measureScore").get("value").asDouble())
                    .isEqualTo(49.31);
        }

        @Test
        @DisplayName("não carrega nenhum dado individual")
        void semDadoIndividual() throws Exception {
            String json = transformer.transform(RESUMO, "AGGREGATED", HOJE);
            assertThat(json).doesNotContain("Patient").doesNotContain("P000001");
        }
    }

    /** Fatia "Exames" (footnote ²): só observações; demais seções vazias (o patient-data já fatiou). */
    private static final String SO_EXAMES = """
            {"demographics":{"id":"P000001","nome":"Joao da Silva","data_nascimento":"1980-05-12",
              "genero":"male","cidade":"Brasilia","estado":"DF","cpf":"000.000.000-00","cns":"700000000000000"},
             "encounters":[],"conditions":[],
             "observations":[{"codigo_tipo":"Creatinina","valor":2.16,"unidade":"mg/dL",
              "data":"2023-09-29T11:20:08"}],
             "medications":[]}
            """;

    /** Fatia "Medicamentos": só medicações. */
    private static final String SO_MEDICAMENTOS = """
            {"demographics":{"id":"P000001","nome":"Joao da Silva","data_nascimento":"1980-05-12",
              "genero":"male","cidade":"Brasilia","estado":"DF","cpf":"000.000.000-00","cns":"700000000000000"},
             "encounters":[],"conditions":[],"observations":[],
             "medications":[{"codigo_tipo":"Insulina","descricao":"Antidiabetico","data":"2023-09-05T06:30:05"}]}
            """;

    /** Shape ListaPacientes (novo): índice "meus pacientes", um bloco demográfico por entrada. */
    private static final String LISTA = """
            {"listaPacientes":[
              {"id":"P000001","nome":"Joao da Silva","data_nascimento":"1980-05-12","genero":"male",
               "cidade":"Brasilia","estado":"DF","cpf":"000.000.000-00","cns":"700000000000000"},
              {"id":"P000002","nome":"Maria Souza","data_nascimento":"1990-02-02","genero":"female",
               "cidade":"Goiania","estado":"GO","cpf":"111.111.111-11","cns":"700000000000001"}]}
            """;

    @Nested
    @DisplayName("fatias individuais (Exames/Medicamentos)")
    class Fatias {

        @Test
        @DisplayName("Exames: Bundle só com Patient + Observation")
        void soObservacoes() throws Exception {
            JsonNode bundle = transform(SO_EXAMES, "FULL");
            assertThat(bundle.get("type").asText()).isEqualTo("collection");
            assertThat(tiposDeRecurso(bundle)).containsExactly("Patient", "Observation");
        }

        @Test
        @DisplayName("Medicamentos: Bundle só com Patient + MedicationRequest")
        void soMedicacoes() throws Exception {
            assertThat(tiposDeRecurso(transform(SO_MEDICAMENTOS, "FULL")))
                    .containsExactly("Patient", "MedicationRequest");
        }

        @Test
        @DisplayName("PARTIAL na fatia continua mascarando o Patient")
        void fatiaPartialMascara() throws Exception {
            JsonNode patient = transform(SO_EXAMES, "PARTIAL").get("entry").get(0).get("resource");
            assertThat(patient.get("name").get(0).get("text").asText()).isEqualTo("J. da S.");
            assertThat(patient.has("identifier")).isFalse();
        }
    }

    @Nested
    @DisplayName("lista de pacientes (searchset)")
    class ListaPacientes {

        @Test
        @DisplayName("FULL: Bundle searchset com um Patient completo por paciente")
        void searchsetFull() throws Exception {
            JsonNode bundle = transform(LISTA, "FULL");

            assertThat(bundle.get("type").asText()).isEqualTo("searchset");
            assertThat(bundle.get("total").asInt()).isEqualTo(2);
            assertThat(tiposDeRecurso(bundle)).containsExactly("Patient", "Patient");

            JsonNode primeiro = bundle.get("entry").get(0).get("resource");
            assertThat(primeiro.get("id").asText()).isEqualTo("P000001");
            assertThat(primeiro.get("name").get(0).get("text").asText()).isEqualTo("Joao da Silva");
            assertThat(primeiro.has("identifier")).isTrue();
        }

        @Test
        @DisplayName("PARTIAL: cada Patient vem com iniciais e sem CPF/CNS")
        void searchsetPartial() throws Exception {
            JsonNode bundle = transform(LISTA, "PARTIAL");
            JsonNode segundo = bundle.get("entry").get(1).get("resource");

            assertThat(segundo.get("name").get(0).get("text").asText()).isEqualTo("M. S.");
            assertThat(segundo.has("identifier")).isFalse();
            assertThat(transformer.transform(LISTA, "PARTIAL", HOJE))
                    .doesNotContain("000.000.000-00").doesNotContain("111.111.111-11");
        }
    }

    @Nested
    @DisplayName("dispatch inválido falha alto")
    class Invalido {

        @Test
        @DisplayName("nivel vazio ou desconhecido é erro de contrato")
        void nivelInvalido() {
            assertThatThrownBy(() -> transformer.transform(INDIVIDUAL, "", HOJE))
                    .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> transformer.transform(INDIVIDUAL, "SUPERUSER", HOJE))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("FULL com payload de coorte não devolve dado — falha")
        void fullComCoorte() {
            assertThatThrownBy(() -> transformer.transform(COORTE, "FULL", HOJE))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("demographics");
        }

        @Test
        @DisplayName("AGGREGATED com payload individual falha")
        void aggregatedComIndividual() {
            assertThatThrownBy(() -> transformer.transform(INDIVIDUAL, "AGGREGATED", HOJE))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("ANONYMIZED com resumo de coorte falha")
        void anonymizedComResumo() {
            assertThatThrownBy(() -> transformer.transform(RESUMO, "ANONYMIZED", HOJE))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }
}
