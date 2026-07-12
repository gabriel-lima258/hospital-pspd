import React, { useEffect } from "react"
import { X } from "lucide-react"

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  position?: "left" | "right"
  size?: "sm" | "md" | "lg"
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  position = "right",
  size = "md",
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  const sizeClasses = {
    sm: "max-w-xs",
    md: "max-w-md",
    lg: "max-w-xl",
  }

  const positionClasses = {
    left: `${isOpen ? "translate-x-0" : "-translate-x-full"}`,
    right: `${isOpen ? "translate-x-0" : "translate-x-full"}`,
  }

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden transition-all ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Slide Container */}
      <div className={`absolute inset-y-0 flex max-w-full ${position === "right" ? "right-0 pl-10" : "left-0 pr-10"}`}>
        <div
          className={`w-screen ${sizeClasses[size]} transform bg-card shadow-2xl transition-transform duration-300 ease-in-out border-border ${
            position === "right" ? "border-l" : "border-r"
          } ${positionClasses[position]}`}
        >
          <div className="flex h-full flex-col overflow-y-scroll bg-card">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-5">
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Content */}
            <div className="relative flex-1 p-5">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
