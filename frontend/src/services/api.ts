import axios from "axios"
import keycloak from "./keycloak"
import { IS_DEMO, env } from "./config"
import { getMockCohort, getMockPatientBundle, DEMO_PATIENT_IDS } from "./mockData"
import type { Role } from "./config"

const api = axios.create({
  baseURL: env.apiGatewayUrl,
})

// Interceptor para injetar o Token Bearer em todas as requisições (fluxo real).
api.interceptors.request.use(
  async (config: any) => {
    if (!config) return config
    if (!IS_DEMO && keycloak.token) {
      try {
        // Atualiza o token se expirar em menos de 30 segundos.
        await keycloak.updateToken(30)
        config.headers = config.headers ?? {}
        config.headers.Authorization = `Bearer ${keycloak.token}`
      } catch (error) {
        console.error("Falha ao atualizar token. Redirecionando para login...", error)
        keycloak.login()
      }
    }
    return config
  },
  (error: unknown) => Promise.reject(error),
)

export default api

/* ------------------------------------------------------------------ */
/* Erro de API normalizado para a UI                                   */
/* ------------------------------------------------------------------ */

export interface ApiError {
  status: number
  title: string
  message: string
}

export function toApiError(err: unknown): ApiError {
  const axiosErr = err as { response?: { status?: number; data?: { message?: string } } }
  const status = axiosErr?.response?.status ?? 0

  switch (status) {
    case 400:
      return { status, title: "Requisição inválida", message: "Verifique os dados informados e tente novamente." }
    case 401:
      return { status, title: "Sessão expirada", message: "Sua sessão expirou. Faça login novamente para continuar." }
    case 403:
      return { status, title: "Acesso negado", message: "Você não possui permissão para acessar este recurso." }
    case 404:
      return { status, title: "Não encontrado", message: "O recurso solicitado não foi localizado no sistema." }
    case 500:
    case 502:
      return { status, title: "Erro de Servidor", message: "Ocorreu uma falha no processamento interno ou comunicação gRPC." }
    case 0:
      return {
        status,
        title: "Falha de conexão",
        message: "Não foi possível contatar o API Gateway. Verifique sua conexão ou tente novamente.",
      }
    default:
      return {
        status,
        title: "Erro inesperado",
        message: axiosErr?.response?.data?.message ?? "Ocorreu um erro ao processar a requisição.",
      }
  }
}

/* ------------------------------------------------------------------ */
/* Camada de acesso a dados clínicos                                   */
/*                                                                     */
/* Em produção usa o Axios (`api`) contra o gateway. Em modo demo,     */
/* resolve localmente com os mesmos formatos de resposta, inclusive    */
/* simulando erros HTTP (403/404) para exercitar a UI.                 */
/* ------------------------------------------------------------------ */

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function demoHttpError(status: number, message: string): never {
  throw {
    isAxiosError: true,
    response: { status, data: { message } },
  }
}

/** Resolve o nível de acesso demográfico a partir das roles. */
export function resolveAccessLevel(roles: string[]): "FULL" | "PARTIAL" {
  return roles.includes("MEDICO") ? "FULL" : "PARTIAL"
}

/** GET /fhir/Patient (Lista de pacientes) */
export async function fetchPatients(roles: Role[] | string[]) {
  if (IS_DEMO) {
    await delay(500)
    const access = resolveAccessLevel(roles)
    const entries = DEMO_PATIENT_IDS.map((id) => {
      const bundle = getMockPatientBundle(id, access)
      const patient = bundle?.entry?.find((e) => e.resource.resourceType === "Patient")?.resource
      return patient ? { resource: patient } : null
    }).filter(Boolean)

    return {
      resourceType: "Bundle",
      type: "searchset",
      total: entries.length,
      entry: entries,
    }
  }

  const { data } = await api.get("/fhir/Patient")
  return data
}

/** GET /fhir/Patient/{id} (com ?tipo= opcional para carga sob demanda) */
export async function fetchPatient(
  patientId: string,
  roles: Role[] | string[],
  tipo = "HistoricoClinico"
) {
  if (IS_DEMO) {
    await delay(650)
    const access = resolveAccessLevel(roles)
    const bundle = getMockPatientBundle(patientId, access)
    if (!bundle) {
      demoHttpError(404, `Paciente "${patientId}" não encontrado.`)
    }

    // No modo demo, se o tipo for diferente de HistoricoClinico, filtramos os dados de acordo com o tipo solicitado.
    if (tipo === "ResumoClinico") {
      // Retorna apenas dados básicos, condições ativas e a última observação
      const p = bundle.entry?.find(e => e.resource.resourceType === "Patient")
      const c = bundle.entry?.filter(e => e.resource.resourceType === "Condition").slice(0, 1) || []
      const o = bundle.entry?.filter(e => e.resource.resourceType === "Observation").slice(0, 1) || []
      return {
        resourceType: "Bundle",
        type: "collection",
        entry: [p, ...c, ...o].filter(Boolean)
      }
    } else if (tipo === "Exames") {
      const p = bundle.entry?.find(e => e.resource.resourceType === "Patient")
      const o = bundle.entry?.filter(e => e.resource.resourceType === "Observation") || []
      return {
        resourceType: "Bundle",
        type: "collection",
        entry: [p, ...o].filter(Boolean)
      }
    } else if (tipo === "Medicamentos") {
      const p = bundle.entry?.find(e => e.resource.resourceType === "Patient")
      const m = bundle.entry?.filter(e => e.resource.resourceType === "MedicationRequest") || []
      return {
        resourceType: "Bundle",
        type: "collection",
        entry: [p, ...m].filter(Boolean)
      }
    }
    
    return bundle
  }

  const { data } = await api.get(`/fhir/Patient/${encodeURIComponent(patientId)}`, {
    params: { tipo },
  })
  return data
}

/** GET /fhir/cohort/{projetoId}?tipo={tipo} */
export async function fetchCohort(
  projetoId: string,
  tipo: "ResumoCoorte" | "ExamesCoorte" | "Estatisticas",
) {
  if (IS_DEMO) {
    await delay(750)
    const result = getMockCohort(projetoId, tipo === "Estatisticas" ? "ResumoCoorte" : tipo)
    if (!result) {
      demoHttpError(404, `Projeto de pesquisa "${projetoId}" não encontrado.`)
    }
    return result
  }

  const { data } = await api.get(
    `/fhir/cohort/${encodeURIComponent(projetoId)}`,
    { params: { tipo } },
  )
  return data
}

/** GET /projects (Lista de projetos para pesquisadores) */
export async function fetchProjects() {
  if (IS_DEMO) {
    await delay(400)
    return [
      { id: "PRJ01", nome: "Estudo de Controle Glicêmico", coorteCodigo: "DIABETES_2026", status: "Ativo" },
      { id: "PRJ02", nome: "Coorte Renal Crônica", coorteCodigo: "RENAL_CHRONIC_2026", status: "Ativo" },
    ]
  }

  const { data } = await api.get("/projects")
  return data
}
