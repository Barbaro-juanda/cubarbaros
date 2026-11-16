import { repartir } from './dinero'
import type { Config, Gasto, OrigenGasto, Pedido } from './tipos'

export interface Resumen {
  ventas: number
  numPedidos: number
  unidades: { nombre: string; cantidad: number; total: number }[]
  efectivoNeto: number
  transferencias: number
  transferenciasPorCanal: Record<string, number>
  gastos: number
  gastosPorOrigen: Record<OrigenGasto, number>
  gastosPorCategoria: Record<string, number>
  utilidad: number
  repartoDueno: number
  repartoSocio: number
  efectivoEsperado: number
  /** null si todavía no se ha contado el efectivo. */
  diferenciaCuadre: number | null
}

/** Los anulados no cuentan en la contabilidad. */
export const pedidosValidos = (p: Pedido[]) => p.filter((x) => !x.anulado)

export function resumir(pedidos: Pedido[], gastos: Gasto[], cfg: Config): Resumen {
  const validos = pedidosValidos(pedidos)
  const porProducto = new Map<string, { nombre: string; cantidad: number; total: number }>()
  const canales: Record<string, number> = {}
  let ventas = 0
  let efectivoNeto = 0
  let transferencias = 0

  for (const p of validos) {
    ventas += p.total
    efectivoNeto += p.pago.efectivoRecibido - p.pago.devuelto
    transferencias += p.pago.transferencia
    if (p.pago.transferencia > 0) {
      const c = p.pago.canal ?? 'Otro'
      canales[c] = (canales[c] ?? 0) + p.pago.transferencia
    }
    for (const l of p.lineas) {
      const f = porProducto.get(l.productoId) ?? { nombre: l.nombre, cantidad: 0, total: 0 }
      f.cantidad += l.cantidad
      f.total += l.cantidad * l.precio
      porProducto.set(l.productoId, f)
    }
  }

  const gastosPorOrigen: Record<OrigenGasto, number> = { caja: 0, yo: 0, socio: 0, transferencia: 0 }
  const gastosPorCategoria: Record<string, number> = {}
  let totalGastos = 0
  for (const g of gastos) {
    totalGastos += g.monto
    gastosPorOrigen[g.origen] += g.monto
    gastosPorCategoria[g.categoria] = (gastosPorCategoria[g.categoria] ?? 0) + g.monto
  }

  const utilidad = ventas - totalGastos
  const { dueno, socio } = repartir(utilidad, cfg.porcentajeDueno)
  const efectivoEsperado = cfg.baseCaja + efectivoNeto - gastosPorOrigen.caja

  return {
    ventas,
    numPedidos: validos.length,
    unidades: [...porProducto.values()].sort((a, b) => b.cantidad - a.cantidad),
    efectivoNeto,
    transferencias,
    transferenciasPorCanal: canales,
    gastos: totalGastos,
    gastosPorOrigen,
    gastosPorCategoria,
    utilidad,
    repartoDueno: dueno,
    repartoSocio: socio,
    efectivoEsperado,
    diferenciaCuadre: cfg.efectivoContado === null ? null : cfg.efectivoContado - efectivoEsperado,
  }
}

/** Hora en Colombia (UTC-5, sin horario de verano), sin depender del reloj del celular. */
export function horaColombia(ms: number): number {
  return new Date(ms - 5 * 3600 * 1000).getUTCHours()
}

/** Ventas por hora (0-23) de pedidos no anulados. */
export function ventasPorHora(pedidos: Pedido[]): { hora: number; total: number; pedidos: number }[] {
  const h = Array.from({ length: 24 }, (_, hora) => ({ hora, total: 0, pedidos: 0 }))
  for (const p of pedidosValidos(pedidos)) {
    const f = h[horaColombia(p.creadoEn)]
    f.total += p.total
    f.pedidos += 1
  }
  return h
}

/** ¿Hay que aplicar el registro que llegó de la nube? Gana el más reciente. */
export function debeAplicarRemoto(remotoActualizadoEn: number, local?: { actualizadoEn: number; sucio: number }): boolean {
  if (!local) return true
  if (remotoActualizadoEn > local.actualizadoEn) return true
  return false
}
