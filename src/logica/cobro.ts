import type { Canal, LineaPedido, Pago } from './tipos'

export function totalPedido(lineas: Pick<LineaPedido, 'precio' | 'cantidad'>[]): number {
  return lineas.reduce((s, l) => s + l.precio * l.cantidad, 0)
}

export interface ResultadoCobro {
  ok: boolean
  /** Lo que aún falta por pagar (0 si ya alcanza). */
  falta: number
  /** Cambio que se debe devolver en efectivo. */
  devolver: number
  /** Efectivo que debe quedar en la caja por este pedido. */
  efectivoDebido: number
  error?: string
  pago?: Pago
}

const NO: ResultadoCobro = { ok: false, falta: 0, devolver: 0, efectivoDebido: 0 }

export function cobrarEfectivo(total: number, recibido: number): ResultadoCobro {
  if (total <= 0) return { ...NO, error: 'El pedido está vacío' }
  if (recibido < total) {
    return { ...NO, falta: total - recibido, efectivoDebido: total, error: 'Falta plata' }
  }
  const devolver = recibido - total
  return {
    ok: true,
    falta: 0,
    devolver,
    efectivoDebido: total,
    pago: { metodo: 'efectivo', efectivoRecibido: recibido, devuelto: devolver, transferencia: 0 },
  }
}

export function cobrarTransferencia(total: number, canal: Canal | undefined, referencia: string): ResultadoCobro {
  if (total <= 0) return { ...NO, error: 'El pedido está vacío' }
  if (!canal) return { ...NO, error: 'Elige el canal de la transferencia' }
  return {
    ok: true,
    falta: 0,
    devolver: 0,
    efectivoDebido: 0,
    pago: {
      metodo: 'transferencia',
      efectivoRecibido: 0,
      devuelto: 0,
      transferencia: total,
      canal,
      referencia: referencia.trim() || undefined,
    },
  }
}

/**
 * Pago mixto: `transferido` es la parte por transferencia; el resto va en efectivo.
 * `recibido` es el efectivo que entrega el cliente para cubrir ese resto.
 */
export function cobrarMixto(
  total: number,
  transferido: number,
  recibido: number,
  canal: Canal | undefined,
  referencia: string,
): ResultadoCobro {
  if (total <= 0) return { ...NO, error: 'El pedido está vacío' }
  if (transferido <= 0) return { ...NO, error: 'Escribe cuánto llegó por transferencia' }
  if (transferido >= total) return { ...NO, error: 'Si todo llegó por transferencia, usa Transferencia' }
  if (!canal) return { ...NO, error: 'Elige el canal de la transferencia' }
  const efectivoDebido = total - transferido
  if (recibido < efectivoDebido) {
    return { ...NO, falta: efectivoDebido - recibido, efectivoDebido, error: 'Falta plata' }
  }
  const devolver = recibido - efectivoDebido
  return {
    ok: true,
    falta: 0,
    devolver,
    efectivoDebido,
    pago: {
      metodo: 'mixto',
      efectivoRecibido: recibido,
      devuelto: devolver,
      transferencia: transferido,
      canal,
      referencia: referencia.trim() || undefined,
    },
  }
}
