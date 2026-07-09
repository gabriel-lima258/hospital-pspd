package com.hospital.authorization.adapters.in.grpc;

import java.time.LocalDate;

import com.hospital.authorization.adapters.out.jpa.AssignmentRepository;
import com.hospital.authorization.adapters.out.jpa.ProjectRepository;
import com.hospital.authorization.domain.AuthorizationPolicy;
import com.hospital.authorization.domain.AuthzInput;
import com.hospital.authorization.domain.Decision;
import com.hospital.authorization.domain.ProjectInfo;

import hospital.AuthorizationGrpc;
import hospital.AuthzReply;
import hospital.AuthzRequest;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;

/**
 * Adapter de entrada gRPC do Authorization (D3 — matriz completa).
 * Papel do adapter: apurar os FATOS (consultando só o repositório relevante ao perfil), montar o
 * {@link AuthzInput} e delegar a DECISÃO ao domínio ({@link AuthorizationPolicy}). Nenhuma regra de
 * negócio vive aqui nem nos repositórios.
 *
 * DÍVIDA TÉCNICA (P3): a decisão PARTIAL/ANONYMIZED/AGGREGATED é correta, mas a ENFORCEMENT (a
 * anonimização/agregação real dos dados) ainda não existe — hoje o Data Transform devolve dados FULL
 * independentemente do nível. Ex.: um ESTAGIARIO recebe ALLOW/PARTIAL e vê dados completos. Fechar no P3.
 */
@GrpcService
public class AuthorizationGrpcService extends AuthorizationGrpc.AuthorizationImplBase {

    private final AssignmentRepository assignments;
    private final ProjectRepository projects;
    private final AuthorizationPolicy policy = new AuthorizationPolicy();

    public AuthorizationGrpcService(AssignmentRepository assignments, ProjectRepository projects) {
        this.assignments = assignments;
        this.projects = projects;
    }

    @Override
    public void check(AuthzRequest request, StreamObserver<AuthzReply> responseObserver) {
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
                .build();
        responseObserver.onNext(reply);
        responseObserver.onCompleted();
    }
}
