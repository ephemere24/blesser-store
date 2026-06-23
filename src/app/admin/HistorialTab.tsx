'use client'

import { useEffect, useState } from 'react'
import { Package, RefreshCw } from 'lucide-react'
import { formatDayLabel } from '@/lib/pickup'

interface OItem { id: number; productName: string; flavorName: string | null; price: number; quantity: number }
interface Order {
  id: number; total: number; status: string; note: string | null; manual: boolean; createdAt: string
  pickupDate: string | null; pickupTime: string | null; customerName: string | null; customerPhone: string | null
  items: OItem[]; accessCode: { code: string; clientName: string | null; phone: string | null } | null
}

const STATUS = {
  pending:   { label: 'Pendiente',  color: '#f59e0b' },
  ready:     { label: 'Preparado',  color: '#3b82f6' },
  completed: { label: 'Entregado',  color: '#22c55e' },
  cancelled: { label: 'Cancelado',  color: '#ef4444' },
} as Record<string, { label: string; color: string }>

function orderName(o: Order) { return o.customerName || o.accessCode?.clientName || 'Sin nombre' }

export default function HistorialTab() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/admin/orders')
    if (res.ok) setOrders(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Agrupar por día de creación (más reciente primero)
  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const groups: { day: string; items: Order[] }[] = []
  for (const o of sorted) {
    const day = o.createdAt.slice(0, 10)
    const g = groups.find(x => x.day === day)
    if (g) g.items.push(o)
    else groups.push({ day, items: [o] })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold" style={{ color: 'var(--accent2)' }}>Historial de pedidos</h2>
        <button onClick={load} className="p-2 rounded-xl cursor-pointer" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
          <RefreshCw size={15} />
        </button>
      </div>

      {loading ? (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>Cargando...</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <Package size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <p style={{ color: 'var(--muted)' }}>Aún no hay pedidos</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(g => (
            <div key={g.day}>
              <p className="text-xs font-semibold uppercase mb-2 capitalize" style={{ color: 'var(--muted)' }}>
                {formatDayLabel(new Date(g.day + 'T00:00:00'))} · {new Date(g.day + 'T00:00:00').getFullYear()}
              </p>
              <div className="space-y-2">
                {g.items.map(o => {
                  const st = STATUS[o.status] ?? STATUS.pending
                  return (
                    <div key={o.id} className="rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold truncate" style={{ color: 'var(--accent2)' }}>{orderName(o)}</span>
                          {o.manual && <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>manual</span>}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: `${st.color}22`, color: st.color }}>{st.label}</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        {new Date(o.createdAt).toLocaleString('es-ES')}
                        {o.pickupDate && o.pickupTime ? ` · recogida ${formatDayLabel(new Date(o.pickupDate + 'T00:00:00'))} ${o.pickupTime}` : ''}
                      </p>
                      <div className="mt-2 space-y-0.5">
                        {o.items.map(it => (
                          <p key={it.id} className="text-sm" style={{ color: 'var(--accent)' }}>
                            <span className="font-semibold" style={{ color: 'var(--accent2)' }}>{it.quantity}×</span> {it.productName}{it.flavorName ? ` — ${it.flavorName}` : ''}
                          </p>
                        ))}
                      </div>
                      {o.note && <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>📝 {o.note}</p>}
                      <p className="text-sm font-bold mt-2" style={{ color: 'var(--accent2)' }}>{o.total.toFixed(2)} €</p>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
