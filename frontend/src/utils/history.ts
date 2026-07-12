export interface HistoryItem {
  id: string
  query: string
  timestamp: number
  screen: string
  username: string
}

const STORAGE_KEY = "hospital.search.history"

export function getSearchHistory(): HistoryItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as HistoryItem[]) : []
  } catch {
    return []
  }
}

export function recordSearch(query: string, screen: string, username: string) {
  if (!query.trim()) return

  try {
    const history = getSearchHistory()
    // Remove duplicatas próximas
    const filtered = history.filter(
      (item) => !(item.query.toLowerCase() === query.toLowerCase() && item.screen === screen)
    )

    const newItem: HistoryItem = {
      id: Math.random().toString(36).substring(2, 9),
      query: query.trim(),
      timestamp: Date.now(),
      screen,
      username,
    }

    // Mantém no máximo 50 registros no histórico
    const updated = [newItem, ...filtered].slice(0, 50)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    console.warn("Erro ao gravar histórico de buscas:", error)
  }
}

export function removeHistoryItem(id: string) {
  try {
    const history = getSearchHistory()
    const updated = history.filter((item) => item.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    console.warn("Erro ao remover item do histórico:", error)
  }
}

export function clearSearchHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn("Erro ao limpar histórico:", error)
  }
}
