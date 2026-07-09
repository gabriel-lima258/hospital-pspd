package com.hospital.authorization.adapters.out.jpa;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.hospital.authorization.domain.ProjectInfo;

/**
 * Adapter de saída — consulta os projetos de pesquisa (base da decisão do PESQUISADOR).
 * A OWNERSHIP (dono + id do projeto) é filtrada aqui na query; o julgamento de
 * "aprovado E vigente" fica no domínio ({@link ProjectInfo#aprovadoEVigente}).
 * Scaffold/skeleton: JdbcTemplate direto (sem entidade JPA ainda).
 */
@Repository
public class ProjectRepository {

    private final JdbcTemplate jdbc;

    public ProjectRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Projeto do dono, se existir. Vazio quando o projeto não existe ou pertence a outro
     * pesquisador → o domínio traduz isso em DENY.
     */
    public Optional<ProjectInfo> findDoDono(String usernamePesquisador, String projetoId) {
        List<ProjectInfo> found = jdbc.query(
                "SELECT status, data_validade FROM projects " +
                "WHERE id_projeto = ? AND username_pesquisador = ?",
                (rs, rowNum) -> new ProjectInfo(
                        rs.getString("status"),
                        rs.getObject("data_validade", LocalDate.class)),
                projetoId, usernamePesquisador);
        return found.stream().findFirst();
    }
}
