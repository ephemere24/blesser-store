'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Plus, Trash2, Package, Receipt, TrendingUp, Wallet, Users, PiggyBank, ClipboardList, FileBarChart } from 'lucide-react'
import HistorialTab from './HistorialTab'
import { lotTotal, lotUnitCost, weightedUnitCost } from '@/lib/costing'

interface ProductRef { id: number; name: string }

interface Purchase {
  id: number; productId: number; units: number; productCost: number
  shipping: number; insurance: number; otherCosts: number; note: string | null; date: string
  product: { id: number; name: string }
}
interface Expense {
  id: number; category: string; amount: number; description: string | null; date: string
}

type Sub = 'resumen' | 'ventas' | 'beneficios' | 'costes' | 'clientes' | 'caja' | 'pedidos' | 'informes'

const SUBS: { key: Sub; label: string; icon: React.ComponentType<{ size?: number }>; ready: boolean }[] = [
  { key: 'resumen', label: 'Resumen', icon: TrendingUp, ready: false },
  { key: 'ventas', label: 'Ventas', icon: Receipt, ready: false },
  { key: 'beneficios', label: 'Beneficios', icon: PiggyBank, ready: false },
  { key: 'costes', label: 'Costes', icon: Wallet, ready: true },
  { key: 'clientes', label: 'Clientes', icon: Users, ready: false },
  { key: 'caja', label: 'Caja', icon: Package, ready: false },
  { key: 'pedidos', label: 'Pedidos', icon: ClipboardList, ready: true },
  { key: 'informes', label: 'Informes', icon: FileBarChart, ready: false },
]

const eur = (n: number) => `${n.toFixed(2)} €`

export default function FacturacionTab({ products }: { products: ProductRef[] }) {
  const [sub, setSub] = useState<Sub>('costes')

  return (
    <div>
      <h2 className="font-bold mb-4 text-lg" style={{ color: 'var(--accent2)' }}>Facturación</h2>

      {/* Sub-navegación */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {SUBS.map(({ key, label, icon: Icon, ready }) => (
          <button key={key} onClick={() => setSub(key)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer shrink-0"
            style={{
              background: sub === key ? 'var(--accent2)' : 'var(--surface2)',
              color: sub === key ? 'var(--bg)' : ready ? 'var(--accent)' : 'var(--muted)',
              border: '1px solid var(--border)',
              opacity: ready || sub === key ? 1 : 0.6,
            }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {sub === 'costes' && <CostesSection products={products} />}
      {sub === 'pedidos' && <HistorialTab />}
      {sub !== 'costes' && sub !== 'pedidos' && <ComingSoon />}
    </div>
  )
}

function ComingSoon() {
  return (
    <div className="text-center py-20 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <TrendingUp size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
      <p className="font-semibold" style={{ color: 'var(--accent2)' }}>Próximamente</p>
      <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Este apartado llega en la siguiente fase.</p>
    </div>
  )
}

function CostesSection({ products }: { products: ProductRef[] }) {
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

  // Coste/unidad por media ponderada, por producto
  const unitCostByProduct = useMemo(() => {
    const byProd = new Map<number, Purchase[]>()
    for (const p of purchases) {
      const arr = byProd.get(p.productId) || []
      arr.push(p); byProd.set(p.productId, arr)
    }
    const out = new Map<number, { name: string; units: number; total: number; unit: number }>()
    for (const [pid, lots] of byProd) {
      const total = lots.reduce((s, l) => s + lotTotal(l), 0)
      const units = lots.reduce((s, l) => s + l.units, 0)
      out.set(pid, { name: lots[0].product.name, units, total, unit: weightedUnitCost(lots) })
    }
    return out
  }, [purchases])

  const totalInvertido = useMemo(() => purchases.reduce((s, p) => s + lotTotal(p), 0), [purchases])
  const totalGastos = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses])

  if (loading) return <div className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>Cargando…</div>

  return (
    <div className="space-y-8">
      {/* KPIs de costes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Kpi label="Invertido en compras" value={eur(totalInvertido)} />
        <Kpi label="Gastos generales" value={eur(totalGastos)} />
        <Kpi label="Coste total" value={eur(totalInvertido + totalGastos)} highlight />
      </div>

      <PurchaseBlock products={products} purchases={purchases} unitCostByProduct={unitCostByProduct} onChange={load} />
      <ExpenseBlock expenses={expenses} onChange={load} />
    </div>
  )
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: `1px solid ${highlight ? 'var(--accent2)' : 'var(--border)'}` }}>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-xl font-bold mt-1" style={{ color: 'var(--accent2)' }}>{value}</p>
    </div>
  )
}

function PurchaseBlock({ products, purchases, unitCostByProduct, onChange }: {
  products: ProductRef[]
  purchases: Purchase[]
  unitCostByProduct: Map<number, { name: string; units: number; total: number; unit: number }>
  onChange: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ productId: '', units: '', productCost: '', shipping: '', insurance: '', otherCosts: '', date: today, note: '' })
  const [saving, setSaving] = useState(false)

  const liveUnit = useMemo(() => {
    const units = Number(form.units)
    if (!units || units <= 0) return null
    return lotUnitCost({
      units,
      productCost: Number(form.productCost) || 0,
      shipping: Number(form.shipping) || 0,
      insurance: Number(form.insurance) || 0,
      otherCosts: Number(form.otherCosts) || 0,
    })
  }, [form])

  async function add() {
    if (!form.productId) { alert('Elige un producto'); return }
    if (!form.units || Number(form.units) <= 0) { alert('Indica las unidades'); return }
    if (form.productCost === '' || Number(form.productCost) < 0) { alert('Indica el coste del producto'); return }
    setSaving(true)
    const res = await fetch('/api/admin/purchases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: Number(form.productId), units: Number(form.units), productCost: Number(form.productCost),
        shipping: Number(form.shipping) || 0, insurance: Number(form.insurance) || 0, otherCosts: Number(form.otherCosts) || 0,
        date: form.date, note: form.note,
      }),
    })
    setSaving(false)
    if (res.ok) { setForm({ productId: '', units: '', productCost: '', shipping: '', insurance: '', otherCosts: '', date: today, note: '' }); onChange() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || 'No se pudo guardar') }
  }

  async function del(id: number) {
    if (!confirm('¿Eliminar este lote de compra?')) return
    const res = await fetch(`/api/admin/purchases/${id}`, { method: 'DELETE' })
    if (res.ok) onChange()
  }

  const inp = 'px-3 py-2 rounded-lg text-sm outline-none w-full'
  const inpStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }

  return (
    <div>
      <h3 className="font-semibold mb-3" style={{ color: 'var(--accent2)' }}>Compras (lotes)</h3>

      {/* Formulario de alta */}
      <div className="rounded-2xl p-4 mb-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} className={inp} style={inpStyle}>
            <option value="">Producto…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inp} style={{ ...inpStyle, colorScheme: 'dark' }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <LabeledInput label="Unidades" value={form.units} onChange={v => setForm(f => ({ ...f, units: v }))} />
          <LabeledInput label="Coste producto €" value={form.productCost} onChange={v => setForm(f => ({ ...f, productCost: v }))} />
          <LabeledInput label="Envío €" value={form.shipping} onChange={v => setForm(f => ({ ...f, shipping: v }))} />
          <LabeledInput label="Seguro €" value={form.insurance} onChange={v => setForm(f => ({ ...f, insurance: v }))} />
          <LabeledInput label="Otros €" value={form.otherCosts} onChange={v => setForm(f => ({ ...f, otherCosts: v }))} />
        </div>
        <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Nota (opcional)" className={inp} style={inpStyle} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>
            {liveUnit != null ? <>Coste/unidad de este lote: <b style={{ color: 'var(--accent2)' }}>{eur(liveUnit)}</b></> : 'Coste/unidad: —'}
          </span>
          <button onClick={add} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
            <Plus size={14} /> {saving ? 'Guardando…' : 'Añadir lote'}
          </button>
        </div>
      </div>

      {/* Coste/unidad por producto (media ponderada) */}
      {unitCostByProduct.size > 0 && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold mb-2 tracking-wide" style={{ color: 'var(--muted)' }}>COSTE/UNIDAD POR PRODUCTO (media ponderada)</p>
          <div className="space-y-1.5">
            {[...unitCostByProduct.entries()].map(([pid, d]) => (
              <div key={pid} className="flex justify-between text-sm">
                <span style={{ color: 'var(--accent)' }}>{d.name} <span style={{ color: 'var(--muted)' }}>· {d.units} ud</span></span>
                <span className="font-semibold" style={{ color: 'var(--accent2)' }}>{eur(d.unit)}/ud</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de lotes */}
      {purchases.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>Aún no hay compras registradas.</p>
      ) : (
        <div className="space-y-2">
          {purchases.map(p => (
            <div key={p.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--accent2)' }}>{p.product.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {p.date} · {p.units} ud · {eur(lotTotal(p))} ({eur(lotUnitCost(p))}/ud)
                  {(p.shipping || p.insurance || p.otherCosts) ? ` · envío ${p.shipping}€ · seguro ${p.insurance}€ · otros ${p.otherCosts}€` : ''}
                  {p.note ? ` · ${p.note}` : ''}
                </p>
              </div>
              <button onClick={() => del(p.id)} className="p-2 rounded-lg cursor-pointer shrink-0" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
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
    const res = await fetch('/api/admin/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: form.category, amount: Number(form.amount), description: form.description, date: form.date }),
    })
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
    <div>
      <h3 className="font-semibold mb-3" style={{ color: 'var(--accent2)' }}>Gastos generales</h3>

      <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
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
        <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>Aún no hay gastos registrados.</p>
      ) : (
        <div className="space-y-2">
          {expenses.map(e => (
            <div key={e.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--accent2)' }}>{e.category} · {eur(e.amount)}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{e.date}{e.description ? ` · ${e.description}` : ''}</p>
              </div>
              <button onClick={() => del(e.id)} className="p-2 rounded-lg cursor-pointer shrink-0" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] block mb-1" style={{ color: 'var(--muted)' }}>{label}</label>
      <input type="number" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)}
        className="px-2 py-2 rounded-lg text-sm outline-none w-full"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />
    </div>
  )
}
