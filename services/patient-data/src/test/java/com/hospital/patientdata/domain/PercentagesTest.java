package com.hospital.patientdata.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** Testes do único naco de lógica pura do patient-data — sem Spring, sem banco. */
@DisplayName("Percentages — distribuições percentuais das coortes")
class PercentagesTest {

    private static Map<String, Object> row(String label, long n) {
        return Map.of("label", label, "n", n);
    }

    /** Soma de todos os valores de uma distribuição (todos são Double). */
    private static double soma(Map<String, Object> dist) {
        return dist.values().stream().mapToDouble(v -> (Double) v).sum();
    }

    @Nested
    @DisplayName("pct")
    class Pct {

        @Test
        @DisplayName("arredonda meia-casa para cima")
        void arredonda() {
            assertThat(Percentages.pct(1, 3, 2)).isEqualTo(33.33);
            assertThat(Percentages.pct(2, 3, 2)).isEqualTo(66.67);
        }

        @Test
        @DisplayName("denominador zero devolve 0.0 em vez de estourar")
        void denominadorZero() {
            assertThat(Percentages.pct(5, 0, 2)).isZero();
        }
    }

    @Nested
    @DisplayName("distribution")
    class Distribution {

        @Test
        @DisplayName("com ordem esperada, emite a chave ausente com 0.0 (faixa 0-17 sem menores)")
        void injetaBucketZerado() {
            List<Map<String, Object>> rows = List.of(row("18-39", 50), row("40-59", 50));

            Map<String, Object> dist = Percentages.distribution(
                    rows, 100, List.of("0-17", "18-39", "40-59", "60+"), 2);

            assertThat(dist).containsExactly(
                    Map.entry("0-17", 0.0),
                    Map.entry("18-39", 50.0),
                    Map.entry("40-59", 50.0),
                    Map.entry("60+", 0.0));
        }

        @Test
        @DisplayName("os percentuais somam ~100 quando o denominador é o total das linhas")
        void somaCem() {
            List<Map<String, Object>> rows = List.of(row("male", 4414), row("female", 4198), row("other", 340));

            Map<String, Object> dist =
                    Percentages.distribution(rows, 8952, List.of("male", "female", "other"), 2);

            assertThat(soma(dist)).isCloseTo(100.0, within(0.05));
        }

        @Test
        @DisplayName("sem ordem esperada, ordena por frequência decrescente (setor/medicamento)")
        void ordenaPorFrequencia() {
            List<Map<String, Object>> rows =
                    List.of(row("Losartana", 4507), row("Metformina", 18110), row("Enalapril", 4457));

            Map<String, Object> dist = Percentages.distribution(rows, 27074, List.of(), 2);

            assertThat(dist.keySet()).containsExactly("Metformina", "Losartana", "Enalapril");
        }

        @Test
        @DisplayName("label fora da ordem esperada não some — senão a soma não fecharia 100")
        void labelInesperadoAparece() {
            List<Map<String, Object>> rows = List.of(row("male", 50), row("desconhecido", 50));

            Map<String, Object> dist = Percentages.distribution(rows, 100, List.of("male", "female"), 2);

            assertThat(dist).containsEntry("desconhecido", 50.0);
            assertThat(soma(dist)).isCloseTo(100.0, within(0.01));
        }

        @Test
        @DisplayName("coorte vazia devolve as chaves canônicas zeradas")
        void coorteVazia() {
            Map<String, Object> dist = Percentages.distribution(List.of(), 0, List.of("male", "female"), 2);

            assertThat(dist).containsExactly(Map.entry("male", 0.0), Map.entry("female", 0.0));
        }
    }

    @Nested
    @DisplayName("sumN e round")
    class SumNeRound {

        @Test
        @DisplayName("sumN soma as contagens — é o denominador de porSetor/freqMedicamentos")
        void sumN() {
            assertThat(Percentages.sumN(List.of(row("a", 10), row("b", 5)))).isEqualTo(15L);
            assertThat(Percentages.sumN(List.of())).isZero();
        }

        @Test
        @DisplayName("round arredonda o AVG e deixa null atravessar (coorte sem o exame)")
        void round() {
            assertThat(Percentages.round(8.7512, 2)).isEqualTo(8.75);
            assertThat(Percentages.round(null, 2)).isNull();
        }
    }
}
