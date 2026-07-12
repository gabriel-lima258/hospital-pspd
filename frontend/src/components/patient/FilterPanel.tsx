import React, { useState, useEffect } from "react"

export interface FilterValues {
  name: string
  cpf: string
  city: string
  state: string
  gender: string
  minAge: string
  maxAge: string
  department: string
  encounterType: string
  condition: string
  medication: string
  startDate: string
  endDate: string
  status: string
}

interface FilterPanelProps {
  initialFilters: Partial<FilterValues>
  onApply: (filters: FilterValues) => void
  onClear: () => void
}

const emptyFilters: FilterValues = {
  name: "",
  cpf: "",
  city: "",
  state: "",
  gender: "",
  minAge: "",
  maxAge: "",
  department: "",
  encounterType: "",
  condition: "",
  medication: "",
  startDate: "",
  endDate: "",
  status: "",
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  initialFilters,
  onApply,
  onClear,
}) => {
  const [filters, setFilters] = useState<FilterValues>({
    ...emptyFilters,
    ...initialFilters,
  })

  useEffect(() => {
    setFilters({
      ...emptyFilters,
      ...initialFilters,
    })
  }, [initialFilters])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onApply(filters)
  }

  const handleClear = () => {
    setFilters(emptyFilters)
    onClear()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 flex flex-col h-full justify-between pb-8">
      <div className="space-y-4 overflow-y-auto pr-1 flex-1 max-h-[calc(100vh-12rem)] scrollbar-thin">
        {/* Nome */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nome</label>
          <input
            type="text"
            name="name"
            value={filters.name}
            onChange={handleChange}
            placeholder="Nome do paciente"
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
          />
        </div>

        {/* CPF */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">CPF</label>
          <input
            type="text"
            name="cpf"
            value={filters.cpf}
            onChange={handleChange}
            placeholder="000.000.000-00"
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Cidade */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cidade</label>
            <input
              type="text"
              name="city"
              value={filters.city}
              onChange={handleChange}
              placeholder="Brasília"
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>

          {/* Estado */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Estado</label>
            <input
              type="text"
              name="state"
              value={filters.state}
              onChange={handleChange}
              placeholder="DF"
              maxLength={2}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring uppercase"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Sexo */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sexo</label>
            <select
              name="gender"
              value={filters.gender}
              onChange={handleChange}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none"
            >
              <option value="">Todos</option>
              <option value="female">Feminino</option>
              <option value="male">Masculino</option>
              <option value="other">Outro</option>
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleChange}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none"
            >
              <option value="">Todos</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Idade Mínima */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Idade Mínima</label>
            <input
              type="number"
              name="minAge"
              value={filters.minAge}
              onChange={handleChange}
              placeholder="0"
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none"
            />
          </div>

          {/* Idade Máxima */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Idade Máxima</label>
            <input
              type="number"
              name="maxAge"
              value={filters.maxAge}
              onChange={handleChange}
              placeholder="120"
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none"
            />
          </div>
        </div>

        {/* Diagnóstico (Condition) */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Diagnóstico</label>
          <input
            type="text"
            name="condition"
            value={filters.condition}
            onChange={handleChange}
            placeholder="Ex: Diabetes"
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
          />
        </div>

        {/* Medicamento */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Medicamento</label>
          <input
            type="text"
            name="medication"
            value={filters.medication}
            onChange={handleChange}
            placeholder="Ex: Metformina"
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Data Inicial */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Data Inicial</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleChange}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground outline-none"
            />
          </div>

          {/* Data Final */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Data Final</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleChange}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs text-foreground outline-none"
            />
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-4 border-t border-border mt-4 shrink-0 bg-card">
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 h-10 rounded-xl border border-border bg-background text-sm font-semibold text-foreground hover:bg-muted transition-colors focus:outline-none"
        >
          Limpar
        </button>
        <button
          type="submit"
          className="flex-1 h-10 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none"
        >
          Aplicar Filtros
        </button>
      </div>
    </form>
  )
}
export default FilterPanel
