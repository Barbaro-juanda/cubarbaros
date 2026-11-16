import { useMemo, useState } from 'react'
import { anularPedido, cambiarEstado, usePedidos } from '../datos/almacen'
import { formatoCOP } from '../logica/dinero'
import { fechaHoraColombia } from '../logica/exportar'
import { ESTADOS, type EstadoPedido, type Pedido } from '../logica/tipos'
import { Confirmar } from '../componentes/ui'

type Filtro = 'todos' | EstadoPedido | 'anulados'
const NOMBRE: Record<EstadoPedido, string> = { pendiente: 'Pendiente', preparando: 'Preparando', listo: 'Listo', entregado: 'Entregado' }
const ACCION: Record<EstadoPedido, string> = { pendiente: 'Empezar a preparar', preparando: 'Marcar listo', listo: 'Marcar entregado', entregado: '' }

export default function Pedidos() {
  const pedidos = usePedidos()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [anulando, setAnulando] = useState<Pedido | null>(null)

  const activos = useMemo(() => pedidos.filter((p) => !p.anulado), [pedidos])
  const cuenta = (f: Filtro) => (f === 'todos' ? activos.length : f === 'anulados' ? pedidos.length - activos.length : activos.filter((p) => p.estado === f).length)
  const lista = useMemo(
    () =>
      pedidos
        .filter((p) => (filtro === 'anulados' ? p.anulado : filtro === 'todos' ? !p.anulado : !p.anulado && p.estado === filtro))
        .sort((a, b) => b.creadoEn - a.creadoEn),
    [pedidos, filtro],
  )
  const filtros: { f: Filtro; t: string }[] = [{ f: 'todos', t: 'Todos' }, ...ESTADOS.map((e) => ({ f: e as Filtro, t: NOMBRE[e] })), { f: 'anulados', t: 'Anulados' }]

  return (
    <div className="pantalla">
      <div className="filtros">
        {filtros.map(({ f, t }) => (
          <button key={f} className={'btn btn-chip' + (filtro === f ? ' sel' : '')} onClick={() => setFiltro(f)}>
            {t} <span className="cuenta">{cuenta(f)}</span>
          </button>
        ))}
      </div>

      {lista.length === 0 && <p className="vacio">No hay pedidos aquí.</p>}
      {lista.map((p) => {
        const i = ESTADOS.indexOf(p.estado)
        return (
          <article key={p.id} className={'tarjeta pedido' + (p.anulado ? ' anulado' : '')}>
            <header className="pedido-cab">
              <strong className="pedido-num">{p.numero}</strong>
              <span className="pedido-hora">{fechaHoraColombia(p.creadoEn).slice(11)}</span>
              {p.anulado ? <span className="etiqueta e-anulado">Anulado</span> : <span className={'etiqueta e-' + p.estado}>{NOMBRE[p.estado]}</span>}
            </header>
            <ul className="lista-lineas">
              {p.lineas.map((l) => (
                <li key={l.productoId}>
                  {l.cantidad} × {l.nombre}
                </li>
              ))}
            </ul>
            {p.nota && <p className="nota">📝 {p.nota}</p>}
            <div className="pedido-total">{formatoCOP(p.total)}</div>
            <p className="pago-detalle">{detallePago(p)}</p>

            {p.anulado ? (
              <button className="btn btn-sec" onClick={() => anularPedido(p.id, false)}>
                Restaurar pedido
              </button>
            ) : (
              <>
                <div className="fila-botones">
                  {i > 0 && (
                    <button className="btn btn-sec btn-peq" onClick={() => cambiarEstado(p.id, ESTADOS[i - 1])}>
                      ↶ Deshacer
                    </button>
                  )}
                  {p.estado !== 'entregado' && (
                    <button className="btn btn-principal" onClick={() => cambiarEstado(p.id, ESTADOS[i + 1])}>
                      {ACCION[p.estado]}
                    </button>
                  )}
                </div>
                <button className="enlace-peligro" onClick={() => setAnulando(p)}>
                  Anular pedido
                </button>
              </>
            )}
          </article>
        )
      })}

      {anulando && (
        <Confirmar
          titulo={`¿Anular ${anulando.numero}?`}
          mensaje="No contará en la contabilidad. Lo puedes restaurar después desde Anulados."
          textoConfirmar="Sí, anular"
          peligro
          onCancelar={() => setAnulando(null)}
          onConfirmar={() => {
            void anularPedido(anulando.id, true)
            setAnulando(null)
          }}
        />
      )}
    </div>
  )
}

function detallePago(p: Pedido): string {
  const x = p.pago
  if (x.metodo === 'efectivo') return `Efectivo · recibido ${formatoCOP(x.efectivoRecibido)} · devuelto ${formatoCOP(x.devuelto)}`
  const t = `${x.canal ?? 'Transferencia'} ${formatoCOP(x.transferencia)}${x.referencia ? ` (ref. ${x.referencia})` : ''}`
  if (x.metodo === 'transferencia') return `Transferencia · ${t}`
  return `Mixto · ${t} + efectivo recibido ${formatoCOP(x.efectivoRecibido)}, devuelto ${formatoCOP(x.devuelto)}`
}
