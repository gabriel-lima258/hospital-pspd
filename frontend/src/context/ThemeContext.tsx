import React, { createContext, useContext, useEffect, useState } from "react"

export type Theme = "light" | "dark" | "system"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "light" | "dark"
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem("hospital.theme") as Theme) || "system"
  })

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem("hospital.theme", newTheme)
  }

  useEffect(() => {
    const root = window.document.documentElement
    
    const applyTheme = () => {
      let activeTheme: "light" | "dark" = "light"
      
      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
        activeTheme = systemTheme
      } else {
        activeTheme = theme
      }

      root.classList.remove("light", "dark")
      root.classList.add(activeTheme)
      setResolvedTheme(activeTheme)
    }

    applyTheme()

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const listener = () => applyTheme()
      mediaQuery.addEventListener("change", listener)
      return () => mediaQuery.removeEventListener("change", listener)
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within a ThemeProvider")
  return context
}
