/**
 * Interfaces TypeScript básicas para os recursos HL7/FHIR consumidos pelo
 * dashboard. Não pretendem cobrir a especificação inteira — apenas os campos
 * efetivamente utilizados pela UI, de forma tipada (sem `any`).
 */

export interface FhirCoding {
  system?: string
  code?: string
  display?: string
}

export interface FhirCodeableConcept {
  text?: string
  coding?: FhirCoding[]
}

export interface FhirHumanName {
  use?: string
  text?: string
  family?: string
  given?: string[]
}

export interface FhirIdentifier {
  system?: string
  value?: string
  /** Rótulo amigável usado pela UI (ex.: "CPF", "CNS"). */
  type?: FhirCodeableConcept
}

export interface FhirQuantity {
  value?: number
  unit?: string
  system?: string
  code?: string
}

export interface FhirReference {
  reference?: string
  display?: string
}

/** Patient (paciente). Campos sensíveis podem vir ausentes p/ estagiários. */
export interface FhirPatient {
  resourceType: "Patient"
  id: string
  name?: FhirHumanName[]
  gender?: "male" | "female" | "other" | "unknown" | string
  birthDate?: string
  identifier?: FhirIdentifier[]
  address?: { city?: string; state?: string }[]
  /** Nível de acesso resolvido pelo gateway: FULL | PARTIAL. */
  meta?: { security?: FhirCoding[] }
}

/** Condition (diagnóstico). */
export interface FhirCondition {
  resourceType: "Condition"
  id: string
  code?: FhirCodeableConcept
  clinicalStatus?: FhirCodeableConcept
  severity?: FhirCodeableConcept
  onsetDateTime?: string
  recordedDate?: string
}

/** Observation (exame / medição). */
export interface FhirObservation {
  resourceType: "Observation"
  id: string
  status?: string
  code?: FhirCodeableConcept
  effectiveDateTime?: string
  valueQuantity?: FhirQuantity
  valueString?: string
  interpretation?: FhirCodeableConcept[]
  referenceRange?: { low?: FhirQuantity; high?: FhirQuantity; text?: string }[]
}

/** MedicationRequest (prescrição). */
export interface FhirMedicationRequest {
  resourceType: "MedicationRequest"
  id: string
  status?: string
  intent?: string
  medicationCodeableConcept?: FhirCodeableConcept
  authoredOn?: string
  dosageInstruction?: { text?: string }[]
  requester?: FhirReference
}

export type FhirClinicalResource =
  | FhirPatient
  | FhirCondition
  | FhirObservation
  | FhirMedicationRequest

export interface FhirBundleEntry<T = FhirClinicalResource> {
  fullUrl?: string
  resource: T
}

export interface FhirBundle<T = FhirClinicalResource> {
  resourceType: "Bundle"
  type?: string
  total?: number
  entry?: FhirBundleEntry<T>[]
}

/* ------------------------------------------------------------------ */
/* Recursos de Coorte (Pesquisador) — agregados / anonimizados         */
/* ------------------------------------------------------------------ */

export interface CohortAgeBand {
  faixa: string
  percentual: number
  total: number
}

export interface CohortExamAverage {
  exame: string
  media: number
  unidade: string
  referencia?: string
}

/** Distribuição percentual rotulada (setor, medicamento, etc.). */
export interface CohortShare {
  rotulo: string
  percentual: number
}

/** Resposta de ?tipo=ResumoCoorte / Estatisticas */
export interface CohortSummary {
  tipo: "ResumoCoorte"
  projetoId: string
  nomeProjeto?: string
  totalPacientes: number
  distribuicaoGenero: {
    masculino: number
    feminino: number
    outro?: number
  }
  faixasEtarias: CohortAgeBand[]
  mediasExames: CohortExamAverage[]
  /** Departamentos mais usados (porSetor) — enunciado item ii. */
  distribuicaoSetor: CohortShare[]
  /** Frequência de utilização de medicamentos (freqMedicamentos) — enunciado item ii. */
  frequenciaMedicamentos: CohortShare[]
}

export interface CohortExamRow {
  /** Identificador anonimizado (hash). */
  hashId: string
  /** Faixa etária (o backend anonimiza a idade exata sob ANONYMIZED). */
  faixaEtaria?: string
  genero?: string
  exames: Record<string, number>
}

/** Item da lista de projetos do pesquisador — GET /projects (enunciado item iv). */
export interface ProjectSummary {
  id: string
  titulo: string
  condicao: string
  status: string
  validade?: string
}

/** Resposta de ?tipo=ExamesCoorte */
export interface CohortExamsResult {
  tipo: "ExamesCoorte"
  projetoId: string
  nomeProjeto?: string
  colunas: { chave: string; rotulo: string; unidade?: string }[]
  linhas: CohortExamRow[]
}

export type CohortResult = CohortSummary | CohortExamsResult
