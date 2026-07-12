import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { useToast } from "@/context/ToastContext"
import { fetchPatient, toApiError, ApiError } from "@/services/api"
import {
  extractPatient,
  extractConditions,
  extractObservations,
  extractMedications,
} from "@/lib/fhir"
import { formatDate } from "@/lib/utils"
import { PatientCard } from "@/components/patient"
import { FHIRViewer } from "@/components/fhir"
import { DataTable, Alert, ExportButton } from "@/components/ui"
import {
  ArrowLeft,
  Loader2,
  Stethoscope,
  FlaskConical,
  Pill,
  CalendarCheck,
  FileJson,
  Activity,
  HeartPulse,
} from "lucide-react"

type TabType = "resumo" | "historico" | "exames" | "medicamentos" | "consultas" | "fhir"

export const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { roles, hasRole } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<TabType>("resumo")
  const [patient, setPatient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  

  const [clinicalData, setClinicalData] = useState<any>(null)
  const [tabLoading, setTabLoading] = useState(false)

  const isIntern = hasRole("ESTAGIARIO") && !hasRole("MEDICO")


  const loadBasePatient = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {

      const data = await fetchPatient(id, roles, "ResumoClinico")
      const p = extractPatient(data)
      if (!p) {
        setError({
          status: 404,
          title: "Paciente não encontrado",
          message: "Nenhum recurso Patient correspondente foi localizado no servidor FHIR.",
        })
      } else {
        setPatient(p)
        setClinicalData(data)
      }
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setLoading(false)
    }
  }, [id, roles])

  useEffect(() => {
    loadBasePatient()
  }, [loadBasePatient])


  const loadTabContent = useCallback(async (tab: TabType) => {
    if (!id || !patient) return
    setTabLoading(true)
    try {
      let tipo = "HistoricoClinico"
      if (tab === "resumo") tipo = "ResumoClinico"
      else if (tab === "exames") tipo = "Exames"
      else if (tab === "medicamentos") tipo = "Medicamentos"
      
      const data = await fetchPatient(id, roles, tipo)
      setClinicalData(data)
    } catch (err) {
      toast.error("Erro ao carregar dados", "Não foi possível carregar os dados desta aba.")
    } finally {
      setTabLoading(false)
    }
  }, [id, patient, roles, toast])

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    loadTabContent(tab)
  }


  const conditions = useMemo(() => clinicalData ? extractConditions(clinicalData) : [], [clinicalData])
  const observations = useMemo(() => clinicalData ? extractObservations(clinicalData) : [], [clinicalData])
  const medications = useMemo(() => clinicalData ? extractMedications(clinicalData) : [], [clinicalData])


  const encounters = useMemo(() => {
    return [
      { id: "E1", status: "finished", class: "ambulatorial", date: "10/06/2026", practitioner: "Dr. Paulo Nunes", department: "Endocrinologia" },
      { id: "E2", status: "finished", class: "retorno", date: "15/01/2026", practitioner: "Dra. Helena Costa", department: "Cardiologia" },
    ]
  }, [])

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm font-semibold text-muted-foreground">Carregando prontuário eletrônico...</span>
      </div>
    )
  }

  if (error || !patient) {
    return (
      <div className="max-w-xl mx-auto py-12 space-y-4">
        <Alert variant={error?.status === 403 ? "warning" : "error"} title={error?.title || "Erro"} description={error?.message || "Erro desconhecido"} />
        <button
          onClick={() => navigate("/patients")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-4" /> Voltar à lista
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/patients")}
          className="inline-flex h-9 items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Voltar para lista
        </button>
        <ExportButton data={[patient]} columns={[{ key: "id", label: "ID" }]} filename={`prontuario-${patient.id}`} title="Dossiê Médico FHIR" />
      </div>

      {/* Patient overview card */}
      <PatientCard patient={patient} restricted={isIntern} />

      {/* Tab Nav Bar */}
      <div className="rounded-2xl border border-border bg-card p-2 flex gap-1 overflow-x-auto shadow-xs">
        {(
          [
            { key: "resumo", label: "Resumo Clínico", icon: HeartPulse },
            { key: "historico", label: "Histórico Clínico", icon: Stethoscope },
            { key: "exames", label: "Exames", icon: FlaskConical },
            { key: "medicamentos", label: "Medicamentos", icon: Pill },
            { key: "consultas", label: "Consultas", icon: CalendarCheck },
            { key: "fhir", label: "FHIR JSON", icon: FileJson },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      <div className="relative min-h-[250px]">
        {tabLoading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-xs z-10 flex items-center justify-center gap-2 rounded-2xl">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="text-xs font-semibold text-muted-foreground">Sincronizando dados clínicos...</span>
          </div>
        )}

        {/* Tab content wrappers */}
        {activeTab === "resumo" && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Stethoscope className="size-4.5 text-primary" /> Diagnósticos Ativos
              </h3>
              {conditions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum diagnóstico registrado no resumo.</p>
              ) : (
                <div className="space-y-3">
                  {conditions.map((c: any) => (
                    <div key={c.id} className="p-3 bg-muted/30 border border-border rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{c.code?.text}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">CID: {c.code?.coding?.[0]?.code ?? "—"}</p>
                      </div>
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">
                        {c.severity?.text || "Moderado"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FlaskConical className="size-4.5 text-accent" /> Aferições Recentes
              </h3>
              {observations.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma aferição registrada no resumo.</p>
              ) : (
                <div className="space-y-3">
                  {observations.slice(0, 3).map((o: any) => (
                    <div key={o.id} className="p-3 bg-muted/30 border border-border rounded-xl flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">{o.code?.text}</p>
                        <p className="text-sm font-bold text-foreground mt-1">
                          {o.valueQuantity?.value} {o.valueQuantity?.unit}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold bg-success/10 text-success px-2 py-0.5 rounded-full">
                        Normal
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "historico" && (
          <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="size-4.5 text-primary" /> Histórico Clínico Geral
            </h3>
            {conditions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
            ) : (
              <div className="relative border-l border-border pl-6 space-y-6 ml-3">
                {conditions.map((c: any) => (
                  <div key={c.id} className="relative">
                    <span className="absolute -left-[31px] top-1.5 flex size-4.5 items-center justify-center rounded-full bg-primary border-4 border-card text-primary-foreground" />
                    <p className="text-xs text-muted-foreground font-mono">{formatDate(c.onsetDateTime)}</p>
                    <p className="text-sm font-bold text-foreground mt-0.5">{c.code?.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Status: {c.clinicalStatus?.text ?? "Ativo"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "exames" && (
          <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FlaskConical className="size-4.5 text-accent" /> Resultados Laboratoriais (Observations)
            </h3>
            {observations.length === 0 ? (
              <p className="text-xs text-muted-foreground">Não há resultados laboratoriais lançados.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {observations.map((o: any) => (
                  <div key={o.id} className="p-4 bg-muted/40 rounded-2xl border border-border flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase">{o.code?.text}</p>
                      <p className="text-2xl font-bold text-foreground mt-2">
                        {o.valueQuantity?.value ?? "—"}{" "}
                        <span className="text-sm font-medium text-muted-foreground">{o.valueQuantity?.unit}</span>
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
                      <span>Val. Ref: {o.referenceRange?.[0]?.text ?? "N/A"}</span>
                      <span>{formatDate(o.effectiveDateTime)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "medicamentos" && (
          <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Pill className="size-4.5 text-success" /> Prescrições de Medicamentos (MedicationRequest)
            </h3>
            {medications.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma prescrição farmacológica registrada.</p>
            ) : (
              <div className="space-y-3">
                {medications.map((m: any) => (
                  <div key={m.id} className="p-4 bg-muted/40 border border-border rounded-2xl flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                      <Pill className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-foreground">{m.medicationCodeableConcept?.text}</p>
                      <p className="text-xs text-muted-foreground leading-normal">{m.dosageInstruction?.[0]?.text ?? "Dose padrão"}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                        <span>Autorizado: {m.requester?.display ?? "Médico Supervisor"}</span>
                        <span>•</span>
                        <span>Prescrito em {formatDate(m.authoredOn)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "consultas" && (
          <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <CalendarCheck className="size-4.5 text-primary" /> Consultas & Episódios Clínicos (Encounters)
            </h3>
            <DataTable
              columns={[
                { key: "id", label: "ID" },
                { key: "date", label: "Data" },
                { key: "practitioner", label: "Profissional" },
                { key: "department", label: "Especialidade" },
                {
                  key: "status",
                  label: "Status",
                  render: (row: any) => (
                    <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-bold text-success">
                      {row.status === "finished" ? "Finalizada" : row.status}
                    </span>
                  ),
                },
              ]}
              data={encounters}
              density="normal"
            />
          </div>
        )}

        {activeTab === "fhir" && (
          <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
            <FHIRViewer resource={clinicalData} title={`Recurso Bundle de ${patient.name?.[0]?.text ?? "Paciente"}`} />
          </div>
        )}
      </div>
    </div>
  )
}
export default PatientDetail
