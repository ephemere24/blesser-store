'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Trash2, RefreshCw } from 'lucide-react'

interface OrderItem { id: number; productName: string; flavorName: string | null; price: number; quantity: number }
interface Order {
  id: number; total: number; status: string; note: string | null; createdAt: string
  items: OrderItem[]; accessCode: { code: string; clientName: string | null }
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', completed: 'Completado', cancelled: 'Cancelado',
}
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', completed: '#22c55e', cancelled: '#ef4444',
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  async function load() {
    const res = await fetch('/api/admin/orders')
    if (res.status === 401) { router.push('/admin'); return }
    setOrders(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function setStatus(id: number, status: string) {
    await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  async function remove(id: number) {
    if (!confirm('¿Eliminar este pedido?')) return
    await fetch('/api/admin/orders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
              style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-xl cursor-pointer"
                style={{ color: 'var(--muted)', background: 'var(--surface2)' }}>
            <ArrowLeft size={16} />
          </Link>
          <span className="font-semibold text-sm" style={{ color: 'var(--accent2)' }}>Pedidos</span>
        </div>
        <button onClick={load} className="p-2 rounded-xl cursor-pointer"
                style={{ color: 'var(--muted)', background: 'var(--surface2)' }}>
          <RefreshCw size={16} />
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>Cargando...</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <Package size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
            <p style={{ color: 'var(--muted)' }}>No hay pedidos todavía</p>
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className="rounded-2xl p-4"
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold" style={{ color: 'var(--accent2)' }}>#{order.id}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${STATUS_COLORS[order.status]}22`, color: STATUS_COLORS[order.status] }}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                  <p className="text-sm mt-1 font-medium" style={{ color: 'var(--accent)' }}>
                    {order.accessCode.clientName || 'Sin nombre'} · <span className="font-mono">{order.accessCode.code}</span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {new Date(order.createdAt).toLocaleString('es-ES')}
                  </p>
                </div>
                <button onClick={() => remove(order.id)} className="p-2 rounded-lg cursor-pointer"
                        style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="space-y-1 mb-3">
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm" style={{ color: 'var(--accent)' }}>
                    <span>{item.quantity}x {item.productName}{item.flavorName ? ` — ${item.flavorName}` : ''}</span>
                    <span style={{ color: 'var(--muted)' }}>{(item.price * item.quantity).toFixed(2)} €</span>
                  </div>
                ))}
              </div>

              {order.note && (
                <p className="text-xs mb-3 p-2 rounded-lg" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                  📝 {order.note}
                </p>
              )}

              <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="font-bold" style={{ color: 'var(--accent2)' }}>{order.total.toFixed(2)} €</span>
                <div className="flex gap-2">
                  {order.status !== 'completed' && (
                    <button onClick={() => setStatus(order.id, 'completed')}
                            className="text-xs px-3 py-1.5 rounded-lg cursor-pointer font-medium"
                            style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                      Completar
                    </button>
                  )}
                  {order.status !== 'pending' && (
                    <button onClick={() => setStatus(order.id, 'pending')}
                            className="text-xs px-3 py-1.5 rounded-lg cursor-pointer font-medium"
                            style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                      Reabrir
                    </button>
                  )}
                  {order.status !== 'cancelled' && (
                    <button onClick={() => setStatus(order.id, 'cancelled')}
                            className="text-xs px-3 py-1.5 rounded-lg cursor-pointer font-medium"
                            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}
