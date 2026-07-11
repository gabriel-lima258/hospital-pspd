package com.hospital.authorization.domain;

import java.time.LocalDate;

/**
 * Projeto de pesquisa (status + validade + coorte), carregado do repositório apenas quando o
 * pesquisador é o dono. A regra de negócio "aprovado E vigente" mora aqui (domínio),
 * não no SQL — assim os casos "Aprovado-mas-vencido" e "Expirado-mas-na-validade"
 * são testáveis por unidade.
 *
 * <p>{@code codigoCondicao} é a coorte que o projeto autoriza (ex.: {@code Diabetes}) — igual a
 * {@code clinical_events.codigo_tipo}. A {@link AuthorizationPolicy} não a lê: ela só decide
 * allow+nível. Quem a devolve ao Gateway é o adapter gRPC, e é essa resolução server-side que
 * impede o pesquisador de autorizar num projeto e consultar a coorte de outro.
 */
public record ProjectInfo(String status, LocalDate dataValidade, String codigoCondicao) {

    /** Aprovado E ainda vigente na data de referência (data_validade >= hoje). */
    public boolean aprovadoEVigente(LocalDate hoje) {
        return "Aprovado".equals(status)
                && dataValidade != null
                && !dataValidade.isBefore(hoje);
    }
}
