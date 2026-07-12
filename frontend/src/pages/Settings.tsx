import React, { useEffect } from "react"
import { useTheme } from "@/context/ThemeContext"
import { useToast } from "@/context/ToastContext"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import {
  Palette,
  Globe,
  LayoutGrid,
  Zap,
  Filter,
  FileJson,
  Bell,
  Check,
} from "lucide-react"

export interface UserSettings {
  language: "pt" | "en"
  tableDensity: "compact" | "normal" | "spacious"
  rowsPerPage: number
  showAnimations: boolean
  rememberFilters: boolean
  expandedFhirJson: boolean
  notifications: boolean
}

const DEFAULT_SETTINGS: UserSettings = {
  language: "pt",
  tableDensity: "normal",
  rowsPerPage: 8,
  showAnimations: true,
  rememberFilters: true,
  expandedFhirJson: false,
  notifications: true,
}

export const Settings: React.FC = () => {
  const { theme, setTheme } = useTheme()
  const toast = useToast()
  const [settings, setSettings] = useLocalStorage<UserSettings>("hospital.settings", DEFAULT_SETTINGS)

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  // Monitora alterações de animações para injetar a classe no documentElement
  useEffect(() => {
    const root = window.document.documentElement
    if (settings.showAnimations) {
      root.classList.remove("no-animations")
    } else {
      root.classList.add("no-animations")
    }
  }, [settings.showAnimations])

  const handleSave = () => {
    toast.success("Configurações salvas", "Suas preferências de exibição foram aplicadas com sucesso!")
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">Preferências do Sistema</h2>
        <p className="text-sm text-muted-foreground">
          Personalize as interfaces, a densidade visual e o comportamento do prontuário eletrônico.
        </p>
      </header>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Aparência e Tema */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Palette className="size-4.5 text-primary" />
            Tema & Aparência
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                  theme === t
                    ? "border-primary bg-primary/5 text-primary font-bold"
                    : "border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-sm capitalize font-bold">{t === "system" ? "Automático (Sistema)" : t === "light" ? "Tema Claro" : "Tema Escuro"}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Layout e Tabelas */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <LayoutGrid className="size-4.5 text-accent" />
            Layout das Tabelas
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Densidade */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Densidade Visual</label>
              <div className="flex gap-2 bg-muted p-1 rounded-xl">
                {(["compact", "normal", "spacious"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => updateSetting("tableDensity", d)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      settings.tableDensity === d
                        ? "bg-card text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d === "compact" ? "Compacta" : d === "normal" ? "Normal" : "Espaçosa"}
                  </button>
                ))}
              </div>
            </div>

            {/* Linhas por página */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Linhas por Página</label>
              <select
                value={settings.rowsPerPage}
                onChange={(e) => updateSetting("rowsPerPage", Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring"
              >
                {[5, 8, 10, 20, 50].map((num) => (
                  <option key={num} value={num}>
                    {num} registros
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Acessibilidade e Idioma */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Globe className="size-4.5 text-purple-600" />
            Idioma & Notificações
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Idioma Principal</label>
              <select
                value={settings.language}
                onChange={(e) => updateSetting("language", e.target.value as "pt" | "en")}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none"
              >
                <option value="pt">Português (Brasil)</option>
                <option value="en">English (US)</option>
              </select>
            </div>

            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-2xl">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Bell className="size-4" /> Notificações de Alerta
                </p>
                <p className="text-xs text-muted-foreground">Exibir balões de aviso do sistema</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => updateSetting("notifications", e.target.checked)}
                className="size-4 rounded border-input text-primary focus:ring-ring"
              />
            </div>
          </div>
        </section>

        {/* Comportamento e Navegação */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Zap className="size-4.5 text-success" />
            Performance & Comportamento
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-2xl">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Zap className="size-3.5" /> Animações
                </p>
                <p className="text-[10px] text-muted-foreground">Efeitos de transição</p>
              </div>
              <input
                type="checkbox"
                checked={settings.showAnimations}
                onChange={(e) => updateSetting("showAnimations", e.target.checked)}
                className="size-4"
              />
            </div>

            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-2xl">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Filter className="size-3.5" /> Lembrar Filtros
                </p>
                <p className="text-[10px] text-muted-foreground">Manter histórico ativo</p>
              </div>
              <input
                type="checkbox"
                checked={settings.rememberFilters}
                onChange={(e) => updateSetting("rememberFilters", e.target.checked)}
                className="size-4"
              />
            </div>

            <div className="flex items-center justify-between bg-muted/30 p-3 rounded-2xl">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground flex items-center gap-1">
                  <FileJson className="size-3.5" /> FHIR Expandido
                </p>
                <p className="text-[10px] text-muted-foreground">JSON aberto por padrão</p>
              </div>
              <input
                type="checkbox"
                checked={settings.expandedFhirJson}
                onChange={(e) => updateSetting("expandedFhirJson", e.target.checked)}
                className="size-4"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Check className="size-4" />
          Salvar Configurações
        </button>
      </div>
    </div>
  )
}
export default Settings
