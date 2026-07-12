import React, { useState } from "react"
import { Download, FileSpreadsheet, FileText, FileCode, Printer, Loader2 } from "lucide-react"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import html2canvas from "html2canvas"

interface ExportButtonProps {
  data: any[]
  columns: { key: string; label: string }[]
  filename?: string
  title?: string
  elementIdToPdf?: string // ID de elemento DOM para converter direto em PDF
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  data,
  columns,
  filename = "relatorio-hospitalar",
  title = "Relatório Clínico PSPD",
  elementIdToPdf,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const handleExportCSV = () => {
    const exportData = data.map((row) => {
      const obj: any = {}
      columns.forEach((col) => {
        obj[col.label] = row[col.key] ?? ""
      })
      return obj
    })
    const csv = Papa.unparse(exportData)
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${filename}.csv`)
    link.click()
    setIsOpen(false)
  }

  const handleExportExcel = () => {
    const exportData = data.map((row) => {
      const obj: any = {}
      columns.forEach((col) => {
        obj[col.label] = row[col.key] ?? ""
      })
      return obj
    })
    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados")
    XLSX.writeFile(workbook, `${filename}.xlsx`)
    setIsOpen(false)
  }

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${filename}.json`)
    link.click()
    setIsOpen(false)
  }

  const handleExportPDF = async () => {
    setIsExportingPdf(true)
    setIsOpen(false)
    try {
      if (elementIdToPdf) {
        const element = document.getElementById(elementIdToPdf)
        if (element) {
          const canvas = await html2canvas(element, { scale: 2, useCORS: true })
          const imgData = canvas.toDataURL("image/png")
          const pdf = new jsPDF("p", "mm", "a4")
          const imgWidth = 210
          const pageHeight = 295
          const imgHeight = (canvas.height * imgWidth) / canvas.width
          let heightLeft = imgHeight
          let position = 0

          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
          heightLeft -= pageHeight

          while (heightLeft >= 0) {
            position = heightLeft - imgHeight
            pdf.addPage()
            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
            heightLeft -= pageHeight
          }
          pdf.save(`${filename}.pdf`)
          setIsExportingPdf(false)
          return
        }
      }

      // Exportação em formato de tabela nativo caso não haja Element ID
      const doc = new jsPDF()
      doc.setFont("helvetica", "bold")
      doc.setFontSize(18)
      doc.text(title, 14, 20)
      
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.text(`Data de geração: ${new Date().toLocaleString("pt-BR")}`, 14, 28)
      
      let startY = 38
      const rowHeight = 10
      const pageHeight = doc.internal.pageSize.height
      
      // Cabeçalho da tabela
      doc.setFont("helvetica", "bold")
      columns.forEach((col, idx) => {
        doc.text(col.label, 14 + idx * (180 / columns.length), startY)
      })
      
      doc.line(14, startY + 2, 196, startY + 2)
      startY += 8
      doc.setFont("helvetica", "normal")
      
      data.forEach((row) => {
        if (startY + rowHeight > pageHeight - 15) {
          doc.addPage()
          startY = 20
        }
        
        columns.forEach((col, idx) => {
          const val = String(row[col.key] ?? "—")
          const truncated = val.length > 20 ? val.substring(0, 17) + "..." : val
          doc.text(truncated, 14 + idx * (180 / columns.length), startY)
        })
        startY += rowHeight
      })

      // Numeração de páginas
      const totalPages = doc.internal.pages.length - 1
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.text(`Página ${i} de ${totalPages}`, 180, pageHeight - 10)
      }

      doc.save(`${filename}.pdf`)
    } catch (error) {
      console.error("Erro ao gerar PDF:", error)
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExportingPdf}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-xs transition hover:border-ring hover:bg-muted focus:outline-none disabled:opacity-50"
      >
        {isExportingPdf ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        Exportar
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-2xl border border-border bg-card p-1.5 shadow-xl z-20 animate-fade-in-up">
            <button
              onClick={handleExportCSV}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors"
            >
              <FileText className="size-4 text-primary" />
              CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors"
            >
              <FileSpreadsheet className="size-4 text-success" />
              Excel (xlsx)
            </button>
            <button
              onClick={handleExportJSON}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors"
            >
              <FileCode className="size-4 text-accent" />
              JSON
            </button>
            <button
              onClick={handleExportPDF}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Printer className="size-4 text-destructive" />
              PDF Documento
            </button>
          </div>
        </>
      )}
    </div>
  )
}
