'use client'

import { useEffect, useMemo, useState } from 'react'
import { Package, RefreshCw, Search, Trash2, Download, X, Check, ShoppingBag, Euro, Receipt, Calendar } from 'lucide-react'
import { formatDayLabel } from '@/lib/pickup'

interface OItem { id: number; productId: number | null; productName: string; flavorName: string | null; price: number; quantity: number; onSale: boolean }
interface Order {
  id: number; total: number; status: string; note: string | null; manual: boolean; createdAt: string
  pickupDate: string | null; pickupTime: string | null; customerName: string | null; customerPhone: string | null
  items: OItem[]; accessCode: { code: string; clientName: string | null; phone: string | null } | null
}
interface PProduct { id: number; name: string }

const STATUS = {
  pending: { label: 'Pendiente', color: '#f59e0b' },
  ready: { label: 'Preparado', color: '#3b82f6' },
  completed: { label: 'Entregado', color: '#22c55e' },
  cancelled: { label: 'Cancelado', color: '#ef4444' },
} as Record<string, { label: string; color: string }>

function orderName(o: Order) { return o.customerName || o.accessCode?.clientName || 'Sin nombre' }
function orderPhone(o: Order) { return o.customerPhone || o.accessCode?.phone || '' }

export default function HistorialTab() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<PProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [productId, setProductId] = useState<number | null>(null)
  const [status, setStatus] = useState<string>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [onlyOnSale, setOnlyOnSale] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  async function load() {
    const res = await fetch('/api/admin/orders')
    if (res.ok) setOrders(await res.json())
    setLoading(false)
  }
  useEffect(() => {
    load()
    fetch('/api/admin/products').then(r => r.ok ? r.json() : []).then(setProducts)
  }, [])

  function preset(days: number | 'all') {
    if (days === 'all') { setFrom(''); setTo(''); return }
    const t = new Date(); const f = new Date(); f.setDate(f.getDate() - days)
    setFrom(f.toISOString().slice(0, 10)); setTo(t.toISOString().slice(0, 10))
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter(o => {
      if (status !== 'all' && o.status !== status) return false
      if (onlyOnSale && !o.items.some(i => i.onSale)) return false
      if (productId && !o.items.some(i => i.productId === productId)) return false
      if (q) {
        const hay = `${orderName(o)} ${orderPhone(o)} ${o.accessCode?.code ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      const day = o.createdAt.slice(0, 10)
      if (from && day < from) return false
      if (to && day > to) return false
      return true
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [orders, search, productId, status, from, to, onlyOnSale])

  const revenue = filtered.filter(o => o.status === 'completed').reduce((s, o) => s + o.total, 0)
  const deliveredCount = filtered.filter(o => o.status === 'completed').length
  const avgTicket = deliveredCount > 0 ? revenue / deliveredCount : 0

  const groups: { day: string; items: Order[] }[] = []
  for (const o of filtered) {
    const day = o.createdAt.slice(0, 10)
    const g = groups.find(x => x.day === day)
    if (g) g.items.push(o); else groups.push({ day, items: [o] })
  }

  const hasFilters = !!(search || productId || status !== 'all' || from || to || onlyOnSale)
  const allVisibleSelected = filtered.length > 0 && filtered.every(o => selected.has(o.id))
  function toggleSelectAll() { setSelected(allVisibleSelected ? new Set() : new Set(filtered.map(o => o.id))) }
  function toggle(id: number) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  async function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`¿Eliminar ${selected.size} pedido(s)? Se devolverá su stock al inventario. No se puede deshacer.`)) return
    await fetch('/api/admin/orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selected] }) })
    setSelected(new Set()); load()
  }

  function exportCSV() {
    const rows = [['Fecha', 'Cliente', 'Teléfono', 'Estado', 'Recogida', 'Productos', 'Total €']]
    filtered.forEach(o => rows.push([
      new Date(o.createdAt).toLocaleString('es-ES'), orderName(o), orderPhone(o),
      STATUS[o.status]?.label ?? o.status,
      o.pickupDate && o.pickupTime ? `${o.pickupDate} ${o.pickupTime}` : '',
      o.items.map(i => `${i.quantity}x ${i.productName}${i.flavorName ? ` (${i.flavorName})` : ''}`).join(' | '),
      o.total.toFixed(2),
    ]))
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const inputBase = 'w-full rounded-xl text-sm outline-none transition-all focus:ring-2 focus:ring-white/15'
  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }

  const kpis = [
    { label: 'Pedidos', value: String(filtered.length), icon: ShoppingBag, tint: 'var(--accent2)' },
    { label: 'Ingresos', value: `${revenue.toFixed(2)}€`, icon: Euro, tint: '#22c55e' },
    { label: 'Ticket medio', value: `${avgTicket.toFixed(2)}€`, icon: Receipt, tint: 'var(--accent2)' },
  ]

  return (
    <div>
      {/* Cabecera */}
      <div className="flex items-end justify-between mb-5 gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--accent2)' }}>Historial</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {orders.length} pedido{orders.length !== 1 ? 's' : ''} en total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} title="Exportar CSV"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors hover:brightness-125"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
            <Download size={15} /> <span className="hidden sm:inline">CSV</span>
          </button>
          <button onClick={load} title="Actualizar"
            className="p-2 rounded-xl cursor-pointer transition-colors hover:brightness-125"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)' }}><RefreshCw size={15} /></button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 rounded-2xl mb-5 overflow-hidden bs-rise" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {kpis.map((k, i) => (
          <div key={k.label} className="px-3.5 py-4 relative" style={{ borderLeft: i ? '1px solid var(--border)' : undefined }}>
            <k.icon size={14} className="mb-2" style={{ color: 'rgba(255,255,255,0.35)' }} />
            <p className="text-lg sm:text-2xl font-bold tabular-nums leading-none tracking-tight" style={{ color: k.tint }}>{k.value}</p>
            <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="space-y-2.5 mb-5">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,255,255,0.4)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente, teléfono o código"
            className={`${inputBase} pl-10 pr-3 py-3`} style={inputStyle} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <select value={productId ?? ''} onChange={e => setProductId(Number(e.target.value) || null)}
            className={`${inputBase} px-3 py-3 truncate`} style={inputStyle}>
            <option value="">Todos los productos</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className={`${inputBase} px-3 py-3`} style={inputStyle}>
            <option value="all">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="ready">Preparado</option>
            <option value="completed">Entregado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div>
          <p className="text-[11px] mb-1.5 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <Calendar size={12} /> Rango de fechas
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] pl-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Desde</span>
              <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}
                className={`${inputBase} px-3 py-3`} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] pl-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Hasta</span>
              <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}
                className={`${inputBase} px-3 py-3`} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </label>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {([['Hoy', 0], ['7 días', 7], ['30 días', 30], ['Todo', 'all']] as const).map(([l, d]) => (
            <button key={l} onClick={() => preset(d)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors hover:text-white"
              style={{ background: 'var(--surface2)', color: 'rgba(255,255,255,0.6)', border: '1px solid var(--border)' }}>{l}</button>
          ))}
          <button onClick={() => setOnlyOnSale(v => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            style={{ background: onlyOnSale ? 'var(--danger)' : 'rgba(239,68,68,0.1)', color: onlyOnSale ? '#fff' : 'var(--danger)', border: '1px solid var(--danger)' }}>
            Liquidación
          </button>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setProductId(null); setStatus('all'); setFrom(''); setTo(''); setOnlyOnSale(false) }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1"
              style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
              <X size={12} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Barra de selección */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between mb-3 px-0.5">
          <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm cursor-pointer transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <span className="w-5 h-5 rounded-md flex items-center justify-center transition-colors" style={{ background: allVisibleSelected ? 'var(--accent2)' : 'transparent', border: `2px solid ${allVisibleSelected ? 'var(--accent2)' : 'rgba(255,255,255,0.35)'}` }}>
              {allVisibleSelected && <Check size={13} strokeWidth={3} style={{ color: 'var(--bg)' }} />}
            </span>
            Seleccionar todo
          </button>
          {selected.size > 0 && (
            <button onClick={deleteSelected} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer transition-transform active:scale-95" style={{ background: 'rgba(239,68,68,0.14)', color: 'var(--danger)' }}>
              <Trash2 size={14} /> Eliminar ({selected.size})
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
          <Package size={36} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.25)' }} />
          <p className="font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {hasFilters ? 'Nada coincide con los filtros' : 'Aún no hay pedidos'}
          </p>
          {hasFilters && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Prueba a limpiar los filtros</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(g => {
            const dayTotal = g.items.reduce((s, o) => s + o.total, 0)
            const dayDate = new Date(g.day + 'T00:00:00')
            return (
              <div key={g.day}>
                <div className="flex items-center gap-3 mb-2.5 sticky top-0 z-10 py-1.5" style={{ background: 'var(--bg)' }}>
                  <p className="text-xs font-bold uppercase tracking-wider capitalize shrink-0" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {formatDayLabel(dayDate)} <span style={{ color: 'rgba(255,255,255,0.35)' }}>· {dayDate.getFullYear()}</span>
                  </p>
                  <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
                  <p className="text-xs tabular-nums shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>{g.items.length} · {dayTotal.toFixed(2)}€</p>
                </div>
                <div className="space-y-2.5">
                  {g.items.map(o => {
                    const st = STATUS[o.status] ?? STATUS.pending
                    const sel = selected.has(o.id)
                    return (
                      <div key={o.id} className="rounded-2xl p-3.5 flex gap-3 transition-all bs-rise"
                        style={{ background: 'var(--surface)', border: `1px solid ${sel ? 'var(--accent2)' : 'var(--border)'}`, boxShadow: sel ? '0 0 0 1px var(--accent2)' : 'none' }}>
                        <button onClick={() => toggle(o.id)} className="shrink-0 mt-0.5 cursor-pointer">
                          <span className="w-5 h-5 rounded-md flex items-center justify-center transition-colors" style={{ background: sel ? 'var(--accent2)' : 'transparent', border: `2px solid ${sel ? 'var(--accent2)' : 'rgba(255,255,255,0.3)'}` }}>
                            {sel && <Check size={13} strokeWidth={3} style={{ color: 'var(--bg)' }} />}
                          </span>
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: st.color }} />
                                <span className="font-bold truncate" style={{ color: 'var(--accent2)' }}>{orderName(o)}</span>
                                {o.manual && <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>manual</span>}
                                {o.items.some(i => i.onSale) && <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-bold" style={{ background: 'var(--danger)', color: '#fff' }}>LIQUIDACIÓN</span>}
                              </div>
                              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                {new Date(o.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                {o.pickupDate && o.pickupTime ? ` · recogida ${o.pickupTime}` : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-base font-bold tabular-nums leading-none" style={{ color: 'var(--accent2)' }}>{o.total.toFixed(2)}€</p>
                              <span className="text-[11px] font-medium" style={{ color: st.color }}>{st.label}</span>
                            </div>
                          </div>
                          <div className="mt-2.5 space-y-1">
                            {o.items.map(it => (
                              <p key={it.id} className="text-sm leading-snug" style={{ color: 'var(--accent)' }}>
                                <span className="font-semibold tabular-nums" style={{ color: 'var(--accent2)' }}>{it.quantity}×</span> {it.productName}
                                {it.flavorName ? <span style={{ color: 'rgba(255,255,255,0.5)' }}> — {it.flavorName}</span> : ''}
                              </p>
                            ))}
                          </div>
                          {o.note && <p className="text-xs mt-2.5 px-2.5 py-2 rounded-lg" style={{ background: 'var(--surface2)', color: 'rgba(255,255,255,0.6)' }}>📝 {o.note}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
