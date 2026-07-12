import { useState } from "react"
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  FlaskConical,
  Minus,
  Pill,
  Stethoscope,
  TriangleAlert,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type {
  FhirCondition,
  FhirMedicationRequest,
  FhirObservation,
} from "@/types/fhir"
import { interpretationTone } from "@/lib/fhir"
import { cn, formatDate } from "@/lib/utils"
import { EmptyState } from "@/components/ui"

type TabKey = "conditions" | "observations" | "medications"

interface ClinicalTabsProps {
  conditions: FhirCondition[]
  observations: FhirObservation[]
  medications: FhirMedicationRequest[]
}

export function ClinicalTabs({ conditions, observations, medications }: ClinicalTabsProps) {
  const [active, setActive] = useState<TabKey>("conditions")

  const tabs: { key: TabKey; label: string; icon: LucideIcon; count: number }[] = [
    { key: "conditions", label: "Diagnósticos", icon: Stethoscope, count: conditions.length },
    { key: "observations", label: "Exames", icon: FlaskConical, count: observations.length },
    { key: "medications", label: "Medicamentos", icon: Pill, count: medications.length },
  ]

  return (
    <div className="animate-fade-in-up rounded-2xl border border-border bg-card shadow-sm">
      {/* Barra de abas — rolável em telas pequenas */}
      <div
        role="tablist"
        aria-label="Informações clínicas"
        className="flex gap-1 overflow-x-auto border-b border-border p-2"
      >
        {tabs.map((tab) => {
          const isActive = active === tab.key
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <tab.icon className="size-4" aria-hidden="true" />
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums",
                  isActive ? "bg-primary-foreground/20" : "bg-muted-foreground/15",
                )}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="p-4 sm:p-5">
        {active === "conditions" && <ConditionsPanel items={conditions} />}
        {active === "observations" && <ObservationsPanel items={observations} />}
        {active === "medications" && <MedicationsPanel items={medications} />}
      </div>
    </div>
  )
}

/* --------------------------- Diagnósticos --------------------------- */

function severityTone(severity?: string): string {
  const s = (severity ?? "").toLowerCase()
  if (s.includes("grave") || s.includes("severa")) return "bg-destructive/12 text-destructive"
  if (s.includes("moder")) return "bg-warning/20 text-warning-foreground"
  return "bg-success/12 text-success"
}

function ConditionsPanel({ items }: { items: FhirCondition[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nenhum diagnóstico registrado"
        description="Não há recursos Condition no prontuário deste paciente."
      />
    )
  }
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {items.map((c) => (
        <li
          key={c.id}
          className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-sm">
            <Stethoscope className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground text-pretty">{c.code?.text ?? "Diagnóstico"}</p>
              {c.code?.coding?.[0]?.code && (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                  {c.code.coding[0].code}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {c.severity?.text && (
                <span className={cn("rounded-full px-2 py-0.5 font-medium", severityTone(c.severity.text))}>
                  {c.severity.text}
                </span>
              )}
              {c.clinicalStatus?.text && (
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                  {c.clinicalStatus.text}
                </span>
              )}
              {c.onsetDateTime && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                  Início {formatDate(c.onsetDateTime)}
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ----------------------------- Exames ------------------------------ */

const TONE_CONFIG: Record<
  ReturnType<typeof interpretationTone>,
  { icon: LucideIcon; badge: string; label: string }
> = {
  high: { icon: ArrowUpRight, badge: "bg-destructive/12 text-destructive", label: "Alto" },
  low: { icon: ArrowDownRight, badge: "bg-primary/12 text-primary", label: "Baixo" },
  warn: { icon: TriangleAlert, badge: "bg-warning/20 text-warning-foreground", label: "Limítrofe" },
  normal: { icon: Minus, badge: "bg-success/12 text-success", label: "Normal" },
}

function ObservationsPanel({ items }: { items: FhirObservation[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Nenhum exame disponível"
        description="Não há recursos Observation no prontuário deste paciente."
      />
    )
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((o) => {
        const tone = interpretationTone(o.interpretation?.[0]?.text)
        const cfg = TONE_CONFIG[tone]
        const ToneIcon = cfg.icon
        const range = o.referenceRange?.[0]?.text
        return (
          <li key={o.id} className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-snug text-foreground text-pretty">
                {o.code?.text ?? "Exame"}
              </p>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  cfg.badge,
                )}
              >
                <ToneIcon className="size-3" />
                {o.interpretation?.[0]?.text ?? cfg.label}
              </span>
            </div>
            <p className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {o.valueQuantity?.value ?? o.valueString ?? "—"}
              </span>
              {o.valueQuantity?.unit && (
                <span className="text-sm font-medium text-muted-foreground">{o.valueQuantity.unit}</span>
              )}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {range && <span>Ref.: {range}</span>}
              {o.effectiveDateTime && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="size-3" />
                  {formatDate(o.effectiveDateTime)}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* --------------------------- Medicamentos --------------------------- */

function MedicationsPanel({ items }: { items: FhirMedicationRequest[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Pill}
        title="Nenhuma prescrição ativa"
        description="Não há recursos MedicationRequest no prontuário deste paciente."
      />
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((m) => (
        <li
          key={m.id}
          className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent shadow-sm">
            <Pill className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground text-pretty">
                {m.medicationCodeableConcept?.text ?? "Medicamento"}
              </p>
              {m.status && (
                <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">
                  {m.status === "active" ? "Ativo" : m.status}
                </span>
              )}
            </div>
            {m.dosageInstruction?.[0]?.text && (
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                {m.dosageInstruction[0].text}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {m.authoredOn && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="size-3.5" />
                  Prescrito em {formatDate(m.authoredOn)}
                </span>
              )}
              {m.requester?.display && <span>Por {m.requester.display}</span>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
