package com.hospital.gateway.observability;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extrai identificadores de recurso do path para o log de acesso (auditoria: "quem viu o quê").
 * Lógica pura → testável sem servlet.
 */
public final class RequestFields {

    private static final Pattern PATIENT = Pattern.compile("/fhir/Patient/([^/]+)");
    private static final Pattern COHORT  = Pattern.compile("/fhir/cohort/([^/]+)");

    private RequestFields() {
    }

    /** Id do paciente em {@code /fhir/Patient/{id}}, ou {@code null} se a rota não for essa. */
    public static String patientId(String path) {
        return group(PATIENT, path);
    }

    /** Id do projeto em {@code /fhir/cohort/{projetoId}}, ou {@code null}. */
    public static String projetoId(String path) {
        return group(COHORT, path);
    }

    private static String group(Pattern p, String path) {
        if (path == null) {
            return null;
        }
        Matcher m = p.matcher(path);
        return m.find() ? m.group(1) : null;
    }
}
