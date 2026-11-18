import type { Pedido } from './tipos'

/**
 * Número que se ve en pantalla: 1, 2, 3… ordenado por la hora en que se cobró,
 * igual para todos los celulares. Los anulados también cuentan, así los números
 * de los demás no se mueven al anular o restaurar.
 * (Si un celular sin señal envía un pedido tarde, los que vienen después pueden correrse un puesto.)
 */
export function numerarPedidos(pedidos: Pick<Pedido, 'id' | 'creadoEn'>[]): Map<string, number> {
  const orden = [...pedidos].sort((a, b) => a.creadoEn - b.creadoEn || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return new Map(orden.map((p, i) => [p.id, i + 1]))
}
