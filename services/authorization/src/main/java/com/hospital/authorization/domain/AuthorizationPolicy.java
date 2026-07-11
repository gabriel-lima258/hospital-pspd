package com.hospital.authorization.domain;

/**
 * Regra de autorização — serviço de DOMÍNIO puro (sem Spring/gRPC/JDBC). Recebe o contexto e os
 * fatos já apurados ({@link AuthzInput}) e devolve a {@link Decision} (ALLOW/DENY + nível).
 *
 * Matriz (docs/contratos.md §4.7):
 *   MEDICO      → FULL     sse vínculo médico ATIVO com o paciente (consulta individual);
 *                          FULL direto na {@link #LISTA_PACIENTES} (escopada por username no data layer).
 *   ESTAGIARIO  → PARTIAL  espelho do médico.
 *   PESQUISADOR → ALLOW    sse projeto do dono está Aprovado E vigente; nível por tipo_consulta;
 *                          FULL direto na {@link #LISTA_PROJETOS} (o dono vê todos os seus projetos,
 *                          inclusive Expirado/Suspenso, para ler o status de cada um — enunciado iv).
 *   qualquer outro / claim ausente → DENY.
 */
public class AuthorizationPolicy {

    /** Lista de pacientes do cuidador (médico/estagiário) — não exige vínculo com paciente específico. */
    public static final String LISTA_PACIENTES = "ListaPacientes";
    /** Lista de projetos do pesquisador (enunciado item iv) — não exige projeto aprovado específico. */
    public static final String LISTA_PROJETOS = "ListaProjetos";

    public Decision decide(AuthzInput in) {
        if (in == null || in.role() == null) {
            return Decision.DENY;
        }
        return switch (in.role()) {
            case "MEDICO" -> decideCuidador(in, Nivel.FULL, in.medicoVinculoAtivo());
            case "ESTAGIARIO" -> decideCuidador(in, Nivel.PARTIAL, in.estagiarioSupervisionadoAtivo());
            case "PESQUISADOR" -> decidePesquisador(in);
            default -> Decision.DENY;
        };
    }

    /**
     * Médico/estagiário. A lista de pacientes é liberada só pela role (o filtro por
     * {@code username_cuidador} acontece no Patient Data — o cuidador nunca vê pacientes de outro).
     * Toda consulta individual continua exigindo o vínculo já apurado; um tipo de outra role
     * (ex.: ListaProjetos) cai aqui sem vínculo → DENY.
     */
    private Decision decideCuidador(AuthzInput in, Nivel nivel, boolean vinculoAtivo) {
        if (LISTA_PACIENTES.equals(in.tipoConsulta())) {
            return Decision.allow(nivel);
        }
        return vinculoAtivo ? Decision.allow(nivel) : Decision.DENY;
    }

    private Decision decidePesquisador(AuthzInput in) {
        if (LISTA_PROJETOS.equals(in.tipoConsulta())) {
            return Decision.allow(Nivel.FULL);
        }
        if (in.projeto() == null || !in.projeto().aprovadoEVigente(in.hoje())) {
            return Decision.DENY;
        }
        return Decision.allow(nivelPesquisador(in.tipoConsulta()));
    }

    /**
     * Nível do pesquisador por tipo de consulta (definido e documentado em docs/contratos.md):
     *   "ExamesCoorte"              → ANONYMIZED (exames por paciente na coorte);
     *   "ResumoCoorte"/"Estatisticas" → AGGREGATED (estatística/coorte).
     * Default seguro = AGGREGATED (nunca cai em ANONYMIZED sem pedido explícito).
     */
    static Nivel nivelPesquisador(String tipoConsulta) {
        return "ExamesCoorte".equals(tipoConsulta) ? Nivel.ANONYMIZED : Nivel.AGGREGATED;
    }
}
