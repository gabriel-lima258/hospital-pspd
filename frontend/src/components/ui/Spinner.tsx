import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SpinnerProps {
  className?: string
  label?: string
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className={cn("size-5 animate-spin", className)} aria-hidden="true" />
      {label && <span className="text-sm font-medium">{label}</span>}
      <span className="sr-only">Carregando</span>
    </div>
  )
}
