import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db, leerMeta, type Registro } from './db'
import { CONFIG_INICIAL, MENU_VERSION, NOMBRE_ESTADO, type Cambio, type Config, type Gasto, type EstadoPedido, type LineaPedido, type Pago, type Pedido } from '../logica/tipos'
import { totalPedido } from '../logica/cobro'
import { formatoCOP } from '../logica/dinero'
import { conCambio } from '../logica/historial'
import { etiquetaPedido, numerarPedidos } from '../logica/numeracion'

export function useLive<T>(consulta: () => T | Promise<T>, inicial: T): T {
  const [valor, setValor] = useState<T>(inicial)
  useEffect(() => {
    const s = liveQuery(consulta).subscribe({ next: setValor, error: (e) => console.error(e) })
    return () => s.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return valor
}

export const usePedidos = () =>
  useLive(async () => (await db.registros.where('tipo').equals('pedido').filter((r) => !r.borrado).toArray()).map((r) => r.datos as Pedido), [] as Pedido[])

export const useGastos = () =>
  useLive(async () => (await db.registros.where('tipo').equals('gasto').filter((r) => !r.borrado).toArray()).map((r) => r.datos as Gasto), [] as Gasto[])

export function useConfig(): Config {
  return useLive(leerConfig, CONFIG_INICIAL)
}

export interface EntradaHistorial extends Cambio {
  /** A qué se refiere: "Pedido P-3", "Gasto" o "Ajustes". */
  sobre: string
}

/** Todos los cambios de todos los celulares, el más reciente primero. */
export const useHistorial = () =>
  useLive(async () => {
    const regs = await db.registros.toArray()
    const orden = numerarPedidos(regs.filter((r) => r.tipo === 'pedido').map((r) => r.datos as Pedido))
    const out: EntradaHistorial[] = []
    for (const r of regs) {
      const hist = r.datos?.historial as Cambio[] | undefined
      if (!hist?.length) continue
      const sobre = r.tipo === 'pedido' ? `Pedido ${etiquetaPedido(orden.get(r.id))}` : r.tipo === 'gasto' ? 'Gasto' : 'Ajustes'
      for (const c of hist) out.push({ ...c, sobre })
    }
    return out.sort((a, b) => b.ts - a.ts).slice(0, 300)
  }, [] as EntradaHistorial[])

/** El número que se ve en pantalla para un pedido (1, 2, 3… por hora de cobro). */
export async function numeroVisible(id: string): Promise<number> {
  const regs = await db.registros.where('tipo').equals('pedido').toArray()
  return numerarPedidos(regs.map((r) => r.datos as Pedido)).get(id) ?? 0
}

export const useSinEnviar = () => useLive(() => db.registros.where('sucio').equals(1).count(), 0)
/** Devuelve `undefined` mientras carga y luego el valor guardado (o `porDefecto`). */
export const useMeta = <T,>(clave: string, porDefecto: T) => useLive<T | undefined>(() => leerMeta<T>(clave, porDefecto), undefined)

export async function leerConfig(): Promise<Config> {
  const r = await db.registros.get('config')
  const d = r?.datos ?? {}
  // Un menú guardado con versión vieja se cambia por el menú base nuevo.
  const menu = (d.menuVersion ?? 0) >= MENU_VERSION && d.menu ? d.menu : CONFIG_INICIAL.menu
  return { ...CONFIG_INICIAL, ...d, menu, menuVersion: MENU_VERSION }
}

const nuevoId = () => crypto.randomUUID()
const quienSoy = () => leerMeta<string>('dispositivo', '?')
const anotacion = async (texto: string, clave?: string): Promise<Cambio> => ({ ts: Date.now(), quien: await quienSoy(), texto, clave })

type Aviso = () => void
let avisarCambio: Aviso = () => {}
/** La sincronización se registra aquí para enviar lo nuevo apenas haya un cambio. */
export const alCambiar = (f: Aviso) => {
  avisarCambio = f
}

async function guardarRegistro(tipo: Registro['tipo'], id: string, datos: any, borrado: 0 | 1 = 0) {
  const previo = await db.registros.get(id)
  const actualizadoEn = Math.max(Date.now(), (previo?.actualizadoEn ?? 0) + 1)
  await db.registros.put({ id, tipo, datos, actualizadoEn, sucio: 1, borrado })
  avisarCambio()
}

/** `cambio` es lo que se anota en el historial (con `clave` para juntar cambios seguidos del mismo tipo). */
export async function guardarConfig(parcial: Partial<Config>, cambio?: { texto: string; clave?: string }) {
  const actual = await leerConfig()
  const historial = cambio ? conCambio(actual.historial, await anotacion(cambio.texto, cambio.clave)) : actual.historial
  await guardarRegistro('config', 'config', { ...actual, ...parcial, historial })
}

export async function crearPedido(lineas: LineaPedido[], nota: string, pago: Pago): Promise<Pedido> {
  const dispositivo = await leerMeta<string>('dispositivo', '?')
  const id = nuevoId()
  const ahora = Date.now()
  // La secuencia se reserva dentro de una transacción para que nunca se repita en este celular.
  const pedido = await db.transaction('rw', db.registros, async () => {
    // El consecutivo sale de los pedidos que ya existen con la letra de este celular.
    const mios = await db.registros.where('tipo').equals('pedido').filter((r) => r.datos.dispositivo === dispositivo).toArray()
    const sec = Math.max(0, ...mios.map((r) => Number(r.datos.secuencia) || 0)) + 1
    const p: Pedido = {
      id,
      dispositivo,
      secuencia: sec,
      numero: `${dispositivo}-${sec}`,
      creadoEn: ahora,
      lineas,
      total: totalPedido(lineas),
      nota: nota.trim(),
      estado: 'pendiente',
      anulado: false,
      pago,
      historial: [{ ts: ahora, quien: dispositivo, texto: `Creó el pedido · ${formatoCOP(totalPedido(lineas))} · ${pago.metodo}` }],
    }
    await db.registros.put({ id, tipo: 'pedido', datos: p, actualizadoEn: ahora, sucio: 1, borrado: 0 })
    return p
  })
  avisarCambio()
  return pedido
}

async function cambiarPedido(id: string, cambio: Partial<Pedido>, texto: string) {
  const r = await db.registros.get(id)
  if (!r) return
  const historial = conCambio(r.datos.historial, await anotacion(texto))
  await guardarRegistro('pedido', id, { ...r.datos, ...cambio, historial })
}
export async function cambiarEstado(id: string, estado: EstadoPedido) {
  const r = await db.registros.get(id)
  if (!r) return
  const antes = NOMBRE_ESTADO[r.datos.estado as EstadoPedido] ?? r.datos.estado
  await cambiarPedido(id, { estado }, `Estado: ${antes} → ${NOMBRE_ESTADO[estado]}`)
}
export const anularPedido = (id: string, anulado: boolean) => cambiarPedido(id, { anulado }, anulado ? 'Anuló el pedido' : 'Restauró el pedido')

export async function agregarGasto(g: Omit<Gasto, 'id' | 'creadoEn'>) {
  const id = nuevoId()
  const historial = conCambio(undefined, await anotacion(`Registró el gasto: ${g.concepto} · ${formatoCOP(g.monto)}`))
  await guardarRegistro('gasto', id, { ...g, id, creadoEn: Date.now(), historial })
}
export async function borrarGasto(id: string) {
  const r = await db.registros.get(id)
  if (!r) return
  const historial = conCambio(r.datos.historial, await anotacion(`Borró el gasto: ${r.datos.concepto} · ${formatoCOP(r.datos.monto)}`))
  await guardarRegistro('gasto', id, { ...r.datos, historial }, 1)
}
