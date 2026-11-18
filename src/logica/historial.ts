import type { Cambio } from './tipos'

export const MAX_CAMBIOS = 40
const VENTANA_MS = 2 * 60 * 1000

/**
 * Agrega un cambio al historial. Si la misma persona repite el mismo tipo de cambio
 * (`clave`) en menos de 2 minutos —por ejemplo, escribiendo la base de caja número a número—
 * se reemplaza el último en vez de llenar la lista.
 */
export function conCambio(historial: Cambio[] | undefined, nuevo: Cambio, max = MAX_CAMBIOS): Cambio[] {
  const h = [...(historial ?? [])]
  const ult = h[h.length - 1]
  if (nuevo.clave && ult && ult.clave === nuevo.clave && ult.quien === nuevo.quien && nuevo.ts - ult.ts < VENTANA_MS) {
    h[h.length - 1] = nuevo
  } else {
    h.push(nuevo)
  }
  return h.slice(-max)
}
