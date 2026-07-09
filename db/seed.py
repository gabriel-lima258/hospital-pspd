#!/usr/bin/env python3
# =============================================================================
# db/seed.py — Seed de dados sintéticos EM VOLUME (Trilha D, §4.4 do roteiro).
#
# Por que existe: teste de carga sobre banco vazio é INVÁLIDO — o Postgres serve
# tudo de cache e o gargalo real (I/O, planejamento de query, contenção) nunca
# aparece. Volume também é o que dá sentido à agregação do pesquisador (coortes)
# e à anonimização em escala. Ver §4.4.
#
# Técnica: Faker(pt_BR) para gerar + COPY via psycopg2.copy_expert (NÃO INSERT
# linha a linha — seria ~100x mais lento). seed=42 → reprodutível.
#
# Volumes-alvo (default --scale 50000):
#   patients                  ~50.000
#   encounters                ~200.000   (~4 por paciente)
#   clinical_events           ~1–2M      (~20–40 por paciente)
#   user_patient_assignments  ~55.000
#   projects                  ~50
#
# Conexão: variáveis PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD (defaults
# localhost/5432/hospital/app/app) ou --dsn. O MESMO script roda:
#   - no cluster (Job): PGHOST=db
#   - local (compose):  --dsn postgresql://app:app@localhost:5433/hospital
#
# Alinhado aos usuários do Keycloak (senão a validação funcional falha):
#   med.cardoso (MEDICO)     -> vínculo médico ATIVO com um bloco de pacientes (inclui P000001)
#   est.almeida (ESTAGIARIO) -> supervisionado por med.cardoso, subconjunto dos pacientes dele
#   pesq.souza  (PESQUISADOR)-> dono de PRJ01 (Diabetes/Aprovado/vigente) e PRJ02 (Expirado → DENY)
#   med.semvinculo (MEDICO)  -> SEM vínculos (caso DENY)
# =============================================================================
import argparse
import io
import os
import random
import sys
from datetime import date, datetime, timedelta

import psycopg2
from faker import Faker

# ── Reprodutibilidade (fixa ANTES de qualquer geração) ───────────────────────
fake = Faker("pt_BR")
Faker.seed(42)
random.seed(42)

# ── Domínio clínico ──────────────────────────────────────────────────────────
GENEROS = ["male", "female", "other"]
GENERO_W = [0.48, 0.48, 0.04]
TIPOS_ATENDIMENTO = ["Ambulatorial", "Emergencia", "Internacao", "Retorno"]
TIPOS_ATEND_W = [0.55, 0.15, 0.10, 0.20]
SETORES_GERAIS = ["ClinicaGeral", "Pediatria", "Ortopedia", "Ginecologia", "Neurologia"]
PREV_DIABETES = 0.18   # ~18% diabéticos
PREV_HIPERT = 0.25     # ~25% hipertensos

NOW = datetime(2026, 7, 6, 12, 0, 0)   # data fixa (reprodutibilidade; sem datetime.now())
HIST_INICIO = NOW - timedelta(days=3 * 365)

CHUNK = 100_000   # linhas por flush do COPY (limita memória)


def parse_args():
    p = argparse.ArgumentParser(description="Seed de volume do Hospital (PSPD/UnB).")
    p.add_argument("--scale", type=int, default=50_000,
                   help="nº de pacientes (default 50000). encounters/events derivam disto.")
    p.add_argument("--dsn", default=None,
                   help="DSN psycopg2 (override); senão usa as variáveis PG* do ambiente.")
    return p.parse_args()


def connect(dsn):
    if dsn:
        return psycopg2.connect(dsn)
    return psycopg2.connect(
        host=os.environ.get("PGHOST", "localhost"),
        port=os.environ.get("PGPORT", "5432"),
        dbname=os.environ.get("PGDATABASE", "hospital"),
        user=os.environ.get("PGUSER", "app"),
        password=os.environ.get("PGPASSWORD", "app"),
    )


# ── COPY helpers (formato texto TSV: \t separa, \N = NULL) ────────────────────
def _cell(v):
    """Serializa um valor p/ o formato texto do COPY (escapando o que precisa)."""
    if v is None:
        return r"\N"
    s = str(v)
    # Ordem importa: escapar a barra invertida primeiro.
    s = s.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")
    return s


def copy_rows(conn, table, cols, rows_iter, total_hint=None):
    """Faz COPY de um iterável de tuplas em blocos de CHUNK linhas."""
    n = 0
    buf = io.StringIO()
    col_sql = ", ".join(cols)
    with conn.cursor() as cur:
        for row in rows_iter:
            buf.write("\t".join(_cell(v) for v in row))
            buf.write("\n")
            n += 1
            if n % CHUNK == 0:
                buf.seek(0)
                cur.copy_expert(f"COPY {table} ({col_sql}) FROM STDIN", buf)
                buf.close()
                buf = io.StringIO()
                sys.stdout.write(f"\r  {table}: {n:,} linhas" + (f" / ~{total_hint:,}" if total_hint else ""))
                sys.stdout.flush()
        if buf.tell() > 0:
            buf.seek(0)
            cur.copy_expert(f"COPY {table} ({col_sql}) FROM STDIN", buf)
        buf.close()
    conn.commit()
    print(f"\r  {table}: {n:,} linhas                         ")
    return n


# ── Geradores ────────────────────────────────────────────────────────────────
def gen_patients(scale):
    """Gera pacientes e devolve (rows, profiles). profiles[i] = (diabetes, hipert)."""
    profiles = []
    rows = []
    for i in range(1, scale + 1):
        pid = f"P{i:06d}"
        if i == 1:
            # P000001 FIXADO — coerência com a evidência do M1 (walking skeleton).
            rows.append((pid, "Joao da Silva", "1980-05-12", "male", "Brasilia", "DF",
                         "000.000.000-00", "700000000000000"))
            profiles.append((True, False))   # P000001 é diabético (bate com seed-min)
            continue
        genero = random.choices(GENEROS, GENERO_W)[0]
        if genero == "male":
            nome = fake.name_male()
        elif genero == "female":
            nome = fake.name_female()
        else:
            nome = fake.name()
        # nascimento enviesado p/ adultos (18–90 anos)
        idade = random.randint(18, 90)
        nasc = date(NOW.year - idade, random.randint(1, 12), random.randint(1, 28))
        diabetes = random.random() < PREV_DIABETES
        hipert = random.random() < PREV_HIPERT
        profiles.append((diabetes, hipert))
        rows.append((pid, nome, nasc.isoformat(), genero, fake.city(),
                     fake.estado_sigla(), fake.cpf(), str(fake.random_number(digits=15, fix_len=True))))
    return rows, profiles


def _setor_pref(diabetes, hipert):
    """Setor 'principal' do paciente, enviesado pela condição crônica."""
    if diabetes:
        return "Endocrinologia"
    if hipert:
        return "Cardiologia"
    return random.choice(SETORES_GERAIS)


def gen_encounters(scale, profiles):
    """~4 encounters/paciente com id explícito 1..E. Devolve (rows, patient_encs)."""
    rows = []
    patient_encs = {}   # idx paciente (1..scale) -> [enc_ids]
    eid = 0
    total = scale * 4
    for i in range(1, scale + 1):
        diabetes, hipert = profiles[i - 1]
        setor_pref = _setor_pref(diabetes, hipert)
        n_enc = random.randint(2, 6)
        encs = []
        for _ in range(n_enc):
            eid += 1
            inicio = HIST_INICIO + timedelta(seconds=random.randint(0, 3 * 365 * 24 * 3600))
            fim = inicio + timedelta(hours=random.randint(1, 72))
            tipo = random.choices(TIPOS_ATENDIMENTO, TIPOS_ATEND_W)[0]
            # setor enviesado pela condição crônica; ~20% vai p/ um setor geral (variedade)
            setor = setor_pref if random.random() < 0.8 else random.choice(SETORES_GERAIS)
            rows.append((eid, f"P{i:06d}", inicio.strftime("%Y-%m-%d %H:%M:%S"),
                         fim.strftime("%Y-%m-%d %H:%M:%S"), tipo, setor))
            encs.append(eid)
        patient_encs[i] = encs
    return rows, patient_encs, total


def _obs(codigo, low, high, unidade):
    return codigo, round(random.uniform(low, high), 2), unidade


def gen_clinical_events(scale, profiles, patient_encs):
    """Gera eventos ligados a encounters do próprio paciente. ~20-40/paciente."""
    def rows():
        for i in range(1, scale + 1):
            diabetes, hipert = profiles[i - 1]
            pid = f"P{i:06d}"
            encs = patient_encs[i]
            # setor "principal" do paciente enviesado pela condição crônica
            if diabetes:
                setor_pref = "Endocrinologia"
            elif hipert:
                setor_pref = "Cardiologia"
            else:
                setor_pref = random.choice(SETORES_GERAIS)

            def data_evt():
                enc = random.choice(encs) if encs else None
                dt = HIST_INICIO + timedelta(seconds=random.randint(0, 3 * 365 * 24 * 3600))
                return enc, dt.strftime("%Y-%m-%d %H:%M:%S")

            # Condições crônicas (Condicao) + observações/medicações recorrentes
            if diabetes:
                enc, dt = data_evt()
                yield (pid, enc, "Condicao", "Diabetes", "Diabetes mellitus tipo 2", dt, None, None)
                for _ in range(random.randint(4, 10)):
                    enc, dt = data_evt()
                    cod, val, un = _obs("Glicemia", 90, 320, "mg/dL")
                    yield (pid, enc, "Observacao", cod, "Glicemia de jejum", dt, val, un)
                # HbA1c (hemoglobina glicada) — a spec cita "média de HbA1c" nas agregações
                for _ in range(random.randint(2, 5)):
                    enc, dt = data_evt()
                    cod, val, un = _obs("HbA1c", 5.5, 12.0, "%")
                    yield (pid, enc, "Observacao", cod, "Hemoglobina glicada", dt, val, un)
                for _ in range(random.randint(2, 6)):
                    enc, dt = data_evt()
                    yield (pid, enc, "Medicacao", random.choice(["Metformina", "Insulina"]),
                           "Antidiabetico", dt, None, None)
            if hipert:
                enc, dt = data_evt()
                yield (pid, enc, "Condicao", "Hipertensao", "Hipertensao arterial sistemica", dt, None, None)
                for _ in range(random.randint(4, 10)):
                    enc, dt = data_evt()
                    cod, val, un = _obs("PressaoArterial", 120, 190, "mmHg")
                    yield (pid, enc, "Observacao", cod, "Pressao arterial sistolica", dt, val, un)
                for _ in range(random.randint(2, 6)):
                    enc, dt = data_evt()
                    yield (pid, enc, "Medicacao", random.choice(["Losartana", "Enalapril"]),
                           "Anti-hipertensivo", dt, None, None)
            # Observações gerais p/ todos (creatinina) — dá corpo à tabela
            # (faixa calibrada p/ o total cair em 1–2M events, §4.4)
            for _ in range(random.randint(14, 30)):
                enc, dt = data_evt()
                cod, val, un = _obs("Creatinina", 0.6, 2.5, "mg/dL")
                yield (pid, enc, "Observacao", cod, f"Exame - {setor_pref}", dt, val, un)

    return rows


def gen_assignments(scale):
    """
    Vínculos alinhados ao Keycloak. Devolve iterável de linhas.
    - med.cardoso: bloco de ~1000 pacientes (inclui P000001), medico/ativo.
    - est.almeida: subconjunto (~200) dos de med.cardoso, estagiario/ativo, supervisor med.cardoso.
    - demais pacientes: um medico sintético med.NNNN (ativo na maioria).
    - med.semvinculo: NADA.
    """
    n_cardoso = min(1000, scale)
    n_almeida = min(200, n_cardoso)
    rows = []
    for i in range(1, scale + 1):
        pid = f"P{i:06d}"
        if i <= n_cardoso:
            rows.append(("med.cardoso", pid, "medico", None, "ativo"))
            if i <= n_almeida:
                rows.append(("est.almeida", pid, "estagiario", "med.cardoso", "ativo"))
        else:
            med = f"med.{random.randint(1, 60):04d}"
            status = "ativo" if random.random() < 0.9 else "inativo"
            rows.append((med, pid, "medico", None, status))
    return rows


def gen_projects():
    """~50 projetos. PRJ01/PRJ02 fixos p/ pesq.souza (casos ALLOW/DENY)."""
    condicoes = ["Diabetes", "Hipertensao", "Creatinina", "Glicemia", "PressaoArterial"]
    rows = [
        ("PRJ01", "Coorte de diabeticos tipo 2", "pesq.souza", "Diabetes", "Aprovado", "2027-12-31"),
        ("PRJ02", "Estudo hipertensao (encerrado)", "pesq.souza", "Hipertensao", "Expirado", "2024-01-01"),
    ]
    for n in range(3, 51):
        cod = random.choice(condicoes)
        status = random.choices(["Aprovado", "Expirado", "Suspenso"], [0.5, 0.3, 0.2])[0]
        if status == "Aprovado":
            validade = date(2027, random.randint(1, 12), random.randint(1, 28))
        else:
            validade = date(2024, random.randint(1, 12), random.randint(1, 28))
        rows.append((f"PRJ{n:02d}", f"Estudo {cod} #{n}", f"pesq.{random.randint(1, 20):04d}",
                     cod, status, validade.isoformat()))
    return rows


def fix_sequences(conn):
    """Reajusta as sequences SERIAL após COPY com id explícito."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT setval(pg_get_serial_sequence('encounters', 'id_atendimento'), "
            "COALESCE((SELECT max(id_atendimento) FROM encounters), 1))")
        cur.execute(
            "SELECT setval(pg_get_serial_sequence('clinical_events', 'id_evento'), "
            "COALESCE((SELECT max(id_evento) FROM clinical_events), 1))")
    conn.commit()


def main():
    args = parse_args()
    scale = args.scale
    print(f">> seed: scale={scale:,} pacientes (seed=42, reprodutível)")
    conn = connect(args.dsn)
    try:
        # Idempotente: limpa tudo antes (remove o seed-min também).
        print(">> TRUNCATE (idempotente)")
        with conn.cursor() as cur:
            cur.execute("TRUNCATE patients, encounters, clinical_events, "
                        "user_patient_assignments, projects RESTART IDENTITY CASCADE")
        conn.commit()

        print(">> patients")
        patients, profiles = gen_patients(scale)
        n_pat = copy_rows(conn, "patients",
                          ["id_paciente", "nome", "data_nascimento", "genero", "cidade",
                           "estado", "cpf", "cns"], patients, scale)

        print(">> encounters")
        encounters, patient_encs, enc_total = gen_encounters(scale, profiles)
        n_enc = copy_rows(conn, "encounters",
                          ["id_atendimento", "id_paciente", "data_inicio", "data_fim",
                           "tipo_atendimento", "setor"], encounters, enc_total)
        del encounters   # libera memória antes dos eventos (o pico da tabela)

        print(">> clinical_events (maior volume — pode levar ~1-2 min)")
        ev_iter = gen_clinical_events(scale, profiles, patient_encs)()
        n_evt = copy_rows(conn, "clinical_events",
                          ["id_paciente", "id_atendimento", "tipo_evento", "codigo_tipo",
                           "descricao", "data_evento", "valor", "unidade"], ev_iter, scale * 30)

        print(">> user_patient_assignments")
        n_asg = copy_rows(conn, "user_patient_assignments",
                          ["username_cuidador", "id_paciente", "tipo_vinculo",
                           "username_supervisor", "status"], gen_assignments(scale))

        print(">> projects")
        n_prj = copy_rows(conn, "projects",
                          ["id_projeto", "titulo", "username_pesquisador", "codigo_condicao",
                           "status", "data_validade"], gen_projects())

        print(">> ajustando sequences SERIAL")
        fix_sequences(conn)

        print("\n=== RESUMO ===")
        print(f"  patients                 : {n_pat:,}")
        print(f"  encounters               : {n_enc:,}")
        print(f"  clinical_events          : {n_evt:,}")
        print(f"  user_patient_assignments : {n_asg:,}")
        print(f"  projects                 : {n_prj:,}")
        print("OK. Volume semeado (seed=42).")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
