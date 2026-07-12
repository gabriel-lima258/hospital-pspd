import type {
  FhirBundle,
  FhirClinicalResource,
  FhirCondition,
  FhirMedicationRequest,
  FhirObservation,
  FhirPatient,
} from "@/types/fhir"

/**
 * O gateway pode devolver tanto um Bundle (com várias entradas) quanto um
 * recurso Patient isolado. Estas funções normalizam ambos os casos.
 */

function entries(bundle: FhirBundle<FhirClinicalResource>): FhirClinicalResource[] {
  return (bundle.entry ?? []).map((e) => e.resource)
}

export function isBundle(data: unknown): data is FhirBundle<FhirClinicalResource> {
  return !!data && typeof data === "object" && (data as { resourceType?: string }).resourceType === "Bundle"
}

export function extractPatient(
  data: FhirBundle<FhirClinicalResource> | FhirPatient,
): FhirPatient | null {
  if (!isBundle(data)) {
    return (data as FhirPatient).resourceType === "Patient" ? (data as FhirPatient) : null
  }
  return (entries(data).find((r) => r.resourceType === "Patient") as FhirPatient) ?? null
}

export function extractConditions(data: FhirBundle<FhirClinicalResource> | FhirPatient): FhirCondition[] {
  if (!isBundle(data)) return []
  return entries(data).filter((r) => r.resourceType === "Condition") as FhirCondition[]
}

export function extractObservations(data: FhirBundle<FhirClinicalResource> | FhirPatient): FhirObservation[] {
  if (!isBundle(data)) return []
  return entries(data).filter((r) => r.resourceType === "Observation") as FhirObservation[]
}

export function extractMedications(
  data: FhirBundle<FhirClinicalResource> | FhirPatient,
): FhirMedicationRequest[] {
  if (!isBundle(data)) return []
  return entries(data).filter((r) => r.resourceType === "MedicationRequest") as FhirMedicationRequest[]
}

/** Retorna um rótulo legível para o gênero FHIR. */
export function genderLabel(gender?: string): string {
  switch (gender) {
    case "male":
      return "Masculino"
    case "female":
      return "Feminino"
    case "other":
      return "Outro"
    case "unknown":
      return "Não informado"
    default:
      return gender ?? "—"
  }
}

/** Extrai um identificador do paciente pelo rótulo do tipo (ex.: "CPF"). */
export function findIdentifier(patient: FhirPatient, typeText: string): string | undefined {
  return patient.identifier?.find(
    (i) => i.type?.text?.toUpperCase() === typeText.toUpperCase(),
  )?.value
}

/** Deriva o nível de acesso (FULL/PARTIAL) declarado no meta.security. */
export function accessLevel(patient: FhirPatient): "FULL" | "PARTIAL" {
  const code = patient.meta?.security?.[0]?.code
  return code === "FULL" ? "FULL" : "PARTIAL"
}

/** Classifica a interpretação de uma observação em um tom semântico. */
export function interpretationTone(text?: string): "normal" | "high" | "low" | "warn" {
  const t = (text ?? "").toLowerCase()
  if (t.includes("alto") || t.includes("high")) return "high"
  if (t.includes("baixo") || t.includes("low")) return "low"
  if (t.includes("limít") || t.includes("border")) return "warn"
  return "normal"
}
