import React, { createContext, useContext, useState, useCallback } from "react"
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react"

export type ToastType = "success" | "error" | "info" | "warning"

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  message: string
  duration?: number
}

interface ToastContextType {
  toasts: ToastMessage[]
  showToast: (type: ToastType, title: string, message: string, duration?: number) => void
  removeToast: (id: string) => void
  success: (title: string, message: string, duration?: number) => void
  error: (title: string, message: string, duration?: number) => void
  warning: (title: string, message: string, duration?: number) => void
  info: (title: string, message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (type: ToastType, title: string, message: string, duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast: ToastMessage = { id, type, title, message, duration }
      setToasts((prev) => [...prev, newToast])

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id)
        }, duration)
      }
    },
    [removeToast]
  )

  const success = useCallback((title: string, message: string, duration?: number) => {
    showToast("success", title, message, duration)
  }, [showToast])

  const error = useCallback((title: string, message: string, duration?: number) => {
    showToast("error", title, message, duration)
  }, [showToast])

  const warning = useCallback((title: string, message: string, duration?: number) => {
    showToast("warning", title, message, duration)
  }, [showToast])

  const info = useCallback((title: string, message: string, duration?: number) => {
    showToast("info", title, message, duration)
  }, [showToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, success, error, warning, info }}>
      {children}
      
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur-md transition-all duration-300 animate-fade-in-up ${
              toast.type === "success"
                ? "bg-success/10 border-success/30 text-success-foreground"
                : toast.type === "error"
                ? "bg-destructive/10 border-destructive/30 text-destructive-foreground"
                : toast.type === "warning"
                ? "bg-warning/10 border-warning/30 text-warning-foreground"
                : "bg-primary/10 border-primary/30 text-foreground"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === "success" && <CheckCircle2 className="size-5 text-success" />}
              {toast.type === "error" && <XCircle className="size-5 text-destructive" />}
              {toast.type === "warning" && <AlertTriangle className="size-5 text-warning" />}
              {toast.type === "info" && <Info className="size-5 text-primary" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">{toast.title}</p>
              <p className="mt-1 text-xs opacity-90 leading-relaxed text-pretty">{toast.message}</p>
            </div>
            
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 rounded-lg p-0.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) throw new Error("useToast must be used within a ToastProvider")
  return context
}
