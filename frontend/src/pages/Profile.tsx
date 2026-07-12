import React, { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeContext"
import { useToast } from "@/context/ToastContext"
import { FHIRViewer } from "@/components/fhir/FHIRViewer"
import {
  Key,
  Shield,
  Clock,
  Mail,
  Calendar,
  LogOut,
  Sliders,
  Camera,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

export const Profile: React.FC = () => {
  const { username, fullName, email, roles, lastLogin, secondsRemaining, tokenClaims, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()

  const [localPhoto, setLocalPhoto] = useState<string | null>(null)

  const formatSessionTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }



  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setLocalPhoto(reader.result as string)
        toast.success("Foto de perfil carregada", "Sua nova foto foi atualizada localmente.")
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile Overview Card */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {/* Avatar Container */}
          <div className="relative group self-center sm:self-auto shrink-0">
            <div className="flex size-24 items-center justify-center rounded-3xl bg-primary/10 text-primary ring-4 ring-primary/20 text-3xl font-bold overflow-hidden">
              {localPhoto ? (
                <img src={localPhoto} alt={fullName} className="w-full h-full object-cover" />
              ) : (
                fullName.substring(0, 2).toUpperCase()
              )}
            </div>
            <label className="absolute -bottom-2 -right-2 bg-accent text-accent-foreground p-2 rounded-xl cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-md">
              <Camera className="size-4" />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>

          {/* User Meta */}
          <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-bold text-foreground">{fullName}</h2>
              {roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary"
                >
                  {role}
                </span>
              ))}
            </div>
            <p className="text-sm text-muted-foreground font-mono">{username}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-y-1 gap-x-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3.5" /> {email}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" /> Último login: {lastLogin || "Hoje"}
              </span>
            </div>
          </div>

          {/* Quick theme toggles / settings */}
          <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={() => navigate("/settings")}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <Sliders className="size-4" />
              Preferências
            </button>
            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 px-4 py-2.5 text-sm font-semibold hover:bg-destructive hover:text-destructive-foreground transition-all"
            >
              <LogOut className="size-4" />
              Sair
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Session details */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-xs lg:col-span-1 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground">Status da Sessão</h3>
            
            <div className="space-y-3">
              <div className="bg-muted/50 p-3 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3.5" /> Tempo Restante:
                </span>
                <span className="text-sm font-mono font-bold text-primary">
                  {formatSessionTime(secondsRemaining)}
                </span>
              </div>

              <div className="bg-muted/50 p-3 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Shield className="size-3.5" /> Nível de Acesso:
                </span>
                <span className="text-xs font-bold text-foreground">
                  {roles.includes("MEDICO") ? "FULL ACCESS" : "PARTIAL MASKED"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">Alternar tema rápido:</p>
            <div className="flex items-center gap-2 bg-muted p-1 rounded-xl">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 py-1.5 rounded-lg flex justify-center text-xs font-semibold transition-all text-muted-foreground hover:text-foreground ${
                    theme === t ? "bg-card text-foreground shadow-xs" : ""
                  }`}
                >
                  {t === "light" && "Claro"}
                  {t === "dark" && "Escuro"}
                  {t === "system" && "Sistema"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Token Information & Claims Viewer */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-xs lg:col-span-2 space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Key className="size-4.5 text-accent" />
              Token JWT & Claims OIDC
            </h3>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-md font-mono text-muted-foreground select-all">
              HS256 / PKCE
            </span>
          </div>

          <div className="flex-1 min-h-[300px]">
            <FHIRViewer resource={tokenClaims} title="JWT Decodificado" />
          </div>
        </div>
      </div>
    </div>
  )
}
export default Profile
