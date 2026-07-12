import type {
  CohortExamsResult,
  CohortSummary,
  FhirBundle,
  FhirClinicalResource,
  ProjectSummary,
} from "@/types/fhir"

/**
 * Dados fictícios usados apenas no "modo demonstração". Reproduzem a forma dos
 * Bundles FHIR devolvidos pelo API Gateway real, permitindo exercitar toda a
 * UI (acesso FULL para médicos, PARTIAL/anonimizado para estagiários e
 * agregações para pesquisadores) sem um backend.
 */

/** Base bruta (acesso FULL — como o médico enxerga). */
const FULL_PATIENTS: Record<string, FhirBundle<FhirClinicalResource>> = {
  P000001: buildPatientBundle({
    id: "P000001",
    family: "Almeida Souza",
    given: ["Mariana", "Cristina"],
    gender: "female",
    birthDate: "1986-03-14",
    cpf: "123.456.789-09",
    cns: "700 5000 1234 5678",
    city: "Brasília",
    state: "DF",
    conditions: [
      { id: "C1", text: "Diabetes mellitus tipo 2", code: "E11", severity: "Moderada", onset: "2019-08-02", status: "Ativo" },
      { id: "C2", text: "Hipertensão arterial sistêmica", code: "I10", severity: "Leve", onset: "2021-01-19", status: "Ativo" },
    ],
    observations: [
      { id: "O1", text: "Hemoglobina glicada (HbA1c)", value: 7.8, unit: "%", ref: "4.0 - 5.6", interp: "Alto", date: "2026-05-30" },
      { id: "O2", text: "Glicemia de jejum", value: 142, unit: "mg/dL", ref: "70 - 99", interp: "Alto", date: "2026-05-30" },
      { id: "O3", text: "Pressão arterial sistólica", value: 138, unit: "mmHg", ref: "90 - 120", interp: "Limítrofe", date: "2026-06-10" },
      { id: "O4", text: "Colesterol LDL", value: 118, unit: "mg/dL", ref: "< 100", interp: "Alto", date: "2026-05-30" },
    ],
    medications: [
      { id: "M1", text: "Metformina 850 mg", dosage: "1 comprimido, 2x ao dia, após refeições", authoredOn: "2026-05-30", requester: "Dr. Paulo Nunes" },
      { id: "M2", text: "Losartana 50 mg", dosage: "1 comprimido pela manhã", authoredOn: "2026-06-10", requester: "Dr. Paulo Nunes" },
    ],
  }),
  P000002: buildPatientBundle({
    id: "P000002",
    family: "Ferreira Lima",
    given: ["João", "Pedro"],
    gender: "male",
    birthDate: "1972-11-02",
    cpf: "987.654.321-00",
    cns: "700 4000 8765 4321",
    city: "Taguatinga",
    state: "DF",
    conditions: [
      { id: "C1", text: "Doença renal crônica (estágio 3)", code: "N18.3", severity: "Moderada", onset: "2018-04-11", status: "Ativo" },
    ],
    observations: [
      { id: "O1", text: "Creatinina sérica", value: 1.9, unit: "mg/dL", ref: "0.7 - 1.3", interp: "Alto", date: "2026-06-01" },
      { id: "O2", text: "Taxa de filtração glomerular (TFG)", value: 48, unit: "mL/min", ref: "> 90", interp: "Baixo", date: "2026-06-01" },
      { id: "O3", text: "Potássio", value: 5.1, unit: "mmol/L", ref: "3.5 - 5.0", interp: "Limítrofe", date: "2026-06-01" },
    ],
    medications: [
      { id: "M1", text: "Enalapril 10 mg", dosage: "1 comprimido, 2x ao dia", authoredOn: "2026-06-01", requester: "Dra. Helena Costa" },
    ],
  }),
  P000003: buildPatientBundle({
    id: "P000003",
    family: "Santos Oliveira",
    given: ["Beatriz"],
    gender: "female",
    birthDate: "2001-07-25",
    cpf: "456.789.123-33",
    cns: "700 6000 4567 8912",
    city: "Sobradinho",
    state: "DF",
    conditions: [
      { id: "C1", text: "Asma persistente moderada", code: "J45.4", severity: "Moderada", onset: "2010-09-15", status: "Ativo" },
    ],
    observations: [
      { id: "O1", text: "Volume expiratório forçado (VEF1)", value: 78, unit: "%", ref: "> 80", interp: "Baixo", date: "2026-04-18" },
      { id: "O2", text: "Saturação de oxigênio (SpO2)", value: 97, unit: "%", ref: "95 - 100", interp: "Normal", date: "2026-04-18" },
    ],
    medications: [
      { id: "M1", text: "Budesonida + Formoterol (inalatório)", dosage: "2 inalações, 2x ao dia", authoredOn: "2026-04-18", requester: "Dr. Paulo Nunes" },
    ],
  }),
  P000004: buildPatientBundle({
    id: "P000004",
    family: "Oliveira Silva",
    given: ["Carlos", "Eduardo"],
    gender: "male",
    birthDate: "1960-08-24",
    cpf: "234.567.890-12",
    cns: "700 8000 2345 6789",
    city: "Gama",
    state: "DF",
    conditions: [
      { id: "C1", text: "Insuficiência Cardíaca Congestiva", code: "I50.9", severity: "Grave", onset: "2017-11-05", status: "Ativo" },
    ],
    observations: [
      { id: "O1", text: "Fração de Ejeção", value: 38, unit: "%", ref: "55 - 70", interp: "Baixo", date: "2026-05-12" },
    ],
    medications: [
      { id: "M1", text: "Carvedilol 12.5 mg", dosage: "1 comprimido, 2x ao dia", authoredOn: "2026-05-12", requester: "Dra. Ana Ribeiro" },
    ],
  }),
  P000005: buildPatientBundle({
    id: "P000005",
    family: "Mendes Costa",
    given: ["Patrícia"],
    gender: "female",
    birthDate: "1992-05-17",
    cpf: "345.678.901-23",
    cns: "700 9000 3456 7890",
    city: "Goiânia",
    state: "GO",
    conditions: [
      { id: "C1", text: "Hipotireoidismo Primário", code: "E03.9", severity: "Leve", onset: "2020-03-22", status: "Ativo" },
    ],
    observations: [
      { id: "O1", text: "TSH", value: 6.2, unit: "mUI/L", ref: "0.4 - 4.5", interp: "Alto", date: "2026-06-03" },
    ],
    medications: [
      { id: "M1", text: "Levotiroxina Sódica 75 mcg", dosage: "1 comprimido em jejum", authoredOn: "2026-06-03", requester: "Dra. Helena Costa" },
    ],
  }),
  P000006: buildPatientBundle({
    id: "P000006",
    family: "Nunes Pereira",
    given: ["Roberto"],
    gender: "male",
    birthDate: "1980-12-10",
    cpf: "567.123.456-78",
    cns: "700 3000 5678 1234",
    city: "São Paulo",
    state: "SP",
    conditions: [
      { id: "C1", text: "Dislipidemia", code: "E78.5", severity: "Leve", onset: "2022-07-14", status: "Ativo" },
    ],
    observations: [
      { id: "O1", text: "Colesterol Total", value: 245, unit: "mg/dL", ref: "< 200", interp: "Alto", date: "2026-04-20" },
    ],
    medications: [
      { id: "M1", text: "Atorvastatina 20 mg", dosage: "1 comprimido à noite", authoredOn: "2026-04-20", requester: "Dr. Paulo Nunes" },
    ],
  }),
  P000007: buildPatientBundle({
    id: "P000007",
    family: "Azevedo Rocha",
    given: ["Juliana"],
    gender: "female",
    birthDate: "1975-04-03",
    cpf: "678.234.567-89",
    cns: "700 2000 6789 2345",
    city: "Campinas",
    state: "SP",
    conditions: [
      { id: "C1", text: "Depressão Moderada", code: "F32.1", severity: "Moderada", onset: "2023-01-30", status: "Ativo" },
    ],
    observations: [],
    medications: [
      { id: "M1", text: "Sertralina 50 mg", dosage: "1 comprimido pela manhã", authoredOn: "2026-05-15", requester: "Dra. Ana Ribeiro" },
    ],
  }),
  P000008: buildPatientBundle({
    id: "P000008",
    family: "Ribeiro Santos",
    given: ["Lucas"],
    gender: "male",
    birthDate: "2015-09-08",
    cpf: "789.345.678-90",
    cns: "700 1000 7890 3456",
    city: "Rio de Janeiro",
    state: "RJ",
    conditions: [
      { id: "C1", text: "Rinite Alérgica", code: "J30.9", severity: "Leve", onset: "2021-08-10", status: "Ativo" },
    ],
    observations: [],
    medications: [
      { id: "M1", text: "Desloratadina 5 mg", dosage: "1 comprimido à noite", authoredOn: "2026-06-02", requester: "Dr. Paulo Nunes" },
    ],
  }),
  P000009: buildPatientBundle({
    id: "P000009",
    family: "Gomes Martins",
    given: ["Marcos", "Aurélio"],
    gender: "male",
    birthDate: "1955-01-14",
    cpf: "890.456.789-01",
    cns: "700 0000 8901 4567",
    city: "Niterói",
    state: "RJ",
    conditions: [
      { id: "C1", text: "Osteoartrose de Joelho", code: "M17", severity: "Moderada", onset: "2016-03-12", status: "Ativo" },
    ],
    observations: [],
    medications: [
      { id: "M1", text: "Condroitina + Glucosamina", dosage: "1 sachê ao dia dissolvido em água", authoredOn: "2026-03-12", requester: "Dra. Ana Ribeiro" },
    ],
  }),
  P000010: buildPatientBundle({
    id: "P000010",
    family: "Vasconcelos Cardoso",
    given: ["Amanda"],
    gender: "female",
    birthDate: "1998-10-31",
    cpf: "901.567.890-12",
    cns: "700 1234 5678 9012",
    city: "Brasília",
    state: "DF",
    conditions: [
      { id: "C1", text: "Enxaqueca Crônica", code: "G43.7", severity: "Grave", onset: "2018-09-05", status: "Ativo" },
    ],
    observations: [],
    medications: [
      { id: "M1", text: "Sumatriptana 50 mg", dosage: "1 comprimido se houver crise", authoredOn: "2026-04-10", requester: "Dra. Helena Costa" },
    ],
  }),
}

/** Aliases sem zeros à esquerda (P1 -> P000001) para conveniência. */
function normalizeId(raw: string): string {
  const trimmed = raw.trim().toUpperCase()
  const match = trimmed.match(/^P0*([0-9]+)$/)
  if (match) return `P${match[1].padStart(6, "0")}`
  return trimmed
}

export function getMockPatientBundle(
  rawId: string,
  access: "FULL" | "PARTIAL",
): FhirBundle<FhirClinicalResource> | null {
  const id = normalizeId(rawId)
  const bundle = FULL_PATIENTS[id]
  if (!bundle) return null
  return access === "FULL" ? bundle : anonymizeBundle(bundle)
}

/** Aplica anonimização (visão do estagiário — acesso PARTIAL). */
function anonymizeBundle(
  bundle: FhirBundle<FhirClinicalResource>,
): FhirBundle<FhirClinicalResource> {
  const entry = (bundle.entry ?? []).map((e) => {
    if (e.resource.resourceType !== "Patient") return e
    const patient = e.resource
    const initials =
      (patient.name?.[0]?.given ?? [])
        .map((g) => g[0]?.toUpperCase())
        .join(".") +
      "." +
      (patient.name?.[0]?.family?.[0]?.toUpperCase() ?? "")
    const year = patient.birthDate?.slice(0, 4)
    return {
      ...e,
      resource: {
        ...patient,
        name: [{ text: initials }],
        birthDate: year,
        identifier: undefined,
        meta: { security: [{ code: "PARTIAL", display: "Acesso parcial" }] },
      },
    }
  })
  return { ...bundle, entry }
}

/* ---------------------------- Coortes ---------------------------- */

const COHORT_SUMMARIES: Record<string, CohortSummary> = {
  PRJ01: {
    tipo: "ResumoCoorte",
    projetoId: "PRJ01",
    nomeProjeto: "Estudo de Controle Glicêmico",
    totalPacientes: 1284,
    distribuicaoGenero: { masculino: 47, feminino: 52, outro: 1 },
    faixasEtarias: [
      { faixa: "0-17", percentual: 6, total: 77 },
      { faixa: "18-39", percentual: 24, total: 308 },
      { faixa: "40-59", percentual: 41, total: 527 },
      { faixa: "60+", percentual: 29, total: 372 },
    ],
    mediasExames: [
      { exame: "HbA1c", media: 7.2, unidade: "%", referencia: "< 5.7" },
      { exame: "Glicemia de jejum", media: 131, unidade: "mg/dL", referencia: "70-99" },
      { exame: "Colesterol LDL", media: 109, unidade: "mg/dL", referencia: "< 100" },
      { exame: "IMC", media: 28.4, unidade: "kg/m²", referencia: "18.5-24.9" },
    ],
    distribuicaoSetor: [
      { rotulo: "Endocrinologia", percentual: 62 },
      { rotulo: "Cardiologia", percentual: 21 },
      { rotulo: "Clínica Geral", percentual: 17 },
    ],
    frequenciaMedicamentos: [
      { rotulo: "Metformina", percentual: 48 },
      { rotulo: "Insulina", percentual: 33 },
      { rotulo: "Losartana", percentual: 19 },
    ],
  },
  PRJ02: {
    tipo: "ResumoCoorte",
    projetoId: "PRJ02",
    nomeProjeto: "Coorte Renal Crônica",
    totalPacientes: 642,
    distribuicaoGenero: { masculino: 58, feminino: 41, outro: 1 },
    faixasEtarias: [
      { faixa: "0-17", percentual: 2, total: 13 },
      { faixa: "18-39", percentual: 15, total: 96 },
      { faixa: "40-59", percentual: 38, total: 244 },
      { faixa: "60+", percentual: 45, total: 289 },
    ],
    mediasExames: [
      { exame: "Creatinina", media: 1.7, unidade: "mg/dL", referencia: "0.7-1.3" },
      { exame: "TFG", media: 52, unidade: "mL/min", referencia: "> 90" },
      { exame: "Potássio", media: 4.8, unidade: "mmol/L", referencia: "3.5-5.0" },
    ],
    distribuicaoSetor: [
      { rotulo: "Nefrologia", percentual: 71 },
      { rotulo: "Cardiologia", percentual: 18 },
      { rotulo: "Clínica Geral", percentual: 11 },
    ],
    frequenciaMedicamentos: [
      { rotulo: "Enalapril", percentual: 44 },
      { rotulo: "Furosemida", percentual: 31 },
      { rotulo: "Losartana", percentual: 25 },
    ],
  },
}

/** Projetos fictícios do pesquisador (modo demo) — espelha GET /projects real. */
const MOCK_PROJECTS: ProjectSummary[] = [
  { id: "PRJ01", titulo: "Estudo de Controle Glicêmico", condicao: "Diabetes", status: "Aprovado", validade: "2027-12-31" },
  { id: "PRJ02", titulo: "Coorte Renal Crônica", condicao: "Hipertensao", status: "Expirado", validade: "2024-01-01" },
  { id: "PRJ03", titulo: "Coorte de Doença Rara (vazia)", condicao: "Rara", status: "Aprovado", validade: "2027-12-31" },
]

export function getMockProjects(): ProjectSummary[] {
  return MOCK_PROJECTS
}

function buildExamsResult(projetoId: string, summary: CohortSummary): CohortExamsResult {
  const colunas = summary.mediasExames.map((m) => ({
    chave: m.exame.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    rotulo: m.exame,
    unidade: m.unidade,
  }))

  const FAIXAS = ["18-39", "40-59", "60+"]
  // Gera linhas determinísticas em torno das médias (dados sintéticos).
  const linhas = Array.from({ length: 47 }).map((_, i) => {
    const seed = i + 1
    const exames: Record<string, number> = {}
    summary.mediasExames.forEach((m, j) => {
      const jitter = ((seed * (j + 3)) % 17) / 10 - 0.8
      const val = m.media * (1 + jitter * 0.14)
      const chave = colunas[j].chave
      exames[chave] = Math.round(val * 10) / 10
    })
    return {
      hashId: hash(`${projetoId}-${seed}`),
      faixaEtaria: FAIXAS[seed % FAIXAS.length],
      genero: seed % 2 === 0 ? "female" : "male",
      exames,
    }
  })

  return {
    tipo: "ExamesCoorte",
    projetoId,
    nomeProjeto: summary.nomeProjeto,
    colunas,
    linhas,
  }
}

export function getMockCohort(
  rawProjetoId: string,
  tipo: "ResumoCoorte" | "ExamesCoorte",
): CohortSummary | CohortExamsResult | null {
  const projetoId = rawProjetoId.trim().toUpperCase()
  const summary = COHORT_SUMMARIES[projetoId]
  if (!summary) return null
  return tipo === "ResumoCoorte" ? summary : buildExamsResult(projetoId, summary)
}

/* --------------------------- helpers ---------------------------- */

interface PatientSeed {
  id: string
  family: string
  given: string[]
  gender: string
  birthDate: string
  cpf: string
  cns: string
  city: string
  state: string
  conditions: {
    id: string
    text: string
    code: string
    severity: string
    onset: string
    status: string
  }[]
  observations: {
    id: string
    text: string
    value: number
    unit: string
    ref: string
    interp: string
    date: string
  }[]
  medications: {
    id: string
    text: string
    dosage: string
    authoredOn: string
    requester: string
  }[]
}

function buildPatientBundle(seed: PatientSeed): FhirBundle<FhirClinicalResource> {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: seed.id,
          name: [
            {
              text: `${seed.given.join(" ")} ${seed.family}`,
              family: seed.family,
              given: seed.given,
            },
          ],
          gender: seed.gender,
          birthDate: seed.birthDate,
          identifier: [
            { system: "urn:cpf", value: seed.cpf, type: { text: "CPF" } },
            { system: "urn:cns", value: seed.cns, type: { text: "CNS" } },
          ],
          address: [
            {
              city: seed.city,
              state: seed.state,
            },
          ],
          meta: { security: [{ code: "FULL", display: "Acesso completo" }] },
        },
      },
      ...seed.conditions.map((c) => ({
        resource: {
          resourceType: "Condition" as const,
          id: c.id,
          code: { text: c.text, coding: [{ code: c.code, display: c.text }] },
          clinicalStatus: { text: c.status },
          severity: { text: c.severity },
          onsetDateTime: c.onset,
          recordedDate: c.onset,
        },
      })),
      ...seed.observations.map((o) => ({
        resource: {
          resourceType: "Observation" as const,
          id: o.id,
          status: "final",
          code: { text: o.text },
          effectiveDateTime: o.date,
          valueQuantity: { value: o.value, unit: o.unit },
          interpretation: [{ text: o.interp }],
          referenceRange: [{ text: o.ref }],
        },
      })),
      ...seed.medications.map((m) => ({
        resource: {
          resourceType: "MedicationRequest" as const,
          id: m.id,
          status: "active",
          intent: "order",
          medicationCodeableConcept: { text: m.text },
          authoredOn: m.authoredOn,
          dosageInstruction: [{ text: m.dosage }],
          requester: { display: m.requester },
        },
      })),
    ],
  }
}

function hash(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0
  }
  return "H" + (h >>> 0).toString(16).padStart(8, "0").toUpperCase()
}

export const DEMO_PATIENT_IDS = Object.keys(FULL_PATIENTS)
export const DEMO_PROJECT_IDS = Object.keys(COHORT_SUMMARIES)
