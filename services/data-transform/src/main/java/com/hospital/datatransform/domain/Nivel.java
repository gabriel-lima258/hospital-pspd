package com.hospital.datatransform.domain;

/**
 * Nível de acesso decidido pelo Authorization Service e propagado pelo Gateway no
 * {@code TransformRequest.nivel}. É o que DECIDE a forma da saída FHIR — não existe passthrough.
 *
 * <p>Duplicado do módulo {@code authorization} de propósito: compartilhar exigiria um novo módulo
 * Gradle, e o enum tem 4 constantes. A fonte da verdade da <em>decisão</em> continua lá.
 */
public enum Nivel {
    FULL,
    PARTIAL,
    ANONYMIZED,
    AGGREGATED;

    /**
     * Converte a string crua do proto. Vazio/desconhecido é <b>erro de programação</b>, não caso de
     * negócio: quando o Authorization nega, o Gateway responde 403 e nunca chama o ToFhir. Adivinhar
     * um nível aqui seria exatamente o bug de vazamento que este serviço existe para impedir.
     */
    public static Nivel fromProto(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("nivel ausente — o Gateway deveria ter negado antes");
        }
        try {
            return valueOf(raw);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("nivel desconhecido: " + raw, e);
        }
    }
}
