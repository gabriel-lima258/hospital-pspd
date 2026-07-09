package com.hospital.datatransform.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Pseudonimização estável do identificador do paciente (nível ANONYMIZED):
 * {@code sha256(SALT + "|" + id)} → {@code "hash" + 12 hex}. Mesmo id ⇒ mesmo pseudônimo, o que
 * permite ligar os recursos de um paciente dentro do Bundle sem revelar quem ele é.
 *
 * <p><b>Por que o sal importa</b> (vale para o relatório): o espaço de ids é enumerável e pequeno
 * (P000001..P050000). Um {@code sha256(id)} <em>sem sal</em> é invertido por uma rainbow table de
 * 50 mil hashes que se calcula em milissegundos — a pseudonimização seria decorativa. O sal secreto
 * é o que a torna defensável; o truncamento em 12 hex (48 bits) reduz a ligabilidade sem risco real
 * de colisão nesta escala.
 */
public final class Pseudonymizer {

    /** Em produção viria de um Secret (env/Vault). Constante aqui para o skeleton ser reprodutível. */
    private static final String SALT = "pspd-hospital-unb-2026";

    private Pseudonymizer() {
    }

    public static String of(String idReal) {
        if (idReal == null || idReal.isBlank()) {
            return "";
        }
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] digest = sha256.digest((SALT + "|" + idReal).getBytes(StandardCharsets.UTF_8));
            return "hash" + HexFormat.of().formatHex(digest).substring(0, 12);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível nesta JVM", e);
        }
    }
}
