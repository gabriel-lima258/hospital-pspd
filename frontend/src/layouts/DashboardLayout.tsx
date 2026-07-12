import React, { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeContext"
import {
  LayoutDashboard,
  Users,
  Star,
  History,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  Moon,
  Sun,
  Laptop,
  Timer,
} from "lucide-react"
import { RoleBadge } from "@/components/ui"

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { username, roles, logout, hasRole, secondsRemaining } = useAuth()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isClinician = hasRole("MEDICO") || hasRole("ESTAGIARIO")

  const menuItems = [
    {
      label: isClinician ? "Painel Clínico" : "Central de Pesquisa",
      path: "/",
      icon: LayoutDashboard,
      roles: ["MEDICO", "ESTAGIARIO", "PESQUISADOR"],
    },
    ...(isClinician
      ? [
          {
            label: "Pacientes",
            path: "/patients",
            icon: Users,
            roles: ["MEDICO", "ESTAGIARIO"],
          },
        ]
      : []),
    {
      label: "Favoritos",
      path: "/favorites",
      icon: Star,
      roles: ["MEDICO", "ESTAGIARIO", "PESQUISADOR"],
    },
    {
      label: "Histórico de Buscas",
      path: "/history",
      icon: History,
      roles: ["MEDICO", "ESTAGIARIO", "PESQUISADOR"],
    },
    {
      label: "Perfil",
      path: "/profile",
      icon: User,
      roles: ["MEDICO", "ESTAGIARIO", "PESQUISADOR"],
    },
    {
      label: "Configurações",
      path: "/settings",
      icon: Settings,
      roles: ["MEDICO", "ESTAGIARIO", "PESQUISADOR"],
    },
  ]

  const formatSessionTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const activeMenu = menuItems.find((item) => item.path === location.pathname) ?? menuItems[0]

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight">HOSPITAL</span>
            <span className="text-xs text-muted-foreground block -mt-1 font-semibold">Plataforma PSPD</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/10"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4.5" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer Area */}
        <div className="p-4 border-t border-border space-y-4">
          {/* Sessão Timer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-xl">
            <span className="inline-flex items-center gap-1 font-semibold">
              <Timer className="size-3.5" /> Sessão:
            </span>
            <span className="font-mono font-bold text-foreground">
              {formatSessionTime(secondsRemaining)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 bg-muted p-1 rounded-xl">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 py-1.5 rounded-lg flex justify-center text-muted-foreground hover:text-foreground transition-colors ${
                  theme === t ? "bg-card text-foreground shadow-xs" : ""
                }`}
                title={`Tema ${t}`}
              >
                {t === "light" && <Sun className="size-4" />}
                {t === "dark" && <Moon className="size-4" />}
                {t === "system" && <Laptop className="size-4" />}
              </button>
            ))}
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 px-4 py-2.5 text-sm font-semibold hover:bg-destructive hover:text-destructive-foreground transition-all"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 md:px-8 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-muted-foreground hover:bg-muted"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <h1 className="text-lg font-bold text-foreground md:block hidden">
              {activeMenu?.label}
            </h1>
            <span className="text-sm text-muted-foreground md:hidden font-bold">Hospital PSPD</span>
          </div>

          {/* User profile & quick roles */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-wrap gap-1.5 justify-end">
              {roles.map((role) => (
                <RoleBadge key={role} role={role} size="sm" />
              ))}
            </div>
            <div className="h-8 w-px bg-border hidden sm:block" />
            <div
              className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded-xl transition-colors"
              onClick={() => navigate("/profile")}
            >
              <div className="flex size-8 items-center justify-center rounded-xl bg-accent/20 text-accent font-bold text-sm">
                {username?.substring(0, 2).toUpperCase() || "US"}
              </div>
              <span className="text-sm font-bold text-foreground hidden md:inline">
                {username}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 animate-fade-in-up">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 bg-card border-r border-border flex flex-col h-full z-50 animate-fade-in-up">
            <div className="h-16 flex items-center px-6 border-b border-border justify-between">
              <span className="font-bold text-sm tracking-tight">HOSPITAL PSPD</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-xl text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="size-4.5" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="p-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted p-2.5 rounded-xl">
                <span className="font-semibold">Sessão:</span>
                <span className="font-mono font-bold text-foreground">
                  {formatSessionTime(secondsRemaining)}
                </span>
              </div>
              <button
                onClick={logout}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 px-4 py-2.5 text-sm font-semibold hover:bg-destructive hover:text-destructive-foreground transition-all"
              >
                <LogOut className="size-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
