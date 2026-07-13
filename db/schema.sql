-- =============================================================================
-- schema.sql — Contrato de dados do Hospital Universitário (PSPD/UnB)
-- As 5 tabelas exatas do enunciado (§4.3). CONGELADO NO DIA 1.
-- Carregado automaticamente pelo Postgres via docker-entrypoint-initdb.d.
--
-- Os índices ao final NÃO são cosméticos: sem eles as agregações do pesquisador
-- (clinical_events por id_paciente / codigo_tipo) ficam lentas e o teste de carga
-- mede "índice faltando", não a arquitetura. Ver descoberta 9.1 do docs/RELATORIO.md.
-- =============================================================================

-- Pacientes (raiz do prontuário). id no padrão P000001.
CREATE TABLE patients (
  id_paciente     VARCHAR(12) PRIMARY KEY,          -- ex.: P000001
  nome            TEXT        NOT NULL,
  data_nascimento DATE        NOT NULL,
  genero          VARCHAR(10) NOT NULL,             -- male | female | other
  cidade          TEXT,
  estado          VARCHAR(2),
  cpf             VARCHAR(14),                       -- anonimizável (PARTIAL/ANONYMIZED)
  cns             VARCHAR(20)                        -- Cartão Nacional de Saúde
);

-- Atendimentos (encontros clínicos → FHIR Encounter).
CREATE TABLE encounters (
  id_atendimento   SERIAL      PRIMARY KEY,
  id_paciente      VARCHAR(12) REFERENCES patients,
  data_inicio      TIMESTAMP,
  data_fim         TIMESTAMP,
  tipo_atendimento VARCHAR(20),                      -- Ambulatorial | Emergencia | Internacao | Retorno
  setor            VARCHAR(30)                       -- Cardiologia | Endocrinologia | Pediatria...
);

-- Eventos clínicos (condições, observações, medicações → FHIR Condition/Observation/MedicationRequest).
-- Tabela de maior volume (~1–2M linhas no seed) — é onde os índices mais pesam.
CREATE TABLE clinical_events (
  id_evento      SERIAL      PRIMARY KEY,
  id_paciente    VARCHAR(12) REFERENCES patients,
  id_atendimento INT         REFERENCES encounters,
  tipo_evento    VARCHAR(12),                        -- Condicao | Observacao | Medicacao
  codigo_tipo    VARCHAR(30),                        -- Diabetes | Hipertensao | Creatinina | Insulina...
  descricao      TEXT,
  data_evento    TIMESTAMP,
  valor          NUMERIC,                            -- p/ observações (ex.: creatinina)
  unidade        VARCHAR(15)
);

-- Vínculos cuidador↔paciente (base da autorização de Médico/Estagiário).
-- username_cuidador casa com preferred_username do JWT (ver docs/contratos.md).
CREATE TABLE user_patient_assignments (
  id_vinculo          SERIAL      PRIMARY KEY,
  username_cuidador   VARCHAR(40),
  id_paciente         VARCHAR(12) REFERENCES patients,
  tipo_vinculo        VARCHAR(12),                   -- medico | estagiario
  username_supervisor VARCHAR(40),                   -- supervisor do estagiário
  status              VARCHAR(12)                    -- ativo | inativo
);

-- Projetos de pesquisa (base da autorização do Pesquisador → coortes ANONYMIZED/AGGREGATED).
-- username_pesquisador casa com preferred_username do JWT.
CREATE TABLE projects (
  id_projeto           VARCHAR(12) PRIMARY KEY,      -- ex.: PRJ01
  titulo               TEXT,
  username_pesquisador VARCHAR(40),
  codigo_condicao      VARCHAR(30),                  -- igual a clinical_events.codigo_tipo
  status               VARCHAR(12),                  -- Aprovado | Expirado | Suspenso
  data_validade        DATE
);

-- ── Índices que salvam os testes de carga (§4.3) ─────────────────────────────
CREATE INDEX ix_events_paciente ON clinical_events(id_paciente);
CREATE INDEX ix_events_codigo   ON clinical_events(codigo_tipo);
CREATE INDEX ix_enc_paciente    ON encounters(id_paciente);
CREATE INDEX ix_assign_cuidador ON user_patient_assignments(username_cuidador);
CREATE INDEX ix_projects_pesq   ON projects(username_pesquisador);
