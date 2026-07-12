import type { ReactNode } from "react"
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Info,
  SearchX,
  WifiOff,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Variant = "error" | "warning" | "info" | "success"

interface AlertProps {
  variant?: Variant
  title: string
  /** Texto descritivo curto. Alternativa a `children`. */
  description?: ReactNode
  children?: ReactNode
  /** Código HTTP opcional, escolhe automaticamente um ícone adequado. */
  status?: number
  className?: string
  action?: ReactNode
}

const VARIANT_STYLES: Record<Variant, string> = {
  error: "border-destructive/25 bg-destructive/8 text-destructive",
  warning: "border-warning/40 bg-warning/12 text-warning-foreground",
  info: "border-primary/20 bg-primary/8 text-primary",
  success: "border-success/25 bg-success/10 text-success",
}

const ICON_WRAP: Record<Variant, string> = {
  error: "bg-destructive/12 text-destructive",
  warning: "bg-warning/25 text-warning-foreground",
  info: "bg-primary/12 text-primary",
  success: "bg-success/15 text-success",
}

function pickIcon(variant: Variant, status?: number) {
  if (status === 403) return Ban
  if (status === 404) return SearchX
  if (status === 0) return WifiOff
  switch (variant) {
    case "error":
      return XCircle
    case "warning":
      return AlertTriangle
    case "success":
      return CheckCircle2
    default:
      return Info
  }
}

export function Alert({
  variant = "error",
  title,
  description,
  children,
  status,
  className,
  action,
}: AlertProps) {
  const Icon = pickIcon(variant, status)
  const body = children ?? description
  return (
    <div
      role="alert"
      className={cn(
        "animate-fade-in-up flex items-start gap-3 rounded-xl border p-4",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", ICON_WRAP[variant])}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold leading-tight">{title}</p>
          {status ? (
            <span className="rounded-md bg-current/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums opacity-80">
              HTTP {status}
            </span>
          ) : null}
        </div>
        {body ? <p className="mt-1 text-sm leading-relaxed opacity-90">{body}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  )
}
