package com.hospital.authorization.domain;

import java.time.LocalDate;

/**
 * Projeto de pesquisa (status + validade), carregado do repositório apenas quando o
 * pesquisador é o dono. A regra de negócio "aprovado E vigente" mora aqui (domínio),
 * não no SQL — assim os casos "Aprovado-mas-vencido" e "Expirado-mas-na-validade"
 * são testáveis por unidade.
 */
public record ProjectInfo(String status, LocalDate dataValidade) {

    /** Aprovado E ainda vigente na data de referência (data_validade >= hoje). */
    public boolean aprovadoEVigente(LocalDate hoje) {
        return "Aprovado".equals(status)
                && dataValidade != null
                && !dataValidade.isBefore(hoje);
    }
}
