import Dexie, { type EntityTable } from 'dexie'

export type TipoRegistro = 'pedido' | 'gasto' | 'config'

/** Todo lo que se guarda (pedidos, gastos, ajustes) es un "registro" con la misma forma. */
export interface Registro {
  id: string
  tipo: TipoRegistro
  datos: any
  actualizadoEn: number
  /** 1 = tiene cambios que aún no se han enviado a la nube. */
  sucio: 0 | 1
  borrado: 0 | 1
}

export interface Meta {
  clave: string
  valor: any
}

class BaseCaja extends Dexie {
  registros!: EntityTable<Registro, 'id'>
  meta!: EntityTable<Meta, 'clave'>
  constructor() {
    super('cubarbaros-caja')
    this.version(1).stores({
      registros: 'id, tipo, sucio, actualizadoEn',
      meta: 'clave',
    })
  }
}

export const db = new BaseCaja()

export async function leerMeta<T>(clave: string, porDefecto: T): Promise<T> {
  const m = await db.meta.get(clave)
  return m ? (m.valor as T) : porDefecto
}
export const escribirMeta = (clave: string, valor: any) => db.meta.put({ clave, valor })

/** Copia local recuperable: todo el contenido como texto JSON. */
export async function exportarCopiaLocal(): Promise<string> {
  const registros = await db.registros.toArray()
  const meta = await db.meta.toArray()
  return JSON.stringify({ app: 'cubarbaros-caja', exportadoEn: Date.now(), registros, meta }, null, 1)
}
