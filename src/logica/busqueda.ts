import { formatoCOP } from './dinero'
import { fechaHoraColombia } from './exportar'
import type { Pedido } from './tipos'

/** Minúsculas y sin tildes: "Sándwich" y "sandwich" son lo mismo. */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Todo el texto por el que se puede encontrar un pedido. */
function textoDe(p: Pedido): string {
  const estado = p.anulado ? 'anulado' : p.estado
  return normalizar(
    [
      p.numero,
      p.nota,
      p.lineas.map((l) => `${l.cantidad} ${l.nombre}`).join(' '),
      estado,
      p.pago.metodo,
      p.pago.canal ?? '',
      p.pago.referencia ?? '',
      String(p.total), // 35800
      formatoCOP(p.total), // $35.800
      fechaHoraColombia(p.creadoEn).slice(11), // 21:46
    ].join(' '),
  )
}

/**
 * Busca pedidos. Cada palabra escrita debe aparecer en alguna parte del pedido
 * ("a-3 cliente juan" encuentra el A-3 con nota "Juan"). Sin texto devuelve todos.
 */
export function buscarPedidos(pedidos: Pedido[], consulta: string): Pedido[] {
  const palabras = normalizar(consulta)
    .split(/\s+/)
    .filter(Boolean)
    // "$17.900" o "17.900" se busca como "17900" y también como "17.900"
    .map((w) => w.replace(/^\$/, ''))
    .filter(Boolean)
  if (!palabras.length) return pedidos
  return pedidos.filter((p) => {
    const t = textoDe(p)
    return palabras.every((w) => t.includes(w) || (/^[\d.]+$/.test(w) && t.includes(w.replace(/\./g, ''))))
  })
}
