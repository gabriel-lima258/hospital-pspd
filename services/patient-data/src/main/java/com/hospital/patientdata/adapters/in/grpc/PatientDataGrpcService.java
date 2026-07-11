package com.hospital.patientdata.adapters.in.grpc;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.EmptyResultDataAccessException;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.patientdata.adapters.out.jpa.PatientRepository;
import com.hospital.patientdata.domain.Percentages;

import hospital.ClinicalData;
import hospital.PatientDataGrpc;
import hospital.PatientQuery;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;

/**
 * Adapter de entrada gRPC do Patient Data. Ramifica por {@code tipo_consulta} e devolve o payload
 * clínico cru (JSON) para o Data Transform, que é quem anonimiza e converte para FHIR.
 *
 * <p>O vocabulário de {@code tipo_consulta} é o mesmo do Authorization Service
 * ({@code AuthorizationPolicy.nivelPesquisador}): "ExamesCoorte" → ANONYMIZED, "ResumoCoorte"/
 * "Estatisticas" → AGGREGATED. O gateway manda "Patient" no caminho individual, que é o default.
 */
@GrpcService
public class PatientDataGrpcService extends PatientDataGrpc.PatientDataImplBase {

    private static final Logger log = LoggerFactory.getLogger(PatientDataGrpcService.class);

    /** Gêneros do seed; ordem fixa para que a chave apareça mesmo com contagem zero. */
    private static final List<String> ORDEM_SEXO = List.of("male", "female", "other");
    private static final List<String> ORDEM_FAIXA = List.of("0-17", "18-39", "40-59", "60+");
    /** Setor e medicamento têm labels abertos → ordenados por frequência. */
    private static final List<String> ORDEM_LIVRE = List.of();

    private static final int DECIMAIS = 2;
    private static final int LIMITE_AMOSTRA = 100;
    private static final List<String> EXAMES = List.of("HbA1c", "Glicemia", "Creatinina");

    private final PatientRepository patients;
    private final ObjectMapper objectMapper;

    public PatientDataGrpcService(PatientRepository patients, ObjectMapper objectMapper) {
        this.patients = patients;
        this.objectMapper = objectMapper;
    }

    @Override
    public void fetch(PatientQuery request, StreamObserver<ClinicalData> responseObserver) {
        try {
            Map<String, Object> payload = switch (request.getTipoConsulta()) {
                case "ResumoCoorte", "Estatisticas" -> buildAggregated(request.getCoorteCodigo());
                case "ExamesCoorte" -> buildCohortSample(request.getCoorteCodigo());
                default -> buildIndividual(request.getPatientId());
            };

            String json = objectMapper.writeValueAsString(payload);
            responseObserver.onNext(ClinicalData.newBuilder().setJsonPayload(json).build());
            responseObserver.onCompleted();
        } catch (EmptyResultDataAccessException e) {
            // Paciente inexistente: queryForMap não achou linha. Sinaliza NOT_FOUND para o gateway
            // traduzir em 404 — sem isso a exceção vaza como UNKNOWN e vira 500 genérico.
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("recurso não encontrado").asRuntimeException());
        } catch (Exception e) {
            // Falha inesperada (ex.: erro de SQL/conexão): loga com stack e devolve INTERNAL genérico
            // — nunca a exceção crua, que vazaria detalhe interno ao cliente.
            log.error("falha inesperada em fetch (tipo={})", request.getTipoConsulta(), e);
            responseObserver.onError(Status.INTERNAL
                    .withDescription("erro interno").asRuntimeException());
        }
    }

    // ── (i) Individual — base do FULL/PARTIAL e dos 5 recursos FHIR ──────────

    private Map<String, Object> buildIndividual(String patientId) {
        Map<String, Object> demo = patients.findDemographics(patientId);

        Map<String, Object> demographics = new LinkedHashMap<>();
        demographics.put("id", demo.get("id_paciente"));
        demographics.put("nome", demo.get("nome"));
        demographics.put("data_nascimento", toIso(demo.get("data_nascimento")));
        demographics.put("genero", demo.get("genero"));
        demographics.put("cidade", demo.get("cidade"));
        demographics.put("estado", demo.get("estado"));
        demographics.put("cpf", demo.get("cpf"));
        demographics.put("cns", demo.get("cns"));

        List<Map<String, Object>> encounters = new ArrayList<>();
        for (Map<String, Object> row : patients.findEncounters(patientId)) {
            Map<String, Object> enc = new LinkedHashMap<>();
            enc.put("id", row.get("id_atendimento"));
            enc.put("data_inicio", toIso(row.get("data_inicio")));
            enc.put("data_fim", toIso(row.get("data_fim")));
            enc.put("tipo_atendimento", row.get("tipo_atendimento"));
            enc.put("setor", row.get("setor"));
            encounters.add(enc);
        }

        List<Map<String, Object>> conditions = new ArrayList<>();
        List<Map<String, Object>> observations = new ArrayList<>();
        List<Map<String, Object>> medications = new ArrayList<>();
        for (Map<String, Object> row : patients.findEvents(patientId)) {
            Object data = toIso(row.get("data_evento"));
            String codigo = (String) row.get("codigo_tipo");
            switch (String.valueOf(row.get("tipo_evento"))) {
                case "Condicao" -> conditions.add(evento(codigo, row.get("descricao"), data));
                case "Medicacao" -> medications.add(evento(codigo, row.get("descricao"), data));
                case "Observacao" -> {
                    Map<String, Object> obs = new LinkedHashMap<>();
                    obs.put("codigo_tipo", codigo);
                    obs.put("valor", row.get("valor"));
                    obs.put("unidade", row.get("unidade"));
                    obs.put("data", data);
                    observations.add(obs);
                }
                default -> { /* tipo_evento desconhecido: ignora em vez de derrubar a consulta */ }
            }
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("demographics", demographics);
        payload.put("encounters", encounters);
        payload.put("conditions", conditions);
        payload.put("observations", observations);
        payload.put("medications", medications);
        return payload;
    }

    private static Map<String, Object> evento(String codigo, Object descricao, Object data) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("codigo_tipo", codigo);
        e.put("descricao", descricao);
        e.put("data", data);
        return e;
    }

    // ── (ii) Agregado — estatística da coorte (pesquisador) ──────────────────

    private Map<String, Object> buildAggregated(String coorteCodigo) {
        long total = patients.countCohort(coorteCodigo);

        List<Map<String, Object>> setores = patients.cohortBySetor(coorteCodigo);
        List<Map<String, Object>> medicamentos = patients.cohortMedFreq(coorteCodigo);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("coorte", coorteCodigo);
        payload.put("total", total);
        payload.put("porSexo",
                Percentages.distribution(patients.cohortBySexo(coorteCodigo), total, ORDEM_SEXO, DECIMAIS));
        payload.put("porFaixa",
                Percentages.distribution(patients.cohortByFaixa(coorteCodigo), total, ORDEM_FAIXA, DECIMAIS));
        // Denominador = atendimentos da coorte (um paciente tem vários), não pacientes.
        payload.put("porSetor",
                Percentages.distribution(setores, Percentages.sumN(setores), ORDEM_LIVRE, DECIMAIS));
        payload.put("mediaHbA1c", Percentages.round(patients.cohortAvgHbA1c(coorteCodigo), DECIMAIS));
        // Denominador = prescrições da coorte → soma 100 (um paciente pode usar vários fármacos).
        payload.put("freqMedicamentos",
                Percentages.distribution(medicamentos, Percentages.sumN(medicamentos), ORDEM_LIVRE, DECIMAIS));
        return payload;
    }

    // ── (iii) Exames da coorte — fonte do ANONYMIZED, ainda identificados ────

    private Map<String, Object> buildCohortSample(String coorteCodigo) {
        List<Map<String, Object>> amostra = patients.cohortSample(coorteCodigo, LIMITE_AMOSTRA);
        List<String> ids = amostra.stream().map(r -> (String) r.get("id_paciente")).toList();

        // Uma única query para os exames dos 100 pacientes (sem N+1); agrupa em memória.
        Map<String, Map<String, List<Map<String, Object>>>> exames = new LinkedHashMap<>();
        for (Map<String, Object> row : patients.examsForPatients(ids)) {
            Map<String, Object> exame = new LinkedHashMap<>();
            exame.put("valor", row.get("valor"));
            exame.put("unidade", row.get("unidade"));
            exame.put("data", toIso(row.get("data_evento")));
            exames.computeIfAbsent((String) row.get("id_paciente"), k -> new LinkedHashMap<>())
                    .computeIfAbsent((String) row.get("codigo_tipo"), k -> new ArrayList<>())
                    .add(exame);
        }

        List<Map<String, Object>> pacientes = new ArrayList<>();
        for (Map<String, Object> row : amostra) {
            String id = (String) row.get("id_paciente");
            Map<String, List<Map<String, Object>>> doPaciente = exames.getOrDefault(id, Map.of());

            Map<String, Object> porExame = new LinkedHashMap<>();
            for (String codigo : EXAMES) {
                porExame.put(codigo, doPaciente.getOrDefault(codigo, List.of()));
            }

            Map<String, Object> paciente = new LinkedHashMap<>();
            paciente.put("id", id);
            paciente.put("nome", row.get("nome"));
            paciente.put("data_nascimento", toIso(row.get("data_nascimento")));
            paciente.put("cidade", row.get("cidade"));
            paciente.put("exames", porExame);
            pacientes.add(paciente);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("coorte", coorteCodigo);
        payload.put("pacientes", pacientes);
        return payload;
    }

    /**
     * O JDBC devolve {@code java.sql.Date}/{@code Timestamp}, cujo {@code toString} não é ISO-8601.
     * Convertidos para {@code java.time}, o ObjectMapper do Boot (JavaTimeModule) emite ISO limpo.
     */
    private static Object toIso(Object value) {
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toLocalDateTime();
        }
        if (value instanceof java.sql.Date d) {
            return d.toLocalDate();
        }
        return value;
    }
}
