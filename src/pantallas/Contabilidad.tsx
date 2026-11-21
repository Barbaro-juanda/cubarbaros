import { useMemo, useState } from 'react'
import { guardarConfig, useConfig, usePedidos } from '../datos/almacen'
import { resumir, ventasPorHora } from '../logica/contabilidad'
import { formatoCOP } from '../logica/dinero'
import { generarCSV, generarResumenWhatsApp } from '../logica/exportar'
import type { Gasto } from '../logica/tipos'
import { CampoMonto, Modal, copiarTexto } from '../componentes/ui'

/** La app ya no maneja gastos: el resumen solo cuenta lo vendido. */
const SIN_GASTOS: Gasto[] = []

export default function Contabilidad() {
  const pedidos = usePedidos()
  const cfg = useConfig()
  const r = useMemo(() => resumir(pedidos, SIN_GASTOS, cfg), [pedidos, cfg])
  const horas = useMemo(() => ventasPorHora(pedidos), [pedidos])
  const [manual, setManual] = useState<{ titulo: string; texto: string } | null>(null)
  const [copiado, setCopiado] = useState('')

  const copiar = async (titulo: string, texto: string) => {
    if (await copiarTexto(texto)) {
      setCopiado(titulo)
      setTimeout(() => setCopiado(''), 2500)
    } else setManual({ titulo, texto })
  }

  return (
    <div className="pantalla">
      <section className="tarjeta">
        <h3>Lo que vendimos hoy</h3>
        <Fila t="Ventas totales" v={formatoCOP(r.ventas)} grande />
        <Fila t="Pedidos" v={String(r.numPedidos)} />
        {r.unidades.map((u) => (
          <Fila key={u.nombre} t={`• ${u.nombre}`} v={`${u.cantidad} und · ${formatoCOP(u.total)}`} />
        ))}
        <hr />
        <Fila t="Efectivo neto" v={formatoCOP(r.efectivoNeto)} />
        <Fila t="Transferencias" v={formatoCOP(r.transferencias)} />
        {Object.entries(r.transferenciasPorCanal).map(([c, v]) => (
          <Fila key={c} t={`• ${c}`} v={formatoCOP(v)} />
        ))}
      </section>

      <section className="tarjeta">
        <h3>Cuadre de caja</h3>
        <Fila t="Base inicial" v={formatoCOP(cfg.baseCaja)} />
        <Fila t="+ Efectivo neto de ventas" v={formatoCOP(r.efectivoNeto)} />
        <Fila t="Efectivo esperado" v={formatoCOP(r.efectivoEsperado)} grande />
        <CampoMonto etiqueta="Efectivo contado" valor={cfg.efectivoContado ?? 0} onCambio={(n) => guardarConfig({ efectivoContado: n || null }, { texto: n ? `Contó el efectivo: ${formatoCOP(n)}` : 'Borró el efectivo contado', clave: 'contado' })} />
        {r.diferenciaCuadre !== null && (
          <div className={'cuadre ' + (r.diferenciaCuadre === 0 ? 'ok' : 'mal')}>
            {r.diferenciaCuadre === 0 ? 'Cuadra exacto ✓' : r.diferenciaCuadre > 0 ? `Sobran ${formatoCOP(r.diferenciaCuadre)}` : `Faltan ${formatoCOP(-r.diferenciaCuadre)}`}
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h3>Ventas por hora</h3>
        <Grafico horas={horas} />
      </section>

      <section className="tarjeta">
        <h3>Exportar</h3>
        <div className="fila-botones col">
          <button className="btn btn-sec" onClick={() => copiar('CSV', generarCSV(pedidos, SIN_GASTOS))}>
            Copiar CSV (pedidos)
          </button>
          <button className="btn btn-sec" onClick={() => copiar('Resumen', generarResumenWhatsApp(r, cfg))}>
            Copiar resumen para WhatsApp
          </button>
        </div>
        {copiado && <p className="ok-texto">✓ {copiado} copiado</p>}
      </section>

      {manual && (
        <Modal titulo={`Copia ${manual.titulo} a mano`} onCerrar={() => setManual(null)}>
          <p className="texto">Tu celular no dejó copiar solo. Mantén presionado el texto, elige “Seleccionar todo” y “Copiar”.</p>
          <textarea className="entrada caja-texto" readOnly value={manual.texto} onFocus={(e) => e.currentTarget.select()} />
        </Modal>
      )}
    </div>
  )
}

function Fila({ t, v, grande }: { t: string; v: string; grande?: boolean }) {
  return (
    <div className={'fila-dato' + (grande ? ' grande' : '')}>
      <span>{t}</span>
      <strong>{v}</strong>
    </div>
  )
}

function Grafico({ horas }: { horas: { hora: number; total: number; pedidos: number }[] }) {
  const conVentas = horas.filter((h) => h.total > 0).map((h) => h.hora)
  const ini = Math.min(12, ...conVentas)
  const fin = Math.max(23, ...conVentas)
  const vis = horas.filter((h) => h.hora >= ini && h.hora <= fin)
  const max = Math.max(1, ...vis.map((h) => h.total))
  return (
    <div className="grafico" role="img" aria-label="Ventas por hora">
      {vis.map((h) => (
        <div key={h.hora} className="barra-col">
          <span className="barra-val">{h.pedidos > 0 ? h.pedidos : ''}</span>
          <div className="barra" style={{ height: `${Math.max(h.total > 0 ? 6 : 2, (h.total / max) * 100)}%` }} title={formatoCOP(h.total)} />
          <span className="barra-hora">{h.hora}</span>
        </div>
      ))}
    </div>
  )
}
