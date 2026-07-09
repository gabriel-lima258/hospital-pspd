package com.hospital.datatransform.domain;

import java.time.LocalDate;
import java.time.Period;

/**
 * Faixa etária e truncamento de data — as duas formas de reduzir precisão temporal sem zerar o
 * valor clínico do dado.
 *
 * <p>As faixas são as mesmas que o patient-data calcula em SQL (porFaixa). Compartilhar o código
 * exigiria um módulo Gradle novo; para quatro fronteiras, a duplicação é o custo certo.
 */
public final class AgeBuckets {

    private AgeBuckets() {
    }

    /** {@code "1980-05-12"} + referência 2026 → {@code "40-59"}. Data inválida/ausente → {@code ""}. */
    public static String faixa(String dataNascimentoIso, LocalDate referencia) {
        String data = ano(dataNascimentoIso).isEmpty() ? "" : dataNascimentoIso;
        if (data.isEmpty()) {
            return "";
        }
        int idade;
        try {
            idade = Period.between(LocalDate.parse(data.substring(0, 10)), referencia).getYears();
        } catch (RuntimeException e) {
            return "";
        }
        if (idade < 18) {
            return "0-17";
        }
        if (idade < 40) {
            return "18-39";
        }
        if (idade < 60) {
            return "40-59";
        }
        return "60+";
    }

    /**
     * Trunca uma data ou timestamp ISO ao ano: {@code "1980-05-12"} → {@code "1980"},
     * {@code "2023-12-06T02:51:48"} → {@code "2023"}. É o que remove a "data exata" sem apagar o dado.
     */
    public static String ano(String dataIso) {
        if (dataIso == null || dataIso.length() < 4) {
            return "";
        }
        String candidato = dataIso.substring(0, 4);
        return candidato.chars().allMatch(Character::isDigit) ? candidato : "";
    }
}
