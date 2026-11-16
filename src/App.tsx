import { useEffect, useState } from 'react'
import { escribirMeta } from './datos/db'
import { useMeta, useSinEnviar } from './datos/almacen'
import { haySesion, iniciarSesionConCodigo, nubeConfigurada, useEstadoSync } from './datos/sync'
import Caja from './pantallas/Caja'
import Pedidos from './pantallas/Pedidos'
import Contabilidad from './pantallas/Contabilidad'
import Ajustes from './pantallas/Ajustes'
import { Modal } from './componentes/ui'

type Seccion = 'caja' | 'pedidos' | 'conta' | 'ajustes'

export default function App() {
  const [seccion, setSeccion] = useState<Seccion>('caja')
  const letra = useMeta<string | null>('dispositivo', null)
  const modoLocal = useMeta<boolean>('modoLocal', false)
  const sesionAntes = useMeta<boolean>('sesionAlgunaVez', false)
  const sinEnviar = useSinEnviar()
  const sync = useEstadoSync()
  const [ahora, setAhora] = useState(Date.now())
  const [revisado, setRevisado] = useState(!nubeConfigurada)

  useEffect(() => {
    void haySesion().finally(() => setRevisado(true))
    const t = setInterval(() => setAhora(Date.now()), 5000)
    return () => clearInterval(t)
  }, [])

  if (letra === undefined || modoLocal === undefined || sesionAntes === undefined || !revisado) return <div className="cargando">Cargando…</div>

  if (nubeConfigurada && !sync.conectado && !sesionAntes && !modoLocal) return <Entrada />

  if (letra === null) return <ElegirLetra />

  let badge = { texto: 'Solo en este celular', clase: 'local' }
  if (nubeConfigurada && !modoLocal && sesionAntes) {
    if (sinEnviar > 0) badge = { texto: `${sinEnviar} sin enviar`, clase: 'pend' }
    else if (sync.ultimoExito && ahora - sync.ultimoExito < 30000) badge = { texto: 'Sincronizado', clase: 'ok' }
    else badge = { texto: 'Sin conexión', clase: 'local' }
  }

  return (
    <div className="app">
      <header className="cabecera">
        <img className="logo" src="/logo.png" alt="Cubárbaros" width={44} height={44} />
        <div className="titulo-app">
          <span className="nombre">Cubárbaros Caja</span>
          <span className="frase">
            Celular {letra}
            <span className={'insignia ' + badge.clase} role="status">
              {badge.texto}
            </span>
          </span>
        </div>
        <button className="btn-icono claro" onClick={() => setSeccion('ajustes')} aria-label="Ajustes">
          ⚙
        </button>
      </header>
      <main className="contenido">
        <div hidden={seccion !== 'caja'}>
          <Caja />
        </div>
        {seccion === 'pedidos' && <Pedidos />}
        {seccion === 'conta' && <Contabilidad />}
        {seccion === 'ajustes' && (
          <Ajustes
            onEntrarCodigo={async () => {
              await escribirMeta('modoLocal', false)
              await escribirMeta('sesionAlgunaVez', false)
            }}
          />
        )}
      </main>
      <nav className="navegacion" aria-label="Secciones">
        {(
          [
            ['caja', 'Caja', '🧾'],
            ['pedidos', 'Pedidos', '🥪'],
            ['conta', 'Contabilidad', '📊'],
          ] as [Seccion, string, string][]
        ).map(([s, t, i]) => (
          <button key={s} className={'nav-btn' + (seccion === s ? ' sel' : '')} onClick={() => setSeccion(s)} aria-current={seccion === s ? 'page' : undefined}>
            <span className="nav-ico" aria-hidden>
              {i}
            </span>
            {t}
          </button>
        ))}
      </nav>
    </div>
  )
}

function Entrada() {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  return (
    <div className="entrada-pantalla">
      <img className="logo-grande" src="/logo.png" alt="Cubárbaros" width={160} height={160} />
      <h1>Cubárbaros Caja</h1>
      <p className="texto">Escribe el código de acceso para compartir datos entre los celulares.</p>
      <input className="entrada" type="password" inputMode="text" autoComplete="off" placeholder="Código de acceso" value={codigo} onChange={(e) => setCodigo(e.target.value)} aria-label="Código de acceso" />
      {error && <p className="error">{error}</p>}
      <button
        className="btn btn-principal"
        disabled={!codigo.trim() || cargando}
        onClick={async () => {
          setCargando(true)
          setError('')
          const e = await iniciarSesionConCodigo(codigo)
          setCargando(false)
          if (e) setError(e)
        }}
      >
        {cargando ? 'Entrando…' : 'Entrar'}
      </button>
      <button className="btn btn-sec" onClick={() => escribirMeta('modoLocal', true)}>
        Usar solo en este celular
      </button>
    </div>
  )
}

function ElegirLetra() {
  return (
    <Modal titulo="¿Qué celular es este?" cerrable={false}>
      <p className="texto">Elige una letra distinta para cada celular. Sirve para que los números de pedido no se repitan (A-1, B-1…). Cajero: A. Dueño: B.</p>
      <div className="atajos">
        {['A', 'B', 'C'].map((l) => (
          <button key={l} className="btn btn-chip grande-letra" onClick={() => escribirMeta('dispositivo', l)}>
            {l}
          </button>
        ))}
      </div>
    </Modal>
  )
}
