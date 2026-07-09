-- seed-min.sql — dados mínimos p/ o esqueleto ambulante (M1, D2). Caminho feliz.
-- Roda no initdb DEPOIS de 01-schema.sql. Só entra em volume novo (docker compose down -v).

-- Paciente-alvo do walking skeleton.
INSERT INTO patients (id_paciente, nome, data_nascimento, genero, cidade, estado, cpf, cns)
VALUES ('P000001', 'Joao da Silva', '1980-05-12', 'male', 'Brasilia', 'DF', '000.000.000-00', '700000000000000');

-- Vínculo ativo: med.cardoso (preferred_username do JWT) é médico do P000001 → habilita ALLOW/FULL.
INSERT INTO user_patient_assignments (username_cuidador, id_paciente, tipo_vinculo, username_supervisor, status)
VALUES ('med.cardoso', 'P000001', 'medico', NULL, 'ativo');

-- 1-2 eventos clínicos (id_atendimento NULL — coluna opcional; FK aceita null).
INSERT INTO clinical_events (id_paciente, id_atendimento, tipo_evento, codigo_tipo, descricao, data_evento, valor, unidade)
VALUES
  ('P000001', NULL, 'Condicao',   'Diabetes',   'Diabetes tipo 2',   '2025-01-10 10:00:00', NULL, NULL),
  ('P000001', NULL, 'Observacao', 'Creatinina', 'Creatinina serica', '2025-01-10 10:05:00', 1.1,  'mg/dL');
