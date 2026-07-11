package com.hospital.gateway.observability;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class RequestFieldsTest {

    @Test
    void extraiPatientId() {
        assertEquals("P000001", RequestFields.patientId("/fhir/Patient/P000001"));
        assertNull(RequestFields.patientId("/fhir/cohort/PRJ01"));
        assertNull(RequestFields.patientId("/actuator/health"));
        assertNull(RequestFields.patientId(null));
    }

    @Test
    void extraiProjetoId() {
        assertEquals("PRJ01", RequestFields.projetoId("/fhir/cohort/PRJ01"));
        assertNull(RequestFields.projetoId("/fhir/Patient/P000001"));
    }

    @Test
    void ignoraQueryEExtras() {
        // o path do servlet não traz query string, mas garante que segmento extra não contamina o id
        assertEquals("P000001", RequestFields.patientId("/fhir/Patient/P000001/extra"));
    }
}
