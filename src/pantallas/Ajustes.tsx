import { useState } from 'react'
import { guardarConfig, useConfig, useMeta } from '../datos/almacen'
import { aplicarBorradoLocal, cerrarSesion, nubeConfigurada, sincronizar, useEstadoSync } from '../datos/sync'
import { escribirMeta, exportarCopiaLocal } from '../datos/db'
import { formatoCOP, leerMonto } from '../logica/dinero'
import type { Producto } from '../logica/tipos'
import { CampoMonto, Confirmar, Modal, copiarTexto } from '../componentes/ui'

export default function Ajustes({ onEntrarCodigo }: { onEntrarCodigo: () => void }) {
  const cfg = useConfig()
  const letra = useMeta<string | null>('dispositivo', null)
  const sync = useEstadoSync()
  const [borrador, setBorrador] = useState<Producto[] | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [msg, setMsg] = useState('')
  const [copia, setCopia] = useState<string | null>(null)
  const menu = borrador ?? cfg.menu
  const sucio = borrador !== null
  const aviso = (t: string) => {
    setMsg(t)
    setTimeout(() => setMsg(''), 2500)
  }

  const editar = (id: string, c: Partial<Producto>) => setBorrador(menu.map((p) => (p.id === id ? { ...p, ...c } : p)))
  const menuValido = menu.length > 0 && menu.every((p) => p.nombre.trim() && p.precio > 0)

  return (
    <div className="pantalla">
      <section className="tarjeta">
        <h3>Menú</h3>
        {menu.map((p) => (
          <div key={p.id} className="menu-fila">
            <input className="entrada" value={p.nombre} onChange={(e) => editar(p.id, { nombre: e.target.value })} aria-label="Nombre del producto" />
            <input className="entrada entrada-monto" inputMode="numeric" value={p.precio ? formatoCOP(p.precio) : ''} placeholder="$0" onChange={(e) => editar(p.id, { precio: leerMonto(e.target.value) })} aria-label="Precio" />
            <button className="btn-icono peligro" aria-label={`Quitar ${p.nombre}`} onClick={() => setBorrador(menu.filter((x) => x.id !== p.id))}>
              ✕
            </button>
          </div>
        ))}
        <div className="fila-botones">
          <button className="btn btn-sec" onClick={() => setBorrador([...menu, { id: crypto.randomUUID(), nombre: '', precio: 0 }])}>
            + Agregar producto
          </button>
          <button
            className="btn btn-principal"
            disabled={!sucio || !menuValido}
            onClick={async () => {
              await guardarConfig({ menu: menu.map((p) => ({ ...p, nombre: p.nombre.trim() })) })
              setBorrador(null)
              aviso('Menú guardado')
            }}
          >
            Guardar menú
          </button>
        </div>
        {sucio && !menuValido && <p className="error">Cada producto necesita nombre y precio.</p>}
        <p className="pequeno">Los pedidos ya hechos conservan el precio con el que se vendieron.</p>
      </section>

      <section className="tarjeta">
        <h3>Caja y reparto</h3>
        <CampoMonto etiqueta="Base inicial de efectivo" valor={cfg.baseCaja} onCambio={(n) => guardarConfig({ baseCaja: n })} />
        <label className="campo">
          <span className="campo-et">Porcentaje para mí (dueño) · propuesta, ajustable</span>
          <input
            className="entrada"
            inputMode="numeric"
            value={String(cfg.porcentajeDueno)}
            onChange={(e) => guardarConfig({ porcentajeDueno: Math.min(100, leerMonto(e.target.value)) })}
          />
        </label>
        <p className="pequeno">Socio: {100 - cfg.porcentajeDueno}%</p>
      </section>

      <section className="tarjeta">
        <h3>Este celular</h3>
        <div className="campo-et">Letra del celular (para numerar pedidos sin que se repitan)</div>
        <div className="atajos">
          {['A', 'B', 'C'].map((l) => (
            <button key={l} className={'btn btn-chip' + (letra === l ? ' sel' : '')} onClick={() => escribirMeta('dispositivo', l)}>
              {l}
            </button>
          ))}
        </div>
        <p className="pequeno">Cada celular debe tener una letra distinta. El cajero: A. Yo: B.</p>
      </section>

      <section className="tarjeta">
        <h3>Sincronización</h3>
        {!nubeConfigurada && <p className="texto">Esta versión no tiene la nube configurada: todo se guarda solo en este celular.</p>}
        {nubeConfigurada && (
          <>
            <p className="texto">{sync.conectado ? 'Conectado con la nube.' : 'Sin conexión con la nube (solo en este celular).'}</p>
            {sync.error && <p className="error">{sync.error}</p>}
            <div className="fila-botones col">
              {sync.conectado ? (
                <>
                  <button className="btn btn-sec" onClick={() => void sincronizar()} disabled={sync.sincronizando}>
                    {sync.sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
                  </button>
                  <button className="btn btn-sec" onClick={() => void cerrarSesion()}>
                    Salir de la nube
                  </button>
                </>
              ) : (
                <button className="btn btn-principal" onClick={onEntrarCodigo}>
                  Entrar con correo
                </button>
              )}
            </div>
          </>
        )}
        <button
          className="btn btn-sec"
          onClick={async () => {
            const t = await exportarCopiaLocal()
            if (await copiarTexto(t)) aviso('Copia de seguridad copiada. Pégala en una nota o WhatsApp.')
            else setCopia(t)
          }}
        >
          Copiar copia de seguridad (JSON)
        </button>
      </section>

      <section className="tarjeta zona-peligro">
        <h3>Borrar datos de prueba</h3>
        <p className="texto">Borra todos los pedidos y gastos en TODOS los celulares y reinicia la numeración. No se puede deshacer.</p>
        <button className="btn btn-peligro" onClick={() => setBorrando(true)}>
          Borrar datos de prueba
        </button>
      </section>

      {msg && <div className="toast">{msg}</div>}
      {borrando && <BorrarDatos onCancelar={() => setBorrando(false)} onListo={() => { setBorrando(false); aviso('Datos de prueba borrados') }} />}
      {copia && (
        <Modal titulo="Copia a mano" onCerrar={() => setCopia(null)}>
          <textarea className="entrada caja-texto" readOnly value={copia} onFocus={(e) => e.currentTarget.select()} />
        </Modal>
      )}
    </div>
  )
}

function BorrarDatos({ onCancelar, onListo }: { onCancelar: () => void; onListo: () => void }) {
  const [txt, setTxt] = useState('')
  const ok = txt === 'BORRAR'
  return (
    <Confirmar
      titulo="¿Borrar todo?"
      mensaje={
        <>
          Escribe <strong>BORRAR</strong> para confirmar.
          <input className="entrada" style={{ marginTop: 12 }} value={txt} onChange={(e) => setTxt(e.target.value)} autoCapitalize="characters" autoComplete="off" aria-label="Escribe BORRAR" />
        </>
      }
      textoConfirmar="Borrar todo"
      peligro
      deshabilitado={!ok}
      onCancelar={onCancelar}
      onConfirmar={async () => {
        if (!ok) return
        const ahora = Date.now()
        await aplicarBorradoLocal(ahora)
        await guardarConfig({ borradoEn: ahora, efectivoContado: null })
        onListo()
      }}
    />
  )
}
