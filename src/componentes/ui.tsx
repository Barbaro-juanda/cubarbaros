import { useEffect, useRef, type ReactNode } from 'react'
import { formatoCOP, leerMonto } from '../logica/dinero'

export function Modal({ titulo, onCerrar, children, cerrable = true }: { titulo: string; onCerrar?: () => void; children: ReactNode; cerrable?: boolean }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  return (
    <div className="velo" onClick={cerrable ? onCerrar : undefined}>
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="hoja-cab">
          <h2>{titulo}</h2>
          {cerrable && (
            <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar">
              ✕
            </button>
          )}
        </div>
        <div className="hoja-cuerpo">{children}</div>
      </div>
    </div>
  )
}

export function Confirmar({
  titulo,
  mensaje,
  textoConfirmar,
  peligro,
  deshabilitado,
  onConfirmar,
  onCancelar,
}: {
  titulo: string
  mensaje: ReactNode
  textoConfirmar: string
  peligro?: boolean
  deshabilitado?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <Modal titulo={titulo} onCerrar={onCancelar}>
      <p className="texto">{mensaje}</p>
      <div className="fila-botones">
        <button className="btn btn-sec" onClick={onCancelar}>
          Cancelar
        </button>
        <button className={peligro ? 'btn btn-peligro' : 'btn btn-principal'} disabled={deshabilitado} onClick={onConfirmar}>
          {textoConfirmar}
        </button>
      </div>
    </Modal>
  )
}

/** Campo de plata: el usuario escribe números y se ve como $20.000. Siempre entero. */
export function CampoMonto({ valor, onCambio, etiqueta, placeholder = '$0', autoFoco }: { valor: number; onCambio: (n: number) => void; etiqueta?: string; placeholder?: string; autoFoco?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFoco) ref.current?.focus()
  }, [autoFoco])
  return (
    <label className="campo">
      {etiqueta && <span className="campo-et">{etiqueta}</span>}
      <input ref={ref} className="entrada entrada-monto" inputMode="numeric" placeholder={placeholder} value={valor ? formatoCOP(valor) : ''} onChange={(e) => onCambio(leerMonto(e.target.value))} />
    </label>
  )
}

export function Atajos({ opciones, onElegir }: { opciones: { texto: string; valor: number }[]; onElegir: (n: number) => void }) {
  return (
    <div className="atajos">
      {opciones.map((o) => (
        <button key={o.texto} className="btn btn-chip" onClick={() => onElegir(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  )
}

export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = texto
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
