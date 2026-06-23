'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Minus, X, Phone, MessageCircle, RefreshCw, Clock, CheckCircle2, Package, Undo2, Pencil, Trash2 } from 'lucide-react'
import { getPickupDays, getTimeSlots, formatDayLabel, dateToValue } from '@/lib/pickup'

interface OItem { id: number; productName: string; flavorName: string | null; price: number; quantity: number }
interface Order {
  id: number; total: number; status: string; note: string | null; manual: boolean
  pickupDate: string | null; pickupTime: string | null; customerName: string | null; customerPhone: string | null
  items: OItem[]; accessCode: { code: string; clientName: string | null; phone: string | null } | null
}
interface PFlavor { id: number; name: string; stock: number }
interface PProduct { id: number; name: string; price: number; flavors: PFlavor[] }
interface DraftLine { productId: number; flavorId: number | null; productName: string; flavorName: string | null; price: number; quantity: number }

const STATUS = {
  pending:   { label: 'Pendiente',  color: '#f59e0b' },
  ready:     { label: 'Preparado',  color: '#3b82f6' },
  completed: { label: 'Entregado',  color: '#22c55e' },
  cancelled: { label: 'Cancelado',  color: '#ef4444' },
} as Record<string, { label: string; color: string }>

function orderName(o: Order) { return o.customerName || o.accessCode?.clientName || 'Sin nombre' }
function orderPhone(o: Order) { return o.customerPhone || o.accessCode?.phone || '' }
function waLink(phone: string) {
  const digits = phone.replace(/[^0-9]/g, '')
  const full = digits.startsWith('34') ? digits : `34${digits}`
  return `https://wa.me/${full}`
}

export default function AgendaTab() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<PProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'today' | 'tomorrow' | 'all' | 'delivered'>('today')
  const [deliveredScope, setDeliveredScope] = useState<'today' | 'yesterday' | 'all'>('today')
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Order | null>(null)
  const [details, setDetails] = useState<Order | null>(null)
  const [closures, setClosures] = useState<{ date: string; time: string | null }[]>([])
  const pausePoll = useRef(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/orders')
    if (res.ok) setOrders(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    fetch('/api/admin/products').then(r => r.ok ? r.json() : []).then(setProducts)
    fetch('/api/admin/closures').then(r => r.ok ? r.json() : []).then(setClosures)
  }, [load])

  useEffect(() => {
    const t = setInterval(() => { if (!pausePoll.current) load() }, 10000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => { pausePoll.current = showNew || editing !== null || details !== null }, [showNew, editing, details])

  async function setStatus(id: number, status: string) {
    await fetch('/api/admin/orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }),
    })
    load()
  }
  async function cancelOrder(id: number) {
    if (!confirm('¿Cancelar este pedido? Se devolverá el stock.')) return
    await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'cancel' }),
    })
    load()
  }
  const today = dateToValue(new Date())
  const tomorrowD = new Date(); tomorrowD.setDate(tomorrowD.getDate() + 1)
  const tomorrow = dateToValue(tomorrowD)
  const yesterdayD = new Date(); yesterdayD.setDate(yesterdayD.getDate() - 1)
  const yesterday = dateToValue(yesterdayD)

  const visible = filter === 'delivered'
    ? orders
        .filter(o => o.status === 'completed')
        .filter(o => deliveredScope === 'all' ? true : deliveredScope === 'today' ? o.pickupDate === today : o.pickupDate === yesterday)
        .sort((a, b) => `${b.pickupDate} ${b.pickupTime}`.localeCompare(`${a.pickupDate} ${a.pickupTime}`))
    : orders
        // En las vistas activas solo lo que queda por hacer (pendiente / preparado)
        .filter(o => o.status === 'pending' || o.status === 'ready')
        .filter(o => filter === 'all' ? true : filter === 'today' ? o.pickupDate === today : o.pickupDate === tomorrow)
        .sort((a, b) => `${a.pickupDate} ${a.pickupTime}`.localeCompare(`${b.pickupDate} ${b.pickupTime}`))

  const pendingToday = orders.filter(o => o.pickupDate === today && (o.status === 'pending' || o.status === 'ready')).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="font-bold" style={{ color: 'var(--accent2)' }}>Agenda</h2>
          {pendingToday > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              {pendingToday} por entregar hoy
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl cursor-pointer" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
            <Plus size={14} /> Nuevo pedido
          </button>
        </div>
      </div>

      {/* Filtro principal */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {([['today', 'Hoy'], ['tomorrow', 'Mañana'], ['all', 'Todos'], ['delivered', 'Entregados']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className="shrink-0 px-4 py-1.5 rounded-xl text-sm font-medium cursor-pointer"
            style={{
              background: filter === k ? 'var(--accent2)' : 'var(--surface2)',
              color: filter === k ? 'var(--bg)' : 'var(--muted)',
              border: '1px solid var(--border)',
            }}>
            {l}
          </button>
        ))}
      </div>

      {/* Subfiltro de entregados */}
      {filter === 'delivered' && (
        <div className="flex gap-2 mb-4">
          {([['today', 'Hoy'], ['yesterday', 'Ayer'], ['all', 'Todos']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setDeliveredScope(k)}
              className="px-3 py-1 rounded-lg text-xs font-medium cursor-pointer"
              style={{
                background: deliveredScope === k ? 'rgba(34,197,94,0.15)' : 'var(--surface2)',
                color: deliveredScope === k ? '#22c55e' : 'var(--muted)',
                border: '1px solid var(--border)',
              }}>
              {l}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>Cargando...</p>
      ) : visible.length === 0 ? (
        <div className="text-center py-16">
          <Package size={36} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <p style={{ color: 'var(--muted)' }}>
            {filter === 'delivered' ? 'No hay pedidos entregados aquí' : `No hay pedidos para ${filter === 'today' ? 'hoy' : filter === 'tomorrow' ? 'mañana' : 'mostrar'}`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(o => {
            const st = STATUS[o.status] ?? STATUS.pending
            const count = o.items.reduce((s, i) => s + i.quantity, 0)
            return (
              <div key={o.id} className="rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl px-3 py-2 text-center shrink-0" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', minWidth: 72 }}>
                    <div className="text-xl font-bold leading-none" style={{ color: 'var(--accent2)' }}>{o.pickupTime || '--:--'}</div>
                    <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{o.pickupDate ? formatDayLabel(new Date(o.pickupDate + 'T00:00:00')) : ''}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold truncate" style={{ color: 'var(--accent2)' }}>{orderName(o)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: `${st.color}22`, color: st.color }}>{st.label}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {count} {count === 1 ? 'producto' : 'productos'} · <span className="font-semibold" style={{ color: 'var(--accent)' }}>{o.total.toFixed(2)} €</span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  {o.status !== 'pending' && (
                    <button onClick={() => setStatus(o.id, o.status === 'completed' ? 'ready' : 'pending')}
                            className="px-3 py-2 rounded-xl cursor-pointer flex items-center justify-center shrink-0"
                            style={{ background: 'var(--surface2)', color: 'var(--muted)' }} title="Retroceder estado">
                      <Undo2 size={16} />
                    </button>
                  )}
                  {o.status === 'pending' && (
                    <button onClick={() => setStatus(o.id, 'ready')} className="flex-1 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                            style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                      Marcar preparado
                    </button>
                  )}
                  {o.status === 'ready' && (
                    <button onClick={() => setStatus(o.id, 'completed')} className="flex-1 py-2 rounded-xl text-sm font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                      <CheckCircle2 size={15} /> Entregar
                    </button>
                  )}
                  {o.status === 'completed' && (
                    <div className="flex-1 py-2 rounded-xl text-sm font-semibold text-center" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                      ✓ Entregado
                    </div>
                  )}
                  <button onClick={() => setDetails(o)} className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer shrink-0"
                          style={{ background: 'var(--surface2)', color: 'var(--accent2)' }}>
                    Detalles
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNew && <NewOrderModal products={products} closures={closures} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />}
      {editing && <EditOrderModal order={editing} products={products} onClose={() => setEditing(null)} onChanged={load} />}

      {details && (() => {
        const o = details
        const st = STATUS[o.status] ?? STATUS.pending
        const phone = orderPhone(o)
        const act = (fn: () => void) => { fn(); setDetails(null) }
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setDetails(null)}>
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5 space-y-4"
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-bold text-lg truncate" style={{ color: 'var(--accent2)' }}>{orderName(o)}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: `${st.color}22`, color: st.color }}>{st.label}</span>
                </div>
                <button onClick={() => setDetails(null)} className="cursor-pointer shrink-0" style={{ color: 'var(--muted)' }}><X size={18} /></button>
              </div>

              {o.pickupDate && o.pickupTime && (
                <p className="text-sm" style={{ color: 'var(--accent)' }}>
                  <Clock size={13} className="inline mr-1" style={{ color: 'var(--accent2)' }} />
                  {formatDayLabel(new Date(o.pickupDate + 'T00:00:00'))} a las <b>{o.pickupTime}</b>
                </p>
              )}

              {phone && (
                <div className="flex gap-2">
                  <a href={`tel:${phone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
                     style={{ background: 'var(--surface2)', color: 'var(--accent2)' }}><Phone size={15} /> {phone}</a>
                  <a href={waLink(phone)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
                     style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}><MessageCircle size={15} /> WhatsApp</a>
                </div>
              )}

              <div className="rounded-xl p-3 space-y-1" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                {o.items.map(it => (
                  <p key={it.id} className="text-sm" style={{ color: 'var(--accent)' }}>
                    <span className="font-semibold" style={{ color: 'var(--accent2)' }}>{it.quantity}×</span> {it.productName}{it.flavorName ? ` — ${it.flavorName}` : ''}
                  </p>
                ))}
                {o.note && <p className="text-xs mt-2 pt-2" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>📝 {o.note}</p>}
              </div>

              <div className="flex justify-between items-center">
                <span className="font-semibold" style={{ color: 'var(--accent2)' }}>Total</span>
                <span className="font-bold text-lg" style={{ color: 'var(--accent2)' }}>{o.total.toFixed(2)} €</span>
              </div>

              {/* Acciones */}
              <div className="space-y-2 pt-1">
                {o.status === 'pending' && (
                  <button onClick={() => act(() => setStatus(o.id, 'ready'))} className="w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>Marcar preparado</button>
                )}
                {o.status === 'ready' && (
                  <div className="flex gap-2">
                    <button onClick={() => act(() => setStatus(o.id, 'pending'))} className="px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer flex items-center gap-1" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}><Undo2 size={14} /></button>
                    <button onClick={() => act(() => setStatus(o.id, 'completed'))} className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer flex items-center justify-center gap-1.5" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}><CheckCircle2 size={15} /> Entregar</button>
                  </div>
                )}
                {o.status === 'completed' && (
                  <button onClick={() => act(() => setStatus(o.id, 'ready'))} className="w-full py-2.5 rounded-xl text-sm font-medium cursor-pointer flex items-center justify-center gap-1.5" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}><Undo2 size={14} /> Deshacer entrega</button>
                )}
                {o.status !== 'completed' && (
                  <div className="flex gap-2">
                    <button onClick={() => { setDetails(null); setEditing(o) }} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer flex items-center justify-center gap-1.5" style={{ background: 'var(--surface2)', color: 'var(--accent2)' }}><Pencil size={14} /> Editar</button>
                    <button onClick={() => act(() => cancelOrder(o.id))} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>Cancelar</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function EditOrderModal({ order, products, onClose, onChanged }: { order: Order; products: PProduct[]; onClose: () => void; onChanged: () => void }) {
  const [ord, setOrd] = useState<Order>(order)
  const [selProd, setSelProd] = useState<number | null>(null)
  const [selFlavor, setSelFlavor] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const prod = products.find(p => p.id === selProd)

  async function patch(body: object) {
    setBusy(true)
    const res = await fetch(`/api/admin/orders/${ord.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) { setOrd(await res.json()); onChanged() }
    else { const err = await res.json().catch(() => ({})); alert(err.error || 'No se pudo modificar') }
    setBusy(false)
  }
  function addItem() {
    if (!prod) return
    if (prod.flavors.length > 0 && !selFlavor) { alert('Elige un sabor'); return }
    patch({ op: 'addItem', productId: prod.id, flavorId: selFlavor, quantity: 1 })
    setSelProd(null); setSelFlavor(null)
  }
  function closeGuard() {
    if (selProd) { if (!confirm('Has seleccionado un producto pero no lo has añadido (pulsa "Añadir"). ¿Salir igualmente?')) return }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={closeGuard}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5 space-y-4"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg" style={{ color: 'var(--accent2)' }}>Editar pedido</h3>
          <button onClick={closeGuard} className="cursor-pointer" style={{ color: 'var(--muted)' }}><X size={18} /></button>
        </div>

        <div className="space-y-2">
          {ord.items.map(it => (
            <div key={it.id} className="flex items-center gap-2 p-2 rounded-xl" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <span className="flex-1 min-w-0 truncate text-sm" style={{ color: 'var(--accent2)' }}>{it.productName}{it.flavorName ? ` — ${it.flavorName}` : ''}</span>
              <button disabled={busy} onClick={() => patch({ op: 'setQty', itemId: it.id, quantity: it.quantity - 1 })}
                      className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer disabled:opacity-50" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}><Minus size={13} /></button>
              <span className="w-5 text-center text-sm" style={{ color: 'var(--accent2)' }}>{it.quantity}</span>
              <button disabled={busy} onClick={() => patch({ op: 'setQty', itemId: it.id, quantity: it.quantity + 1 })}
                      className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer disabled:opacity-50" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}><Plus size={13} /></button>
              <button disabled={busy} onClick={() => patch({ op: 'removeItem', itemId: it.id })}
                      className="p-1.5 rounded-md cursor-pointer disabled:opacity-50" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
            </div>
          ))}
          {ord.items.length === 0 && <p className="text-sm text-center py-3" style={{ color: 'var(--muted)' }}>Sin productos</p>}
        </div>

        <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--accent2)' }}>Añadir producto</p>
          <select value={selProd ?? ''} onChange={e => { setSelProd(Number(e.target.value) || null); setSelFlavor(null) }}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
            <option value="">Producto...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {prod && prod.flavors.length > 0 && (
            <select value={selFlavor ?? ''} onChange={e => setSelFlavor(Number(e.target.value) || null)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none truncate" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
              <option value="">Sabor...</option>
              {prod.flavors.map(f => <option key={f.id} value={f.id} disabled={f.stock <= 0}>{f.name}{f.stock <= 0 ? ' (agotado)' : ` (${f.stock})`}</option>)}
            </select>
          )}
          <button onClick={addItem} disabled={!prod || busy} className="w-full py-2.5 rounded-lg cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 text-sm font-semibold" style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
            <Plus size={16} /> Añadir
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold" style={{ color: 'var(--accent2)' }}>Total</span>
          <span className="font-bold text-lg" style={{ color: 'var(--accent2)' }}>{ord.total.toFixed(2)} €</span>
        </div>
        <button onClick={closeGuard} className="w-full py-3 rounded-xl font-semibold text-sm cursor-pointer" style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>Listo</button>
      </div>
    </div>
  )
}

function NewOrderModal({ products, closures, onClose, onCreated }: { products: PProduct[]; closures: { date: string; time: string | null }[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [selProd, setSelProd] = useState<number | null>(null)
  const [selFlavor, setSelFlavor] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const days = getPickupDays()
  const slots = pickupDate ? getTimeSlots(pickupDate) : []
  const prod = products.find(p => p.id === selProd)
  const isDayClosed = (d: string) => closures.some(c => c.date === d && !c.time)
  const isSlotClosed = (d: string, t: string) => closures.some(c => c.date === d && c.time === t)

  function addLine() {
    if (!prod) return
    if (prod.flavors.length > 0 && !selFlavor) { alert('Elige un sabor'); return }
    const flavor = selFlavor ? prod.flavors.find(f => f.id === selFlavor) : null
    setLines(prev => {
      const idx = prev.findIndex(l => l.productId === prod.id && l.flavorId === (selFlavor ?? null))
      if (idx >= 0) { const c = [...prev]; c[idx] = { ...c[idx], quantity: c[idx].quantity + 1 }; return c }
      return [...prev, { productId: prod.id, flavorId: selFlavor ?? null, productName: prod.name, flavorName: flavor?.name ?? null, price: prod.price, quantity: 1 }]
    })
    setSelProd(null); setSelFlavor(null)
  }
  function setQty(idx: number, q: number) {
    setLines(prev => prev.flatMap((l, n) => n === idx ? (q <= 0 ? [] : [{ ...l, quantity: q }]) : [l]))
  }
  function closeGuard() {
    if (selProd || lines.length > 0) { if (!confirm('¿Descartar este pedido sin crearlo?')) return }
    onClose()
  }

  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0)

  async function submit() {
    if (selProd) { if (!confirm('Has seleccionado un producto pero no lo has añadido (pulsa "Añadir al pedido"). ¿Crear el pedido sin él?')) return }
    if (!name.trim()) { alert('Indica el nombre del cliente'); return }
    if (lines.length === 0) { alert('Añade al menos un producto'); return }
    if (!pickupDate || !pickupTime) { alert('Indica día y hora de recogida'); return }
    // Advertencia si el día o la franja están cerrados en la agenda
    if (isDayClosed(pickupDate)) { if (!confirm('⚠️ Ese DÍA está cerrado en la agenda. ¿Crear el pedido igualmente?')) return }
    else if (isSlotClosed(pickupDate, pickupTime)) { if (!confirm('⚠️ Esa FRANJA horaria está cerrada en la agenda. ¿Crear el pedido igualmente?')) return }
    setSaving(true)
    const res = await fetch('/api/admin/orders/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: lines.map(l => ({ productId: l.productId, flavorId: l.flavorId, quantity: l.quantity })),
        customerName: name, customerPhone: phone, pickupDate, pickupTime, note,
      }),
    })
    if (res.ok) onCreated()
    else { const err = await res.json().catch(() => ({})); alert(err.error || 'No se pudo crear el pedido') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={closeGuard}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5 space-y-4"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg" style={{ color: 'var(--accent2)' }}>Nuevo pedido manual</h3>
          <button onClick={closeGuard} className="cursor-pointer" style={{ color: 'var(--muted)' }}><X size={18} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del cliente *"
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Teléfono" type="tel"
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />
        </div>

        {/* Añadir productos */}
        <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--accent2)' }}>Productos</p>
          <select value={selProd ?? ''} onChange={e => { setSelProd(Number(e.target.value) || null); setSelFlavor(null) }}
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
            <option value="">Producto...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price}€)</option>)}
          </select>
          {prod && prod.flavors.length > 0 && (
            <select value={selFlavor ?? ''} onChange={e => setSelFlavor(Number(e.target.value) || null)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none truncate" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
              <option value="">Sabor...</option>
              {prod.flavors.map(f => <option key={f.id} value={f.id} disabled={f.stock <= 0}>{f.name}{f.stock <= 0 ? ' (agotado)' : ` (${f.stock})`}</option>)}
            </select>
          )}
          <button onClick={addLine} disabled={!prod} className="w-full py-2.5 rounded-lg cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 text-sm font-semibold" style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
            <Plus size={16} /> Añadir al pedido
          </button>
          {lines.map((l, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm" style={{ color: 'var(--accent)' }}>
              <span className="flex-1 truncate">{l.productName}{l.flavorName ? ` — ${l.flavorName}` : ''}</span>
              <button onClick={() => setQty(idx, l.quantity - 1)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}><Minus size={12} /></button>
              <span className="w-5 text-center" style={{ color: 'var(--accent2)' }}>{l.quantity}</span>
              <button onClick={() => setQty(idx, l.quantity + 1)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}><Plus size={12} /></button>
            </div>
          ))}
        </div>

        {/* Recogida */}
        <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--accent2)' }}><Clock size={13} /> Recogida</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {days.map(d => {
              const closed = isDayClosed(d.value)
              return (
              <button key={d.value} onClick={() => { setPickupDate(d.value); setPickupTime('') }}
                className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer capitalize"
                style={{
                  background: pickupDate === d.value ? 'var(--accent2)' : 'var(--surface)',
                  color: pickupDate === d.value ? 'var(--bg)' : closed ? 'var(--danger)' : 'var(--accent)',
                  border: `1px solid ${closed ? 'var(--danger)' : 'var(--border)'}`,
                  textDecoration: closed ? 'line-through' : 'none',
                }}>
                {d.label}
              </button>
              )
            })}
          </div>
          {pickupDate && isDayClosed(pickupDate) && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>⚠️ Día cerrado en la agenda.</p>
          )}
          {pickupDate && (
            <div className="grid grid-cols-4 gap-1.5 max-h-28 overflow-y-auto">
              {slots.map(t => {
                const closed = isSlotClosed(pickupDate, t)
                return (
                <button key={t} onClick={() => setPickupTime(t)}
                  className="px-1 py-2 rounded-lg text-xs font-medium cursor-pointer"
                  style={{
                    background: pickupTime === t ? 'var(--accent2)' : 'var(--surface)',
                    color: pickupTime === t ? 'var(--bg)' : closed ? 'var(--danger)' : 'var(--accent)',
                    border: `1px solid ${closed ? 'var(--danger)' : 'var(--border)'}`,
                    textDecoration: closed ? 'line-through' : 'none',
                  }}>
                  {t}
                </button>
                )
              })}
            </div>
          )}
        </div>

        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Nota (opcional)" rows={2}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)' }} />

        <div className="flex items-center justify-between">
          <span className="font-semibold" style={{ color: 'var(--accent2)' }}>Total</span>
          <span className="font-bold text-lg" style={{ color: 'var(--accent2)' }}>{total.toFixed(2)} €</span>
        </div>
        <button onClick={submit} disabled={saving} className="w-full py-3 rounded-xl font-semibold text-sm cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
          {saving ? 'Creando...' : 'Crear pedido'}
        </button>
      </div>
    </div>
  )
}
