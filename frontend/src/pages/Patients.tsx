import React, { useState, useEffect, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { useToast } from "@/context/ToastContext"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { fetchPatients, toApiError, ApiError } from "@/services/api"
import { findIdentifier, genderLabel, accessLevel } from "@/lib/fhir"
import { calcAge } from "@/lib/utils"
import { DataTable, Column, Drawer, ExportButton, FavoriteButton } from "@/components/ui"
import { FilterPanel, FilterValues } from "@/components/patient"
import { recordSearch } from "@/utils/history"
import { UserSettings } from "./Settings"
import {
  Search,
  SlidersHorizontal,
  Loader2,
  AlertTriangle,
  Eye,
  RefreshCw,
} from "lucide-react"

export const Patients: React.FC = () => {
  const { roles, username } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  

  const [page, setPage] = useState(0)
  const [sortColumn, setSortColumn] = useState<string>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  

  const [isFilterOpen, setIsFilterOpen] = useState(false)


  const [settings] = useLocalStorage<UserSettings>("hospital.settings", {
    language: "pt",
    tableDensity: "normal",
    rowsPerPage: 8,
    showAnimations: true,
    rememberFilters: true,
    expandedFhirJson: false,
    notifications: true,
  })


  const activeFilters = useMemo(() => {
    const filters: Partial<FilterValues> = {}
    searchParams.forEach((value, key) => {
      (filters as any)[key] = value
    })
    return filters
  }, [searchParams])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const bundle = await fetchPatients(roles)
      const parsed = (bundle?.entry ?? []).map((entry: any) => {
        const p = entry.resource
        const cpf = findIdentifier(p, "CPF")
        const cns = findIdentifier(p, "CNS")
        const name = p.name?.[0]?.text ?? "Sem nome"
        const age = calcAge(p.birthDate)
        const city = p.address?.[0]?.city ?? "Brasília"
        const state = p.address?.[0]?.state ?? "DF"
        const access = accessLevel(p)
        
        return {
          id: p.id,
          name,
          cpf,
          cns,
          gender: p.gender,
          birthDate: p.birthDate,
          age,
          city,
          state,
          access,

          lastEncounter: "10/06/2026",
          physician: "Dr. Paulo Nunes",
          status: "active",
        }
      })
      setPatients(parsed)
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [roles])


  const filteredPatients = useMemo(() => {
    let result = [...patients]


    const query = activeFilters.name?.toLowerCase() || ""
    if (query) {
      result = result.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(query) ||
          (p.id || "").toLowerCase().includes(query) ||
          (p.cpf || "").includes(query)
      )
    }


    if (activeFilters.city) {
      const val = activeFilters.city.toLowerCase()
      result = result.filter((p) => (p.city || "").toLowerCase().includes(val))
    }
    if (activeFilters.state) {
      const val = activeFilters.state.toLowerCase()
      result = result.filter((p) => (p.state || "").toLowerCase() === val)
    }
    if (activeFilters.gender) {
      result = result.filter((p) => p.gender === activeFilters.gender)
    }
    if (activeFilters.minAge) {
      result = result.filter((p) => p.age !== null && p.age >= Number(activeFilters.minAge))
    }
    if (activeFilters.maxAge) {
      result = result.filter((p) => p.age !== null && p.age <= Number(activeFilters.maxAge))
    }
    if (activeFilters.cpf) {
      result = result.filter((p) => (p.cpf || "").includes(activeFilters.cpf!))
    }
    if (activeFilters.status) {
      result = result.filter((p) => p.status === activeFilters.status)
    }
    if (activeFilters.condition) {
      const val = activeFilters.condition.toLowerCase()
      result = result.filter((p) => (p.condition || "").toLowerCase().includes(val))
    }
    if (activeFilters.medication) {
      const val = activeFilters.medication.toLowerCase()
      result = result.filter((p) => (p.medication || "").toLowerCase().includes(val))
    }
    if (activeFilters.startDate) {
      result = result.filter((p) => (p.lastEncounter || "") >= activeFilters.startDate!)
    }
    if (activeFilters.endDate) {
      result = result.filter((p) => (p.lastEncounter || "") <= activeFilters.endDate!)
    }


    result.sort((a, b) => {
      let aVal = a[sortColumn]
      let bVal = b[sortColumn]
      
      if (typeof aVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      } else {
        aVal = aVal ?? 0
        bVal = bVal ?? 0
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal
      }
    })

    return result
  }, [patients, activeFilters, sortColumn, sortDirection])


  const pageCount = Math.ceil(filteredPatients.length / settings.rowsPerPage)
  const paginatedPatients = useMemo(() => {
    const start = page * settings.rowsPerPage
    return filteredPatients.slice(start, start + settings.rowsPerPage)
  }, [filteredPatients, page, settings.rowsPerPage])

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(columnKey)
      setSortDirection("asc")
    }
  }


  const handleApplyFilters = (filters: FilterValues) => {
    const params: Record<string, string> = {}
    Object.keys(filters).forEach((key) => {
      const val = (filters as any)[key]
      if (val) params[key] = val
    })
    setSearchParams(params)
    setIsFilterOpen(false)
    setPage(0)


    const activeQuery = filters.name || filters.cpf || filters.city || filters.condition || "Filtros múltiplos"
    recordSearch(activeQuery, "Pacientes", username)
    toast.info("Filtros aplicados", "Os filtros foram aplicados com sucesso na sua busca atual.")
  }

  const handleClearFilters = () => {
    setSearchParams({})
    setPage(0)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val) {
      setSearchParams({ name: val })
    } else {
      setSearchParams({})
    }
    setPage(0)
  }

  const handleSearchBlur = () => {
    const query = activeFilters.name || ""
    if (query.trim()) {
      recordSearch(query, "Pacientes", username)
    }
  }



  const columns: Column<any>[] = [
    {
      key: "id",
      label: "Prontuário",
      sortable: true,
      render: (row) => <span className="font-mono font-bold text-xs">{row.id}</span>,
    },
    {
      key: "name",
      label: "Nome",
      sortable: true,
      render: (row) => (
        <span className="font-semibold text-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => navigate(`/patients/${row.id}`)}>
          {row.name}
        </span>
      ),
    },
    {
      key: "cpf",
      label: "CPF",
      sortable: true,
      render: (row) => <span className="font-mono text-xs">{row.cpf ?? "— (Oculto)"}</span>,
    },
    {
      key: "gender",
      label: "Sexo",
      sortable: true,
      render: (row) => <span>{genderLabel(row.gender)}</span>,
    },
    {
      key: "age",
      label: "Idade",
      sortable: true,
      render: (row) => <span>{row.age !== null ? `${row.age} anos` : "—"}</span>,
    },
    {
      key: "city",
      label: "Cidade",
      sortable: true,
      render: (row) => <span>{row.city} ({row.state})</span>,
    },
    {
      key: "lastEncounter",
      label: "Último Atendimento",
      sortable: true,
    },
    {
      key: "physician",
      label: "Profissional",
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
          row.status === "active" ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"
        }`}>
          {row.status === "active" ? "Ativo" : "Inativo"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Ações",
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/patients/${row.id}`)}
            className="rounded-lg p-1.5 hover:bg-muted text-primary"
            title="Abrir prontuário"
          >
            <Eye className="size-4" />
          </button>
          <FavoriteButton id={row.id} type="patients" name={row.name} />
        </div>
      ),
    },
  ]

  const exportColumns = [
    { key: "id", label: "ID" },
    { key: "name", label: "Nome" },
    { key: "cpf", label: "CPF" },
    { key: "gender", label: "Sexo" },
    { key: "age", label: "Idade" },
    { key: "city", label: "Cidade" },
    { key: "state", label: "Estado" },
    { key: "lastEncounter", label: "Ultimo Atendimento" },
    { key: "physician", label: "Medico Responsavel" },
    { key: "status", label: "Status" },
  ]

  return (
    <div className="space-y-6">
      {/* Header buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <header className="space-y-1">
          <h2 className="text-xl font-bold text-foreground">Lista de Pacientes</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe a lista de prontuários sob sua gerência. Filtre, ordene e extraia relatórios em múltiplos formatos.
          </p>
        </header>

        <div className="flex items-center gap-2">
          <ExportButton data={filteredPatients} columns={exportColumns} filename="lista-pacientes-hospital" title="Ficha de Pacientes sob Responsabilidade" />
        </div>
      </div>

      {/* Search and Filters tools */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={activeFilters.name || ""}
            onChange={handleSearchChange}
            onBlur={handleSearchBlur}
            placeholder="Pesquisar por nome, prontuário ou documento..."
            className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15 shadow-xs"
          />
        </div>
        <button
          onClick={() => setIsFilterOpen(true)}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted transition-colors ${
            Object.keys(activeFilters).length > 1 ? "bg-primary/5 text-primary border-primary/30" : "bg-card text-foreground"
          }`}
        >
          <SlidersHorizontal className="size-4.5" />
          Filtros Avançados
          {Object.keys(activeFilters).length > (activeFilters.name ? 1 : 0) && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground leading-none">
              {Object.keys(activeFilters).length - (activeFilters.name ? 1 : 0)}
            </span>
          )}
        </button>
        {Object.keys(activeFilters).length > 0 && (
          <button
            onClick={handleClearFilters}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-dashed border-border bg-background px-4 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* Table view */}
      {loading ? (
        <div className="flex h-64 items-center justify-center gap-2 bg-card rounded-2xl border border-border">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-sm font-semibold text-muted-foreground">Carregando base de pacientes...</span>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-destructive/20 bg-destructive/10 p-5 flex flex-col gap-4 text-center max-w-lg mx-auto">
          <AlertTriangle className="size-10 text-destructive mx-auto" />
          <div>
            <h3 className="font-bold text-foreground">{error.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
          </div>
          <button onClick={loadData} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
            <RefreshCw className="size-4" /> Tentar novamente
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <DataTable
            columns={columns}
            data={paginatedPatients}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            density={settings.tableDensity}
            emptyTitle="Nenhum paciente localizado"
            emptyDescription="Experimente ajustar os filtros ou pesquisar termos diferentes."
          />

          {/* Pagination bar */}
          {pageCount > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground">
                Exibindo {page * settings.rowsPerPage + 1}–{Math.min((page + 1) * settings.rowsPerPage, filteredPatients.length)} de {filteredPatients.length} pacientes.
              </p>
              <div className="inline-flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  disabled={page === 0}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-xs font-bold text-foreground">
                  Página {page + 1} de {pageCount}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, pageCount - 1))}
                  disabled={page >= pageCount - 1}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Advanced Filters Drawer */}
      <Drawer isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} title="Filtros Avançados" size="md">
        <FilterPanel initialFilters={activeFilters} onApply={handleApplyFilters} onClear={handleClearFilters} />
      </Drawer>
    </div>
  )
}
export default Patients
