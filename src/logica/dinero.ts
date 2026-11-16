/** Formato colombiano: 17900 -> "$17.900". Solo enteros. */
export function formatoCOP(n: number): string {
  const entero = Math.round(n)
  const signo = entero < 0 ? '-' : ''
  const digitos = String(Math.abs(entero))
  return signo + '$' + digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Lee lo que escribe el usuario ("20.000", "20000", "$ 20 000") y devuelve un entero. */
export function leerMonto(texto: string): number {
  const solo = texto.replace(/\D/g, '')
  if (!solo) return 0
  const n = Number(solo.slice(0, 12))
  return Number.isSafeInteger(n) ? n : 0
}

/** Porcentaje del dueño con enteros: redondea y el socio recibe el resto exacto. */
export function repartir(utilidad: number, porcentajeDueno: number): { dueno: number; socio: number } {
  const pct = Math.min(100, Math.max(0, Math.round(porcentajeDueno)))
  const dueno = Math.round((utilidad * pct) / 100)
  return { dueno, socio: utilidad - dueno }
}
