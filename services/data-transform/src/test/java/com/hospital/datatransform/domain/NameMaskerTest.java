package com.hospital.datatransform.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("NameMasker — nome completo vira iniciais (PARTIAL)")
class NameMaskerTest {

    @Test
    @DisplayName("preserva as partículas em minúscula")
    void particulas() {
        assertThat(NameMasker.iniciais("Joao da Silva")).isEqualTo("J. da S.");
        assertThat(NameMasker.iniciais("Ana Paula dos Santos Silva")).isEqualTo("A. P. dos S. S.");
        assertThat(NameMasker.iniciais("Maria de Souza")).isEqualTo("M. de S.");
    }

    @Test
    @DisplayName("nome de uma palavra vira uma inicial")
    void umaPalavra() {
        assertThat(NameMasker.iniciais("Maria")).isEqualTo("M.");
    }

    @Test
    @DisplayName("nulo, vazio e espaços em branco não quebram")
    void vazios() {
        assertThat(NameMasker.iniciais(null)).isEmpty();
        assertThat(NameMasker.iniciais("")).isEmpty();
        assertThat(NameMasker.iniciais("   ")).isEmpty();
    }

    @Test
    @DisplayName("o sobrenome completo não sobrevive em lugar nenhum")
    void naoVazaSobrenome() {
        assertThat(NameMasker.iniciais("Joao da Silva")).doesNotContain("Silva").doesNotContain("Joao");
    }
}
