package com.hospital.authorization.adapters.in.grpc;

import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.hospital.authorization.adapters.out.jpa.AssignmentRepository;
import com.hospital.authorization.adapters.out.jpa.ProjectRepository;
import com.hospital.authorization.domain.AuthorizationPolicy;
import com.hospital.authorization.domain.AuthzInput;
import com.hospital.authorization.domain.Decision;
import com.hospital.authorization.domain.ProjectInfo;

import hospital.AuthorizationGrpc;
import hospital.AuthzReply;
import hospital.AuthzRequest;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;

/**
 * Adapter de entrada gRPC do Authorization (D3 — matriz completa).
 * Papel do adapter: apurar os FATOS (consultando só o repositório relevante ao perfil), montar o
 * {@link AuthzInput} e delegar a DECISÃO ao domínio ({@link AuthorizationPolicy}). Nenhuma regra de
 * negócio vive aqui nem nos repositórios.
 *
 * <p>Desde o P3c a reply também carrega o {@code coorte_codigo} do projeto validado — o Gateway
 * precisa dele para consultar o Patient Data, e resolvê-lo aqui (a partir do projeto cuja ownership
 * e vigência já foram checadas) é o que impede o cliente de escolher a coorte que quiser.
 */
@GrpcService
public class AuthorizationGrpcService extends AuthorizationGrpc.AuthorizationImplBase {

    private static final Logger log = LoggerFactory.getLogger(AuthorizationGrpcService.class);

    private final AssignmentRepository assignments;
    private final ProjectRepository projects;
    private final AuthorizationPolicy policy = new AuthorizationPolicy();

    public AuthorizationGrpcService(AssignmentRepository assignments, ProjectRepository projects) {
        this.assignments = assignments;
        this.projects = projects;
    }

    @Override
    public void check(AuthzRequest request, StreamObserver<AuthzReply> responseObserver) {
        try {
            String role = request.getRole();
            String username = request.getUsername();
            String patientId = request.getPatientId();

            // Apura só o fato relevante ao perfil (evita hits inúteis no banco).
            boolean medicoAtivo = "MEDICO".equals(role)
                    && assignments.countVinculoMedicoAtivo(username, patientId) > 0;
            boolean estagiarioAtivo = "ESTAGIARIO".equals(role)
                    && assignments.existeEstagiarioSupervisionadoAtivo(username, patientId);
            ProjectInfo projeto = "PESQUISADOR".equals(role)
                    ? projects.findDoDono(username, request.getProjetoId()).orElse(null)
                    : null;

            Decision d = policy.decide(new AuthzInput(
                    role, request.getTipoConsulta(), medicoAtivo, estagiarioAtivo, projeto, LocalDate.now()));

            AuthzReply reply = AuthzReply.newBuilder()
                    .setAllow(d.allow())
                    .setNivel(d.allow() ? d.nivel().name() : "")
                    .setCoorteCodigo(coorteCodigoDaReply(d.allow(), role, projeto))
                    .build();
            responseObserver.onNext(reply);
            responseObserver.onCompleted();
        } catch (Exception e) {
            // Falha inesperada (ex.: erro de DB ao apurar vínculo/projeto): loga com stack e devolve
            // INTERNAL genérico — nunca a exceção crua, que vazaria detalhe interno ao cliente.
            log.error("falha inesperada em check (role={})", request.getRole(), e);
            responseObserver.onError(Status.INTERNAL
                    .withDescription("erro interno").asRuntimeException());
        }
    }

    /**
     * A coorte só sai daqui para o dono de um projeto efetivamente autorizado. Um DENY, ou um perfil
     * que não é PESQUISADOR, recebe "" — assim nem um bug no Gateway consegue transformar uma negação
     * numa consulta de coorte. Função pura (package-private) para ser testável sem Spring nem DB.
     */
    static String coorteCodigoDaReply(boolean allow, String role, ProjectInfo projeto) {
        if (allow && "PESQUISADOR".equals(role) && projeto != null && projeto.codigoCondicao() != null) {
            return projeto.codigoCondicao();
        }
        return "";
    }
}
