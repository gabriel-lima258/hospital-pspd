import React, { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Star, Trash2, CalendarCheck, Users, FolderKanban } from "lucide-react"
import { useToast } from "@/context/ToastContext"
import { FavoriteItem } from "@/components/ui"

export const Favorites: React.FC = () => {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const toast = useToast()

  const loadFavorites = () => {
    try {
      const stored = localStorage.getItem("hospital.favorites")
      setFavorites(stored ? (JSON.parse(stored) as FavoriteItem[]) : [])
    } catch {
      setFavorites([])
    }
  }

  useEffect(() => {
    loadFavorites()
  }, [])

  const removeFavorite = (id: string, type: string) => {
    const updated = favorites.filter((fav) => !(fav.id === id && fav.type === type))
    localStorage.setItem("hospital.favorites", JSON.stringify(updated))
    setFavorites(updated)
    toast.success("Favorito removido", "O item foi retirado da sua lista de favoritos.")
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "patients":
        return <Users className="size-5 text-primary" />
      case "projects":
        return <FolderKanban className="size-5 text-accent" />
      case "cohorts":
        return <CalendarCheck className="size-5 text-purple-500" />
      default:
        return <Star className="size-5 text-amber-500" />
    }
  }

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "patients":
        return "bg-primary/10 text-primary"
      case "projects":
        return "bg-accent/10 text-accent"
      case "cohorts":
        return "bg-purple-500/10 text-purple-500"
      default:
        return "bg-amber-500/10 text-amber-500"
    }
  }

  const getLink = (item: FavoriteItem) => {
    if (item.type === "patients") {
      return `/patients/${item.id}`
    }
    return "/" // Projetos e dashboards abrem na home/central
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">Meus Favoritos</h2>
        <p className="text-sm text-muted-foreground">
          Acesso rápido para prontuários de pacientes e projetos salvos por você.
        </p>
      </header>

      {favorites.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center max-w-2xl mx-auto mt-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 mb-4">
            <Star className="size-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">Nenhum favorito adicionado</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Ao navegar por prontuários ou dashboards de coortes, clique na estrela para fixá-los nesta página.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {favorites.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="rounded-2xl border border-border bg-card p-4 shadow-xs hover:border-primary/30 transition-all flex items-start gap-3 justify-between group"
            >
              <Link to={getLink(item)} className="flex items-start gap-3 min-w-0 flex-1">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-foreground">
                  {getIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getBadgeColor(item.type)}`}>
                    {item.type === "patients" ? "Paciente" : item.type === "projects" ? "Projeto" : "Coorte"}
                  </span>
                  <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Salvo em {new Date(item.timestamp).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => removeFavorite(item.id, item.type)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Remover favorito"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
export default Favorites
