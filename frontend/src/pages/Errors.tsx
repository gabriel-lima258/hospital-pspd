import React from "react"
import { useNavigate } from "react-router-dom"
import { ShieldAlert, AlertTriangle, HelpCircle, RefreshCw, Home } from "lucide-react"

interface ErrorPageProps {
  code: 401 | 403 | 404 | 500
}

export const ErrorPage: React.FC<ErrorPageProps> = ({ code }) => {
  const navigate = useNavigate()

  const config = {
    401: {
      title: "Sessão Expirada",
      description: "Sua autenticação expirou ou não é mais válida. Faça login novamente para continuar acessando o sistema.",
      icon: ShieldAlert,
      color: "text-amber-500 bg-amber-500/10",
      action: () => {
        window.location.reload()
      },
      actionLabel: "Fazer Login",
    },
    403: {
      title: "Acesso Negado",
      description: "Você não possui as credenciais ou permissões necessárias para visualizar este prontuário ou recurso clínico.",
      icon: ShieldAlert,
      color: "text-destructive bg-destructive/10",
      action: () => navigate("/"),
      actionLabel: "Voltar ao Início",
    },
    404: {
      title: "Página Não Encontrada",
      description: "O endereço acessado não existe ou o paciente informado não foi localizado no servidor FHIR.",
      icon: HelpCircle,
      color: "text-primary bg-primary/10",
      action: () => navigate("/"),
      actionLabel: "Voltar ao Início",
    },
    500: {
      title: "Erro de Processamento",
      description: "Ocorreu um erro interno no servidor ou falha de comunicação nos microsserviços gRPC downstream.",
      icon: AlertTriangle,
      color: "text-destructive bg-destructive/10",
      action: () => window.location.reload(),
      actionLabel: "Tentar Novamente",
    },
  }[code]

  const Icon = config.icon

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-3xl border border-border bg-card p-10 text-center shadow-xl">
        <div className={`flex size-16 items-center justify-center rounded-2xl ${config.color}`}>
          <Icon className="size-8" />
        </div>
        
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">Erro {code}</p>
          <h2 className="text-xl font-bold text-foreground">{config.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty max-w-sm">
            {config.description}
          </p>
        </div>

        <div className="mt-4 flex gap-3 w-full">
          <button
            onClick={() => navigate("/")}
            className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted transition-colors focus:outline-none"
          >
            <Home className="size-4" />
            Início
          </button>
          
          <button
            onClick={config.action}
            className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors focus:outline-none"
          >
            {code === 500 || code === 401 ? (
              <RefreshCw className="size-4" />
            ) : (
              <Home className="size-4" />
            )}
            {config.actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export const NotFoundPage: React.FC = () => <ErrorPage code={404} />
export const AccessDeniedPage: React.FC = () => <ErrorPage code={403} />
export const SessionExpiredPage: React.FC = () => <ErrorPage code={401} />
export const ServerErrorPage: React.FC = () => <ErrorPage code={500} />
