import { cn } from "@/lib/utils"

/** Bloco base de skeleton loader (usa a animação shimmer definida no CSS). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden="true" />
}
