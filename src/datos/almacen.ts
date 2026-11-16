import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db, leerMeta, type Registro } from './db'
import { CONFIG_INICIAL, type Config, type Gasto, type EstadoPedido, type LineaPedido, type Pago, type Pedido } from '../logica/tipos'
import { totalPedido } from '../logica/cobro'

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

export const useSinEnviar = () => useLive(() => db.registros.where('sucio').equals(1).count(), 0)
/** Devuelve `undefined` mientras carga y luego el valor guardado (o `porDefecto`). */
export const useMeta = <T,>(clave: string, porDefecto: T) => useLive<T | undefined>(() => leerMeta<T>(clave, porDefecto), undefined)

export async function leerConfig(): Promise<Config> {
  const r = await db.registros.get('config')
  return { ...CONFIG_INICIAL, ...(r?.datos ?? {}) }
}

const nuevoId = () => crypto.randomUUID()

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

export async function guardarConfig(parcial: Partial<Config>) {
  const actual = await leerConfig()
  await guardarRegistro('config', 'config', { ...actual, ...parcial })
}

export async function crearPedido(lineas: LineaPedido[], nota: string, pago: Pago): Promise<Pedido> {
  const dispositivo = await leerMeta<string>('dispositivo', 'A')
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
    }
    await db.registros.put({ id, tipo: 'pedido', datos: p, actualizadoEn: ahora, sucio: 1, borrado: 0 })
    return p
  })
  avisarCambio()
  return pedido
}

async function cambiarPedido(id: string, cambio: Partial<Pedido>) {
  const r = await db.registros.get(id)
  if (!r) return
  await guardarRegistro('pedido', id, { ...r.datos, ...cambio })
}
export const cambiarEstado = (id: string, estado: EstadoPedido) => cambiarPedido(id, { estado })
export const anularPedido = (id: string, anulado: boolean) => cambiarPedido(id, { anulado })

export async function agregarGasto(g: Omit<Gasto, 'id' | 'creadoEn'>) {
  const id = nuevoId()
  await guardarRegistro('gasto', id, { ...g, id, creadoEn: Date.now() })
}
export async function borrarGasto(id: string) {
  const r = await db.registros.get(id)
  if (r) await guardarRegistro('gasto', id, r.datos, 1)
}
