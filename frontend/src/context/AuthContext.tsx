import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import keycloak from "@/services/keycloak"
import { IS_DEMO, type Role } from "@/services/config"
import { Activity, Loader2 } from "lucide-react"

interface AuthContextType {
  isAuthenticated: boolean
  token: string | undefined
  roles: string[]
  username: string
  fullName: string
  email: string
  lastLogin: string
  isDemo: boolean
  secondsRemaining: number
  tokenClaims: Record<string, any>
  login: () => void
  logout: () => void
  refreshToken: () => Promise<boolean>
  hasRole: (role: string) => boolean
  /** Disponível apenas no modo demonstração. */
  setDemoRoles?: (roles: Role[]) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEMO_ROLES_KEY = "hospital.demo.roles"
const LAST_LOGIN_KEY = "hospital.last.login"

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [roles, setRoles] = useState<string[]>([])
  const [username, setUsername] = useState("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [lastLogin, setLastLogin] = useState("")
  const [isInitializing, setIsInitializing] = useState(true)
  const [secondsRemaining, setSecondsRemaining] = useState(3600) // 1 hora padrão
  const [tokenClaims, setTokenClaims] = useState<Record<string, any>>({})
  const [token, setToken] = useState<string | undefined>(undefined)
  const initializationRef = useRef(false)

  // Atualiza o tempo restante da sessão
  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      if (IS_DEMO) {
        setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0))
      } else {
        const exp = keycloak.tokenParsed?.exp
        if (exp) {
          const now = Math.floor(Date.now() / 1000)
          const remaining = exp - now
          setSecondsRemaining(remaining > 0 ? remaining : 0)
          
          // Deslogar automaticamente se expirar
          if (remaining <= 0) {
            keycloak.logout()
          }
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isAuthenticated])

  useEffect(() => {
    if (initializationRef.current) return
    initializationRef.current = true

    // Registra a data/hora do último login
    if (!localStorage.getItem(LAST_LOGIN_KEY)) {
      localStorage.setItem(LAST_LOGIN_KEY, new Date().toLocaleString("pt-BR"))
    }
    setLastLogin(localStorage.getItem(LAST_LOGIN_KEY) || "")

    // ----- Modo demonstração (sem backend/Keycloak) -----
    if (IS_DEMO) {
      const stored = localStorage.getItem(DEMO_ROLES_KEY)
      const initialRoles: Role[] = stored ? (JSON.parse(stored) as Role[]) : ["MEDICO"]
      
      setIsAuthenticated(true)
      setRoles(initialRoles)
      setUsername("dra_ana_ribeiro")
      setFullName("Dra. Ana Ribeiro")
      setEmail("ana.ribeiro@hospital.gov.br")
      setToken("demo-token-jwt-mocked-claims-data")
      
      //Claims simulados para o visualizador do perfil
      setTokenClaims({
        sub: "12345678-abcd-ef01-2345-6789abcdef01",
        email_verified: true,
        name: "Dra. Ana Ribeiro",
        preferred_username: "dra_ana_ribeiro",
        given_name: "Ana",
        family_name: "Ribeiro",
        email: "ana.ribeiro@hospital.gov.br",
        realm_access: {
          roles: initialRoles,
        },
        resource_access: {
          account: {
            roles: ["manage-account", "view-profile"],
          },
        },
        scope: "openid email profile",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      })
      setSecondsRemaining(3600)
      setIsInitializing(false)
      return
    }

    // ----- Fluxo real Keycloak (OAuth2 / OIDC) -----
    const initKeycloak = async () => {
      try {
        const authenticated = await keycloak.init({
          onLoad: "login-required", // Redireciona para o login caso não autenticado
          pkceMethod: "S256",
          // Desliga o iframe de checagem de sessão (usa cookie de 3º-party, bloqueado por browsers
          // modernos → "Timeout when waiting for 3rd party check iframe message"). A expiração do
          // token já é controlada localmente (setInterval sobre tokenParsed.exp) + updateToken.
          checkLoginIframe: false,
        })

        setIsAuthenticated(authenticated)

        if (authenticated) {
          setToken(keycloak.token)
          const realmRoles = keycloak.realmAccess?.roles ?? []
          setRoles(realmRoles)

          const profile = keycloak.tokenParsed as any
          setTokenClaims(profile ?? {})
          setUsername(profile?.preferred_username ?? "usuario")
          setFullName(profile?.name ?? profile?.preferred_username ?? "Usuário")
          setEmail(profile?.email ?? "sem-email@hospital.gov.br")
          
          const exp = profile?.exp
          if (exp) {
            setSecondsRemaining(exp - Math.floor(Date.now() / 1000))
          }
        }
      } catch (error) {
        console.error("Falha ao inicializar o Keycloak", error)
      } finally {
        setIsInitializing(false)
      }
    }

    initKeycloak()
  }, [])

  const login = useCallback(() => {
    if (!IS_DEMO) keycloak.login()
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(LAST_LOGIN_KEY)
    if (IS_DEMO) {
      localStorage.removeItem(DEMO_ROLES_KEY)
      window.location.reload()
      return
    }
    keycloak.logout()
  }, [])

  const refreshToken = useCallback(async () => {
    if (IS_DEMO) {
      setSecondsRemaining(3600)
      return true
    }
    try {
      const refreshed = await keycloak.updateToken(5)
      if (refreshed) {
        setToken(keycloak.token)
        setTokenClaims(keycloak.tokenParsed ?? {})
      }
      return refreshed
    } catch (error) {
      console.error("Falha ao renovar token do Keycloak", error)
      return false
    }
  }, [])

  const hasRole = useCallback((role: string) => roles.includes(role), [roles])

  const setDemoRoles = useCallback((next: Role[]) => {
    setRoles(next)
    localStorage.setItem(DEMO_ROLES_KEY, JSON.stringify(next))
    
    // Atualiza as claims do token simulado ao trocar papéis na UI
    setTokenClaims((prev) => ({
      ...prev,
      realm_access: {
        roles: next,
      },
    }))
  }, [])

  const value = useMemo<AuthContextType>(
    () => ({
      isAuthenticated,
      token,
      roles,
      username,
      fullName,
      email,
      lastLogin,
      isDemo: IS_DEMO,
      secondsRemaining,
      tokenClaims,
      login,
      logout,
      refreshToken,
      hasRole,
      ...(IS_DEMO ? { setDemoRoles } : {}),
    }),
    [
      isAuthenticated,
      token,
      roles,
      username,
      fullName,
      email,
      lastLogin,
      secondsRemaining,
      tokenClaims,
      login,
      logout,
      refreshToken,
      hasRole,
      setDemoRoles,
    ]
  )

  if (isInitializing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="relative">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Activity className="size-8 stroke-[2.5]" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm font-medium">Iniciando sessão de autenticação...</span>
        </div>
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider")
  }
  return context
}
