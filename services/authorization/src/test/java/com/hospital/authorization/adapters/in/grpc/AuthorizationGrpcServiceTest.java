package com.hospital.authorization.adapters.in.grpc;

import static com.hospital.authorization.adapters.in.grpc.AuthorizationGrpcService.coorteCodigoDaReply;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.hospital.authorization.domain.ProjectInfo;

/**
 * O invariante de segurança do P3c: a coorte que o Gateway repassa ao Patient Data nasce aqui, do
 * projeto validado — nunca de um parâmetro do cliente. Um vazamento em qualquer linha abaixo deixaria
 * um pesquisador autorizar num projeto (PRJ01/Diabetes) e ler a coorte de outro.
 *
 * <p>JUnit puro sobre a função pura do adapter — sem Spring, sem gRPC, sem DB.
 */
class AuthorizationGrpcServiceTest {

    private static final ProjectInfo DIABETES =
            new ProjectInfo("Aprovado", LocalDate.of(2027, 12, 31), "Diabetes");

    @Test
    @DisplayName("ALLOW + PESQUISADOR → devolve a coorte do projeto validado")
    void pesquisadorAutorizado_devolveCoorte() {
        assertThat(coorteCodigoDaReply(true, "PESQUISADOR", DIABETES)).isEqualTo("Diabetes");
    }

    @Test
    @DisplayName("DENY não vaza a coorte, nem com projeto em mãos")
    void denyNaoVazaCoorte() {
        assertThat(coorteCodigoDaReply(false, "PESQUISADOR", DIABETES)).isEmpty();
    }

    @Test
    @DisplayName("Perfil não-pesquisador nunca recebe coorte")
    void outroPerfil_semCoorte() {
        assertThat(coorteCodigoDaReply(true, "MEDICO", DIABETES)).isEmpty();
        assertThat(coorteCodigoDaReply(true, "ESTAGIARIO", DIABETES)).isEmpty();
        assertThat(coorteCodigoDaReply(true, "", null)).isEmpty();
    }

    @Test
    @DisplayName("Projeto ausente ou sem codigo_condicao → \"\" (nunca null no proto)")
    void projetoAusenteOuSemCoorte() {
        assertThat(coorteCodigoDaReply(true, "PESQUISADOR", null)).isEmpty();
        assertThat(coorteCodigoDaReply(true, "PESQUISADOR",
                new ProjectInfo("Aprovado", LocalDate.of(2027, 12, 31), null))).isEmpty();
    }
}
