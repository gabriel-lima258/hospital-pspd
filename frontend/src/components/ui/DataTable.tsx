import React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  sortColumn?: string
  sortDirection?: "asc" | "desc"
  onSort?: (columnKey: string) => void
  density?: "compact" | "normal" | "spacious"
  emptyTitle?: string
  emptyDescription?: string
  isLoading?: boolean
}

export function DataTable<T extends { id?: string | number; hashId?: string }>({
  columns,
  data,
  sortColumn,
  sortDirection,
  onSort,
  density = "normal",
  emptyTitle = "Nenhum registro encontrado",
  emptyDescription = "Não há dados cadastrados nesta consulta.",
  isLoading = false,
}: DataTableProps<T>) {
  const paddingClasses = {
    compact: "px-3 py-1.5 text-xs",
    normal: "px-4 py-3 text-sm",
    spacious: "px-5 py-4 text-base",
  }

  const renderSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) return null
    return sortDirection === "asc" ? (
      <ChevronUp className="size-4 text-primary shrink-0" />
    ) : (
      <ChevronDown className="size-4 text-primary shrink-0" />
    )
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/65">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${paddingClasses[density]} font-bold text-muted-foreground uppercase tracking-wider select-none`}
                >
                  {col.sortable && onSort ? (
                    <button
                      onClick={() => onSort(col.key)}
                      className="flex items-center gap-1 hover:text-foreground transition-colors outline-hidden font-bold"
                    >
                      {col.label}
                      {renderSortIcon(col.key)}
                    </button>
                  ) : (
                    <span>{col.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/30">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={col.key} className={paddingClasses[density]}>
                      <div className="h-4 bg-muted rounded-md w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
                  <p className="text-xs text-muted-foreground mt-1">{emptyDescription}</p>
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const key = row.id ?? row.hashId ?? idx
                return (
                  <tr
                    key={key}
                    className="hover:bg-muted/40 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={`${paddingClasses[density]} text-foreground leading-normal`}>
                        {col.render ? col.render(row) : (row as any)[col.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
