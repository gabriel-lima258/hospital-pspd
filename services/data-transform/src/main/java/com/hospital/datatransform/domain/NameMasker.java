package com.hospital.datatransform.domain;

import java.util.Locale;
import java.util.Set;

/** Reduz o nome completo às iniciais (nível PARTIAL): {@code "Joao da Silva"} → {@code "J. da S."}. */
public final class NameMasker {

    /** Partículas preservadas em minúscula — sem elas "J. D. S." perderia a legibilidade do nome. */
    private static final Set<String> PARTICULAS = Set.of("da", "de", "do", "das", "dos", "e", "del", "di", "du");

    private NameMasker() {
    }

    public static String iniciais(String nomeCompleto) {
        if (nomeCompleto == null || nomeCompleto.isBlank()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (String palavra : nomeCompleto.trim().split("\\s+")) {
            if (sb.length() > 0) {
                sb.append(' ');
            }
            if (PARTICULAS.contains(palavra.toLowerCase(Locale.ROOT))) {
                sb.append(palavra.toLowerCase(Locale.ROOT));
            } else {
                sb.append(Character.toUpperCase(palavra.charAt(0))).append('.');
            }
        }
        return sb.toString();
    }
}
