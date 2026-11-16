import { formatoCOP } from './dinero'
import type { Resumen } from './contabilidad'
import { ORIGENES, type Config, type Gasto, type Pedido } from './tipos'

const dos = (n: number) => String(n).padStart(2, '0')

/** "2026-11-21 14:05" en hora de Colombia. */
export function fechaHoraColombia(ms: number): string {
  const d = new Date(ms - 5 * 3600 * 1000)
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())} ${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`
}

function celda(v: string | number | boolean | undefined): string {
  const t = v === undefined ? '' : String(v)
  return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t
}
const fila = (v: (string | number | boolean | undefined)[]) => v.map(celda).join(',')

export function generarCSV(pedidos: Pedido[], gastos: Gasto[]): string {
  const orden = [...pedidos].sort((a, b) => a.creadoEn - b.creadoEn)
  const l: string[] = []
  l.push('PEDIDOS')
  l.push(fila(['numero', 'fecha_hora', 'productos', 'total', 'estado', 'anulado', 'metodo', 'efectivo_recibido', 'devuelto', 'transferencia', 'canal', 'referencia', 'nota']))
  for (const p of orden) {
    l.push(
      fila([
        p.numero,
        fechaHoraColombia(p.creadoEn),
        p.lineas.map((x) => `${x.cantidad} x ${x.nombre}`).join(' | '),
        p.total,
        p.estado,
        p.anulado ? 'si' : 'no',
        p.pago.metodo,
        p.pago.efectivoRecibido,
        p.pago.devuelto,
        p.pago.transferencia,
        p.pago.canal,
        p.pago.referencia,
        p.nota,
      ]),
    )
  }
  l.push('')
  l.push('GASTOS')
  l.push(fila(['fecha_hora', 'concepto', 'monto', 'categoria', 'origen']))
  for (const g of [...gastos].sort((a, b) => a.creadoEn - b.creadoEn)) {
    l.push(fila([fechaHoraColombia(g.creadoEn), g.concepto, g.monto, g.categoria, ORIGENES.find((o) => o.valor === g.origen)?.texto ?? g.origen]))
  }
  return l.join('\n')
}

export function generarResumenWhatsApp(r: Resumen, cfg: Config): string {
  const l: string[] = []
  l.push('*Cubárbaros – Resumen del día*')
  l.push('')
  l.push(`Ventas: ${formatoCOP(r.ventas)} (${r.numPedidos} pedidos)`)
  for (const u of r.unidades) l.push(`• ${u.nombre}: ${u.cantidad}`)
  l.push('')
  l.push(`Efectivo neto: ${formatoCOP(r.efectivoNeto)}`)
  l.push(`Transferencias: ${formatoCOP(r.transferencias)}`)
  for (const [canal, v] of Object.entries(r.transferenciasPorCanal)) l.push(`• ${canal}: ${formatoCOP(v)}`)
  l.push('')
  l.push(`Gastos: ${formatoCOP(r.gastos)}`)
  l.push(`*Utilidad: ${formatoCOP(r.utilidad)}*`)
  l.push(`Reparto (${cfg.porcentajeDueno}/${100 - cfg.porcentajeDueno}): ${formatoCOP(r.repartoDueno)} / ${formatoCOP(r.repartoSocio)}`)
  l.push('')
  l.push(`Cuadre de caja: esperado ${formatoCOP(r.efectivoEsperado)}`)
  if (r.diferenciaCuadre !== null && cfg.efectivoContado !== null) {
    l.push(`Contado ${formatoCOP(cfg.efectivoContado)} → diferencia ${formatoCOP(r.diferenciaCuadre)}`)
  }
  return l.join('\n')
}
