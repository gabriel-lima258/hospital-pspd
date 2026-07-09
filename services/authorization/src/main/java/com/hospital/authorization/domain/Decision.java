package com.hospital.authorization.domain;

/**
 * Resultado da decisão de autorização. Quando {@code allow} é false, {@code nivel} é null (DENY).
 */
public record Decision(boolean allow, Nivel nivel) {

    /** Negação padrão (sem nível). */
    public static final Decision DENY = new Decision(false, null);

    /** Concessão com o nível de acesso indicado. */
    public static Decision allow(Nivel nivel) {
        return new Decision(true, nivel);
    }
}
