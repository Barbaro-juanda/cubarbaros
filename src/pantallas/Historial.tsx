import { useHistorial } from '../datos/almacen'
import { fechaHoraColombia } from '../logica/exportar'

/** Lista de cambios de todos los celulares: qué se hizo, cuándo y quién. */
export default function Historial() {
  const cambios = useHistorial()
  if (!cambios.length) return <p className="pequeno">Todavía no hay cambios.</p>
  return (
    <ul className="historial">
      {cambios.map((c, i) => (
        <li key={`${c.ts}-${i}`}>
          <div className="historial-cab">
            <strong>{c.quien}</strong>
            <span>{fechaHoraColombia(c.ts).slice(5)}</span>
          </div>
          <div>
            {c.sobre}: {c.texto}
          </div>
        </li>
      ))}
    </ul>
  )
}
