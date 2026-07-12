import React, { useState, useEffect } from "react"
import { Star } from "lucide-react"

interface FavoriteButtonProps {
  id: string
  type: "patients" | "projects" | "cohorts" | "dashboards"
  name: string
  onToggle?: (isFav: boolean) => void
}

export interface FavoriteItem {
  id: string
  type: "patients" | "projects" | "cohorts" | "dashboards"
  name: string
  timestamp: number
}

const STORAGE_KEY = "hospital.favorites"

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  id,
  type,
  name,
  onToggle,
}) => {
  const [isFavorite, setIsFavorite] = useState(false)

  const getFavorites = (): FavoriteItem[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? (JSON.parse(stored) as FavoriteItem[]) : []
    } catch {
      return []
    }
  }

  useEffect(() => {
    const list = getFavorites()
    setIsFavorite(list.some((fav) => fav.id === id && fav.type === type))
  }, [id, type])

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    
    let list = getFavorites()
    const index = list.findIndex((fav) => fav.id === id && fav.type === type)
    let nextState = false

    if (index >= 0) {
      list.splice(index, 1)
    } else {
      const newItem: FavoriteItem = {
        id,
        type,
        name,
        timestamp: Date.now(),
      }
      list.push(newItem)
      nextState = true
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    setIsFavorite(nextState)
    if (onToggle) onToggle(nextState)
  }

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      className={`rounded-xl p-2 transition-all active:scale-90 ${
        isFavorite
          ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    >
      <Star
        className={`size-4.5 transition-transform duration-200 ${
          isFavorite ? "fill-amber-500 scale-110" : ""
        }`}
      />
    </button>
  )
}
