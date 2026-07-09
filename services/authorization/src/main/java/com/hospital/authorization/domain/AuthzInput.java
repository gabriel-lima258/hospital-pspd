package com.hospital.authorization.domain;

import java.time.LocalDate;

/**
 * Entrada pura para a {@link AuthorizationPolicy}: o contexto da requisição + os fatos já
 * apurados pelos adapters (booleans dos vínculos e o projeto do dono, se houver). O domínio
 * NÃO acessa banco — recebe tudo pronto e só decide.
 *
 * @param role                          MEDICO | ESTAGIARIO | PESQUISADOR (ou desconhecido → DENY)
 * @param tipoConsulta                  usado só para o PESQUISADOR (ANONYMIZED vs AGGREGATED)
 * @param medicoVinculoAtivo            existe vínculo médico ativo com o paciente
 * @param estagiarioSupervisionadoAtivo existe vínculo de estágio ativo e supervisionado
 * @param projeto                       projeto do pesquisador dono (nullable: inexistente/de outro)
 * @param hoje                          data de referência para a vigência do projeto
 */
public record AuthzInput(
        String role,
        String tipoConsulta,
        boolean medicoVinculoAtivo,
        boolean estagiarioSupervisionadoAtivo,
        ProjectInfo projeto,
        LocalDate hoje) {
}
