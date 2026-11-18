import { useMemo, useState } from 'react'
import { agregarGasto, borrarGasto, guardarConfig, useConfig, useGastos, usePedidos } from '../datos/almacen'
import { resumir, ventasPorHora } from '../logica/contabilidad'
import { formatoCOP } from '../logica/dinero'
import { fechaHoraColombia, generarCSV, generarResumenWhatsApp } from '../logica/exportar'
import { CATEGORIAS, ORIGENES, type Categoria, type Gasto, type OrigenGasto } from '../logica/tipos'
import { CampoMonto, Confirmar, Modal, copiarTexto } from '../componentes/ui'

export default function Contabilidad() {
  const pedidos = usePedidos()
  const gastos = useGastos()
  const cfg = useConfig()
  const r = useMemo(() => resumir(pedidos, gastos, cfg), [pedidos, gastos, cfg])
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
        <h3>Resumen</h3>
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
        <hr />
        <Fila t="Gastos" v={formatoCOP(r.gastos)} />
      </section>

      <section className="tarjeta">
        <h3>Utilidad y reparto</h3>
        <Fila t="Utilidad (ventas − gastos)" v={formatoCOP(r.utilidad)} grande />
        <p className="propuesta">Reparto propuesta, ajustable (en Ajustes)</p>
        <Fila t={`Yo (${cfg.porcentajeDueno}%)`} v={formatoCOP(r.repartoDueno)} />
        <Fila t={`Socio (${100 - cfg.porcentajeDueno}%)`} v={formatoCOP(r.repartoSocio)} />
        {(r.gastosPorOrigen.yo > 0 || r.gastosPorOrigen.socio > 0) && (
          <p className="pequeno">
            Ya pusieron de su bolsillo: yo {formatoCOP(r.gastosPorOrigen.yo)} · socio {formatoCOP(r.gastosPorOrigen.socio)}
          </p>
        )}
      </section>

      <section className="tarjeta">
        <h3>Cuadre de caja</h3>
        <Fila t="Base inicial" v={formatoCOP(cfg.baseCaja)} />
        <Fila t="+ Efectivo neto de ventas" v={formatoCOP(r.efectivoNeto)} />
        <Fila t="− Gastos pagados de la caja" v={formatoCOP(r.gastosPorOrigen.caja)} />
        <Fila t="Efectivo esperado" v={formatoCOP(r.efectivoEsperado)} grande />
        <CampoMonto etiqueta="Efectivo contado" valor={cfg.efectivoContado ?? 0} onCambio={(n) => guardarConfig({ efectivoContado: n || null }, { texto: n ? `Contó el efectivo: ${formatoCOP(n)}` : 'Borró el efectivo contado', clave: 'contado' })} />
        {r.diferenciaCuadre !== null && (
          <div className={'cuadre ' + (r.diferenciaCuadre === 0 ? 'ok' : 'mal')}>
            {r.diferenciaCuadre === 0 ? 'Cuadra exacto ✓' : r.diferenciaCuadre > 0 ? `Sobran ${formatoCOP(r.diferenciaCuadre)}` : `Faltan ${formatoCOP(-r.diferenciaCuadre)}`}
          </div>
        )}
      </section>

      <FormGastos />
      <ListaGastos gastos={gastos} />

      <section className="tarjeta">
        <h3>Ventas por hora</h3>
        <Grafico horas={horas} />
      </section>

      <section className="tarjeta">
        <h3>Exportar</h3>
        <div className="fila-botones col">
          <button className="btn btn-sec" onClick={() => copiar('CSV', generarCSV(pedidos, gastos))}>
            Copiar CSV (pedidos y gastos)
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

function FormGastos() {
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState(0)
  const [cat, setCat] = useState<Categoria>('Ingredientes')
  const [origen, setOrigen] = useState<OrigenGasto>('caja')
  const valido = concepto.trim().length > 0 && monto > 0
  return (
    <section className="tarjeta">
      <h3>Registrar gasto</h3>
      <button
        className="btn btn-chip"
        onClick={() => {
          setConcepto('Stand')
          setMonto(150000)
          setCat('Stand')
        }}
      >
        Atajo: stand $150.000
      </button>
      <label className="campo">
        <span className="campo-et">Concepto</span>
        <input className="entrada" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: pan, jamón, hielo" />
      </label>
      <CampoMonto etiqueta="Monto" valor={monto} onCambio={setMonto} />
      <label className="campo">
        <span className="campo-et">Categoría</span>
        <select className="entrada" value={cat} onChange={(e) => setCat(e.target.value as Categoria)}>
          {CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="campo">
        <span className="campo-et">¿De dónde salió la plata?</span>
        <select className="entrada" value={origen} onChange={(e) => setOrigen(e.target.value as OrigenGasto)}>
          {ORIGENES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
      </label>
      <button
        className="btn btn-principal"
        disabled={!valido}
        onClick={async () => {
          await agregarGasto({ concepto: concepto.trim(), monto, categoria: cat, origen })
          setConcepto('')
          setMonto(0)
        }}
      >
        Guardar gasto
      </button>
    </section>
  )
}

function ListaGastos({ gastos }: { gastos: Gasto[] }) {
  const [borrando, setBorrando] = useState<Gasto | null>(null)
  if (!gastos.length) return null
  return (
    <section className="tarjeta">
      <h3>Gastos registrados</h3>
      {[...gastos]
        .sort((a, b) => b.creadoEn - a.creadoEn)
        .map((g) => (
          <div key={g.id} className="gasto">
            <div>
              <strong>{g.concepto}</strong>
              <div className="pequeno">
                {g.categoria} · {ORIGENES.find((o) => o.valor === g.origen)?.texto} · {fechaHoraColombia(g.creadoEn).slice(11)}
              </div>
            </div>
            <div className="gasto-der">
              <strong>{formatoCOP(g.monto)}</strong>
              <button className="enlace-peligro" onClick={() => setBorrando(g)}>
                Borrar
              </button>
            </div>
          </div>
        ))}
      {borrando && (
        <Confirmar
          titulo="¿Borrar este gasto?"
          mensaje={`${borrando.concepto} · ${formatoCOP(borrando.monto)}`}
          textoConfirmar="Sí, borrar"
          peligro
          onCancelar={() => setBorrando(null)}
          onConfirmar={() => {
            void borrarGasto(borrando.id)
            setBorrando(null)
          }}
        />
      )}
    </section>
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
