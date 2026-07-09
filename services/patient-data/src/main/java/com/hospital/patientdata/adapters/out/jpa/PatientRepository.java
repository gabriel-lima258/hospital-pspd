package com.hospital.patientdata.adapters.out.jpa;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Adapter de saída — consultas e agregações do prontuário no Postgres (JdbcTemplate direto).
 *
 * <p>Todas as consultas de coorte materializam os pacientes uma única vez na CTE {@code coorte},
 * que roda sobre {@code ix_events_codigo}. Sem ela, um JOIN ingênuo varreria as ~1,1M linhas de
 * Creatinina de {@code clinical_events}.
 */
@Repository
public class PatientRepository {

    /** CTE reusada por todas as agregações — pacientes que têm o código da coorte. */
    private static final String CTE_COORTE =
            "WITH coorte AS (SELECT DISTINCT id_paciente FROM clinical_events WHERE codigo_tipo = ?) ";

    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;

    public PatientRepository(JdbcTemplate jdbc, NamedParameterJdbcTemplate named) {
        this.jdbc = jdbc;
        this.named = named;
    }

    // ── Consulta individual ──────────────────────────────────────────────────

    /** Demográficos completos (base do FHIR Patient e do mascaramento PARTIAL/ANONYMIZED). */
    public Map<String, Object> findDemographics(String patientId) {
        return jdbc.queryForMap(
                "SELECT id_paciente, nome, data_nascimento, genero, cidade, estado, cpf, cns "
                        + "FROM patients WHERE id_paciente = ?",
                patientId);
    }

    /** Atendimentos do paciente (base do FHIR Encounter). */
    public List<Map<String, Object>> findEncounters(String patientId) {
        return jdbc.queryForList(
                "SELECT id_atendimento, data_inicio, data_fim, tipo_atendimento, setor "
                        + "FROM encounters WHERE id_paciente = ? ORDER BY data_inicio",
                patientId);
    }

    /**
     * Todos os eventos clínicos do paciente numa tacada só; o adapter separa por
     * {@code tipo_evento} em conditions/observations/medications (evita 3 idas ao banco).
     */
    public List<Map<String, Object>> findEvents(String patientId) {
        return jdbc.queryForList(
                "SELECT tipo_evento, codigo_tipo, descricao, valor, unidade, data_evento "
                        + "FROM clinical_events WHERE id_paciente = ? ORDER BY data_evento",
                patientId);
    }

    // ── Agregações da coorte (pesquisador) ───────────────────────────────────

    /** Tamanho da coorte: pacientes distintos com o código. */
    public long countCohort(String coorteCodigo) {
        Long total = jdbc.queryForObject(
                CTE_COORTE + "SELECT COUNT(*) FROM coorte", Long.class, coorteCodigo);
        return total == null ? 0L : total;
    }

    /** Distribuição por sexo — linhas {@code (label, n)}. */
    public List<Map<String, Object>> cohortBySexo(String coorteCodigo) {
        return jdbc.queryForList(
                CTE_COORTE
                        + "SELECT p.genero AS label, COUNT(*) AS n "
                        + "FROM coorte c JOIN patients p USING (id_paciente) GROUP BY 1",
                coorteCodigo);
    }

    /**
     * Distribuição por faixa etária. O bucket {@code 0-17} existe porque o seed gera menores
     * (setor Pediatria) — sem ele os percentuais não somariam 100.
     */
    public List<Map<String, Object>> cohortByFaixa(String coorteCodigo) {
        return jdbc.queryForList(
                CTE_COORTE
                        + "SELECT CASE "
                        + "  WHEN date_part('year', age(CURRENT_DATE, p.data_nascimento)) < 18 THEN '0-17' "
                        + "  WHEN date_part('year', age(CURRENT_DATE, p.data_nascimento)) < 40 THEN '18-39' "
                        + "  WHEN date_part('year', age(CURRENT_DATE, p.data_nascimento)) < 60 THEN '40-59' "
                        + "  ELSE '60+' END AS label, COUNT(*) AS n "
                        + "FROM coorte c JOIN patients p USING (id_paciente) GROUP BY 1",
                coorteCodigo);
    }

    /** Distribuição por setor dos atendimentos da coorte; denominador = total de encounters. */
    public List<Map<String, Object>> cohortBySetor(String coorteCodigo) {
        return jdbc.queryForList(
                CTE_COORTE
                        + "SELECT COALESCE(e.setor, 'NaoInformado') AS label, COUNT(*) AS n "
                        + "FROM coorte c JOIN encounters e USING (id_paciente) GROUP BY 1",
                coorteCodigo);
    }

    /** Média de HbA1c da coorte. {@code null} quando a coorte não tem o exame. */
    public Double cohortAvgHbA1c(String coorteCodigo) {
        return jdbc.queryForObject(
                CTE_COORTE
                        + "SELECT AVG(ev.valor) FROM coorte c JOIN clinical_events ev USING (id_paciente) "
                        + "WHERE ev.codigo_tipo = 'HbA1c'",
                Double.class, coorteCodigo);
    }

    /**
     * Frequência de medicamentos = % das prescrições da coorte. O {@code GROUP BY} é data-driven:
     * uma lista fixa esconderia o Enalapril, que existe no seed.
     */
    public List<Map<String, Object>> cohortMedFreq(String coorteCodigo) {
        return jdbc.queryForList(
                CTE_COORTE
                        + "SELECT ev.codigo_tipo AS label, COUNT(*) AS n "
                        + "FROM coorte c JOIN clinical_events ev USING (id_paciente) "
                        + "WHERE ev.tipo_evento = 'Medicacao' GROUP BY 1",
                coorteCodigo);
    }

    // ── Amostra de exames da coorte (fonte do ANONYMIZED) ────────────────────

    /** Amostra estável de pacientes da coorte, ainda identificados (o P3b pseudonimiza). */
    public List<Map<String, Object>> cohortSample(String coorteCodigo, int limit) {
        return jdbc.queryForList(
                CTE_COORTE
                        + "SELECT p.id_paciente, p.nome, p.data_nascimento, p.cidade "
                        + "FROM coorte c JOIN patients p USING (id_paciente) "
                        + "ORDER BY p.id_paciente LIMIT ?",
                coorteCodigo, limit);
    }

    /**
     * Exames dos pacientes da amostra numa única query (evita o N+1 de um SELECT por paciente).
     * O IN-list restringe a busca aos ~100 ids, então roda sobre {@code ix_events_paciente}.
     */
    public List<Map<String, Object>> examsForPatients(Collection<String> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return named.queryForList(
                "SELECT id_paciente, codigo_tipo, valor, unidade, data_evento "
                        + "FROM clinical_events "
                        + "WHERE id_paciente IN (:ids) AND codigo_tipo IN ('HbA1c','Glicemia','Creatinina') "
                        + "ORDER BY id_paciente, codigo_tipo, data_evento",
                Map.of("ids", ids));
    }
}
