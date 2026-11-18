import { useMemo, useState } from 'react'
import { crearPedido, numeroVisible, useConfig } from '../datos/almacen'
import { cobrarEfectivo, cobrarMixto, cobrarTransferencia, totalPedido } from '../logica/cobro'
import { formatoCOP } from '../logica/dinero'
import { CANALES, type Canal, type LineaPedido, type Metodo, type Pedido } from '../logica/tipos'
import { Atajos, CampoMonto, Modal } from '../componentes/ui'

export default function Caja() {
  const cfg = useConfig()
  const [cant, setCant] = useState<Record<string, number>>({})
  const [nota, setNota] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const [listo, setListo] = useState<{ p: Pedido; n: number } | null>(null)

  const lineas: LineaPedido[] = useMemo(
    () => cfg.menu.filter((p) => (cant[p.id] ?? 0) > 0).map((p) => ({ productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: cant[p.id] })),
    [cfg.menu, cant],
  )
  const total = totalPedido(lineas)
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)
  const cambiar = (id: string, d: number) => setCant((c) => ({ ...c, [id]: Math.max(0, Math.min(99, (c[id] ?? 0) + d)) }))
  const limpiar = () => {
    setCant({})
    setNota('')
  }

  return (
    <div className="pantalla con-barra">
      <div className="productos">
        {cfg.menu.map((p) => {
          const c = cant[p.id] ?? 0
          return (
            <div key={p.id} className={'producto' + (c > 0 ? ' activo' : '')}>
              <button className="producto-info" onClick={() => cambiar(p.id, 1)}>
                <span className="producto-nombre">{p.nombre}</span>
                <span className="producto-precio">{formatoCOP(p.precio)}</span>
              </button>
              <div className="contador">
                <button className="btn-contador" onClick={() => cambiar(p.id, -1)} disabled={c === 0} aria-label={`Quitar ${p.nombre}`}>
                  −
                </button>
                <span className="contador-num">{c}</span>
                <button className="btn-contador mas" onClick={() => cambiar(p.id, 1)} aria-label={`Agregar ${p.nombre}`}>
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <label className="campo">
        <span className="campo-et">Nota del pedido (opcional)</span>
        <input className="entrada" value={nota} onChange={(e) => setNota(e.target.value)} placeholder='Ej: "sin pepinillos", nombre del cliente' />
      </label>

      <div className="barra-cobro">
        <button className="btn btn-sec btn-peq" onClick={limpiar} disabled={!unidades && !nota}>
          Limpiar
        </button>
        <button className="btn btn-principal btn-cobrar" disabled={total <= 0} onClick={() => setCobrando(true)}>
          Cobrar {total > 0 && <>· {formatoCOP(total)}</>}
        </button>
      </div>

      {cobrando && (
        <PanelCobro
          total={total}
          onCerrar={() => setCobrando(false)}
          onConfirmar={async (pago) => {
            const p = await crearPedido(lineas, nota, pago)
            setCobrando(false)
            limpiar()
            setListo({ p, n: await numeroVisible(p.id) })
          }}
        />
      )}
      {listo && (
        <Modal titulo={`Pedido #${listo.n} guardado`} onCerrar={() => setListo(null)}>
          {listo.p.pago.devuelto > 0 && (
            <div className="cambio-grande">
              <span>Devolver</span>
              <strong>{formatoCOP(listo.p.pago.devuelto)}</strong>
            </div>
          )}
          {listo.p.pago.transferencia > 0 && <p className="aviso">Confirma que la plata llegó antes de entregar.</p>}
          <p className="texto">
            Total {formatoCOP(listo.p.total)} · {listo.p.pago.metodo}
          </p>
          <button className="btn btn-principal" onClick={() => setListo(null)}>
            Listo, siguiente pedido
          </button>
        </Modal>
      )}
    </div>
  )
}

function PanelCobro({ total, onCerrar, onConfirmar }: { total: number; onCerrar: () => void; onConfirmar: (p: NonNullable<ReturnType<typeof cobrarEfectivo>['pago']>) => Promise<void> }) {
  const [metodo, setMetodo] = useState<Metodo>('efectivo')
  const [recibido, setRecibido] = useState(0)
  const [transf, setTransf] = useState(0)
  const [canal, setCanal] = useState<Canal | undefined>()
  const [ref, setRef] = useState('')
  const [guardando, setGuardando] = useState(false)

  const r =
    metodo === 'efectivo' ? cobrarEfectivo(total, recibido) : metodo === 'transferencia' ? cobrarTransferencia(total, canal, ref) : cobrarMixto(total, transf, recibido, canal, ref)

  const confirmar = async () => {
    if (!r.ok || !r.pago || guardando) return
    setGuardando(true)
    await onConfirmar(r.pago)
  }

  const bloqueCanal = (
    <>
      <div className="campo-et">Canal</div>
      <div className="atajos">
        {CANALES.map((c) => (
          <button key={c} className={'btn btn-chip' + (canal === c ? ' sel' : '')} onClick={() => setCanal(c)}>
            {c}
          </button>
        ))}
      </div>
      <label className="campo">
        <span className="campo-et">Referencia (opcional)</span>
        <input className="entrada" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Número o nombre en el comprobante" />
      </label>
    </>
  )

  const bloqueEfectivo = (debido: number) => (
    <>
      <CampoMonto etiqueta="Efectivo recibido" valor={recibido} onCambio={setRecibido} autoFoco />
      <Atajos
        opciones={[
          { texto: 'Exacto', valor: debido },
          { texto: '$20.000', valor: 20000 },
          { texto: '$50.000', valor: 50000 },
          { texto: '$100.000', valor: 100000 },
        ]}
        onElegir={setRecibido}
      />
      {recibido > 0 && r.ok && (
        <div className="cambio-grande">
          <span>Devolver</span>
          <strong>{formatoCOP(r.devolver)}</strong>
        </div>
      )}
      {recibido > 0 && !r.ok && r.falta > 0 && (
        <div className="falta">
          Faltan <strong>{formatoCOP(r.falta)}</strong>
        </div>
      )}
    </>
  )

  return (
    <Modal titulo="Cobrar" onCerrar={onCerrar}>
      <div className="total-cobro">
        <span>Total</span>
        <strong>{formatoCOP(total)}</strong>
      </div>
      <div className="pestanas">
        {(['efectivo', 'transferencia', 'mixto'] as Metodo[]).map((m) => (
          <button key={m} className={'pestana' + (metodo === m ? ' sel' : '')} onClick={() => setMetodo(m)}>
            {m === 'efectivo' ? 'Efectivo' : m === 'transferencia' ? 'Transferencia' : 'Mixto'}
          </button>
        ))}
      </div>

      {metodo === 'efectivo' && bloqueEfectivo(total)}
      {metodo === 'transferencia' && (
        <>
          <p className="aviso">Confirma que la plata llegó antes de entregar.</p>
          {bloqueCanal}
        </>
      )}
      {metodo === 'mixto' && (
        <>
          <CampoMonto etiqueta="Llegó por transferencia" valor={transf} onCambio={setTransf} autoFoco />
          <p className="aviso">Confirma que la plata llegó antes de entregar.</p>
          {bloqueCanal}
          {transf > 0 && transf < total && (
            <>
              <div className="falta ok">
                Falta en efectivo: <strong>{formatoCOP(total - transf)}</strong>
              </div>
              {bloqueEfectivo(total - transf)}
            </>
          )}
        </>
      )}

      {r.error && !(r.falta > 0) && metodo !== 'efectivo' && <p className="error">{r.error}</p>}
      <button className="btn btn-principal" disabled={!r.ok || guardando} onClick={confirmar}>
        Confirmar pago
      </button>
    </Modal>
  )
}
