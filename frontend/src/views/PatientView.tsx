import { useCallback, useState } from "react"
import { Search, IdCard, Loader2, ShieldCheck } from "lucide-react"
import { fetchPatient, toApiError, type ApiError } from "@/services/api"
import {
  extractConditions,
  extractMedications,
  extractObservations,
  extractPatient,
} from "@/lib/fhir"
import type {
  FhirBundle,
  FhirClinicalResource,
  FhirCondition,
  FhirMedicationRequest,
  FhirObservation,
  FhirPatient,
} from "@/types/fhir"
import { useAuth } from "@/context/AuthContext"
import { PatientCard, ClinicalTabs } from "@/components/patient"
import { Alert, EmptyState } from "@/components/ui"

interface LoadedRecord {
  patient: FhirPatient
  conditions: FhirCondition[]
  observations: FhirObservation[]
  medications: FhirMedicationRequest[]
}

const SUGGESTED_IDS = ["P000001", "P000002", "P000003"]

export function PatientView() {
  const { roles, hasRole } = useAuth()
  const [patientId, setPatientId] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle")
  const [error, setError] = useState<ApiError | null>(null)
  const [record, setRecord] = useState<LoadedRecord | null>(null)

  const isIntern = hasRole("ESTAGIARIO") && !hasRole("MEDICO")

  const load = useCallback(
    async (id: string) => {
      const trimmed = id.trim()
      if (!trimmed) return

      setStatus("loading")
      setError(null)

      try {
        const data = (await fetchPatient(trimmed, roles)) as
          | FhirBundle<FhirClinicalResource>
          | FhirPatient
        const patient = extractPatient(data)

        if (!patient) {
          setStatus("error")
          setError({
            status: 404,
            title: "Paciente não encontrado",
            message: "Nenhum recurso Patient foi retornado para o identificador informado.",
          })
          setRecord(null)
          return
        }

        setRecord({
          patient,
          conditions: extractConditions(data),
          observations: extractObservations(data),
          medications: extractMedications(data),
        })
        setStatus("success")
      } catch (err) {
        setStatus("error")
        setError(toApiError(err))
        setRecord(null)
      }
    },
    [roles],
  )

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    load(patientId)
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
          Prontuário do Paciente
        </h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Consulte o registro clínico individual por identificador FHIR. O nível de acesso aos dados
          demográficos é definido pelo seu perfil de acesso.
        </p>
      </header>

      {isIntern && (
        <Alert
          variant="info"
          title="Acesso de Estagiário"
          description="Você está com visão restrita: dados demográficos sensíveis (documentos e contato) permanecem ocultos, mas as informações clínicas ficam disponíveis para acompanhamento."
        />
      )}

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
      >
        <label htmlFor="patient-id" className="mb-2 block text-sm font-medium text-foreground">
          Identificador do paciente
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <IdCard className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="patient-id"
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Ex.: P000001"
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15"
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading" || !patientId.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "loading" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            Consultar
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Sugestões:</span>
          {SUGGESTED_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPatientId(id)
                load(id)
              }}
              className="rounded-lg border border-border bg-muted px-2.5 py-1 font-mono text-xs text-foreground transition hover:border-ring hover:bg-accent"
            >
              {id}
            </button>
          ))}
        </div>
      </form>

      {status === "idle" && (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhum paciente consultado"
          description="Informe um identificador acima para carregar o prontuário clínico completo."
        />
      )}

      {status === "error" && error && (
        <Alert
          variant={error.status === 403 ? "warning" : "error"}
          title={error.title}
          description={error.message}
        />
      )}

      {status === "loading" && <PatientCard.Skeleton />}

      {status === "success" && record && (
        <div className="space-y-6">
          <PatientCard patient={record.patient} restricted={isIntern} />
          <ClinicalTabs
            conditions={record.conditions}
            observations={record.observations}
            medications={record.medications}
          />
        </div>
      )}
    </div>
  )
}
