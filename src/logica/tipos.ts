// Todos los montos son pesos colombianos ENTEROS (sin decimales).

export type EstadoPedido = 'pendiente' | 'preparando' | 'listo' | 'entregado'
export const ESTADOS: EstadoPedido[] = ['pendiente', 'preparando', 'listo', 'entregado']

export type Metodo = 'efectivo' | 'transferencia' | 'mixto'
export const CANALES = ['Nequi', 'Bancolombia', 'Daviplata', 'Otro'] as const
export type Canal = (typeof CANALES)[number]

export interface Producto {
  id: string
  nombre: string
  precio: number
}

export interface LineaPedido {
  productoId: string
  nombre: string
  precio: number // precio al momento de la venta
  cantidad: number
}

export interface Pago {
  metodo: Metodo
  /** Efectivo que entregó el cliente (0 si fue solo transferencia). */
  efectivoRecibido: number
  /** Cambio devuelto en efectivo. */
  devuelto: number
  /** Monto pagado por transferencia (0 si fue solo efectivo). */
  transferencia: number
  canal?: Canal
  referencia?: string
}

export interface Pedido {
  id: string
  dispositivo: string // letra del celular: A, B, C
  secuencia: number // consecutivo dentro de ese celular
  numero: string // ej. "A-12"
  creadoEn: number // ms desde 1970
  lineas: LineaPedido[]
  total: number
  nota: string
  estado: EstadoPedido
  anulado: boolean
  pago: Pago
}

export const CATEGORIAS = [
  'Ingredientes',
  'Bebidas',
  'Empaques',
  'Stand',
  'Personal',
  'Marketing e impresión',
  'Otros',
] as const
export type Categoria = (typeof CATEGORIAS)[number]

export type OrigenGasto = 'caja' | 'yo' | 'socio' | 'transferencia'
export const ORIGENES: { valor: OrigenGasto; texto: string }[] = [
  { valor: 'caja', texto: 'Efectivo de la caja' },
  { valor: 'yo', texto: 'Puse yo' },
  { valor: 'socio', texto: 'Puso el socio' },
  { valor: 'transferencia', texto: 'Transferencia del negocio' },
]

export interface Gasto {
  id: string
  concepto: string
  monto: number
  categoria: Categoria
  origen: OrigenGasto
  creadoEn: number
}

export interface Config {
  menu: Producto[]
  baseCaja: number
  /** Porcentaje de la utilidad para el dueño (el resto es del socio). */
  porcentajeDueno: number
  /** Efectivo contado al cerrar (para el cuadre). null = aún no se cuenta. */
  efectivoContado: number | null
  /** Marca de tiempo del último "Borrar datos de prueba". */
  borradoEn: number
}

export const CONFIG_INICIAL: Config = {
  menu: [{ id: 'sandwich-cubano', nombre: 'Sándwich cubano', precio: 17900 }],
  baseCaja: 0,
  porcentajeDueno: 70,
  efectivoContado: null,
  borradoEn: 0,
}
