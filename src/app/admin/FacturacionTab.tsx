'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Plus, Trash2, Package, Receipt, TrendingUp, TrendingDown, Wallet, Users, PiggyBank,
  ClipboardList, FileBarChart, Download, Euro, Percent, ShoppingBag, Coins, LineChart, Layers,
  Boxes, Target, ChevronRight, ArrowLeft, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import HistorialTab from './HistorialTab'
import { EvolutionChart, HBars } from './Charts'
import { lotTotal, lotUnitCost, weightedUnitCost } from '@/lib/costing'
import { computeProductStats } from '@/lib/inventory'
import { effectivePrice } from '@/lib/price'
import {
  unitCostMap, computeKpis, byProduct, byCategory, byClient, monthlySeries, cashSummary, monthProjection,
  presetRange, previousRange, pctChange,
  BillingOrder, BillingPurchase, BillingExpense, BillingProduct, Preset, Kpis,
} from '@/lib/billing'

interface Flavor { id?: number; name: string; inStock: boolean; stock: number }
interface ProductRef {
  id: number; name: string; price: number; category?: string
  flavors: Flavor[]; onSale: boolean; salePrice: number | null; saleEndsAt: string | null; saleUnits: number | null
}
interface BillingData { orders: BillingOrder[]; purchases: BillingPurchase[]; expenses: BillingExpense[]; products: BillingProduct[] }

type Sub = 'resumen' | 'ventas' | 'beneficios' | 'inventario' | 'costes' | 'clientes' | 'caja' | 'pedidos' | 'informes'
const SUBS: { key: Sub; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'resumen', label: 'Resumen', icon: LineChart },
  { key: 'ventas', label: 'Ventas', icon: Receipt },
  { key: 'beneficios', label: 'Beneficios', icon: PiggyBank },
  { key: 'inventario', label: 'Inventario', icon: Boxes },
  { key: 'costes', label: 'Costes', icon: Wallet },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'caja', label: 'Caja', icon: Coins },
  { key: 'pedidos', label: 'Pedidos', icon: ClipboardList },
  { key: 'informes', label: 'Informes', icon: FileBarChart },
]
const SUB_DESC: Record<Sub, string> = {
  resumen: 'Visión general del negocio en el periodo seleccionado.',
  ventas: 'Qué se ha vendido, por producto y categoría.',
  beneficios: 'Margen y beneficio real teniendo en cuenta los costes.',
  inventario: 'Stock, inversión y rentabilidad de cada producto en tiempo real.',
  costes: 'Registra tus compras (suman al stock) y los gastos generales.',
  clientes: 'Quién compra y cuánto gasta.',
  caja: 'Efectivo cobrado y cambios entregados.',
  pedidos: 'Historial completo de pedidos.',
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
  const showPeriod = sub !== 'costes' && sub !== 'pedidos' && sub !== 'informes' && sub !== 'inventario'
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
          {sub === 'resumen' && <Resumen data={data} costMap={costMap} preset={preset} refDate={ref} />}
          {sub === 'ventas' && <Ventas data={data} costMap={costMap} range={range} />}
          {sub === 'beneficios' && <Beneficios data={data} costMap={costMap} range={range} />}
          {sub === 'clientes' && <Clientes data={data} range={range} />}
          {sub === 'caja' && <Caja data={data} range={range} />}
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
function Resumen({ data, costMap, preset, refDate }: { data: BillingData; costMap: Map<number, number>; preset: Preset; refDate: Date }) {
  const range = presetRange(preset, refDate)
  const k = computeKpis(data.orders, costMap, data.expenses, range.from, range.to)
  const prevR = previousRange(preset, refDate)
  const prev: Kpis | null = prevR ? computeKpis(data.orders, costMap, data.expenses, prevR.from, prevR.to) : null
  const series = monthlySeries(data.orders, costMap, '2000-01-01', '2999-12-31').slice(-12)
  const proj = preset === 'month' ? monthProjection(data.orders, refDate) : null
  const empty = !hasSales(data, range.from, range.to)

  if (empty) return (
    <EmptyState icon={LineChart} title="Aún no hay ventas en este periodo"
      hint="Cuando entregues pedidos aparecerán aquí los ingresos, el beneficio y la evolución. Registra tus costes en la pestaña Costes para ver márgenes reales." />
  )

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Ingresos" value={eur(k.revenue)} icon={Euro} hero delta={prev && <Delta cur={k.revenue} prev={prev.revenue} />} />
        <KpiCard label="Beneficio bruto" value={eur(k.grossProfit)} icon={TrendingUp} accent="#22c55e" delta={prev && <Delta cur={k.grossProfit} prev={prev.grossProfit} />} />
        <KpiCard label="Beneficio neto" value={eur(k.netProfit)} icon={PiggyBank} accent={k.netProfit >= 0 ? '#22c55e' : '#ef4444'} delta={prev && <Delta cur={k.netProfit} prev={prev.netProfit} />} />
        <KpiCard label="Margen bruto" value={pct(k.grossMarginPct)} icon={Percent} accent="#3b82f6" />
        <KpiCard label="Ticket medio" value={eur(k.avgTicket)} icon={Receipt} />
        <KpiCard label="Pedidos" value={String(k.orderCount)} icon={ShoppingBag} delta={prev && <Delta cur={k.orderCount} prev={prev.orderCount} />} />
      </div>

      {prev && (
        <p className="text-xs px-1" style={{ color: 'var(--muted)' }}>
          vs {prevR!.label}: ingresos {eur(prev.revenue)} · beneficio neto {eur(prev.netProfit)}
        </p>
      )}

      {proj && proj.soFar > 0 && (
        <div className="rounded-2xl p-5 flex items-center justify-between gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <p className="text-xs font-semibold tracking-wide mb-1" style={{ color: 'var(--muted)' }}>PROYECCIÓN DEL MES</p>
            <p className="text-sm" style={{ color: 'var(--accent)' }}>Llevas {eur(proj.soFar)} en {proj.dayOfMonth}/{proj.daysInMonth} días</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--accent2)' }}>≈ {eur(proj.projected)}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>estimado a fin de mes</p>
          </div>
        </div>
      )}

      <Section title="Evolución" subtitle="Ingresos y beneficio de los últimos meses">
        <EvolutionChart data={series} />
      </Section>
    </div>
  )
}

// ---------- VENTAS ----------
function Ventas({ data, costMap, range }: { data: BillingData; costMap: Map<number, number>; range: { from: string; to: string } }) {
  if (!hasSales(data, range.from, range.to)) return <EmptyState icon={Receipt} title="Sin ventas en este periodo" hint="Aquí verás qué productos y categorías se venden más cuando haya pedidos entregados." />
  const prods = byProduct(data.orders, costMap, range.from, range.to)
  const cats = byCategory(data.orders, costMap, data.products, range.from, range.to)
  const totalRev = prods.reduce((s, p) => s + p.revenue, 0)
  const totalUnits = prods.reduce((s, p) => s + p.units, 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Ingresos del periodo" value={eur(totalRev)} icon={Euro} hero />
        <KpiCard label="Unidades vendidas" value={String(totalUnits)} icon={Package} />
      </div>
      <Section title="Ingresos por producto" subtitle="Ordenado de mayor a menor">
        <HBars items={prods.map(p => ({ label: p.name, value: p.revenue, sub: `${p.units} ud` }))} />
      </Section>
      <Section title="Ingresos por categoría">
        <HBars items={cats.map(c => ({ label: c.category, value: c.revenue, sub: `${c.units} ud` }))} color="#3b82f6" />
      </Section>
      <Section title="Detalle por producto">
        <Table head={['Producto', 'Uds', 'Ingresos']} align={[0, 1, 1]} rows={prods.map(p => [p.name, String(p.units), eur(p.revenue)])} />
      </Section>
    </div>
  )
}

// ---------- BENEFICIOS ----------
function Beneficios({ data, costMap, range }: { data: BillingData; costMap: Map<number, number>; range: { from: string; to: string } }) {
  if (!hasSales(data, range.from, range.to)) return <EmptyState icon={PiggyBank} title="Sin datos de beneficio" hint="El beneficio se calcula con los ingresos menos el coste de la mercancía (registra tus compras en Costes)." />
  const k = computeKpis(data.orders, costMap, data.expenses, range.from, range.to)
  const prods = byProduct(data.orders, costMap, range.from, range.to)
  const byProfit = [...prods].sort((a, b) => b.profit - a.profit)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ingresos" value={eur(k.revenue)} icon={Euro} />
        <KpiCard label="Coste mercancía" value={eur(k.cogs)} icon={Layers} accent="#f59e0b" />
        <KpiCard label="Beneficio bruto" value={eur(k.grossProfit)} icon={TrendingUp} accent="#22c55e" hero />
        <KpiCard label="Margen bruto" value={pct(k.grossMarginPct)} icon={Percent} accent="#3b82f6" />
      </div>
      <p className="text-xs px-1" style={{ color: 'var(--muted)' }}>
        Beneficio neto (tras {eur(k.expenses)} de gastos generales): <b style={{ color: k.netProfit >= 0 ? '#22c55e' : '#ef4444' }}>{eur(k.netProfit)}</b>
      </p>
      <Section title="Beneficio por producto" subtitle="Con su margen %">
        <HBars items={byProfit.map(p => ({ label: p.name, value: p.profit, sub: pct(p.marginPct) }))} color="#22c55e" />
      </Section>
      <Section title="Detalle de márgenes">
        <Table head={['Producto', 'Ingresos', 'Coste', 'Beneficio', 'Margen']} align={[0, 1, 1, 1, 1]}
          rows={byProfit.map(p => [p.name, eur(p.revenue), eur(p.cogs), eur(p.profit), pct(p.marginPct)])} />
      </Section>
    </div>
  )
}

// ---------- CLIENTES ----------
function Clientes({ data, range }: { data: BillingData; range: { from: string; to: string } }) {
  if (!hasSales(data, range.from, range.to)) return <EmptyState icon={Users} title="Sin clientes en este periodo" hint="Aquí verás quién compra y cuánto gasta cada cliente." />
  const clients = byClient(data.orders, range.from, range.to)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Clientes activos" value={String(clients.length)} icon={Users} hero />
        <KpiCard label="Gasto total" value={eur(clients.reduce((s, c) => s + c.revenue, 0))} icon={Euro} />
      </div>
      <Section title="Ranking por gasto">
        <HBars items={clients.map(c => ({ label: c.name, value: c.revenue, sub: `${c.orders} ped.` }))} />
      </Section>
      <Section title="Detalle por cliente">
        <Table head={['Cliente', 'Pedidos', 'Gastado', 'Ticket medio']} align={[0, 1, 1, 1]}
          rows={clients.map(c => [c.name, String(c.orders), eur(c.revenue), eur(c.avgTicket)])} />
      </Section>
    </div>
  )
}

// ---------- CAJA ----------
function Caja({ data, range }: { data: BillingData; range: { from: string; to: string } }) {
  if (!hasSales(data, range.from, range.to)) return <EmptyState icon={Coins} title="Sin movimientos de caja" hint="Aquí verás el efectivo cobrado y los cambios entregados cuando haya pedidos entregados." />
  const c = cashSummary(data.orders, range.from, range.to)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Efectivo cobrado" value={eur(c.collected)} icon={Coins} accent="#22c55e" hero />
        <KpiCard label="Cambios entregados" value={eur(c.changeGiven)} icon={Wallet} accent="#f59e0b" />
        <KpiCard label="Exactos / con cambio" value={`${c.exactCount} / ${c.withChangeCount}`} icon={Receipt} />
      </div>
      <p className="text-xs px-1" style={{ color: 'var(--muted)' }}>
        El efectivo neto que entra en caja es lo cobrado ({eur(c.collected)}); los cambios ya están descontados de lo que recibes de cada cliente.
      </p>
    </div>
  )
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

function PurchaseBlock({ products, purchases, unitCostByProduct, onChange }: {
  products: ProductRef[]; purchases: Purchase[]
  unitCostByProduct: Map<number, { name: string; units: number; unit: number }>; onChange: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ productId: '', units: '', productCost: '', date: today, note: '', flavorId: '', addToStock: true })
  const [saving, setSaving] = useState(false)

  const product = products.find(p => String(p.id) === form.productId)
  const flavors = product?.flavors ?? []
  const autoFlavor = flavors.length === 1 ? flavors[0] : null

  const liveUnit = useMemo(() => {
    const units = Number(form.units)
    if (!units || units <= 0) return null
    return lotUnitCost({ units, productCost: Number(form.productCost) || 0, shipping: 0, insurance: 0, otherCosts: 0 })
  }, [form.units, form.productCost])

  async function add() {
    if (!form.productId) { alert('Elige un producto'); return }
    if (!form.units || Number(form.units) <= 0) { alert('Indica las unidades'); return }
    if (form.productCost === '' || Number(form.productCost) < 0) { alert('Indica el coste total'); return }
    const flavorId = form.flavorId ? Number(form.flavorId) : (autoFlavor?.id ?? null)
    if (form.addToStock && flavors.length > 0 && flavorId == null) { alert('Elige el sabor al que sumar el stock'); return }
    setSaving(true)
    const res = await fetch('/api/admin/purchases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: Number(form.productId), units: Number(form.units), productCost: Number(form.productCost), date: form.date, note: form.note, flavorId, addToStock: form.addToStock }),
    })
    setSaving(false)
    if (res.ok) { setForm({ productId: '', units: '', productCost: '', date: today, note: '', flavorId: '', addToStock: true }); onChange() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || 'No se pudo guardar') }
  }
  async function del(id: number) {
    if (!confirm('¿Eliminar este lote de compra? (no resta el stock que sumó)')) return
    const res = await fetch(`/api/admin/purchases/${id}`, { method: 'DELETE' })
    if (res.ok) onChange()
  }
  const inp = 'px-3 py-2 rounded-lg text-sm outline-none w-full'
  const inpStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }

  return (
    <Section title="Registrar una compra" subtitle="Pon el coste total (con envío y seguros ya sumados). Suma el stock al sabor que elijas.">
      <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value, flavorId: '' }))} className={inp} style={inpStyle}>
            <option value="">Producto…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} style={{ ...inpStyle, colorScheme: 'dark' }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <LabeledInput label="Cantidad (uds)" value={form.units} onChange={v => setForm(f => ({ ...f, units: v }))} />
          <LabeledInput label="Coste total €" value={form.productCost} onChange={v => setForm(f => ({ ...f, productCost: v }))} />
        </div>

        {/* Sumar al stock + sabor */}
        {form.productId && (
          <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {flavors.length === 0 ? (
              <p className="text-xs flex items-center gap-1.5" style={{ color: '#f59e0b' }}>
                <AlertTriangle size={13} /> Este producto no tiene sabores. Añádelos en Catálogo para poder sumar stock.
              </p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--accent)' }}>
                  <input type="checkbox" checked={form.addToStock} onChange={e => setForm(f => ({ ...f, addToStock: e.target.checked }))} />
                  Sumar estas unidades al stock
                </label>
                {form.addToStock && (autoFlavor ? (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>→ Se sumará a: <b style={{ color: 'var(--accent2)' }}>{autoFlavor.name}</b></p>
                ) : (
                  <select value={form.flavorId} onChange={e => setForm(f => ({ ...f, flavorId: e.target.value }))} className={inp} style={inpStyle}>
                    <option value="">Elige el sabor…</option>
                    {flavors.map(f => <option key={f.id ?? f.name} value={f.id}>{f.name} ({f.stock} uds)</option>)}
                  </select>
                ))}
              </>
            )}
          </div>
        )}

        <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Nota (opcional)" className={inp} style={inpStyle} />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>{liveUnit != null ? <>Coste/unidad: <b style={{ color: 'var(--accent2)' }}>{eur(liveUnit)}</b></> : 'Coste/unidad: —'}</span>
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

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] block mb-1" style={{ color: 'var(--muted)' }}>{label}</label>
      <input type="number" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)}
        className="px-2 py-2 rounded-lg text-sm outline-none w-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />
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
      {rows.map(({ product, stats, stockLeft }) => (
        <button key={product.id} onClick={() => setOpenId(product.id)}
          className="w-full text-left rounded-2xl p-4 flex items-center gap-3 cursor-pointer transition-all hover:opacity-90"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--accent2)' }}>{product.name}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Invertido {eur(stats.invested)} · {stockLeft} en stock · {stats.unitsSold} vendidas
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-lg shrink-0"
            style={{ background: stats.recovered ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: stats.recovered ? '#22c55e' : '#ef4444' }}>
            {stats.recovered ? `+${eur(stats.netPosition)}` : `−${eur(Math.abs(stats.netPosition))}`}
          </span>
          <ChevronRight size={16} style={{ color: 'var(--muted)' }} className="shrink-0" />
        </button>
      ))}
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
            🎯 Faltan <b style={{ color: 'var(--accent2)' }}>{stats.unitsToBreakEven} uds</b> por vender para recuperar la inversión.
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
