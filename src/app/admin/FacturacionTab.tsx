'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Plus, Trash2, Package, Receipt, TrendingUp, TrendingDown, Wallet, PiggyBank,
  ClipboardList, FileBarChart, Download, Euro, Percent, ShoppingBag, Coins, LineChart, Layers,
  Boxes, Target, ChevronRight, ChevronLeft, ChevronDown, ArrowLeft, CheckCircle2, Pencil, X, Check,
} from 'lucide-react'
import HistorialTab from './HistorialTab'
import { EvolutionChart, HBars, DailyBars, Sparkline } from './Charts'
import { lotTotal, lotUnitCost, weightedUnitCost } from '@/lib/costing'
import { computeProductStats } from '@/lib/inventory'
import { effectivePrice } from '@/lib/price'
import {
  unitCostMap, computeKpis, byProduct, byCategory, byClient, monthlySeries, dailySeries,
  presetRange, pctChange,
  BillingOrder, BillingPurchase, BillingExpense, BillingProduct, Preset,
} from '@/lib/billing'

interface Flavor { id?: number; name: string; inStock: boolean; stock: number; price?: number | null }
interface ProductRef {
  id: number; name: string; price: number; category?: string
  flavors: Flavor[]; onSale: boolean; salePrice: number | null; saleEndsAt: string | null; saleUnits: number | null
}
interface BillingData { orders: BillingOrder[]; purchases: BillingPurchase[]; expenses: BillingExpense[]; products: BillingProduct[] }

type Sub = 'resumen' | 'pedidos' | 'ventas' | 'costes' | 'inventario' | 'informes'
const SUBS: { key: Sub; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'resumen', label: 'Resumen', icon: LineChart },
  { key: 'pedidos', label: 'Pedidos', icon: ClipboardList },
  { key: 'ventas', label: 'Ventas', icon: Receipt },
  { key: 'costes', label: 'Gastos', icon: Wallet },
  { key: 'inventario', label: 'Inventario', icon: Boxes },
  { key: 'informes', label: 'Informes', icon: FileBarChart },
]
const SUB_DESC: Record<Sub, string> = {
  resumen: 'Visión general del negocio: ventas del mes, beneficio y evolución.',
  pedidos: 'Historial completo de pedidos.',
  ventas: 'Ventas, márgenes y clientes: por producto, categoría y comprador.',
  costes: 'Registra tus compras (crean o reabastecen productos) y los gastos generales.',
  inventario: 'Stock, inversión y rentabilidad de cada producto en tiempo real.',
  informes: 'Exporta tus datos para la contabilidad.',
}
const PRESETS: { key: Preset; label: string }[] = [
  { key: 'month', label: 'Mes' }, { key: 'quarter', label: 'Trimestre' }, { key: 'year', label: 'Año' }, { key: 'all', label: 'Todo' },
]

const eur = (n: number) => `${n.toFixed(2)} €`
const pct = (n: number) => `${n.toFixed(1)}%`

export default function FacturacionTab({ products, onProductsChange }: { products: ProductRef[]; onProductsChange?: () => void }) {
  const [sub, setSub] = useState<Sub>('resumen')
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<Preset>('month')
  const ref = useMemo(() => new Date(), [])

  const loadBilling = useCallback(async () => {
    const d = await fetch('/api/admin/billing').then(r => r.ok ? r.json() : null)
    if (d) setData(d)
    setLoading(false)
  }, [])
  useEffect(() => { loadBilling() }, [loadBilling])

  const costMap = useMemo(() => data ? unitCostMap(data.purchases) : new Map<number, number>(), [data])
  const range = useMemo(() => presetRange(preset, ref), [preset, ref])
  const showPeriod = sub === 'ventas' // Resumen gestiona su propia navegación temporal
  const refreshAll = useCallback(() => { loadBilling(); onProductsChange?.() }, [loadBilling, onProductsChange])
  const active = SUBS.find(s => s.key === sub)!

  return (
    <div>
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--accent2)' }}>
            <active.icon size={18} /> {active.label}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{SUB_DESC[sub]}</p>
        </div>
        {showPeriod && (
          <div className="flex p-1 rounded-xl shrink-0" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => setPreset(p.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                style={{ background: preset === p.key ? 'var(--accent2)' : 'transparent', color: preset === p.key ? 'var(--bg)' : 'var(--muted)' }}>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navegación de submenús */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
        {SUBS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setSub(key)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer shrink-0"
            style={{
              background: sub === key ? 'var(--surface2)' : 'transparent',
              color: sub === key ? 'var(--accent2)' : 'var(--muted)',
              boxShadow: sub === key ? 'inset 0 -2px 0 var(--accent2)' : 'none',
            }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {showPeriod && (
        <p className="text-sm mb-4 capitalize flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--accent2)' }} /> {range.label}
        </p>
      )}

      {loading || !data ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Cargando…
        </div>
      ) : (
        <>
          {sub === 'resumen' && <Resumen data={data} costMap={costMap} />}
          {sub === 'ventas' && <Ventas data={data} costMap={costMap} range={range} />}
          {sub === 'informes' && <Informes data={data} costMap={costMap} />}
          {sub === 'inventario' && <Inventario products={products} data={data} onMutate={refreshAll} />}
          {sub === 'costes' && <CostesSection products={products} onMutate={refreshAll} />}
          {sub === 'pedidos' && <HistorialTab />}
        </>
      )}
    </div>
  )
}

// ---------- Componentes de presentación ----------
function Delta({ cur, prev }: { cur: number; prev: number }) {
  const c = pctChange(cur, prev)
  if (c == null) return null
  const up = c >= 0
  return (
    <span className="text-xs font-semibold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md"
      style={{ color: up ? '#22c55e' : '#ef4444', background: up ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(c).toFixed(1)}%
    </span>
  )
}

function KpiCard({ label, value, icon: Icon, accent = 'var(--accent2)', delta, hero }: {
  label: string; value: string; icon?: React.ComponentType<{ size?: number }>
  accent?: string; delta?: React.ReactNode; hero?: boolean
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: `1px solid ${hero ? accent : 'var(--border)'}`,
      boxShadow: hero ? `0 0 0 3px ${hexA(accent, 0.08)}` : 'none' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: hexA(accent, 0.14), color: accent }}>
              <Icon size={15} />
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
        </div>
        {delta}
      </div>
      <p className={hero ? 'text-3xl font-bold tabular-nums' : 'text-xl font-bold tabular-nums'} style={{ color: 'var(--accent2)' }}>{value}</p>
    </div>
  )
}

// color hex -> rgba con alpha (soporta var(--..) devolviendo color tal cual con opacidad via color-mix)
function hexA(color: string, a: number): string {
  if (color.startsWith('#')) {
    const c = color.replace('#', '')
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${a})`
  }
  return `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="mb-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--accent2)' }}>{title}</p>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ icon: Icon, title, hint }: { icon: React.ComponentType<{ size?: number }>; title: string; hint: string }) {
  return (
    <div className="text-center py-16 rounded-2xl" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
      <span className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
        <Icon size={26} />
      </span>
      <p className="font-semibold" style={{ color: 'var(--accent2)' }}>{title}</p>
      <p className="text-sm mt-1 max-w-xs mx-auto" style={{ color: 'var(--muted)' }}>{hint}</p>
    </div>
  )
}

function hasSales(data: BillingData, from: string, to: string): boolean {
  return data.orders.some(o => o.status === 'completed' && o.createdAt.slice(0, 10) >= from && o.createdAt.slice(0, 10) <= to)
}

// ---------- RESUMEN ----------
type Franja = 'day' | 'week' | 'month'
const FRANJAS: { key: Franja; label: string }[] = [
  { key: 'day', label: 'Diario' }, { key: 'week', label: 'Semanal' }, { key: 'month', label: 'Mes' },
]
const ymd = (d: Date) => d.toISOString().slice(0, 10)

// Rango de la franja anclado al mes mostrado. Si el mes mostrado es el actual, el
// ancla es hoy; si es un mes pasado/futuro, el ancla es su último día.
function franjaRange(franja: Franja, refMonth: Date, now: Date): { from: string; to: string } {
  const monthStart = new Date(refMonth.getFullYear(), refMonth.getMonth(), 1)
  const monthEnd = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0)
  const isCurrent = now.getFullYear() === refMonth.getFullYear() && now.getMonth() === refMonth.getMonth()
  const anchor = isCurrent ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : monthEnd
  if (franja === 'month') return { from: ymd(monthStart), to: ymd(monthEnd) }
  if (franja === 'day') return { from: ymd(anchor), to: ymd(anchor) }
  // week: 7 días terminando en el ancla, sin salir del mes
  const weekStart = new Date(anchor); weekStart.setDate(anchor.getDate() - 6)
  return { from: ymd(weekStart < monthStart ? monthStart : weekStart), to: ymd(anchor) }
}

function Resumen({ data, costMap }: { data: BillingData; costMap: Map<number, number> }) {
  const now = useMemo(() => new Date(), [])
  const [refMonth, setRefMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [franja, setFranja] = useState<Franja>('month')

  const monthStart = new Date(refMonth.getFullYear(), refMonth.getMonth(), 1)
  const monthEnd = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0)
  const daily = useMemo(() => dailySeries(data.orders, costMap, ymd(monthStart), ymd(monthEnd)),
    [data.orders, costMap, refMonth]) // eslint-disable-line react-hooks/exhaustive-deps
  const fr = franjaRange(franja, refMonth, now)
  const k = computeKpis(data.orders, costMap, data.expenses, fr.from, fr.to)
  const monthLabel = refMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const isCurrent = now.getFullYear() === refMonth.getFullYear() && now.getMonth() === refMonth.getMonth()
  const navMonth = (delta: number) => setRefMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1))

  return (
    <div className="space-y-5">
      {/* Gráfico de ventas del mes con navegación < > */}
      <Section title="Ventas del mes" subtitle={`Ingresos diarios · ${monthLabel}`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <button onClick={() => navMonth(-1)} className="p-1.5 rounded-lg cursor-pointer" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)' }} aria-label="Mes anterior">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold capitalize" style={{ color: 'var(--accent2)' }}>{monthLabel}</span>
          <button onClick={() => navMonth(1)} disabled={isCurrent} className="p-1.5 rounded-lg cursor-pointer disabled:opacity-30" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)' }} aria-label="Mes siguiente">
            <ChevronRight size={16} />
          </button>
        </div>
        <DailyBars data={daily} />
      </Section>

      {/* Fila de datos + selector de franja */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {franja === 'month' ? `Datos de ${monthLabel}` : franja === 'week' ? 'Datos de los últimos 7 días' : `Datos del ${fr.from}`}
        </p>
        <div className="flex p-1 rounded-xl shrink-0" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          {FRANJAS.map(f => (
            <button key={f.key} onClick={() => setFranja(f.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              style={{ background: franja === f.key ? 'var(--accent2)' : 'transparent', color: franja === f.key ? 'var(--bg)' : 'var(--muted)' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Pedidos" value={String(k.orderCount)} icon={ShoppingBag} />
        <KpiCard label="Ingreso (bruto)" value={eur(k.revenue)} icon={Euro} hero />
        <KpiCard label="Beneficio (neto)" value={eur(k.netProfit)} icon={PiggyBank} accent={k.netProfit >= 0 ? '#22c55e' : '#ef4444'} />
        <KpiCard label="Ticket medio" value={eur(k.avgTicket)} icon={Receipt} />
      </div>

      <Section title="Evolución" subtitle="Ingresos y beneficio de los últimos meses">
        <EvolutionChart data={monthlySeries(data.orders, costMap, '2000-01-01', '2999-12-31').slice(-12)} />
      </Section>
    </div>
  )
}

// ---------- VENTAS (incluye márgenes y clientes) ----------
function Ventas({ data, costMap, range }: { data: BillingData; costMap: Map<number, number>; range: { from: string; to: string } }) {
  if (!hasSales(data, range.from, range.to)) return <EmptyState icon={Receipt} title="Sin ventas en este periodo" hint="Aquí verás qué se vende, su margen y quién compra cuando haya pedidos entregados." />
  const k = computeKpis(data.orders, costMap, data.expenses, range.from, range.to)
  const prods = byProduct(data.orders, costMap, range.from, range.to)
  const cats = byCategory(data.orders, costMap, data.products, range.from, range.to)
  const clients = byClient(data.orders, range.from, range.to)
  const breakeven = breakEvenByProduct(data) // acumulado (toda la vida), no por periodo

  return (
    <div className="space-y-5">
      {/* KPIs de ventas + beneficio */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ingresos" value={eur(k.revenue)} icon={Euro} hero />
        <KpiCard label="Beneficio bruto" value={eur(k.grossProfit)} icon={TrendingUp} accent="#22c55e" />
        <KpiCard label="Margen bruto" value={pct(k.grossMarginPct)} icon={Percent} accent="#3b82f6" />
        <KpiCard label="Unidades vendidas" value={String(k.unitsSold)} icon={Package} />
      </div>
      <p className="text-xs px-1" style={{ color: 'var(--muted)' }}>
        Coste de mercancía {eur(k.cogs)} · Beneficio neto (tras {eur(k.expenses)} de gastos): <b style={{ color: k.netProfit >= 0 ? '#22c55e' : '#ef4444' }}>{eur(k.netProfit)}</b>
      </p>

      <Section title="Ranking por ingresos" subtitle="Productos que más facturan">
        <HBars items={prods.map(p => ({ label: p.name, value: p.revenue, sub: `${p.units} ud` }))} />
      </Section>

      <Section title="Por categoría">
        <HBars items={cats.map(c => ({ label: c.category, value: c.revenue, sub: `${c.units} ud` }))} color="#3b82f6" />
      </Section>

      <Section title="Detalle por producto" subtitle="Ventas, coste y margen de cada producto">
        <Table head={['Producto', 'Uds', 'Ingresos', 'Coste', 'Beneficio', 'Margen']} align={[0, 1, 1, 1, 1, 1]}
          rows={prods.map(p => [p.name, String(p.units), eur(p.revenue), eur(p.cogs), eur(p.profit), pct(p.marginPct)])} />
      </Section>

      {breakeven.length > 0 && (
        <Section title="Para recuperar la inversión" subtitle="Unidades que faltan por vender por producto (acumulado de toda su vida)">
          <Table head={['Producto', 'Faltan (uds)', 'Recuperado', 'Inversión']} align={[0, 1, 1, 1]}
            rows={breakeven.map(b => [b.name, b.recovered ? '✓ recuperada' : `${b.unitsToBreakEven} uds`, eur(b.revenue), eur(b.invested)])} />
        </Section>
      )}

      <Section title="Por cliente" subtitle="Quién compra y cuánto gasta">
        <Table head={['Cliente', 'Pedidos', 'Gastado', 'Ticket medio']} align={[0, 1, 1, 1]}
          rows={clients.map(c => [c.name, String(c.orders), eur(c.revenue), eur(c.avgTicket)])} />
      </Section>
    </div>
  )
}

// Break-even acumulado por producto (toda la vida): inversión vs ingresos.
function breakEvenByProduct(data: BillingData): { name: string; invested: number; revenue: number; recovered: boolean; unitsToBreakEven: number }[] {
  const priceById = new Map(data.products.map(p => [p.id, { name: p.name, price: p.price }]))
  const lotsByProduct = new Map<number, BillingPurchase[]>()
  for (const p of data.purchases) { const a = lotsByProduct.get(p.productId) || []; a.push(p); lotsByProduct.set(p.productId, a) }
  const soldByProduct = new Map<number, { price: number; quantity: number }[]>()
  for (const o of data.orders) {
    if (o.status !== 'completed') continue
    for (const it of o.items) {
      if (it.productId == null) continue
      const a = soldByProduct.get(it.productId) || []; a.push({ price: it.price, quantity: it.quantity }); soldByProduct.set(it.productId, a)
    }
  }
  const out: { name: string; invested: number; revenue: number; recovered: boolean; unitsToBreakEven: number }[] = []
  for (const [pid, lots] of lotsByProduct) {
    const info = priceById.get(pid)
    if (!info) continue
    const sold = soldByProduct.get(pid) || []
    const stats = computeProductStats(lots, sold.map(s => ({ productId: pid, price: s.price, quantity: s.quantity })), info.price)
    out.push({ name: info.name, invested: stats.invested, revenue: stats.revenue, recovered: stats.recovered, unitsToBreakEven: stats.unitsToBreakEven })
  }
  return out.sort((a, b) => Number(a.recovered) - Number(b.recovered) || b.unitsToBreakEven - a.unitsToBreakEven)
}

// ---------- INFORMES ----------
function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(c => {
    const s = String(c)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function Informes({ data, costMap }: { data: BillingData; costMap: Map<number, number> }) {
  const all = { from: '2000-01-01', to: '2999-12-31' }
  function exportProductos() {
    const rows: (string | number)[][] = [['Producto', 'Unidades', 'Ingresos', 'Coste', 'Beneficio', 'Margen %']]
    for (const p of byProduct(data.orders, costMap, all.from, all.to)) rows.push([p.name, p.units, p.revenue.toFixed(2), p.cogs.toFixed(2), p.profit.toFixed(2), p.marginPct.toFixed(1)])
    downloadCSV('ventas-por-producto.csv', rows)
  }
  function exportMensual() {
    const rows: (string | number)[][] = [['Mes', 'Pedidos', 'Ingresos', 'Beneficio']]
    for (const m of monthlySeries(data.orders, costMap, all.from, all.to)) rows.push([m.month, m.orders, m.revenue.toFixed(2), m.profit.toFixed(2)])
    downloadCSV('evolucion-mensual.csv', rows)
  }
  function exportPedidos() {
    const rows: (string | number)[][] = [['ID', 'Fecha', 'Estado', 'Cliente', 'Total', 'Paga con', 'Productos']]
    for (const o of data.orders) {
      const items = o.items.map(i => `${i.quantity}x ${i.productName}`).join(' | ')
      rows.push([o.id, o.createdAt.slice(0, 10), o.status, o.clientName || o.customerName || '', o.total.toFixed(2), o.payWith ?? 'exacto', items])
    }
    downloadCSV('pedidos.csv', rows)
  }
  const cards: { label: string; desc: string; fn: () => void }[] = [
    { label: 'Ventas por producto', desc: 'Unidades, ingresos, coste, beneficio y margen', fn: exportProductos },
    { label: 'Evolución mensual', desc: 'Pedidos, ingresos y beneficio por mes', fn: exportMensual },
    { label: 'Todos los pedidos', desc: 'Listado completo con productos y pagos', fn: exportPedidos },
  ]
  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Descarga tus datos en CSV (se abren en Excel/Google Sheets) para tu contabilidad o gestoría.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map(c => (
          <button key={c.label} onClick={c.fn} className="text-left rounded-2xl p-4 cursor-pointer transition-all hover:opacity-90"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: 'var(--surface2)', color: 'var(--accent2)' }}>
              <Download size={16} />
            </span>
            <p className="text-sm font-semibold" style={{ color: 'var(--accent2)' }}>{c.label}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{c.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- Tabla ----------
function Table({ head, rows, align = [] }: { head: string[]; rows: string[][]; align?: number[] }) {
  if (rows.length === 0) return <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin datos.</p>
  const ta = (i: number) => align.includes(i) && i !== 0 ? 'right' : 'left'
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>{head.map((h, i) => <th key={i} className="font-medium pb-2 px-2" style={{ color: 'var(--muted)', textAlign: ta(i) }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
              {r.map((c, j) => <td key={j} className="py-2 px-2 tabular-nums" style={{ color: j === 0 ? 'var(--accent2)' : 'var(--accent)', textAlign: ta(j) }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------- COSTES ----------
interface Purchase {
  id: number; productId: number; flavorId: number | null; units: number; productCost: number
  shipping: number; insurance: number; otherCosts: number; note: string | null; date: string
  product: { id: number; name: string }
  flavor?: { id: number; name: string } | null
}
interface Expense { id: number; category: string; amount: number; description: string | null; date: string }

function CostesSection({ products, onMutate }: { products: ProductRef[]; onMutate: () => void }) {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [p, e] = await Promise.all([
      fetch('/api/admin/purchases').then(r => r.ok ? r.json() : []),
      fetch('/api/admin/expenses').then(r => r.ok ? r.json() : []),
    ])
    setPurchases(p); setExpenses(e); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  const refresh = useCallback(() => { load(); onMutate() }, [load, onMutate])

  const unitCostByProduct = useMemo(() => {
    const byProd = new Map<number, Purchase[]>()
    for (const p of purchases) { const arr = byProd.get(p.productId) || []; arr.push(p); byProd.set(p.productId, arr) }
    const out = new Map<number, { name: string; units: number; unit: number }>()
    for (const [pid, lots] of byProd) {
      const units = lots.reduce((s, l) => s + l.units, 0)
      out.set(pid, { name: lots[0].product.name, units, unit: weightedUnitCost(lots) })
    }
    return out
  }, [purchases])

  const totalInvertido = useMemo(() => purchases.reduce((s, p) => s + lotTotal(p), 0), [purchases])
  const totalGastos = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses])

  if (loading) return <div className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>Cargando…</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard label="Invertido en compras" value={eur(totalInvertido)} icon={Layers} accent="#f59e0b" />
        <KpiCard label="Gastos generales" value={eur(totalGastos)} icon={Wallet} accent="#f59e0b" />
        <KpiCard label="Coste total" value={eur(totalInvertido + totalGastos)} icon={Coins} hero accent="#f59e0b" />
      </div>
      <PurchaseBlock products={products} purchases={purchases} unitCostByProduct={unitCostByProduct} onChange={refresh} />
      <ExpenseBlock expenses={expenses} onChange={refresh} />
    </div>
  )
}

interface VariantRow { flavorId: number | null; name: string; units: string; cost: string }
function PurchaseBlock({ products, purchases, unitCostByProduct, onChange }: {
  products: ProductRef[]; purchases: Purchase[]
  unitCostByProduct: Map<number, { name: string; units: number; unit: number }>; onChange: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [productId, setProductId] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [variants, setVariants] = useState<VariantRow[]>([{ flavorId: null, name: '', units: '', cost: '' }])
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const inp = 'px-3 py-2 rounded-lg text-sm outline-none w-full'
  const inpStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }

  function reset() {
    setName(''); setCategory(''); setProductId(''); setDate(today); setNote('')
    setVariants([{ flavorId: null, name: '', units: '', cost: '' }])
  }

  // Al elegir un producto existente, precarga sus sabores como variantes a reabastecer
  function selectProduct(id: string) {
    setProductId(id)
    const p = products.find(pr => String(pr.id) === id)
    if (p && p.flavors.length > 0) {
      setVariants(p.flavors.map(f => ({ flavorId: f.id ?? null, name: f.name, units: '', cost: '' })))
    } else {
      setVariants([{ flavorId: null, name: '', units: '', cost: '' }])
    }
  }

  const setV = (i: number, patch: Partial<VariantRow>) => setVariants(vs => vs.map((v, j) => j === i ? { ...v, ...patch } : v))
  const addVariant = () => setVariants(vs => [...vs, { flavorId: null, name: '', units: '', cost: '' }])
  const removeVariant = (i: number) => setVariants(vs => vs.length > 1 ? vs.filter((_, j) => j !== i) : vs)

  const liveTotal = useMemo(() => variants.reduce((s, v) => s + (Number(v.cost) || 0), 0), [variants])
  const liveUnits = useMemo(() => variants.reduce((s, v) => s + (Number(v.units) || 0), 0), [variants])

  async function add() {
    const clean = variants
      .map(v => ({ flavorId: v.flavorId, name: v.name.trim(), units: Math.floor(Number(v.units)), cost: Number(v.cost) }))
      .filter(v => v.units > 0)
    if (clean.length === 0) { alert('Añade al menos una variante con cantidad'); return }
    if (clean.some(v => isNaN(v.cost) || v.cost < 0)) { alert('Cada variante con cantidad necesita un coste válido'); return }
    if (mode === 'new') {
      if (!name.trim()) { alert('Indica el nombre del producto'); return }
      if (clean.some(v => !v.name)) { alert('Cada variante necesita un nombre'); return }
    } else if (!productId) { alert('Elige el producto a reabastecer'); return }

    setSaving(true)
    const body = mode === 'new'
      ? { mode: 'new', name: name.trim(), category: category || null, date, note, variants: clean.map(v => ({ name: v.name, units: v.units, cost: v.cost })) }
      : { mode: 'existing', productId: Number(productId), date, note, variants: clean.map(v => ({ flavorId: v.flavorId, name: v.name, units: v.units, cost: v.cost })) }
    const res = await fetch('/api/admin/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (res.ok) { reset(); onChange() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || 'No se pudo guardar') }
  }
  async function del(id: number) {
    if (!confirm('¿Eliminar este lote de compra? (no resta el stock que sumó)')) return
    const res = await fetch(`/api/admin/purchases/${id}`, { method: 'DELETE' })
    if (res.ok) onChange()
  }

  return (
    <Section title="Registrar una compra" subtitle="Crea un producto nuevo (oculto hasta completarlo en Catálogo) o reabastece uno existente. Cada variante con su cantidad y su coste.">
      <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        {/* Modo */}
        <div className="flex p-1 rounded-xl w-fit" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {([['new', 'Producto nuevo'], ['existing', 'Reabastecer existente']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => { setMode(k); reset() }} className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              style={{ background: mode === k ? 'var(--accent2)' : 'transparent', color: mode === k ? 'var(--bg)' : 'var(--muted)' }}>{lbl}</button>
          ))}
        </div>

        {mode === 'new' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del producto" className={inp} style={inpStyle} />
            <CategoryPicker value={category} onChange={setCategory} />
          </div>
        ) : (
          <select value={productId} onChange={e => selectProduct(e.target.value)} className={inp} style={inpStyle}>
            <option value="">Producto a reabastecer…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} style={{ ...inpStyle, colorScheme: 'dark' }} />

        {/* Variantes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--muted)' }}>VARIANTES (SABOR/MODELO)</span>
            <button onClick={addVariant} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg cursor-pointer" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
              <Plus size={12} /> Variante
            </button>
          </div>
          {variants.map((v, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl p-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <input value={v.name} onChange={e => setV(i, { name: e.target.value })} placeholder="Nombre del sabor/modelo"
                disabled={mode === 'existing' && v.flavorId != null}
                className="px-2.5 py-2 rounded-lg text-sm outline-none w-full disabled:opacity-70" style={inpStyle} />
              <div className="flex items-center gap-2">
                <input type="number" inputMode="numeric" value={v.units} onChange={e => setV(i, { units: e.target.value })} placeholder="Uds" className="px-2.5 py-2 rounded-lg text-sm outline-none flex-1 min-w-0" style={inpStyle} />
                <input type="number" inputMode="decimal" value={v.cost} onChange={e => setV(i, { cost: e.target.value })} placeholder="Coste €" className="px-2.5 py-2 rounded-lg text-sm outline-none flex-1 min-w-0" style={inpStyle} />
                <button onClick={() => removeVariant(i)} className="p-2 rounded-lg cursor-pointer shrink-0" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }} aria-label="Quitar variante"><X size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Nota (opcional)" className={inp} style={inpStyle} />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>{liveUnits > 0 ? <>Total: <b style={{ color: 'var(--accent2)' }}>{liveUnits} uds · {eur(liveTotal)}</b></> : 'Total: —'}</span>
          <button onClick={add} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
            <Plus size={14} /> {saving ? 'Guardando…' : 'Registrar compra'}
          </button>
        </div>
      </div>

      {unitCostByProduct.size > 0 && (
        <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold mb-2 tracking-wide" style={{ color: 'var(--muted)' }}>COSTE/UNIDAD POR PRODUCTO (media ponderada)</p>
          <div className="space-y-1.5">
            {[...unitCostByProduct.entries()].map(([pid, d]) => (
              <div key={pid} className="flex justify-between text-sm">
                <span style={{ color: 'var(--accent)' }}>{d.name} <span style={{ color: 'var(--muted)' }}>· {d.units} ud</span></span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--accent2)' }}>{eur(d.unit)}/ud</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {purchases.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>Aún no hay compras registradas.</p>
      ) : (
        <>
        <button onClick={() => setShowHistory(s => !s)} className="flex items-center gap-2 text-xs font-semibold tracking-wide mb-2 cursor-pointer" style={{ color: 'var(--muted)' }}>
          {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />} HISTORIAL DE COMPRAS ({purchases.length})
        </button>
        {showHistory && (
        <div className="space-y-2">
          {purchases.map(p => (
            <div key={p.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--accent2)' }}>{p.product.name}{p.flavor ? <span style={{ color: 'var(--muted)' }}> · {p.flavor.name}</span> : ''}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{p.date} · {p.units} ud · {eur(lotTotal(p))} ({eur(lotUnitCost(p))}/ud){p.note ? ` · ${p.note}` : ''}</p>
              </div>
              <button onClick={() => del(p.id)} className="p-2 rounded-lg cursor-pointer shrink-0" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        )}
        </>
      )}
    </Section>
  )
}

function ExpenseBlock({ expenses, onChange }: { expenses: Expense[]; onChange: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ category: '', amount: '', description: '', date: today })
  const [saving, setSaving] = useState(false)
  async function add() {
    if (!form.category.trim()) { alert('Indica la categoría'); return }
    if (!form.amount || Number(form.amount) <= 0) { alert('Indica el importe'); return }
    setSaving(true)
    const res = await fetch('/api/admin/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: form.category, amount: Number(form.amount), description: form.description, date: form.date }) })
    setSaving(false)
    if (res.ok) { setForm({ category: '', amount: '', description: '', date: today }); onChange() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || 'No se pudo guardar') }
  }
  async function del(id: number) {
    if (!confirm('¿Eliminar este gasto?')) return
    const res = await fetch(`/api/admin/expenses/${id}`, { method: 'DELETE' })
    if (res.ok) onChange()
  }
  const inp = 'px-3 py-2 rounded-lg text-sm outline-none w-full'
  const inpStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }
  return (
    <Section title="Gastos generales" subtitle="Gastos no ligados a un producto (transporte, suministros, etc.)">
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Categoría" className={inp} style={inpStyle} />
          <input type="number" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="Importe €" className={inp} style={inpStyle} />
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción (opcional)" className={inp} style={inpStyle} />
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} style={{ ...inpStyle, colorScheme: 'dark' }} />
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={add} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
            <Plus size={14} /> {saving ? 'Guardando…' : 'Añadir gasto'}
          </button>
        </div>
      </div>
      {expenses.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>Aún no hay gastos registrados.</p>
      ) : (
        <div className="space-y-2">
          {expenses.map(e => (
            <div key={e.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--accent2)' }}>{e.category} · {eur(e.amount)}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{e.date}{e.description ? ` · ${e.description}` : ''}</p>
              </div>
              <button onClick={() => del(e.id)} className="p-2 rounded-lg cursor-pointer shrink-0" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

interface Category { id: number; name: string }
// Selector de categoría gestionable: elegir, crear nueva, renombrar y eliminar.
export function CategoryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [cats, setCats] = useState<Category[]>([])
  const [managing, setManaging] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const inp = 'px-3 py-2 rounded-lg text-sm outline-none w-full'
  const inpStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }

  const load = useCallback(async () => {
    const c = await fetch('/api/admin/categories').then(r => r.ok ? r.json() : [])
    setCats(c)
  }, [])
  useEffect(() => { load() }, [load])

  async function create() {
    const n = newName.trim()
    if (!n) return
    const res = await fetch('/api/admin/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) })
    if (res.ok) { setNewName(''); setCreating(false); await load(); onChange(n) }
    else { const e = await res.json().catch(() => ({})); alert(e.error || 'No se pudo crear') }
  }
  async function rename(c: Category) {
    const n = prompt('Nuevo nombre de la categoría:', c.name)
    if (n == null || !n.trim() || n.trim() === c.name) return
    const res = await fetch(`/api/admin/categories/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n.trim() }) })
    if (res.ok) { if (value === c.name) onChange(n.trim()); await load() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || 'No se pudo renombrar') }
  }
  async function remove(c: Category) {
    if (!confirm(`¿Eliminar la categoría «${c.name}»? Los productos que la usaban quedarán sin categoría.`)) return
    const res = await fetch(`/api/admin/categories/${c.id}`, { method: 'DELETE' })
    if (res.ok) { if (value === c.name) onChange(''); await load() }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select value={value} onChange={e => onChange(e.target.value)} className={inp} style={inpStyle}>
          <option value="">Categoría…</option>
          {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <button onClick={() => setCreating(v => !v)} className="p-2 rounded-lg cursor-pointer shrink-0" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)' }} aria-label="Nueva categoría"><Plus size={14} /></button>
        <button onClick={() => setManaging(v => !v)} className="p-2 rounded-lg cursor-pointer shrink-0" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)' }} aria-label="Editar categorías"><Pencil size={14} /></button>
      </div>
      {creating && (
        <div className="flex items-center gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} placeholder="Nueva categoría" className={inp} style={inpStyle} autoFocus />
          <button onClick={create} className="p-2 rounded-lg cursor-pointer shrink-0" style={{ background: 'var(--accent2)', color: 'var(--bg)' }} aria-label="Guardar"><Check size={14} /></button>
        </div>
      )}
      {managing && (
        <div className="rounded-lg p-2 space-y-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {cats.length === 0 ? <p className="text-xs px-1" style={{ color: 'var(--muted)' }}>Sin categorías.</p> : cats.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-sm px-1">
              <span style={{ color: 'var(--accent)' }}>{c.name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => rename(c)} className="p-1.5 rounded-lg cursor-pointer" style={{ background: 'var(--surface2)', color: 'var(--accent)' }} aria-label="Renombrar"><Pencil size={12} /></button>
                <button onClick={() => remove(c)} className="p-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }} aria-label="Eliminar"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- INVENTARIO / RENTABILIDAD POR PRODUCTO ----------
function Inventario({ products, data, onMutate }: { products: ProductRef[]; data: BillingData; onMutate: () => void }) {
  const [openId, setOpenId] = useState<number | null>(null)

  // Líneas vendidas por producto (pedidos entregados)
  const soldByProduct = useMemo(() => {
    const m = new Map<number, { price: number; quantity: number }[]>()
    for (const o of data.orders) {
      if (o.status !== 'completed') continue
      for (const it of o.items) {
        if (it.productId == null) continue
        const arr = m.get(it.productId) || []; arr.push({ price: it.price, quantity: it.quantity }); m.set(it.productId, arr)
      }
    }
    return m
  }, [data.orders])

  const purchasesByProduct = useMemo(() => {
    const m = new Map<number, typeof data.purchases>()
    for (const p of data.purchases) { const arr = m.get(p.productId) || []; arr.push(p); m.set(p.productId, arr) }
    return m
  }, [data.purchases])

  // Evolución de la posición neta por producto (empieza en -inversión y sube con cada venta)
  const sparkByProduct = useMemo(() => {
    const sorted = [...data.orders].filter(o => o.status === 'completed').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const invested = new Map<number, number>()
    for (const [pid, lots] of purchasesByProduct) invested.set(pid, lots.reduce((s, l) => s + lotTotal(l), 0))
    const series = new Map<number, number[]>()
    const running = new Map<number, number>()
    for (const pid of invested.keys()) { running.set(pid, -(invested.get(pid) || 0)); series.set(pid, [-(invested.get(pid) || 0)]) }
    for (const o of sorted) {
      for (const it of o.items) {
        if (it.productId == null || !series.has(it.productId)) continue
        const v = (running.get(it.productId) || 0) + it.price * it.quantity
        running.set(it.productId, v)
        series.get(it.productId)!.push(v)
      }
    }
    return series
  }, [data.orders, purchasesByProduct])

  // Productos con compras o ventas
  const rows = useMemo(() => {
    return products
      .map(p => {
        const lots = purchasesByProduct.get(p.id) || []
        const sold = soldByProduct.get(p.id) || []
        if (lots.length === 0 && sold.length === 0) return null
        const stats = computeProductStats(lots, sold.map(s => ({ productId: p.id, price: s.price, quantity: s.quantity })), effectivePrice(p))
        const stockLeft = p.flavors.reduce((s, f) => s + (f.stock || 0), 0)
        return { product: p, stats, stockLeft }
      })
      .filter((x): x is { product: ProductRef; stats: ReturnType<typeof computeProductStats>; stockLeft: number } => x != null)
      .sort((a, b) => a.stats.netPosition - b.stats.netPosition) // primero los que faltan por recuperar
  }, [products, purchasesByProduct, soldByProduct])

  if (openId != null) {
    const row = rows.find(r => r.product.id === openId)
    if (row) return <InventoryDetail row={row} lots={purchasesByProduct.get(openId) || []} onBack={() => setOpenId(null)} onMutate={onMutate} />
  }

  if (rows.length === 0) return (
    <EmptyState icon={Boxes} title="Aún no hay productos con compras" hint="Registra una compra en la pestaña Costes y aquí verás su inversión, stock y rentabilidad." />
  )

  return (
    <div className="space-y-2">
      {rows.map(({ product, stats, stockLeft }) => {
        const roiPct = stats.invested > 0 ? (stats.netPosition / stats.invested) * 100 : 0
        const barColor = stats.recovered ? '#22c55e' : stats.progressPct >= 50 ? '#f59e0b' : '#ef4444'
        return (
          <button key={product.id} onClick={() => setOpenId(product.id)}
            className="w-full text-left rounded-2xl p-4 cursor-pointer transition-all hover:opacity-90"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate" style={{ color: 'var(--accent2)' }}>{product.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Invertido {eur(stats.invested)} · {stockLeft} en stock · {stats.unitsSold} vendidas
                </p>
              </div>
              <Sparkline values={sparkByProduct.get(product.id) || []} />
              <div className="text-right shrink-0">
                <span className="text-xs font-semibold px-2 py-1 rounded-lg block"
                  style={{ background: stats.recovered ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: stats.recovered ? '#22c55e' : '#ef4444' }}>
                  {stats.recovered ? `+${eur(stats.netPosition)}` : `−${eur(Math.abs(stats.netPosition))}`}
                </span>
                <span className="text-[10px] tabular-nums" style={{ color: stats.netPosition >= 0 ? '#22c55e' : '#ef4444' }}>
                  {roiPct >= 0 ? '+' : ''}{roiPct.toFixed(0)}%
                </span>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--muted)' }} className="shrink-0" />
            </div>
            {/* Barra de progreso de recuperación */}
            <div className="h-1.5 rounded-full overflow-hidden mt-3" style={{ background: 'var(--surface2)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, stats.progressPct)}%`, background: barColor }} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

function InventoryDetail({ row, lots, onBack, onMutate }: {
  row: { product: ProductRef; stats: ReturnType<typeof computeProductStats>; stockLeft: number }
  lots: BillingPurchase[]; onBack: () => void; onMutate: () => void
}) {
  const { product, stats, stockLeft } = row

  async function adjustStock(flavorId: number, name: string, current: number) {
    const input = prompt(`Corregir stock de «${name}» (defectuosos, regalos, recuento).\nUnidades reales:`, String(current))
    if (input == null) return
    const n = Math.max(0, Math.floor(Number(input)))
    if (isNaN(n)) { alert('Número inválido'); return }
    const res = await fetch(`/api/admin/flavors/${flavorId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock: n }),
    })
    if (res.ok) onMutate(); else alert('No se pudo ajustar')
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: 'var(--muted)' }}>
        <ArrowLeft size={15} /> Volver al inventario
      </button>
      <div>
        <h3 className="text-lg font-bold" style={{ color: 'var(--accent2)' }}>{product.name}</h3>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Precio de venta actual: {eur(stats.salePrice)}</p>
      </div>

      {/* Posición / break-even */}
      <div className="rounded-2xl p-5" style={{ background: stats.recovered ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.07)', border: `1px solid ${stats.recovered ? '#22c55e' : '#ef4444'}` }}>
        <div className="flex items-center gap-2 mb-2">
          {stats.recovered ? <CheckCircle2 size={18} style={{ color: '#22c55e' }} /> : <Target size={18} style={{ color: '#ef4444' }} />}
          <p className="font-bold" style={{ color: stats.recovered ? '#22c55e' : '#ef4444' }}>
            {stats.recovered ? `Inversión recuperada · +${eur(stats.netPosition)}` : `Aún en negativo · −${eur(Math.abs(stats.netPosition))}`}
          </p>
        </div>
        {!stats.recovered && (
          <p className="text-sm mb-2" style={{ color: 'var(--accent)' }}>
            Faltan <b style={{ color: 'var(--accent2)' }}>{stats.unitsToBreakEven} uds</b> por vender para recuperar la inversión.
          </p>
        )}
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
          <div className="h-full rounded-full" style={{ width: `${stats.progressPct}%`, background: stats.recovered ? '#22c55e' : '#f59e0b' }} />
        </div>
        <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>{stats.progressPct.toFixed(0)}% de la inversión recuperada ({eur(stats.revenue)} de {eur(stats.invested)})</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Inversión total" value={eur(stats.invested)} icon={Coins} accent="#f59e0b" />
        <KpiCard label="Coste medio/ud" value={eur(stats.costPerUnit)} icon={Layers} accent="#f59e0b" />
        <KpiCard label="Stock restante" value={`${stockLeft} uds`} icon={Boxes} />
        <KpiCard label="Unidades vendidas" value={`${stats.unitsSold}`} icon={ShoppingBag} />
        <KpiCard label="Ingresos" value={eur(stats.revenue)} icon={Euro} />
        <KpiCard label="Beneficio/ud" value={eur(stats.profitPerUnit)} icon={TrendingUp} accent="#22c55e" />
      </div>
      <p className="text-xs px-1" style={{ color: 'var(--muted)' }}>
        Margen por unidad: <b style={{ color: 'var(--accent2)' }}>{pct(stats.marginPct)}</b> · Beneficio contable de lo vendido: <b style={{ color: stats.realizedProfit >= 0 ? '#22c55e' : '#ef4444' }}>{eur(stats.realizedProfit)}</b>
      </p>

      {/* Stock por sabor + corregir */}
      <Section title="Stock por sabor" subtitle="«Corregir» ajusta las unidades reales (defectuosos, regalos, recuento) sin tocar la inversión">
        {product.flavors.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Este producto no tiene sabores.</p>
        ) : (
          <div className="space-y-2">
            {product.flavors.map(f => (
              <div key={f.id ?? f.name} className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <span className="text-sm" style={{ color: 'var(--accent)' }}>{f.name}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold tabular-nums" style={{ color: f.stock > 0 ? 'var(--accent2)' : 'var(--danger)' }}>{f.stock} uds</span>
                  <button onClick={() => f.id != null && adjustStock(f.id, f.name, f.stock)} className="text-xs px-2.5 py-1 rounded-lg cursor-pointer" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)' }}>Corregir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Compras */}
      <Section title="Compras registradas">
        {lots.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin compras registradas.</p>
        ) : (
          <Table head={['Fecha', 'Uds', 'Coste', 'Coste/ud']} align={[0, 1, 1, 1]}
            rows={lots.map(l => [(l as BillingPurchase & { date?: string }).date || '—', String(l.units), eur(lotTotal(l)), eur(lotUnitCost(l))])} />
        )}
      </Section>
    </div>
  )
}
