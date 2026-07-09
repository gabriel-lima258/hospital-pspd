package com.hospital.authorization.adapters.out.jpa;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Adapter de saída — consulta os vínculos cuidador↔paciente (base da decisão de autorização).
 * Scaffold/skeleton: JdbcTemplate direto (sem entidade JPA ainda).
 */
@Repository
public class AssignmentRepository {

    private final JdbcTemplate jdbc;

    public AssignmentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Nº de vínculos médicos ATIVOS entre o cuidador e o paciente. */
    public int countVinculoMedicoAtivo(String usernameCuidador, String patientId) {
        Integer c = jdbc.queryForObject(
                "SELECT count(*) FROM user_patient_assignments " +
                "WHERE username_cuidador = ? AND id_paciente = ? " +
                "AND tipo_vinculo = 'medico' AND status = 'ativo'",
                Integer.class, usernameCuidador, patientId);
        return c == null ? 0 : c;
    }

    /**
     * Existe vínculo de ESTÁGIO ativo e SUPERVISIONADO entre o estagiário e o paciente?
     * (username_supervisor IS NOT NULL = atividade sob supervisão de um médico responsável.)
     */
    public boolean existeEstagiarioSupervisionadoAtivo(String usernameCuidador, String patientId) {
        Integer c = jdbc.queryForObject(
                "SELECT count(*) FROM user_patient_assignments " +
                "WHERE username_cuidador = ? AND id_paciente = ? " +
                "AND tipo_vinculo = 'estagiario' AND status = 'ativo' " +
                "AND username_supervisor IS NOT NULL",
                Integer.class, usernameCuidador, patientId);
        return c != null && c > 0;
    }
}
