import React from "react"
import { AlertTriangle } from "lucide-react"
import { Modal } from "./Modal"

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "warning" | "primary"
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
}) => {
  const buttonColors = {
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive/20",
    warning: "bg-warning text-warning-foreground hover:bg-warning/90 focus:ring-warning/20",
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary/20",
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className={`flex size-12 items-center justify-center rounded-full ${
          variant === "danger" ? "bg-destructive/10 text-destructive" :
          variant === "warning" ? "bg-warning/10 text-warning" :
          "bg-primary/10 text-primary"
        }`}>
          <AlertTriangle className="size-6" />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
          {message}
        </p>
        <div className="mt-4 flex w-full gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors focus:outline-none"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold shadow-xs transition-colors focus:outline-none focus:ring-4 ${buttonColors[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
