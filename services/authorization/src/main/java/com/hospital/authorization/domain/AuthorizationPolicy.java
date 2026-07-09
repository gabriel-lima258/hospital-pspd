package com.hospital.authorization.domain;

/**
 * Regra de autorização — serviço de DOMÍNIO puro (sem Spring/gRPC/JDBC). Recebe o contexto e os
 * fatos já apurados ({@link AuthzInput}) e devolve a {@link Decision} (ALLOW/DENY + nível).
 *
 * Matriz (docs/contratos.md §4.7):
 *   MEDICO      → FULL     sse vínculo médico ATIVO com o paciente.
 *   ESTAGIARIO  → PARTIAL  sse vínculo de estágio ATIVO e supervisionado.
 *   PESQUISADOR → ALLOW    sse projeto do dono está Aprovado E vigente; nível por tipo_consulta.
 *   qualquer outro / claim ausente → DENY.
 */
public class AuthorizationPolicy {

    public Decision decide(AuthzInput in) {
        if (in == null || in.role() == null) {
            return Decision.DENY;
        }
        return switch (in.role()) {
            case "MEDICO" -> in.medicoVinculoAtivo() ? Decision.allow(Nivel.FULL) : Decision.DENY;
            case "ESTAGIARIO" -> in.estagiarioSupervisionadoAtivo() ? Decision.allow(Nivel.PARTIAL) : Decision.DENY;
            case "PESQUISADOR" -> decidePesquisador(in);
            default -> Decision.DENY;
        };
    }

    private Decision decidePesquisador(AuthzInput in) {
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
