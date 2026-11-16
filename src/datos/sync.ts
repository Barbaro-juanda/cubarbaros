import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { alCambiar, leerConfig } from './almacen'
import { db, escribirMeta, leerMeta, type Registro } from './db'
import { debeAplicarRemoto } from '../logica/contabilidad'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const CORREO = (import.meta.env.VITE_SUPABASE_EMAIL as string | undefined) || 'caja@cubarbaros.app'

/** ¿La app fue publicada con los datos de Supabase? Si no, funciona solo en este celular. */
export const nubeConfigurada = Boolean(URL && CLAVE)

const supabase: SupabaseClient | null = nubeConfigurada
  ? createClient(URL!, CLAVE!, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cubarbaros-auth' } })
  : null

export interface EstadoSync {
  conectado: boolean // hay sesión con la nube
  sincronizando: boolean
  ultimoExito: number // ms; 0 = nunca
  error: string
}
let estado: EstadoSync = { conectado: false, sincronizando: false, ultimoExito: 0, error: '' }
const oyentes = new Set<() => void>()
function poner(p: Partial<EstadoSync>) {
  estado = { ...estado, ...p }
  oyentes.forEach((f) => f())
}
export const useEstadoSync = () =>
  useSyncExternalStore(
    (f) => {
      oyentes.add(f)
      return () => oyentes.delete(f)
    },
    () => estado,
  )

export async function iniciarSesionConCodigo(codigo: string): Promise<string | null> {
  if (!supabase) return 'La nube no está configurada en esta versión.'
  const { error } = await supabase.auth.signInWithPassword({ email: CORREO, password: codigo.trim() })
  if (error) {
    if (!navigator.onLine || /fetch|network/i.test(error.message)) return 'No hay internet. Necesitas señal para entrar la primera vez.'
    return 'Código incorrecto.'
  }
  await escribirMeta('sesionAlgunaVez', true)
  poner({ conectado: true, error: '' })
  void sincronizar()
  return null
}

export async function cerrarSesion() {
  await supabase?.auth.signOut()
  poner({ conectado: false })
}

export async function haySesion(): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  const ok = Boolean(data.session)
  poner({ conectado: ok })
  return ok
}

const aFila = (r: Registro) => ({ id: r.id, tipo: r.tipo, datos: r.datos, actualizado_en: r.actualizadoEn, borrado: Boolean(r.borrado) })

/** Borra localmente lo anterior a `borradoEn` y reinicia la numeración (del "Borrar datos de prueba"). */
export async function aplicarBorradoLocal(borradoEn: number) {
  await db.transaction('rw', db.registros, db.meta, async () => {
    const viejos = await db.registros
      .where('tipo')
      .anyOf('pedido', 'gasto')
      .filter((r) => (r.datos?.creadoEn ?? 0) <= borradoEn)
      .primaryKeys()
    await db.registros.bulkDelete(viejos)
    await escribirMeta('borradoVisto', borradoEn)
  })
}

let enCurso = false
let pendiente = false

export async function sincronizar(): Promise<void> {
  if (!supabase) return
  if (enCurso) {
    pendiente = true
    return
  }
  enCurso = true
  try {
    if (!navigator.onLine) return
    if (!(await haySesion())) return
    poner({ sincronizando: true })

    // 1) Enviar lo pendiente
    for (;;) {
      const sucios = await db.registros.where('sucio').equals(1).limit(100).toArray()
      if (!sucios.length) break
      const { error } = await supabase.from('registros').upsert(sucios.map(aFila), { onConflict: 'id' })
      if (error) throw error
      await db.transaction('rw', db.registros, async () => {
        for (const s of sucios) {
          const actual = await db.registros.get(s.id)
          // solo se marca como enviado si no cambió mientras se enviaba
          if (actual && actual.actualizadoEn === s.actualizadoEn) await db.registros.update(s.id, { sucio: 0 })
        }
      })
    }

    // 2) Limpiar la nube si se pidió "Borrar datos de prueba"
    const cfgLocal = await leerConfig()
    if (cfgLocal.borradoEn > (await leerMeta<number>('borradoNubeLimpiado', 0))) {
      const { error } = await supabase.from('registros').delete().in('tipo', ['pedido', 'gasto']).lte('actualizado_en', cfgLocal.borradoEn)
      if (error) throw error
      await escribirMeta('borradoNubeLimpiado', cfgLocal.borradoEn)
    }

    // 3) Traer lo nuevo de los otros celulares (con 60 s de margen por relojes distintos)
    const desde = Math.max(0, (await leerMeta<number>('ultimaDescarga', 0)) - 60_000)
    let cursor = desde
    for (;;) {
      const { data, error } = await supabase
        .from('registros')
        .select('id,tipo,datos,actualizado_en,borrado')
        .gt('actualizado_en', cursor)
        .order('actualizado_en', { ascending: true })
        .limit(500)
      if (error) throw error
      if (!data?.length) break
      await aplicarRemotos(data as any[])
      cursor = Number(data[data.length - 1].actualizado_en)
      if (data.length < 500) break
    }
    if (cursor > desde) await escribirMeta('ultimaDescarga', cursor)

    poner({ ultimoExito: Date.now(), error: '' })
  } catch (e: any) {
    const msg = String(e?.message ?? e)
    poner({ error: /jwt|auth|token/i.test(msg) ? 'Sesión vencida: vuelve a escribir el código.' : msg })
  } finally {
    enCurso = false
    poner({ sincronizando: false })
    if (pendiente) {
      pendiente = false
      void sincronizar()
    }
  }
}

async function aplicarRemotos(filas: { id: string; tipo: Registro['tipo']; datos: any; actualizado_en: number; borrado: boolean }[]) {
  // ¿Otro celular borró los datos de prueba?
  const remotoConfig = filas.find((f) => f.id === 'config')
  if (remotoConfig) {
    const borradoEn = Number(remotoConfig.datos?.borradoEn ?? 0)
    if (borradoEn > (await leerMeta<number>('borradoVisto', 0))) await aplicarBorradoLocal(borradoEn)
  }
  const limite = Math.max((await leerConfig()).borradoEn, remotoConfig ? Number(remotoConfig.datos?.borradoEn ?? 0) : 0)

  await db.transaction('rw', db.registros, async () => {
    for (const f of filas) {
      if ((f.tipo === 'pedido' || f.tipo === 'gasto') && (f.datos?.creadoEn ?? 0) <= limite) continue
      const local = await db.registros.get(f.id)
      const t = Number(f.actualizado_en)
      if (!debeAplicarRemoto(t, local)) continue
      await db.registros.put({ id: f.id, tipo: f.tipo, datos: f.datos, actualizadoEn: t, sucio: 0, borrado: f.borrado ? 1 : 0 })
    }
  })
}

/** Arranca los envíos automáticos: cada 8 s, al volver la señal y apenas hay un cambio. */
export function iniciarSincronizacion() {
  if (!supabase) return
  alCambiar(() => {
    window.setTimeout(() => void sincronizar(), 400)
  })
  window.addEventListener('online', () => void sincronizar())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sincronizar()
  })
  window.setInterval(() => void sincronizar(), 8000)
  void sincronizar()
}
