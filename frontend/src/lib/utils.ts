/**
 * Concatena classes condicionalmente, ignorando valores falsy.
 * Versão enxuta (sem dependências) suficiente para o dashboard.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ")
}

/** Formata uma data ISO (yyyy-mm-dd) para o padrão brasileiro. */
export function formatDate(iso?: string): string {
  if (!iso) return "—"
  // Aceita tanto "1986-03-14" quanto datas completas.
  const parts = iso.slice(0, 10).split("-")
  if (parts.length === 3) {
    const [y, m, d] = parts
    return `${d}/${m}/${y}`
  }
  return iso
}

/** Calcula a idade a partir de uma data de nascimento ISO. */
export function calcAge(birthDate?: string): number | null {
  if (!birthDate) return null
  const parts = birthDate.slice(0, 10).split("-")
  const year = Number(parts[0])
  const month = parts[1] ? Number(parts[1]) - 1 : 0
  const day = parts[2] ? Number(parts[2]) : 1
  if (Number.isNaN(year)) return null
  const dob = new Date(year, month, day)
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const mDiff = now.getMonth() - dob.getMonth()
  if (mDiff < 0 || (mDiff === 0 && now.getDate() < dob.getDate())) age--
  return age
}
