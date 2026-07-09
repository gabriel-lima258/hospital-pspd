package com.hospital.datatransform.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Pseudonymizer — identificador pseudonimizado e estável (ANONYMIZED)")
class PseudonymizerTest {

    @Test
    @DisplayName("mesmo id sempre gera o mesmo hash — é o que liga os recursos do Bundle")
    void estavel() {
        assertThat(Pseudonymizer.of("P000001")).isEqualTo(Pseudonymizer.of("P000001"));
    }

    @Test
    @DisplayName("ids diferentes geram hashes diferentes")
    void distinto() {
        assertThat(Pseudonymizer.of("P000001")).isNotEqualTo(Pseudonymizer.of("P000002"));
    }

    @Test
    @DisplayName("formato hash + 12 hex")
    void formato() {
        assertThat(Pseudonymizer.of("P000001")).matches("^hash[0-9a-f]{12}$");
    }

    @Test
    @DisplayName("o pseudônimo não carrega o id real")
    void naoVazaId() {
        assertThat(Pseudonymizer.of("P000001")).doesNotContain("P000001");
    }

    @Test
    @DisplayName("id vazio devolve vazio em vez de hashear string vazia")
    void vazio() {
        assertThat(Pseudonymizer.of("")).isEmpty();
        assertThat(Pseudonymizer.of(null)).isEmpty();
    }
}
