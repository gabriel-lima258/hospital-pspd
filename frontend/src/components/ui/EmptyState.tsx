import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  children?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-card text-muted-foreground shadow-sm">
        <Icon className="size-7" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground text-balance">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  )
}
