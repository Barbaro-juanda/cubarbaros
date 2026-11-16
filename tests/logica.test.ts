import { describe, expect, it } from 'vitest'
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
