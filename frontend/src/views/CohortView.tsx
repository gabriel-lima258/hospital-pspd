import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Database,
  FolderKanban,
  Hash,
  Pill,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { fetchCohort, fetchProjects, toApiError, type ApiError } from "@/services/api"
import type { CohortExamRow, CohortResult, ProjectSummary } from "@/types/fhir"
import { useAuth } from "@/context/AuthContext"
import { Alert, Card, CardBody, CardHeader, EmptyState, Skeleton } from "@/components/ui"

const SEARCH_TYPES = ["ResumoCoorte", "ExamesCoorte"] as const
const PAGE_SIZE = 8

function formatGenderLabel(gender?: string) {
  if (!gender) return "—"
  switch (gender) {
    case "female":
    case "F":
      return "Feminino"
    case "male":
    case "M":
      return "Masculino"
    case "other":
      return "Outro"
    default:
      return gender
  }
}

/** Cor do selo de status do projeto (Aprovado × Expirado/Suspenso). */
function statusTone(status: string): string {
  const s = status.toLowerCase()
  if (s.includes("aprov")) return "bg-emerald-500/10 text-emerald-600"
  if (s.includes("expir")) return "bg-red-500/10 text-red-600"
  return "bg-amber-500/10 text-amber-600"
}

function SummaryMetric({ label, value, description }: { label: string; value: string; description?: string }) {
  return (
    <div className="rounded-3xl border border-border bg-background px-4 py-5 shadow-sm shadow-black/5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      {description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
    </div>
  )
}

/** Barras horizontais para distribuições percentuais (setor, medicamentos). */
function ShareBars({ items }: { items: { rotulo: string; percentual: number }[] }) {
  if (items.length === 0) return <p className="px-5 pb-5 text-sm text-muted-foreground">Sem dados.</p>
  return (
    <div className="space-y-4 px-5 pb-5">
      {items.map((item) => (
        <div key={item.rotulo} className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-foreground">
            <span>{item.rotulo}</span>
            <span>{item.percentual}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(item.percentual, 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function CohortView() {
  const { hasRole } = useAuth()
  const isResearcher = hasRole("PESQUISADOR")
  const [projetoId, setProjetoId] = useState("PRJ01")
  const [tipo, setTipo] = useState<(typeof SEARCH_TYPES)[number]>("ResumoCoorte")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [error, setError] = useState<ApiError | null>(null)
  const [result, setResult] = useState<CohortResult | null>(null)
  const [page, setPage] = useState(0)
  const [projects, setProjects] = useState<ProjectSummary[]>([])

  // Lista real de projetos do pesquisador (GET /projects) — enunciado item iv.
  useEffect(() => {
    if (!isResearcher) return
    let alive = true
    fetchProjects()
      .then((p) => { if (alive) setProjects(p) })
      .catch(() => { if (alive) setProjects([]) })
    return () => { alive = false }
  }, [isResearcher])

  const clearResult = useCallback(() => {
    setResult(null)
    setPage(0)
    setError(null)
    setStatus("idle")
  }, [])

  useEffect(() => {
    clearResult()
  }, [tipo, clearResult])

  const loadCohort = useCallback(
    async (project: string) => {
      const trimmed = project.trim().toUpperCase()
      if (!trimmed) return

      setStatus("loading")
      setError(null)
      setResult(null)
      setPage(0)

      try {
        const data = (await fetchCohort(trimmed, tipo)) as CohortResult
        setResult(data)
        setStatus("success")
      } catch (err) {
        setError(toApiError(err))
        setStatus("error")
      }
    },
    [tipo],
  )

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    loadCohort(projetoId)
  }

  const pageCount = useMemo(() => {
    if (result?.tipo !== "ExamesCoorte") return 0
    return Math.max(1, Math.ceil(result.linhas.length / PAGE_SIZE))
  }, [result])

  const currentRows = useMemo(() => {
    if (result?.tipo !== "ExamesCoorte") return [] as CohortExamRow[]
    return result.linhas.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  }, [page, result])

  if (!isResearcher) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">Central de Pesquisa</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Esta seção exibe resumos de coortes e exames anonimizados para estudos clínicos.
          </p>
        </header>
        <Alert
          variant="warning"
          title="Acesso restrito"
          description="Apenas usuários com o perfil Pesquisador podem visualizar a Central de Pesquisa."
          action={
            <p className="text-sm text-muted-foreground">
              Verifique seu papel no sistema ou solicite acesso ao administrador.
            </p>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">Central de Pesquisa</h1>
            <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
              Busque um projeto de coorte e alterne entre visualizações agregadas e exames anonimizados para obter insights clínicos com segurança.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
            <ShieldCheck className="size-5 text-accent" />
            Acesso Pesquisador ativado
          </div>
        </div>
      </header>

      <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_auto]">
          <label className="block">
            <span className="text-sm font-medium text-foreground">ID do Projeto</span>
            <input
              value={projetoId}
              onChange={(event) => setProjetoId(event.target.value)}
              placeholder="PRJ01, PRJ02"
              className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15"
              autoComplete="off"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-foreground">Tipo de Consulta</span>
            <select
              value={tipo}
              onChange={(event) => setTipo(event.target.value as typeof SEARCH_TYPES[number])}
              className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15"
            >
              {SEARCH_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={status === "loading" || !projetoId.trim()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="size-4" />
            Pesquisar
          </button>
        </div>

        {projects.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FolderKanban className="size-4 text-accent" />
              Meus projetos ({projects.length})
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((prj) => (
                <button
                  type="button"
                  key={prj.id}
                  onClick={() => {
                    setProjetoId(prj.id)
                    loadCohort(prj.id)
                  }}
                  className="flex flex-col gap-1 rounded-xl border border-border bg-background p-3 text-left transition hover:border-ring hover:bg-accent/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">{prj.id}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone(prj.status)}`}>
                      {prj.status}
                    </span>
                  </div>
                  <span className="truncate text-sm text-foreground">{prj.titulo}</span>
                  <span className="text-xs text-muted-foreground">
                    {prj.condicao}{prj.validade ? ` · válido até ${prj.validade}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </form>

      {status === "error" && error ? (
        <Alert variant="error" title={error.title} description={error.message} status={error.status} />
      ) : null}

      {status === "loading" ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : null}

      {status === "idle" && !result ? (
        <EmptyState
          icon={Database}
          title="Pesquisa de coorte pronta para iniciar"
          description="Insira um projeto e selecione o tipo de consulta para navegar entre resumos agregados e exames anonimizados."
        />
      ) : null}

      {status === "success" && result ? (
        <div className="space-y-6">
          {result.tipo === "ResumoCoorte" ? (
            <section className="space-y-5">
              <Card>
                <CardHeader>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Projeto</p>
                    <h2 className="text-xl font-semibold text-foreground">{result.nomeProjeto ?? result.projetoId}</h2>
                  </div>
                  <Sparkles className="size-6 text-accent" />
                </CardHeader>
                <CardBody>
                  <div className="grid gap-4 xl:grid-cols-4">
                    <SummaryMetric label="Total de casos" value={result.totalPacientes.toLocaleString()} />
                    <SummaryMetric
                      label="Masculino"
                      value={`${result.distribuicaoGenero.masculino}%`}
                      description="Percentual dentro da coorte"
                    />
                    <SummaryMetric
                      label="Feminino"
                      value={`${result.distribuicaoGenero.feminino}%`}
                      description="Percentual dentro da coorte"
                    />
                    <SummaryMetric
                      label="Outros"
                      value={`${result.distribuicaoGenero.outro ?? 0}%`}
                      description="Percentual dentro da coorte"
                    />
                  </div>
                </CardBody>
              </Card>

              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className="space-y-4">
                  <div className="flex items-center justify-between px-5 pt-5">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Faixas Etárias</p>
                      <h3 className="text-lg font-semibold text-foreground">Distribuição por idade</h3>
                    </div>
                    <BarChart3 className="size-5 text-accent" />
                  </div>
                  <div className="space-y-4 px-5 pb-5">
                    {result.faixasEtarias.map((band) => (
                      <div key={band.faixa} className="space-y-2">
                        <div className="flex items-center justify-between text-sm font-medium text-foreground">
                          <span>{band.faixa}</span>
                          <span>{band.percentual}% ({band.total})</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${band.percentual}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="space-y-4">
                  <div className="flex items-center justify-between px-5 pt-5">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Exames Médios</p>
                      <h3 className="text-lg font-semibold text-foreground">Valores de referência</h3>
                    </div>
                    <Database className="size-5 text-accent" />
                  </div>
                  <div className="grid gap-3 px-5 pb-5">
                    {result.mediasExames.map((exam) => (
                      <div key={exam.exame} className="rounded-3xl border border-border bg-background p-4">
                        <p className="text-sm font-medium text-foreground">{exam.exame}</p>
                        <p className="mt-1 text-2xl font-semibold text-foreground">{exam.media} {exam.unidade}</p>
                        {exam.referencia ? (
                          <p className="mt-2 text-sm text-muted-foreground">Referência: {exam.referencia}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="space-y-4">
                  <div className="flex items-center justify-between px-5 pt-5">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Departamentos mais usados</p>
                      <h3 className="text-lg font-semibold text-foreground">Distribuição por setor</h3>
                    </div>
                    <Database className="size-5 text-accent" />
                  </div>
                  <ShareBars items={result.distribuicaoSetor ?? []} />
                </Card>

                <Card className="space-y-4">
                  <div className="flex items-center justify-between px-5 pt-5">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Frequência de medicamentos</p>
                      <h3 className="text-lg font-semibold text-foreground">Uso na coorte</h3>
                    </div>
                    <Pill className="size-5 text-accent" />
                  </div>
                  <ShareBars items={result.frequenciaMedicamentos ?? []} />
                </Card>
              </div>
            </section>
          ) : (
            <section className="space-y-5">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Projeto</p>
                    <h2 className="text-xl font-semibold text-foreground">{result.nomeProjeto ?? result.projetoId}</h2>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
                    <Hash className="size-4 text-accent" />
                    Entrega anonimizados
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-border bg-card text-sm shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-[680px] w-full divide-y divide-border text-left">
                    <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">ID Anonimizado</th>
                        <th className="px-4 py-3">Faixa etária</th>
                        <th className="px-4 py-3">Gênero</th>
                        {result.colunas.map((column) => (
                          <th key={column.chave} className="px-4 py-3">
                            {column.rotulo}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-background">
                      {currentRows.map((row) => (
                        <tr key={row.hashId} className="hover:bg-muted/60">
                          <td className="px-4 py-3 font-mono text-xs text-foreground">{row.hashId}</td>
                          <td className="px-4 py-3 text-foreground">{row.faixaEtaria ?? "—"}</td>
                          <td className="px-4 py-3 text-foreground">{formatGenderLabel(row.genero)}</td>
                          {result.colunas.map((column) => (
                            <td key={column.chave} className="px-4 py-3 text-foreground">
                              {row.exames[column.chave]} {column.unidade ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-border bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Exibindo {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, result.linhas.length)} de {result.linhas.length} registros.
                  </p>
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(current - 1, 0))}
                      disabled={page === 0}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-3 text-sm text-foreground transition hover:border-ring disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <span className="text-sm font-medium text-foreground">
                      Página {page + 1} de {pageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(current + 1, pageCount - 1))}
                      disabled={page >= pageCount - 1}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-3 text-sm text-foreground transition hover:border-ring disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default CohortView
