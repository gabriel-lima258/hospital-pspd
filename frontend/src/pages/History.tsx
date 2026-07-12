import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Trash2, ArrowUpRight, History as HistoryIcon } from "lucide-react"
import { useToast } from "@/context/ToastContext"
import { ConfirmDialog } from "@/components/ui"
import { getSearchHistory, removeHistoryItem, clearSearchHistory, HistoryItem } from "@/utils/history"
import { useAuth } from "@/context/AuthContext"

export const History: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>()
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const { username } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const loadHistory = () => {
    // Filtra histórico pelo usuário logado
    const all = getSearchHistory()
    setHistory(all.filter((item) => item.username === username))
  }

  useEffect(() => {
    loadHistory()
  }, [username])

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeHistoryItem(id)
    loadHistory()
    toast.success("Busca removida", "O registro de busca foi excluído do histórico.")
  }

  const handleClearAll = () => {
    clearSearchHistory()
    loadHistory()
    toast.success("Histórico limpo", "Todos os registros de busca foram removidos.")
  }

  const handleReexecute = (item: HistoryItem) => {
    if (item.screen === "Pacientes") {
      navigate(`/patients?search=${encodeURIComponent(item.query)}`)
    } else {
      navigate(`/`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <header className="space-y-1">
          <h2 className="text-xl font-bold text-foreground">Histórico de Buscas</h2>
          <p className="text-sm text-muted-foreground">
            Visualize as pesquisas efetuadas e clique em qualquer registro para reexecutá-las instantaneamente.
          </p>
        </header>

        {history && history.length > 0 && (
          <button
            onClick={() => setConfirmClearOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-4 text-sm font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all"
          >
            <Trash2 className="size-4" />
            Limpar Histórico
          </button>
        )}
      </div>

      {!history || history.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center max-w-2xl mx-auto mt-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
            <HistoryIcon className="size-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">Nenhuma busca recente</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Suas pesquisas na listagem de pacientes serão catalogadas de forma automatizada e segura aqui.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs divide-y divide-border">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={() => handleReexecute(item)}
              className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Search className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                    {item.query}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold">
                      {item.screen}
                    </span>
                    <span>•</span>
                    <span>{new Date(item.timestamp).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-0.5 text-primary">
                  Reexecutar <ArrowUpRight className="size-3" />
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDeleteItem(item.id, e)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={handleClearAll}
        title="Limpar Histórico de Buscas"
        message="Tem certeza que deseja apagar permanentemente todas as suas consultas de busca recentes? Esta ação não pode ser desfeita."
      />
    </div>
  )
}
export default History
