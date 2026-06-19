'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package } from 'lucide-react'

interface OrderItem { id: number; productName: string; flavorName: string | null; price: number; quantity: number }
interface Order {
  id: number; total: number; status: string; note: string | null; createdAt: string
  pickupDate: string | null; pickupTime: string | null; items: OrderItem[]
}

const STATUS_LABELS: Record<string, string> = { completed: 'Completado', cancelled: 'Cancelado' }
const STATUS_COLORS: Record<string, string> = { completed: '#22c55e', cancelled: '#ef4444' }

export default function MyOrdersHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/orders').then(r => {
      if (r.status === 401) { router.push('/'); return [] }
      return r.json()
    }).then((data: Order[]) => {
      // Solo pedidos cerrados (el pedido abierto se gestiona en la tienda)
      setOrders((data || []).filter(o => o.status !== 'pending'))
      setLoading(false)
    })
  }, [router])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3"
              style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/store" className="p-2 rounded-xl cursor-pointer"
              style={{ color: 'var(--muted)', background: 'var(--surface2)' }}>
          <ArrowLeft size={16} />
        </Link>
        <span className="font-semibold text-sm" style={{ color: 'var(--accent2)' }}>Historial de pedidos</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>Cargando...</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <Package size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
            <p style={{ color: 'var(--muted)' }}>Aún no tienes pedidos en tu historial</p>
            <Link href="/store" className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
              Ir al catálogo
            </Link>
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className="rounded-2xl p-4"
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: 'var(--accent2)' }}>Pedido</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${STATUS_COLORS[order.status]}22`, color: STATUS_COLORS[order.status] }}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  {new Date(order.createdAt).toLocaleDateString('es-ES')}
                </span>
              </div>

              {order.pickupDate && order.pickupTime && (
                <p className="text-xs mb-3" style={{ color: 'var(--accent2)' }}>
                  📅 Recogida: {new Date(order.pickupDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} a las {order.pickupTime}
                </p>
              )}

              <div className="space-y-1 mb-3">
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm" style={{ color: 'var(--accent)' }}>
                    <span>{item.quantity}x {item.productName}{item.flavorName ? ` — ${item.flavorName}` : ''}</span>
                    <span style={{ color: 'var(--muted)' }}>{(item.price * item.quantity).toFixed(2)} €</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="font-bold" style={{ color: 'var(--accent2)' }}>{order.total.toFixed(2)} €</span>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}
