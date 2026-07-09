package com.hospital.datatransform.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

@DisplayName("AgeBuckets — faixa etária e truncamento de data")
class AgeBucketsTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 7, 9);

    @Nested
    @DisplayName("faixa")
    class Faixa {

        @Test
        @DisplayName("P000001 (1980-05-12) cai em 40-59")
        void pacienteReal() {
            assertThat(AgeBuckets.faixa("1980-05-12", HOJE)).isEqualTo("40-59");
        }

        @Test
        @DisplayName("fronteiras 17/18, 39/40 e 59/60")
        void fronteiras() {
            assertThat(AgeBuckets.faixa("2008-07-10", HOJE)).isEqualTo("0-17");  // 17 anos
            assertThat(AgeBuckets.faixa("2008-07-09", HOJE)).isEqualTo("18-39"); // 18 anos
            assertThat(AgeBuckets.faixa("1986-07-10", HOJE)).isEqualTo("18-39"); // 39 anos
            assertThat(AgeBuckets.faixa("1986-07-09", HOJE)).isEqualTo("40-59"); // 40 anos
            assertThat(AgeBuckets.faixa("1966-07-10", HOJE)).isEqualTo("40-59"); // 59 anos
            assertThat(AgeBuckets.faixa("1966-07-09", HOJE)).isEqualTo("60+");   // 60 anos
        }

        @Test
        @DisplayName("data ausente ou inválida devolve vazio, não estoura")
        void invalida() {
            assertThat(AgeBuckets.faixa(null, HOJE)).isEmpty();
            assertThat(AgeBuckets.faixa("", HOJE)).isEmpty();
            assertThat(AgeBuckets.faixa("xxxx-99-99", HOJE)).isEmpty();
        }
    }

    @Nested
    @DisplayName("ano")
    class Ano {

        @Test
        @DisplayName("trunca data e timestamp ao ano")
        void trunca() {
            assertThat(AgeBuckets.ano("1980-05-12")).isEqualTo("1980");
            assertThat(AgeBuckets.ano("2023-12-06T02:51:48")).isEqualTo("2023");
        }

        @Test
        @DisplayName("entrada não-numérica ou curta devolve vazio")
        void invalida() {
            assertThat(AgeBuckets.ano(null)).isEmpty();
            assertThat(AgeBuckets.ano("abc")).isEmpty();
            assertThat(AgeBuckets.ano("abcd-01-01")).isEmpty();
        }
    }
}
