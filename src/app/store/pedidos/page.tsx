'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Plus, Minus, X } from 'lucide-react'

interface OrderItem { id: number; productId: number | null; flavorId: number | null; productName: string; flavorName: string | null; price: number; quantity: number }
interface Order {
  id: number; total: number; status: string; note: string | null; createdAt: string
  pickupDate: string | null; pickupTime: string | null; items: OrderItem[]
}
interface PFlavor { id: number; name: string; stock: number; inStock: boolean }
interface PProduct { id: number; name: string; price: number; flavors: PFlavor[] }

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', completed: 'Completado', cancelled: 'Cancelado',
}
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', completed: '#22c55e', cancelled: '#ef4444',
}

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<PProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [addPicker, setAddPicker] = useState<{ orderId: number; productId: number | null; flavorId: number | null } | null>(null)
  const router = useRouter()

  async function load() {
    const res = await fetch('/api/orders')
    if (res.status === 401) { router.push('/'); return }
    setOrders(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/api/products').then(r => r.ok ? r.json() : []).then(setProducts)
  }, [])

  function replaceOrder(updated: Order) {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  async function editOrder(orderId: number, body: object) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) replaceOrder(await res.json())
    else { const err = await res.json().catch(() => ({})); alert(err.error || 'No se pudo modificar el pedido') }
  }

  function confirmAdd() {
    if (!addPicker || !addPicker.productId) return
    const prod = products.find(p => p.id === addPicker.productId)
    const needsFlavor = (prod?.flavors.length ?? 0) > 0
    if (needsFlavor && !addPicker.flavorId) { alert('Elige un sabor'); return }
    editOrder(addPicker.orderId, { op: 'addItem', productId: addPicker.productId, flavorId: addPicker.flavorId, quantity: 1 })
    setAddPicker(null)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3"
              style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/store" className="p-2 rounded-xl cursor-pointer"
              style={{ color: 'var(--muted)', background: 'var(--surface2)' }}>
          <ArrowLeft size={16} />
        </Link>
        <span className="font-semibold text-sm" style={{ color: 'var(--accent2)' }}>Mis pedidos</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>Cargando...</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <Package size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
            <p style={{ color: 'var(--muted)' }}>Todavía no has hecho ningún pedido</p>
            <Link href="/store" className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
              Ir al catálogo
            </Link>
          </div>
        ) : (
          orders.map(order => {
            const editable = order.status === 'pending'
            return (
            <div key={order.id} className="rounded-2xl p-4"
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: 'var(--accent2)' }}>Pedido #{order.id}</span>
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

              <div className="space-y-1.5 mb-3">
                {order.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-sm" style={{ color: 'var(--accent)' }}>
                    <span className="flex-1 min-w-0 truncate">{item.productName}{item.flavorName ? ` — ${item.flavorName}` : ''}</span>
                    {editable ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => editOrder(order.id, { op: 'setQty', itemId: item.id, quantity: item.quantity - 1 })}
                                className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer"
                                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
                          <Minus size={12} />
                        </button>
                        <span className="w-5 text-center font-semibold" style={{ color: 'var(--accent2)' }}>{item.quantity}</span>
                        <button onClick={() => editOrder(order.id, { op: 'setQty', itemId: item.id, quantity: item.quantity + 1 })}
                                className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer"
                                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
                          <Plus size={12} />
                        </button>
                        <span className="w-16 text-right" style={{ color: 'var(--muted)' }}>{(item.price * item.quantity).toFixed(2)} €</span>
                        <button onClick={() => editOrder(order.id, { op: 'removeItem', itemId: item.id })}
                                className="p-1 rounded-md cursor-pointer" style={{ color: 'var(--danger)' }}>
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>{item.quantity}x · {(item.price * item.quantity).toFixed(2)} €</span>
                    )}
                  </div>
                ))}
              </div>

              {editable && (
                addPicker?.orderId === order.id ? (
                  <div className="mb-3 p-3 rounded-xl space-y-2" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <select value={addPicker.productId ?? ''}
                      onChange={e => setAddPicker({ orderId: order.id, productId: Number(e.target.value) || null, flavorId: null })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
                      <option value="">Elige producto...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {(() => {
                      const prod = products.find(p => p.id === addPicker.productId)
                      if (!prod || prod.flavors.length === 0) return null
                      return (
                        <select value={addPicker.flavorId ?? ''}
                          onChange={e => setAddPicker({ ...addPicker, flavorId: Number(e.target.value) || null })}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
                          <option value="">Elige sabor...</option>
                          {prod.flavors.filter(f => f.stock > 0).map(f => (
                            <option key={f.id} value={f.id}>{f.name} ({f.stock})</option>
                          ))}
                        </select>
                      )
                    })()}
                    <div className="flex gap-2">
                      <button onClick={() => setAddPicker(null)}
                              className="flex-1 py-2 rounded-lg text-sm cursor-pointer"
                              style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                        Cancelar
                      </button>
                      <button onClick={confirmAdd}
                              className="flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                              style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                        Añadir
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddPicker({ orderId: order.id, productId: null, flavorId: null })}
                          className="mb-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg cursor-pointer font-medium"
                          style={{ background: 'var(--surface2)', color: 'var(--accent2)', border: '1px solid var(--border)' }}>
                    <Plus size={13} /> Añadir producto
                  </button>
                )
              )}

              <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="font-bold" style={{ color: 'var(--accent2)' }}>{order.total.toFixed(2)} €</span>
                {editable && (
                  <button onClick={() => { if (confirm('¿Cancelar este pedido?')) editOrder(order.id, { op: 'cancel' }) }}
                          className="text-xs px-3 py-1.5 rounded-lg cursor-pointer font-medium"
                          style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                    Cancelar pedido
                  </button>
                )}
              </div>
            </div>
            )
          })
        )}
      </main>
    </div>
  )
}
