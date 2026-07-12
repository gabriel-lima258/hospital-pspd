import {
  BadgeCheck,
  CalendarDays,
  Cake,
  Fingerprint,
  IdCard,
  ShieldCheck,
  ShieldHalf,
  User,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { FhirPatient } from "@/types/fhir"
import { accessLevel, findIdentifier, genderLabel } from "@/lib/fhir"
import { calcAge, cn, formatDate } from "@/lib/utils"
import { Skeleton } from "@/components/ui"

function DataItem({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon
  label: string
  value?: string | null
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-sm">
        <Icon className="size-4.5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("truncate text-sm font-semibold text-foreground", mono && "font-mono")}>
          {value || "—"}
        </p>
      </div>
    </div>
  )
}

export function PatientCard({
  patient,
  restricted = false,
}: {
  patient: FhirPatient
  /** Força a visão anonimizada no cliente, independente do meta.security. */
  restricted?: boolean
}) {
  const access = accessLevel(patient)
  const isFull = access === "FULL" && !restricted

  const displayName = patient.name?.[0]?.text ?? "Paciente sem nome"
  const initials = displayName
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")

  const age = calcAge(patient.birthDate)
  const birthDisplay = isFull
    ? formatDate(patient.birthDate)
    : patient.birthDate // no modo PARTIAL a API já devolve apenas o ano

  return (
    <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Cabeçalho com faixa de cor da marca */}
      <div className="relative bg-primary px-5 pb-5 pt-6 text-primary-foreground sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15 text-xl font-bold ring-2 ring-primary-foreground/20">
            {initials || <User className="size-7" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/70">
              Prontuário do paciente
            </p>
            <h2 className="truncate text-2xl font-bold leading-tight text-balance">{displayName}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-primary-foreground/85">
              <span className="inline-flex items-center gap-1.5 font-mono">
                <IdCard className="size-4" /> {patient.id}
              </span>
              {age !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <Cake className="size-4" /> {age} anos
                </span>
              )}
            </div>
          </div>

          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-semibold",
              isFull
                ? "bg-primary-foreground/15 text-primary-foreground ring-1 ring-primary-foreground/25"
                : "bg-warning/25 text-primary-foreground ring-1 ring-primary-foreground/25",
            )}
          >
            {isFull ? <ShieldCheck className="size-3.5" /> : <ShieldHalf className="size-3.5" />}
            {isFull ? "Acesso completo" : "Dados anonimizados"}
          </span>
        </div>
      </div>

      {/* Dados demográficos */}
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        <DataItem
          icon={CalendarDays}
          label={isFull ? "Data de nascimento" : "Ano de nascimento"}
          value={birthDisplay}
        />
        <DataItem icon={User} label="Sexo" value={genderLabel(patient.gender)} />

        {isFull ? (
          <>
            <DataItem icon={Fingerprint} label="CPF" value={findIdentifier(patient, "CPF")} mono />
            <DataItem icon={IdCard} label="CNS" value={findIdentifier(patient, "CNS")} mono />
          </>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-warning/40 bg-warning/10 p-3 sm:col-span-2 lg:col-span-1">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-warning-foreground shadow-sm">
              <BadgeCheck className="size-4.5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-warning-foreground/80">
                Privacidade
              </p>
              <p className="text-sm font-medium leading-snug text-warning-foreground">
                Dados sensíveis (CPF, CNS, nome completo) ocultados para o seu nível de acesso.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

PatientCard.Skeleton = function PatientCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="bg-primary px-5 pb-5 pt-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="size-16 rounded-2xl bg-primary-foreground/20" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32 bg-primary-foreground/20" />
            <Skeleton className="h-6 w-52 bg-primary-foreground/20" />
            <Skeleton className="h-3 w-40 bg-primary-foreground/20" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
