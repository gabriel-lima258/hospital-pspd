import React, { useState } from "react"
import { Copy, Download, Search, ChevronDown, ChevronRight, Check, FileJson } from "lucide-react"

interface FHIRViewerProps {
  resource: any
  title?: string
}

export const FHIRViewer: React.FC<FHIRViewerProps> = ({ resource, title = "Recurso FHIR" }) => {
  const [copied, setCopied] = useState(false)
  const [search, setSearch] = useState("")
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({ "": true })

  const resourceType = resource?.resourceType ?? "Desconhecido"
  const resourceId = resource?.id ?? "Sem ID"

  // Função recursiva para renderizar os campos
  const toggleNode = (path: string) => {
    setExpandedKeys((prev) => ({ ...prev, [path]: !prev[path] }))
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(resource, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(resource, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${resourceType}-${resourceId}.json`
    link.click()
  }

  // Gera mapa de chaves de todos os caminhos para expandir/colapsar tudo
  const getAllPaths = (obj: any, currentPath = ""): string[] => {
    const paths: string[] = []
    if (obj && typeof obj === "object") {
      paths.push(currentPath)
      Object.keys(obj).forEach((key) => {
        const nextPath = currentPath ? `${currentPath}.${key}` : key
        paths.push(...getAllPaths(obj[key], nextPath))
      })
    }
    return paths
  }

  const handleExpandAll = () => {
    const allPaths = getAllPaths(resource)
    const next: Record<string, boolean> = {}
    allPaths.forEach((path) => {
      next[path] = true
    })
    setExpandedKeys(next)
  }

  const handleCollapseAll = () => {
    setExpandedKeys({ "": true })
  }

  const isHighlighted = (value: any, keyName: string): boolean => {
    if (!search) return false
    const term = search.toLowerCase()
    if (keyName.toLowerCase().includes(term)) return true
    if (value !== null && value !== undefined && String(value).toLowerCase().includes(term)) return true
    return false
  }

  const renderJsonNode = (node: any, keyName = "", path = "", depth = 0): React.ReactNode => {
    const isObject = node !== null && typeof node === "object"
    const isArray = Array.isArray(node)
    const isNodeExpanded = expandedKeys[path] !== false

    const indent = { paddingLeft: `${depth * 1.25}rem` }

    if (isObject) {
      const keys = Object.keys(node)
      const label = isArray ? `[Array(${keys.length})]` : `{Object}`
      const hasChildren = keys.length > 0

      return (
        <div key={path} className="font-mono text-xs">
          <div
            className="flex items-center gap-1 py-0.5 cursor-pointer hover:bg-muted/40 rounded px-1 transition-colors"
            style={indent}
            onClick={() => hasChildren && toggleNode(path)}
          >
            {hasChildren ? (
              isNodeExpanded ? (
                <ChevronDown className="size-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3.5 text-muted-foreground" />
              )
            ) : (
              <span className="w-3.5" />
            )}
            
            {keyName && (
              <span className={`font-semibold ${isHighlighted(null, keyName) ? "bg-accent/30 text-accent-foreground" : "text-primary"}`}>
                {keyName}:{" "}
              </span>
            )}
            <span className="text-muted-foreground opacity-80">{label}</span>
          </div>

          {isNodeExpanded && hasChildren && (
            <div className="border-l border-border/60 ml-2.5">
              {keys.map((k) => {
                const childPath = path ? `${path}.${k}` : k
                return renderJsonNode(node[k], k, childPath, depth + 1)
              })}
            </div>
          )}
        </div>
      )
    }

    // Valores primitivos
    let valueClass = "text-amber-600 dark:text-amber-400" // String
    let formattedValue = JSON.stringify(node)

    if (typeof node === "number") {
      valueClass = "text-blue-600 dark:text-blue-400"
    } else if (typeof node === "boolean") {
      valueClass = "text-purple-600 dark:text-purple-400"
    } else if (node === null) {
      valueClass = "text-gray-400"
      formattedValue = "null"
    }

    const highlightClass = isHighlighted(node, keyName) ? "bg-accent/30 text-accent-foreground px-0.5 rounded" : ""

    return (
      <div key={path} className="font-mono text-xs py-0.5 px-1 flex items-baseline hover:bg-muted/40 rounded" style={indent}>
        <span className="w-3.5" />
        {keyName && (
          <span className={`font-semibold mr-1 ${isHighlighted(null, keyName) ? "bg-accent/30 text-accent-foreground px-0.5 rounded" : "text-primary"}`}>
            {keyName}:
          </span>
        )}
        <span className={`${valueClass} ${highlightClass} break-all`}>
          {formattedValue}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-3xl border border-border bg-card shadow-sm overflow-hidden h-full">
      {/* Header bar */}
      <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FileJson className="size-5 text-accent" />
          <div>
            <h4 className="text-sm font-bold text-foreground">{title}</h4>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded bg-accent/10 px-1.5 py-0.5 font-semibold text-accent">
                {resourceType}
              </span>
              <span>ID: {resourceId}</span>
            </div>
          </div>
        </div>

        {/* Search bar & utility actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-8 w-36 rounded-lg border border-input bg-background pl-8 pr-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
            />
          </div>
          <button
            onClick={handleExpandAll}
            className="h-8 rounded-lg border border-border px-2 text-xs font-semibold hover:bg-muted text-foreground transition-colors"
          >
            Expandir tudo
          </button>
          <button
            onClick={handleCollapseAll}
            className="h-8 rounded-lg border border-border px-2 text-xs font-semibold hover:bg-muted text-foreground transition-colors"
          >
            Colapsar tudo
          </button>
          <button
            onClick={handleCopy}
            className="h-8 rounded-lg border border-border px-2 text-xs font-semibold hover:bg-muted text-foreground transition-colors flex items-center gap-1"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button
            onClick={handleDownload}
            className="h-8 rounded-lg border border-border px-2 text-xs font-semibold hover:bg-muted text-foreground transition-colors flex items-center gap-1"
          >
            <Download className="size-3.5" />
            Baixar
          </button>
        </div>
      </div>

      {/* JSON content rendering */}
      <div className="flex-1 p-5 overflow-auto bg-muted/10 min-h-[300px]">
        {renderJsonNode(resource)}
      </div>
    </div>
  )
}
