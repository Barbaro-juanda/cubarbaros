import { describe, expect, it } from 'vitest'
import { buscarPedidos } from '../src/logica/busqueda'
import { conCambio } from '../src/logica/historial'
import { etiquetaPedido, numerarPedidos } from '../src/logica/numeracion'
import { cobrarEfectivo, cobrarMixto, cobrarTransferencia, totalPedido } from '../src/logica/cobro'
import { debeAplicarRemoto, horaColombia, resumir, ventasPorHora } from '../src/logica/contabilidad'
import { formatoCOP, leerMonto, repartir } from '../src/logica/dinero'
import { generarCSV } from '../src/logica/exportar'
import { CONFIG_INICIAL, type Gasto, type Pago, type Pedido } from '../src/logica/tipos'

const PRECIO = 17900
let n = 0
function pedido(cant: number, pago: Pago, extra: Partial<Pedido> = {}): Pedido {
  n++
  return {
    id: 'p' + n,
    dispositivo: 'A',
    secuencia: n,
    numero: 'A-' + n,
    creadoEn: Date.UTC(2026, 10, 21, 17, 0), // 12:00 hora Colombia
    lineas: [{ productoId: 'sc', nombre: 'Sándwich cubano', precio: PRECIO, cantidad: cant }],
    total: PRECIO * cant,
    nota: '',
    estado: 'pendiente',
    anulado: false,
    pago,
    ...extra,
  }
}
const efectivo = (cant: number, recibido: number, extra: Partial<Pedido> = {}) =>
  pedido(cant, cobrarEfectivo(PRECIO * cant, recibido).pago!, extra)
const gasto = (monto: number, origen: Gasto['origen'], categoria: Gasto['categoria'] = 'Ingredientes'): Gasto => ({
  id: 'g' + monto + origen,
  concepto: 'x',
  monto,
  categoria,
  origen,
  creadoEn: 0,
})

describe('dinero', () => {
  it('formatea en pesos colombianos', () => {
    expect(formatoCOP(17900)).toBe('$17.900')
    expect(formatoCOP(0)).toBe('$0')
    expect(formatoCOP(1234567)).toBe('$1.234.567')
    expect(formatoCOP(-2100)).toBe('-$2.100')
  })
  it('lee montos escritos por el usuario', () => {
    expect(leerMonto('20.000')).toBe(20000)
    expect(leerMonto('$ 50 000')).toBe(50000)
    expect(leerMonto('')).toBe(0)
    expect(leerMonto('abc')).toBe(0)
  })
  it('reparte la utilidad sin perder pesos', () => {
    const r = repartir(100001, 70)
    expect(r.dueno + r.socio).toBe(100001)
    expect(repartir(-5001, 70).dueno + repartir(-5001, 70).socio).toBe(-5001)
    expect(repartir(1000, 100)).toEqual({ dueno: 1000, socio: 0 })
  })
  it('suma el total con enteros', () => {
    expect(totalPedido([{ precio: 17900, cantidad: 3 }, { precio: 3500, cantidad: 2 }])).toBe(60700)
  })
})

describe('cobro en efectivo', () => {
  it('billete exacto: no hay cambio', () => {
    const r = cobrarEfectivo(17900, 17900)
    expect(r.ok).toBe(true)
    expect(r.devolver).toBe(0)
  })
  it('calcula el cambio', () => {
    const r = cobrarEfectivo(17900, 20000)
    expect(r.ok).toBe(true)
    expect(r.devolver).toBe(2100)
    expect(r.pago).toMatchObject({ metodo: 'efectivo', efectivoRecibido: 20000, devuelto: 2100, transferencia: 0 })
  })
  it('con $100.000 por 3 sándwiches devuelve $46.300', () => {
    expect(cobrarEfectivo(53700, 100000).devolver).toBe(46300)
  })
  it('si recibe menos, muestra cuánto falta y no deja confirmar', () => {
    const r = cobrarEfectivo(17900, 10000)
    expect(r.ok).toBe(false)
    expect(r.falta).toBe(7900)
    expect(r.pago).toBeUndefined()
  })
  it('no cobra un pedido vacío', () => {
    expect(cobrarEfectivo(0, 5000).ok).toBe(false)
  })
})

describe('cobro por transferencia', () => {
  it('exige elegir canal', () => {
    expect(cobrarTransferencia(17900, undefined, '').ok).toBe(false)
  })
  it('guarda canal y referencia', () => {
    const r = cobrarTransferencia(17900, 'Nequi', ' ref123 ')
    expect(r.ok).toBe(true)
    expect(r.pago).toMatchObject({ metodo: 'transferencia', transferencia: 17900, efectivoRecibido: 0, devuelto: 0, canal: 'Nequi', referencia: 'ref123' })
  })
})

describe('cobro mixto', () => {
  it('calcula lo que falta en efectivo', () => {
    const r = cobrarMixto(35800, 10000, 0, 'Nequi', '')
    expect(r.ok).toBe(false)
    expect(r.efectivoDebido).toBe(25800)
    expect(r.falta).toBe(25800)
  })
  it('calcula el cambio del efectivo', () => {
    const r = cobrarMixto(35800, 10000, 30000, 'Daviplata', '')
    expect(r.ok).toBe(true)
    expect(r.devolver).toBe(4200)
    expect(r.pago).toMatchObject({ metodo: 'mixto', efectivoRecibido: 30000, devuelto: 4200, transferencia: 10000 })
  })
  it('rechaza transferencia 0, total o mayor al total', () => {
    expect(cobrarMixto(35800, 0, 50000, 'Nequi', '').ok).toBe(false)
    expect(cobrarMixto(35800, 35800, 0, 'Nequi', '').ok).toBe(false)
    expect(cobrarMixto(35800, 40000, 0, 'Nequi', '').ok).toBe(false)
  })
  it('exige canal', () => {
    expect(cobrarMixto(35800, 10000, 30000, undefined, '').ok).toBe(false)
  })
})

describe('contabilidad', () => {
  const pedidos = [
    efectivo(2, 50000), // venta 35.800, recibe 50.000, devuelve 14.200 -> neto 35.800
    pedido(1, cobrarTransferencia(PRECIO, 'Nequi', '').pago!),
    pedido(2, cobrarMixto(35800, 10000, 30000, 'Bancolombia', '').pago!), // efectivo neto 25.800
  ]
  const cfg = { ...CONFIG_INICIAL, baseCaja: 50000 }

  it('suma ventas, unidades, efectivo neto y transferencias', () => {
    const r = resumir(pedidos, [], cfg)
    expect(r.ventas).toBe(PRECIO * 5)
    expect(r.numPedidos).toBe(3)
    expect(r.unidades[0]).toMatchObject({ cantidad: 5, total: PRECIO * 5 })
    expect(r.efectivoNeto).toBe(35800 + 25800)
    expect(r.transferencias).toBe(PRECIO + 10000)
    expect(r.transferenciasPorCanal).toEqual({ Nequi: PRECIO, Bancolombia: 10000 })
    // efectivo neto + transferencias = ventas
    expect(r.efectivoNeto + r.transferencias).toBe(r.ventas)
  })

  it('un pedido anulado no cuenta, y al restaurarlo vuelve a contar', () => {
    const anulados = pedidos.map((p, i) => (i === 0 ? { ...p, anulado: true } : p))
    const r = resumir(anulados, [], cfg)
    expect(r.ventas).toBe(PRECIO * 3)
    expect(r.numPedidos).toBe(2)
    expect(r.efectivoNeto).toBe(25800)
    expect(resumir(pedidos, [], cfg).ventas).toBe(PRECIO * 5)
  })

  it('utilidad = ventas - gastos y reparto 70/30', () => {
    const gastos = [gasto(150000, 'yo', 'Stand'), gasto(20000, 'caja')]
    const r = resumir(pedidos, gastos, cfg)
    expect(r.gastos).toBe(170000)
    expect(r.utilidad).toBe(PRECIO * 5 - 170000)
    expect(r.repartoDueno + r.repartoSocio).toBe(r.utilidad)
    expect(r.gastosPorOrigen).toMatchObject({ caja: 20000, yo: 150000, socio: 0, transferencia: 0 })
    expect(r.gastosPorCategoria.Stand).toBe(150000)
  })

  it('cuadre: base + efectivo neto - gastos de caja', () => {
    const gastos = [gasto(20000, 'caja'), gasto(150000, 'yo')]
    const r = resumir(pedidos, gastos, cfg)
    expect(r.efectivoEsperado).toBe(50000 + 61600 - 20000)
    expect(r.diferenciaCuadre).toBeNull()
    const sobra = resumir(pedidos, gastos, { ...cfg, efectivoContado: r.efectivoEsperado + 1000 })
    expect(sobra.diferenciaCuadre).toBe(1000)
    const falta = resumir(pedidos, gastos, { ...cfg, efectivoContado: r.efectivoEsperado - 2500 })
    expect(falta.diferenciaCuadre).toBe(-2500)
  })

  it('el cuadre ignora pedidos anulados', () => {
    const anulados = pedidos.map((p) => ({ ...p, anulado: true }))
    expect(resumir(anulados, [], cfg).efectivoEsperado).toBe(50000)
  })

  it('ventas por hora usa hora de Colombia', () => {
    expect(horaColombia(Date.UTC(2026, 10, 21, 17, 0))).toBe(12)
    expect(horaColombia(Date.UTC(2026, 10, 22, 4, 59))).toBe(23)
    const h = ventasPorHora(pedidos)
    expect(h[12].total).toBe(PRECIO * 5)
    expect(h[12].pedidos).toBe(3)
  })
})

describe('sincronización y exportación', () => {
  it('gana el registro más reciente', () => {
    expect(debeAplicarRemoto(10, undefined)).toBe(true)
    expect(debeAplicarRemoto(10, { actualizadoEn: 5, sucio: 1 })).toBe(true)
    expect(debeAplicarRemoto(5, { actualizadoEn: 10, sucio: 1 })).toBe(false)
    expect(debeAplicarRemoto(10, { actualizadoEn: 10, sucio: 0 })).toBe(false)
  })
  it('CSV escapa comas y comillas', () => {
    const p = efectivo(1, 20000, { nota: 'sin "pepinillos", ok' })
    const csv = generarCSV([p], [gasto(5000, 'caja')])
    expect(csv).toContain('"sin ""pepinillos"", ok"')
    expect(csv).toContain('GASTOS')
  })
})

describe('búsqueda de pedidos', () => {
  const a = efectivo(2, 50000, { numero: 'A-12', nota: 'Juan, sin pepinillos' })
  const b = pedido(1, cobrarTransferencia(PRECIO, 'Nequi', 'ref-9981').pago!, { numero: 'B-3', nota: '', estado: 'listo' })
  const c = efectivo(1, 20000, { numero: 'A-13', nota: 'Mamá de Sofía', anulado: true })
  const todos = [a, b, c]
  const nums = (r: Pedido[]) => r.map((p) => p.numero)

  it('sin texto devuelve todos', () => {
    expect(buscarPedidos(todos, '')).toHaveLength(3)
    expect(buscarPedidos(todos, '   ')).toHaveLength(3)
  })
  it('encuentra por número, con o sin letra', () => {
    expect(nums(buscarPedidos(todos, 'a-12'))).toEqual(['A-12'])
    expect(nums(buscarPedidos(todos, 'b-3'))).toEqual(['B-3'])
    expect(nums(buscarPedidos(todos, '13'))).toEqual(['A-13'])
  })
  it('encuentra por nota o nombre, sin importar mayúsculas ni tildes', () => {
    expect(nums(buscarPedidos(todos, 'JUAN'))).toEqual(['A-12'])
    expect(nums(buscarPedidos(todos, 'mama'))).toEqual(['A-13'])
    expect(nums(buscarPedidos(todos, 'sofia'))).toEqual(['A-13'])
  })
  it('encuentra por producto, estado, método, canal y referencia', () => {
    expect(buscarPedidos(todos, 'sandwich')).toHaveLength(3)
    expect(nums(buscarPedidos(todos, 'listo'))).toEqual(['B-3'])
    expect(nums(buscarPedidos(todos, 'anulado'))).toEqual(['A-13'])
    expect(nums(buscarPedidos(todos, 'nequi'))).toEqual(['B-3'])
    expect(nums(buscarPedidos(todos, 'transferencia'))).toEqual(['B-3'])
    expect(nums(buscarPedidos(todos, '9981'))).toEqual(['B-3'])
  })
  it('encuentra por total, escrito de varias formas', () => {
    expect(nums(buscarPedidos(todos, '35800'))).toEqual(['A-12'])
    expect(nums(buscarPedidos(todos, '35.800'))).toEqual(['A-12'])
    expect(nums(buscarPedidos(todos, '$35.800'))).toEqual(['A-12'])
  })
  it('encuentra por hora', () => {
    expect(buscarPedidos(todos, '12:00')).toHaveLength(3)
    expect(buscarPedidos(todos, '03:00')).toHaveLength(0)
  })
  it('todas las palabras deben coincidir', () => {
    expect(nums(buscarPedidos(todos, 'a-12 juan'))).toEqual(['A-12'])
    expect(buscarPedidos(todos, 'a-12 sofia')).toHaveLength(0)
  })
  it('sin coincidencias devuelve vacío', () => {
    expect(buscarPedidos(todos, 'zzzz')).toEqual([])
  })
})

describe('numeración por hora', () => {
  const t = Date.UTC(2026, 10, 21, 17, 0)
  const mk = (id: string, ms: number, extra: Partial<Pedido> = {}) => efectivo(1, 20000, { id, creadoEn: t + ms, ...extra })
  it('numera 1,2,3 por hora de cobro sin importar el celular', () => {
    const j = mk('j1', 0, { dispositivo: 'Jero' })
    const u = mk('u1', 5000, { dispositivo: 'Juanda' })
    const k = mk('j2', 9000, { dispositivo: 'Jero' })
    const m = numerarPedidos([k, j, u]) // desordenados a propósito
    expect([m.get('j1'), m.get('u1'), m.get('j2')]).toEqual([1, 2, 3])
  })
  it('los anulados siguen contando (los demás números no se mueven)', () => {
    const a = mk('a', 0)
    const b = mk('b', 1000, { anulado: true })
    const c = mk('c', 2000)
    expect(numerarPedidos([a, b, c]).get('c')).toBe(3)
  })
  it('con la misma hora desempata por id, siempre igual', () => {
    const x = mk('x', 0)
    const y = mk('y', 0)
    expect(numerarPedidos([y, x]).get('x')).toBe(1)
    expect(numerarPedidos([x, y]).get('y')).toBe(2)
  })
  it('el buscador encuentra por el número visible (#2 o 2) y por celular', () => {
    const j = mk('j1', 0, { dispositivo: 'Jero', numero: 'Jero-1' })
    const u = mk('u1', 5000, { dispositivo: 'Juanda', numero: 'Juanda-1' })
    expect(buscarPedidos([j, u], '#2').map((p) => p.id)).toEqual(['u1'])
    expect(buscarPedidos([j, u], 'juanda').map((p) => p.id)).toEqual(['u1'])
    expect(buscarPedidos([j, u], '#1').map((p) => p.id)).toEqual(['j1'])
    expect(buscarPedidos([j, u], 'p-2').map((p) => p.id)).toEqual(['u1'])
    expect(buscarPedidos([j, u], 'P-1').map((p) => p.id)).toEqual(['j1'])
    expect(etiquetaPedido(7)).toBe('P-7')
  })
  it('el CSV usa el número visible y dice qué celular cobró', () => {
    const j = mk('j1', 0, { dispositivo: 'Jero', numero: 'Jero-1' })
    const u = mk('u1', 5000, { dispositivo: 'Juanda', numero: 'Juanda-1' })
    const csv = generarCSV([u, j], [])
    const filas = csv.split('\n')
    expect(filas[1]).toContain('celular')
    expect(filas[2].startsWith('1,')).toBe(true)
    expect(filas[2].endsWith('Jero')).toBe(true)
    expect(filas[3].startsWith('2,')).toBe(true)
  })
})

describe('historial de cambios', () => {
  const c = (ts: number, quien: string, texto: string, clave?: string) => ({ ts, quien, texto, clave })
  it('agrega cambios en orden', () => {
    const h = conCambio(conCambio(undefined, c(1, 'Jero', 'a')), c(2, 'Juanda', 'b'))
    expect(h.map((x) => x.texto)).toEqual(['a', 'b'])
  })
  it('reemplaza el último si es la misma persona y el mismo tipo de cambio en menos de 2 minutos', () => {
    let h = conCambio(undefined, c(0, 'Jero', 'Base: $5', 'base'))
    h = conCambio(h, c(30_000, 'Jero', 'Base: $50', 'base'))
    h = conCambio(h, c(60_000, 'Jero', 'Base: $50.000', 'base'))
    expect(h.map((x) => x.texto)).toEqual(['Base: $50.000'])
  })
  it('no reemplaza si es otra persona, otro tipo o pasaron más de 2 minutos', () => {
    let h = conCambio(undefined, c(0, 'Jero', 'x', 'base'))
    h = conCambio(h, c(1000, 'Juanda', 'y', 'base'))
    h = conCambio(h, c(2000, 'Juanda', 'z', 'pct'))
    h = conCambio(h, c(2000 + 121_000, 'Juanda', 'w', 'pct'))
    expect(h).toHaveLength(4)
  })
  it('sin clave nunca reemplaza y guarda solo los últimos', () => {
    let h: ReturnType<typeof conCambio> = []
    for (let i = 0; i < 50; i++) h = conCambio(h, c(i, 'Jero', 'e' + i), 40)
    expect(h).toHaveLength(40)
    expect(h[0].texto).toBe('e10')
    expect(h[39].texto).toBe('e49')
  })
})
