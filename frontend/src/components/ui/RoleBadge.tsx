import { GraduationCap, Microscope, Stethoscope } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { ROLE_LABELS, type Role } from "@/services/config"
import { cn } from "@/lib/utils"

const ROLE_CONFIG: Record<Role, { icon: LucideIcon; className: string }> = {
  MEDICO: {
    icon: Stethoscope,
    className: "bg-[--color-role-medico]/12 text-[--color-role-medico] ring-1 ring-[--color-role-medico]/20",
  },
  ESTAGIARIO: {
    icon: GraduationCap,
    className: "bg-[--color-role-estagiario]/12 text-[--color-role-estagiario] ring-1 ring-[--color-role-estagiario]/20",
  },
  PESQUISADOR: {
    icon: Microscope,
    className: "bg-[--color-role-pesquisador]/12 text-[--color-role-pesquisador] ring-1 ring-[--color-role-pesquisador]/20",
  },
}

const KNOWN_ROLES = Object.keys(ROLE_CONFIG) as Role[]

export function RoleBadge({ role, size = "md" }: { role: string; size?: "sm" | "md" }) {
  const config = ROLE_CONFIG[role as Role]

  // Roles desconhecidas (ex.: roles internas do Keycloak) recebem estilo neutro.
  if (!config) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        {role}
      </span>
    )
  }

  const Icon = config.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        config.className,
      )}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden="true" />
      {ROLE_LABELS[role as Role]}
    </span>
  )
}

export { KNOWN_ROLES }
