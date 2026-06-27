import { weightedUnitCost, PurchaseLot } from './costing'

// ---- Tipos de entrada ----
export interface BillingOrderItem {
  productId: number | null
  productName: string
  price: number
  onSale: boolean
  quantity: number
}
export interface BillingOrder {
  id: number
  total: number
  createdAt: string // ISO
  status: string
  accessCodeId: number | null
  customerName: string | null
  clientName: string | null // del AccessCode si lo hay
  payWith: number | null
  items: BillingOrderItem[]
}
export interface BillingPurchase extends PurchaseLot { productId: number; date: string }
export interface BillingExpense { id: number; category: string; amount: number; date: string }
export interface BillingProduct { id: number; name: string; category: string | null; price: number }

// ---- Coste/unidad (media ponderada) por producto ----
export function unitCostMap(purchases: BillingPurchase[]): Map<number, number> {
  const byProd = new Map<number, PurchaseLot[]>()
  for (const p of purchases) {
    const a = byProd.get(p.productId) || []
    a.push(p)
    byProd.set(p.productId, a)
  }
  const m = new Map<number, number>()
  for (const [pid, lots] of byProd) m.set(pid, weightedUnitCost(lots))
  return m
}

// ---- Fechas (trabajamos con 'YYYY-MM-DD') ----
export function orderDate(o: BillingOrder): string { return o.createdAt.slice(0, 10) }
export function inRange(dateStr: string, from: string, to: string): boolean {
  return dateStr >= from && dateStr <= to
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const lastDay = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate() // m0 = mes 0-based

export type Preset = 'month' | 'quarter' | 'year' | 'all'
export interface Range { from: string; to: string; label: string }

export function presetRange(preset: Preset, ref: Date = new Date()): Range {
  const y = ref.getFullYear()
  const m0 = ref.getMonth()
  if (preset === 'month') {
    return { from: `${y}-${pad(m0 + 1)}-01`, to: `${y}-${pad(m0 + 1)}-${pad(lastDay(y, m0))}`,
      label: ref.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) }
  }
  if (preset === 'quarter') {
    const q = Math.floor(m0 / 3)
    const start = q * 3
    return { from: `${y}-${pad(start + 1)}-01`, to: `${y}-${pad(start + 3)}-${pad(lastDay(y, start + 2))}`,
      label: `T${q + 1} ${y}` }
  }
  if (preset === 'year') {
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}` }
  }
  return { from: '2000-01-01', to: '2999-12-31', label: 'Todo' }
}

export function previousRange(preset: Preset, ref: Date = new Date()): Range | null {
  if (preset === 'all') return null
  const y = ref.getFullYear()
  const m0 = ref.getMonth()
  if (preset === 'month') return presetRange('month', new Date(y, m0 - 1, 1))
  if (preset === 'quarter') return presetRange('quarter', new Date(y, m0 - 3, 1))
  return presetRange('year', new Date(y - 1, 0, 1))
}

// ---- KPIs ----
export interface Kpis {
  revenue: number
  cogs: number
  grossProfit: number
  expenses: number
  netProfit: number
  orderCount: number
  avgTicket: number
  grossMarginPct: number
  unitsSold: number
}

function completedInRange(orders: BillingOrder[], from: string, to: string): BillingOrder[] {
  return orders.filter(o => o.status === 'completed' && inRange(orderDate(o), from, to))
}

export function computeKpis(
  orders: BillingOrder[], costMap: Map<number, number>, expenses: BillingExpense[], from: string, to: string
): Kpis {
  const inOrders = completedInRange(orders, from, to)
  let revenue = 0, cogs = 0, units = 0
  for (const o of inOrders) {
    for (const it of o.items) {
      revenue += it.price * it.quantity
      const uc = it.productId != null ? (costMap.get(it.productId) ?? 0) : 0
      cogs += uc * it.quantity
      units += it.quantity
    }
  }
  const exp = expenses.filter(e => inRange(e.date, from, to)).reduce((s, e) => s + e.amount, 0)
  const gross = revenue - cogs
  const orderCount = inOrders.length
  return {
    revenue, cogs, grossProfit: gross, expenses: exp, netProfit: gross - exp,
    orderCount, avgTicket: orderCount ? revenue / orderCount : 0,
    grossMarginPct: revenue ? (gross / revenue) * 100 : 0, unitsSold: units,
  }
}

// ---- Desgloses ----
export interface ProductAgg {
  productId: number; name: string; units: number; revenue: number; cogs: number; profit: number; marginPct: number
}
export function byProduct(orders: BillingOrder[], costMap: Map<number, number>, from: string, to: string): ProductAgg[] {
  const m = new Map<number, ProductAgg>()
  for (const o of completedInRange(orders, from, to)) {
    for (const it of o.items) {
      const pid = it.productId ?? -1
      const cur = m.get(pid) || { productId: pid, name: it.productName, units: 0, revenue: 0, cogs: 0, profit: 0, marginPct: 0 }
      cur.units += it.quantity
      cur.revenue += it.price * it.quantity
      cur.cogs += (costMap.get(pid) ?? 0) * it.quantity
      m.set(pid, cur)
    }
  }
  const out = [...m.values()]
  for (const a of out) { a.profit = a.revenue - a.cogs; a.marginPct = a.revenue ? (a.profit / a.revenue) * 100 : 0 }
  return out.sort((x, y) => y.revenue - x.revenue)
}

export interface CategoryAgg { category: string; units: number; revenue: number; profit: number }
export function byCategory(
  orders: BillingOrder[], costMap: Map<number, number>, products: BillingProduct[], from: string, to: string
): CategoryAgg[] {
  const catOf = new Map<number, string>()
  for (const p of products) catOf.set(p.id, p.category || 'Sin categoría')
  const m = new Map<string, CategoryAgg>()
  for (const o of completedInRange(orders, from, to)) {
    for (const it of o.items) {
      const cat = it.productId != null ? (catOf.get(it.productId) || 'Sin categoría') : 'Sin categoría'
      const cur = m.get(cat) || { category: cat, units: 0, revenue: 0, profit: 0 }
      cur.units += it.quantity
      cur.revenue += it.price * it.quantity
      cur.profit += it.price * it.quantity - (costMap.get(it.productId ?? -1) ?? 0) * it.quantity
      m.set(cat, cur)
    }
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue)
}

export interface ClientAgg { name: string; orders: number; revenue: number; avgTicket: number }
export function byClient(orders: BillingOrder[], from: string, to: string): ClientAgg[] {
  const m = new Map<string, ClientAgg>()
  for (const o of completedInRange(orders, from, to)) {
    const name = o.clientName || o.customerName || 'Sin nombre'
    const cur = m.get(name) || { name, orders: 0, revenue: 0, avgTicket: 0 }
    cur.orders += 1
    cur.revenue += o.items.reduce((s, it) => s + it.price * it.quantity, 0)
    m.set(name, cur)
  }
  const out = [...m.values()]
  for (const c of out) c.avgTicket = c.orders ? c.revenue / c.orders : 0
  return out.sort((a, b) => b.revenue - a.revenue)
}

// ---- Evolución mensual (para gráficas) ----
export interface MonthPoint { month: string; revenue: number; profit: number; orders: number }
export function monthlySeries(orders: BillingOrder[], costMap: Map<number, number>, from: string, to: string): MonthPoint[] {
  const m = new Map<string, MonthPoint>()
  for (const o of completedInRange(orders, from, to)) {
    const key = orderDate(o).slice(0, 7) // YYYY-MM
    const cur = m.get(key) || { month: key, revenue: 0, profit: 0, orders: 0 }
    let rev = 0, cogs = 0
    for (const it of o.items) {
      rev += it.price * it.quantity
      cogs += (costMap.get(it.productId ?? -1) ?? 0) * it.quantity
    }
    cur.revenue += rev
    cur.profit += rev - cogs
    cur.orders += 1
    m.set(key, cur)
  }
  return [...m.values()].sort((a, b) => a.month.localeCompare(b.month))
}

// ---- Serie diaria (para el gráfico del Resumen de un mes) ----
export interface DayPoint { date: string; revenue: number; profit: number; orders: number }
export function dailySeries(orders: BillingOrder[], costMap: Map<number, number>, from: string, to: string): DayPoint[] {
  const m = new Map<string, DayPoint>()
  // Inicializa todos los días del rango a cero para que el gráfico no tenga huecos
  const start = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    m.set(key, { date: key, revenue: 0, profit: 0, orders: 0 })
  }
  for (const o of completedInRange(orders, from, to)) {
    const key = orderDate(o)
    const cur = m.get(key) || { date: key, revenue: 0, profit: 0, orders: 0 }
    let rev = 0, cogs = 0
    for (const it of o.items) {
      rev += it.price * it.quantity
      cogs += (costMap.get(it.productId ?? -1) ?? 0) * it.quantity
    }
    cur.revenue += rev
    cur.profit += rev - cogs
    cur.orders += 1
    m.set(key, cur)
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date))
}

// ---- Caja (efectivo) ----
export interface CashSummary { collected: number; changeGiven: number; exactCount: number; withChangeCount: number }
export function cashSummary(orders: BillingOrder[], from: string, to: string): CashSummary {
  let collected = 0, changeGiven = 0, exactCount = 0, withChangeCount = 0
  for (const o of completedInRange(orders, from, to)) {
    const total = o.items.reduce((s, it) => s + it.price * it.quantity, 0)
    collected += total
    if (o.payWith != null && o.payWith > total) {
      changeGiven += o.payWith - total
      withChangeCount += 1
    } else {
      exactCount += 1
    }
  }
  return { collected, changeGiven, exactCount, withChangeCount }
}

// ---- Proyección mensual (lineal según ritmo actual) ----
export interface Projection { soFar: number; projected: number; dayOfMonth: number; daysInMonth: number }
export function monthProjection(orders: BillingOrder[], ref: Date = new Date()): Projection {
  const r = presetRange('month', ref)
  const soFar = orders
    .filter(o => o.status === 'completed' && inRange(orderDate(o), r.from, r.to))
    .reduce((s, o) => s + o.items.reduce((a, it) => a + it.price * it.quantity, 0), 0)
  const dayOfMonth = ref.getDate()
  const daysInMonth = lastDay(ref.getFullYear(), ref.getMonth())
  const projected = dayOfMonth > 0 ? (soFar / dayOfMonth) * daysInMonth : soFar
  return { soFar, projected, dayOfMonth, daysInMonth }
}

export function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null // null = sin base de comparación
  return ((cur - prev) / prev) * 100
}
