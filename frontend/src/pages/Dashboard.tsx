import React, { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import CohortView from "@/views/CohortView"
import {
  Users,
  CalendarCheck,
  FolderKanban,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  Download,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts"

const COLORS = ["#0284c7", "#0d9488", "#7c3aed", "#e11d48", "#ea580c"]

export const Dashboard: React.FC = () => {
  const { hasRole, username } = useAuth()
  const isClinician = hasRole("MEDICO") || hasRole("ESTAGIARIO")
  const isResearcher = hasRole("PESQUISADOR")

  const [isFullscreen, setIsFullscreen] = useState<string | null>(null)

  // Dados Clínicos Simulados para o Dashboard
  const stats = [
    { label: "Pacientes sob Gestão", value: "10", icon: Users, change: "+12% este mês", color: "text-primary bg-primary/10" },
    { label: "Consultas Hoje", value: "3", icon: CalendarCheck, change: "Próxima às 14:00", color: "text-accent bg-accent/10" },
    { label: "Projetos de Coorte", value: "2", icon: FolderKanban, change: "Vigentes", color: "text-purple-600 bg-purple-600/10" },
    { label: "Exames Anotados", value: "25", icon: FileSpreadsheet, change: "+3 novos exames", color: "text-success bg-success/10" },
  ]

  const ageData = [
    { name: "0-17", pacientes: 1 },
    { name: "18-39", pacientes: 3 },
    { name: "40-59", pacientes: 3 },
    { name: "60+", pacientes: 3 },
  ]

  const genderData = [
    { name: "Feminino", value: 5 },
    { name: "Masculino", value: 5 },
  ]

  const encounterTimelineData = [
    { month: "Jan", consultas: 12 },
    { month: "Fev", consultas: 19 },
    { month: "Mar", consultas: 15 },
    { month: "Abr", consultas: 27 },
    { month: "Mai", consultas: 32 },
    { month: "Jun", consultas: 45 },
  ]

  const labValuesTrend = [
    { week: "Semana 1", glicemia: 120, hba1c: 6.8 },
    { week: "Semana 2", glicemia: 135, hba1c: 7.0 },
    { week: "Semana 3", glicemia: 110, hba1c: 6.5 },
    { week: "Semana 4", glicemia: 145, hba1c: 7.2 },
    { week: "Semana 5", glicemia: 125, hba1c: 6.9 },
  ]

  const specialtyRadarData = [
    { subject: "Cardiologia", A: 120, fullMark: 150 },
    { subject: "Endocrinologia", A: 98, fullMark: 150 },
    { subject: "Nefrologia", A: 86, fullMark: 150 },
    { subject: "Pneumologia", A: 99, fullMark: 150 },
    { subject: "Pediatria", A: 85, fullMark: 150 },
  ]

  const toggleFullscreen = (id: string) => {
    setIsFullscreen((prev) => (prev === id ? null : id))
  }

  // Exportar dados dos gráficos em CSV
  const exportChartData = (data: any[], fileName: string) => {
    const headers = Object.keys(data[0]).join(",")
    const rows = data.map((row) => Object.values(row).join(","))
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `${fileName}.csv`)
    link.click()
  }

  if (isResearcher && !isClinician) {
    return <CohortView />
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Dashboard Hospitalar
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
          Bem-vindo, {username}
        </h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Painel central clínico de atendimento com controle demográfico e estatísticas operacionais.
        </p>
      </header>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <div
              key={i}
              className="rounded-3xl border border-border bg-card p-5 shadow-xs shadow-black/5 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <div className={`flex size-10 items-center justify-center rounded-xl transition-all group-hover:scale-105 ${stat.color}`}>
                  <Icon className="size-5" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{stat.value}</p>
              <p className="mt-2 text-xs text-muted-foreground font-semibold">{stat.change}</p>
            </div>
          )
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Atendimentos Timeline */}
        <div
          className={`rounded-3xl border border-border bg-card p-5 shadow-xs flex flex-col ${
            isFullscreen === "timeline" ? "fixed inset-4 z-50 h-[calc(100vh-2rem)]" : "h-[380px]"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Fluxo de Atendimentos</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Consultas mensais realizadas</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportChartData(encounterTimelineData, "atendimentos-mensais")}
                className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg"
                title="Exportar CSV"
              >
                <Download className="size-4" />
              </button>
              <button
                onClick={() => toggleFullscreen("timeline")}
                className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg"
              >
                {isFullscreen === "timeline" ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={encounterTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorConsultas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="consultas" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorConsultas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Faixa Etária Distribuição */}
        <div
          className={`rounded-3xl border border-border bg-card p-5 shadow-xs flex flex-col ${
            isFullscreen === "age" ? "fixed inset-4 z-50 h-[calc(100vh-2rem)]" : "h-[380px]"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Distribuição por Faixa Etária</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Idade aproximada dos pacientes</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportChartData(ageData, "faixas-etarias")}
                className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg"
                title="Exportar CSV"
              >
                <Download className="size-4" />
              </button>
              <button
                onClick={() => toggleFullscreen("age")}
                className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg"
              >
                {isFullscreen === "age" ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
                <Tooltip />
                <Bar dataKey="pacientes" fill="var(--color-accent)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gênero Distribuição */}
        <div
          className={`rounded-3xl border border-border bg-card p-5 shadow-xs flex flex-col ${
            isFullscreen === "gender" ? "fixed inset-4 z-50 h-[calc(100vh-2rem)]" : "h-[380px]"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Distribuição de Gênero</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Percentual por sexo biológico</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFullscreen("gender")}
                className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg"
              >
                {isFullscreen === "gender" ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {genderData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolução de HbA1c / Glicemia */}
        <div
          className={`rounded-3xl border border-border bg-card p-5 shadow-xs flex flex-col md:col-span-2 ${
            isFullscreen === "lab" ? "fixed inset-4 z-50 h-[calc(100vh-2rem)]" : "h-[380px]"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Tendência de Exames (HbA1c / Glicose)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Acompanhamento glicêmico médio de coorte</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportChartData(labValuesTrend, "evolucao-glicemica")}
                className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg"
                title="Exportar CSV"
              >
                <Download className="size-4" />
              </button>
              <button
                onClick={() => toggleFullscreen("lab")}
                className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg"
              >
                {isFullscreen === "lab" ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={labValuesTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="week" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis yAxisId="left" stroke="var(--color-primary)" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--color-accent)" fontSize={11} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="glicemia" name="Glicemia (mg/dL)" stroke="var(--color-primary)" strokeWidth={2.5} activeDot={{ r: 8 }} />
                <Line yAxisId="right" type="monotone" dataKey="hba1c" name="HbA1c (%)" stroke="var(--color-accent)" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar de Especialidades */}
        <div
          className={`rounded-3xl border border-border bg-card p-5 shadow-xs flex flex-col ${
            isFullscreen === "radar" ? "fixed inset-4 z-50 h-[calc(100vh-2rem)]" : "h-[380px]"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Casos por Especialidade</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Demanda das clínicas especializadas</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFullscreen("radar")}
                className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg"
              >
                {isFullscreen === "radar" ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="90%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={specialtyRadarData}>
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="subject" stroke="var(--color-muted-foreground)" fontSize={10} />
                <PolarRadiusAxis stroke="var(--color-muted-foreground)" fontSize={10} />
                <Radar name="Pacientes" dataKey="A" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
export default Dashboard
