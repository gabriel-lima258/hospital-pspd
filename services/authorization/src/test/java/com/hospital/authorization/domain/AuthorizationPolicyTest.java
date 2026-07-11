package com.hospital.authorization.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Testes de unidade da regra de autorização — JUnit puro, SEM Spring/DB.
 * Cobrem cada linha da matriz e todos os DENYs, com destaque para os dois casos do
 * pesquisador que DEVEM negar: projeto Aprovado-mas-vencido e Expirado-mas-na-validade.
 */
class AuthorizationPolicyTest {

    private final AuthorizationPolicy policy = new AuthorizationPolicy();
    private static final LocalDate HOJE = LocalDate.of(2026, 7, 6);

    private AuthzInput medico(boolean vinculo) {
        return new AuthzInput("MEDICO", "Patient", vinculo, false, null, HOJE);
    }

    private AuthzInput estagiario(boolean supervisionado) {
        return new AuthzInput("ESTAGIARIO", "Patient", false, supervisionado, null, HOJE);
    }

    private AuthzInput pesquisador(String tipoConsulta, ProjectInfo projeto) {
        return new AuthzInput("PESQUISADOR", tipoConsulta, false, false, projeto, HOJE);
    }

    /** A policy não lê o codigo_condicao (quem o devolve é o adapter gRPC); fixa-o para não poluir. */
    private static ProjectInfo projeto(String status, LocalDate validade) {
        return new ProjectInfo(status, validade, "Diabetes");
    }

    @Nested
    @DisplayName("MEDICO → FULL sse vínculo médico ativo")
    class Medico {
        @Test
        void comVinculo_allowFull() {
            Decision d = policy.decide(medico(true));
            assertThat(d.allow()).isTrue();
            assertThat(d.nivel()).isEqualTo(Nivel.FULL);
        }

        @Test
        void semVinculo_deny() {
            assertThat(policy.decide(medico(false))).isEqualTo(Decision.DENY);
        }
    }

    @Nested
    @DisplayName("ESTAGIARIO → PARTIAL sse supervisionado ativo")
    class Estagiario {
        @Test
        void supervisionado_allowPartial() {
            Decision d = policy.decide(estagiario(true));
            assertThat(d.allow()).isTrue();
            assertThat(d.nivel()).isEqualTo(Nivel.PARTIAL);
        }

        @Test
        void naoSupervisionado_deny() {
            assertThat(policy.decide(estagiario(false))).isEqualTo(Decision.DENY);
        }
    }

    @Nested
    @DisplayName("PESQUISADOR → ALLOW sse projeto Aprovado E vigente; nível por tipo_consulta")
    class Pesquisador {
        private final ProjectInfo aprovadoVigente = projeto("Aprovado", HOJE.plusDays(30));

        @Test
        void examesCoorte_allowAnonymized() {
            Decision d = policy.decide(pesquisador("ExamesCoorte", aprovadoVigente));
            assertThat(d.allow()).isTrue();
            assertThat(d.nivel()).isEqualTo(Nivel.ANONYMIZED);
        }

        @Test
        void resumoCoorte_allowAggregated() {
            Decision d = policy.decide(pesquisador("ResumoCoorte", aprovadoVigente));
            assertThat(d.allow()).isTrue();
            assertThat(d.nivel()).isEqualTo(Nivel.AGGREGATED);
        }

        @Test
        void estatisticas_allowAggregated() {
            assertThat(policy.decide(pesquisador("Estatisticas", aprovadoVigente)).nivel())
                    .isEqualTo(Nivel.AGGREGATED);
        }

        @Test
        @DisplayName("tipo_consulta desconhecido → default seguro AGGREGATED")
        void tipoDesconhecido_defaultAggregated() {
            assertThat(policy.decide(pesquisador("QualquerOutro", aprovadoVigente)).nivel())
                    .isEqualTo(Nivel.AGGREGATED);
        }

        @Test
        @DisplayName("Aprovado MAS vencido (data_validade < hoje) → DENY")
        void aprovadoMasVencido_deny() {
            ProjectInfo vencido = projeto("Aprovado", HOJE.minusDays(1));
            assertThat(policy.decide(pesquisador("ResumoCoorte", vencido))).isEqualTo(Decision.DENY);
        }

        @Test
        @DisplayName("Expirado MAS ainda na validade → DENY (status manda)")
        void expiradoMasNaValidade_deny() {
            ProjectInfo expirado = projeto("Expirado", HOJE.plusDays(365));
            assertThat(policy.decide(pesquisador("ResumoCoorte", expirado))).isEqualTo(Decision.DENY);
        }

        @Test
        @DisplayName("Suspenso → DENY")
        void suspenso_deny() {
            ProjectInfo suspenso = projeto("Suspenso", HOJE.plusDays(30));
            assertThat(policy.decide(pesquisador("ResumoCoorte", suspenso))).isEqualTo(Decision.DENY);
        }

        @Test
        @DisplayName("projeto null (inexistente / de outro dono) → DENY")
        void projetoNull_deny() {
            assertThat(policy.decide(pesquisador("ResumoCoorte", null))).isEqualTo(Decision.DENY);
        }

        @Test
        @DisplayName("vigência é inclusiva: data_validade == hoje → ALLOW")
        void validadeIgualHoje_allow() {
            ProjectInfo hojeExato = projeto("Aprovado", HOJE);
            assertThat(policy.decide(pesquisador("ResumoCoorte", hojeExato)).allow()).isTrue();
        }
    }

    @Nested
    @DisplayName("Listas — liberadas pela role, escopadas por username no data layer")
    class Listas {
        @Test
        @DisplayName("MEDICO + ListaPacientes → ALLOW FULL sem exigir vínculo")
        void medicoListaPacientes_allowFull() {
            AuthzInput in = new AuthzInput("MEDICO", "ListaPacientes", false, false, null, HOJE);
            Decision d = policy.decide(in);
            assertThat(d.allow()).isTrue();
            assertThat(d.nivel()).isEqualTo(Nivel.FULL);
        }

        @Test
        @DisplayName("ESTAGIARIO + ListaPacientes → ALLOW PARTIAL sem exigir supervisão de paciente")
        void estagiarioListaPacientes_allowPartial() {
            AuthzInput in = new AuthzInput("ESTAGIARIO", "ListaPacientes", false, false, null, HOJE);
            Decision d = policy.decide(in);
            assertThat(d.allow()).isTrue();
            assertThat(d.nivel()).isEqualTo(Nivel.PARTIAL);
        }

        @Test
        @DisplayName("PESQUISADOR + ListaProjetos → ALLOW mesmo sem projeto aprovado (vê todos, com status)")
        void pesquisadorListaProjetos_allowSemProjeto() {
            AuthzInput in = new AuthzInput("PESQUISADOR", "ListaProjetos", false, false, null, HOJE);
            assertThat(policy.decide(in).allow()).isTrue();
        }

        @Test
        @DisplayName("Cross-role: PESQUISADOR pedindo ListaPacientes → DENY")
        void pesquisadorListaPacientes_deny() {
            AuthzInput in = new AuthzInput("PESQUISADOR", "ListaPacientes", false, false, null, HOJE);
            assertThat(policy.decide(in)).isEqualTo(Decision.DENY);
        }

        @Test
        @DisplayName("Cross-role: MEDICO pedindo ListaProjetos → DENY (sem vínculo)")
        void medicoListaProjetos_deny() {
            AuthzInput in = new AuthzInput("MEDICO", "ListaProjetos", false, false, null, HOJE);
            assertThat(policy.decide(in)).isEqualTo(Decision.DENY);
        }
    }

    @Nested
    @DisplayName("Consultas individuais nomeadas mantêm o nível da role (fatia é do Patient Data)")
    class ConsultasIndividuais {
        @Test
        @DisplayName("MEDICO + ResumoClinico/Exames/Medicamentos → FULL sse vínculo")
        void medicoConsultasNomeadas() {
            for (String tipo : new String[] {"ResumoClinico", "HistoricoClinico", "Exames", "Medicamentos"}) {
                AuthzInput comVinculo = new AuthzInput("MEDICO", tipo, true, false, null, HOJE);
                AuthzInput semVinculo = new AuthzInput("MEDICO", tipo, false, false, null, HOJE);
                assertThat(policy.decide(comVinculo).nivel()).as(tipo).isEqualTo(Nivel.FULL);
                assertThat(policy.decide(semVinculo)).as(tipo).isEqualTo(Decision.DENY);
            }
        }

        @Test
        @DisplayName("ESTAGIARIO + Exames → PARTIAL sse supervisionado")
        void estagiarioExames() {
            assertThat(policy.decide(new AuthzInput("ESTAGIARIO", "Exames", false, true, null, HOJE)).nivel())
                    .isEqualTo(Nivel.PARTIAL);
            assertThat(policy.decide(new AuthzInput("ESTAGIARIO", "Exames", false, false, null, HOJE)))
                    .isEqualTo(Decision.DENY);
        }
    }

    @Nested
    @DisplayName("Role fora do domínio ou ausente → DENY")
    class RoleInvalida {
        @Test
        void roleDesconhecida_deny() {
            assertThat(policy.decide(new AuthzInput("ADMIN", "Patient", true, true, null, HOJE)))
                    .isEqualTo(Decision.DENY);
        }

        @Test
        void roleVazia_deny() {
            assertThat(policy.decide(new AuthzInput("", "Patient", true, true, null, HOJE)))
                    .isEqualTo(Decision.DENY);
        }

        @Test
        void roleNull_deny() {
            assertThat(policy.decide(new AuthzInput(null, "Patient", true, true, null, HOJE)))
                    .isEqualTo(Decision.DENY);
        }
    }
}
