'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Trash2, RefreshCw, Plus, Minus, X } from 'lucide-react'

interface OrderItem { id: number; productId: number | null; flavorId: number | null; productName: string; flavorName: string | null; price: number; quantity: number }
interface Order {
  id: number; total: number; status: string; note: string | null; createdAt: string
  pickupDate: string | null; pickupTime: string | null
  customerName: string | null; customerPhone: string | null
  items: OrderItem[]; accessCode: { code: string; clientName: string | null } | null
}
interface PFlavor { id: number; name: string; stock: number }
interface PProduct { id: number; name: string; price: number; flavors: PFlavor[] }

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', completed: 'Completado', cancelled: 'Cancelado',
}
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', completed: '#22c55e', cancelled: '#ef4444',
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<PProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [addPicker, setAddPicker] = useState<{ orderId: number; productId: number | null; flavorId: number | null } | null>(null)
  const router = useRouter()
  const pausePoll = useRef(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/orders')
    if (res.status === 401) { router.push('/admin'); return }
    setOrders(await res.json())
    setLoading(false)
  }, [router])

  useEffect(() => {
    load()
    fetch('/api/admin/products').then(r => r.ok ? r.json() : []).then(setProducts)
  }, [load])

  // Auto-refresco cada 10s (pausado mientras se edita)
  useEffect(() => {
    const t = setInterval(() => { if (!pausePoll.current) load() }, 10000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => { pausePoll.current = addPicker !== null }, [addPicker])

  function replaceOrder(updated: Order) {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  async function editOrder(orderId: number, body: object) {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      replaceOrder(await res.json())
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'No se pudo modificar el pedido')
    }
  }

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

  function confirmAdd() {
    if (!addPicker || !addPicker.productId) return
    const prod = products.find(p => p.id === addPicker.productId)
    const needsFlavor = (prod?.flavors.length ?? 0) > 0
    if (needsFlavor && !addPicker.flavorId) { alert('Elige un sabor'); return }
    editOrder(addPicker.orderId, {
      op: 'addItem', productId: addPicker.productId, flavorId: addPicker.flavorId, quantity: 1,
    })
    setAddPicker(null)
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length

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
          {pendingCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Auto · 10s</span>
          <button onClick={load} className="p-2 rounded-xl cursor-pointer"
                  style={{ color: 'var(--muted)', background: 'var(--surface2)' }}>
            <RefreshCw size={16} />
          </button>
        </div>
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
          orders.map(order => {
            const editable = order.status === 'pending'
            return (
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
                    {order.customerName || order.accessCode?.clientName || 'Sin nombre'}{order.accessCode ? <> · <span className="font-mono">{order.accessCode.code}</span></> : order.customerPhone ? ` · ${order.customerPhone}` : ''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {new Date(order.createdAt).toLocaleString('es-ES')}
                  </p>
                  {order.pickupDate && order.pickupTime && (
                    <p className="text-xs mt-1 font-medium" style={{ color: 'var(--accent2)' }}>
                      Recogida: {new Date(order.pickupDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} a las {order.pickupTime}
                    </p>
                  )}
                </div>
                <button onClick={() => remove(order.id)} className="p-2 rounded-lg cursor-pointer"
                        style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>
                  <Trash2 size={15} />
                </button>
              </div>

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
                          {prod.flavors.map(f => (
                            <option key={f.id} value={f.id} disabled={f.stock <= 0}>
                              {f.name}{f.stock <= 0 ? ' (agotado)' : ` (${f.stock})`}
                            </option>
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

              {order.note && (
                <p className="text-xs mb-3 p-2 rounded-lg" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                  Nota: {order.note}
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
                  {order.status === 'completed' && (
                    <button onClick={() => setStatus(order.id, 'pending')}
                            className="text-xs px-3 py-1.5 rounded-lg cursor-pointer font-medium"
                            style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                      Reabrir
                    </button>
                  )}
                  {order.status !== 'cancelled' && (
                    <button onClick={() => editOrder(order.id, { op: 'cancel' })}
                            className="text-xs px-3 py-1.5 rounded-lg cursor-pointer font-medium"
                            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
            )
          })
        )}
      </main>
    </div>
  )
}
