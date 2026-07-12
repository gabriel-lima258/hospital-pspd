/**
 * Adapters FHIR → domínio para a jornada do pesquisador. O gateway devolve FHIR cru
 * (`MeasureReport` no ResumoCoorte/Estatisticas, `Bundle` pseudonimizado no ExamesCoorte);
 * a UI (`CohortView`) consome objetos de domínio (`CohortSummary`/`CohortExamsResult`).
 * Toda a conversão vive aqui, na camada de serviço — os componentes ficam intactos.
 *
 * Sem dependência de HAPI: navega o JSON com interfaces mínimas (só os campos usados).
 */
import type {
  CohortExamRow,
  CohortExamsResult,
  CohortShare,
  CohortSummary,
} from "@/types/fhir"

const URL_FAIXA_ETARIA = "http://hospital.unb.br/fhir/faixaEtaria"

/* ----------------------------- MeasureReport ----------------------------- */

interface MeasureStratum {
  value?: { text?: string }
  measureScore?: { value?: number }
}
interface MeasureStratifier {
  code?: { text?: string }[]
  stratum?: MeasureStratum[]
}
interface MeasureGroup {
  population?: { count?: number }[]
  measureScore?: { value?: number; unit?: string }
  stratifier?: MeasureStratifier[]
}
interface MeasureReport {
  resourceType: "MeasureReport"
  measure?: string
  group?: MeasureGroup[]
}

function stratifierByName(group: MeasureGroup | undefined, nome: string): MeasureStratum[] {
  return group?.stratifier?.find((s) => s.code?.[0]?.text === nome)?.stratum ?? []
}

/** Distribuição rotulada (setor, medicamento) → lista ordenada desc por percentual. */
function shares(strata: MeasureStratum[]): CohortShare[] {
  return strata
    .map((s) => ({ rotulo: s.value?.text ?? "—", percentual: s.measureScore?.value ?? 0 }))
    .sort((a, b) => b.percentual - a.percentual)
}

export function measureReportToCohortSummary(mr: MeasureReport, projetoId: string): CohortSummary {
  const group = mr.group?.[0]
  const total = group?.population?.[0]?.count ?? 0

  const sexo = stratifierByName(group, "porSexo")
  const pctSexo = (label: string) =>
    sexo.find((s) => s.value?.text === label)?.measureScore?.value ?? 0

  const faixasEtarias = stratifierByName(group, "porFaixa").map((s) => {
    const percentual = s.measureScore?.value ?? 0
    return { faixa: s.value?.text ?? "—", percentual, total: Math.round((percentual * total) / 100) }
  })

  const mediaHbA1c = group?.measureScore?.value
  const mediasExames =
    mediaHbA1c != null ? [{ exame: "HbA1c", media: mediaHbA1c, unidade: "%", referencia: "< 5.7" }] : []

  return {
    tipo: "ResumoCoorte",
    projetoId,
    nomeProjeto: mr.measure, // "Coorte/Diabetes"
    totalPacientes: total,
    distribuicaoGenero: {
      masculino: pctSexo("male"),
      feminino: pctSexo("female"),
      outro: pctSexo("other"),
    },
    faixasEtarias,
    mediasExames,
    distribuicaoSetor: shares(stratifierByName(group, "porSetor")),
    frequenciaMedicamentos: shares(stratifierByName(group, "freqMedicamentos")),
  }
}

/* ------------------------- Bundle (ExamesCoorte) ------------------------- */

interface FhirEntryResource {
  resourceType?: string
  id?: string
  gender?: string
  extension?: { url?: string; valueString?: string }[]
  code?: { text?: string }
  valueQuantity?: { value?: number; unit?: string }
  subject?: { reference?: string }
}
interface FhirBundleRaw {
  resourceType: "Bundle"
  entry?: { resource: FhirEntryResource }[]
}

export function bundleToCohortExams(bundle: FhirBundleRaw, projetoId: string): CohortExamsResult {
  const resources = (bundle.entry ?? []).map((e) => e.resource)

  // Índice de pacientes pseudonimizados.
  const pacientes = new Map<string, CohortExamRow>()
  for (const r of resources) {
    if (r.resourceType !== "Patient" || !r.id) continue
    pacientes.set(`Patient/${r.id}`, {
      hashId: r.id,
      genero: r.gender,
      faixaEtaria: r.extension?.find((e) => e.url === URL_FAIXA_ETARIA)?.valueString,
      exames: {},
    })
  }

  // Observações → coluna por código; valor mais recente por paciente (Bundle vem ordenado asc).
  const colunas = new Map<string, { chave: string; rotulo: string; unidade?: string }>()
  for (const r of resources) {
    if (r.resourceType !== "Observation") continue
    const codigo = r.code?.text
    const ref = r.subject?.reference
    if (!codigo || !ref) continue
    colunas.set(codigo, { chave: codigo, rotulo: codigo, unidade: r.valueQuantity?.unit })
    const linha = pacientes.get(ref)
    if (linha && r.valueQuantity?.value != null) {
      linha.exames[codigo] = r.valueQuantity.value
    }
  }

  return {
    tipo: "ExamesCoorte",
    projetoId,
    colunas: [...colunas.values()],
    linhas: [...pacientes.values()],
  }
}
