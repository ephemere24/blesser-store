'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart, LogOut, Package, Plus, Minus, Trash2, CheckCircle2, Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { getPickupDays, getTimeSlots, formatDayLabel } from '@/lib/pickup'

gsap.registerPlugin(ScrollTrigger)

interface Flavor { id: number; name: string; inStock: boolean; stock: number }
interface Product {
  id: number; name: string; price: number; description: string
  specs: string; category: string; images: string; flavors: Flavor[]
}
interface CartItem {
  id: number; productId: number; flavorId: number | null; quantity: number; product: Product; flavor: Flavor | null
}
interface Cart { items: CartItem[] }
interface OrderItem { id: number; productId: number | null; flavorId: number | null; productName: string; flavorName: string | null; price: number; quantity: number }
interface DraftLine { productId: number; flavorId: number | null; productName: string; flavorName: string | null; price: number; quantity: number }
interface Order {
  id: number; total: number; status: string; note: string | null; pendingChanges: boolean
  pickupDate: string | null; pickupTime: string | null; items: OrderItem[]
  draftItems: DraftLine[] | null; draftPickupDate: string | null; draftPickupTime: string | null
}

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Cart | null>(null)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [justAddedId, setJustAddedId] = useState<number | null>(null)
  const [selectedFlavors, setSelectedFlavors] = useState<Record<number, number | null>>({})
  const [note, setNote] = useState('')
  const [placing, setPlacing] = useState(false)
  const [orderDone, setOrderDone] = useState(false)
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [cartStep, setCartStep] = useState<'items' | 'pickup'>('items')
  const router = useRouter()

  const pickupDays = useMemo(() => getPickupDays(), [])
  const timeSlots = useMemo(() => pickupDate ? getTimeSlots(pickupDate) : [], [pickupDate])

  const headerRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const cartPanelRef = useRef<HTMLDivElement>(null)

  const dirty = activeOrder?.pendingChanges ?? false
  // Mientras hay cambios sin guardar mostramos el BORRADOR; si no, el pedido real.
  const orderItems: DraftLine[] = activeOrder
    ? (dirty && activeOrder.draftItems
        ? activeOrder.draftItems
        : activeOrder.items.map(i => ({ productId: i.productId!, flavorId: i.flavorId, productName: i.productName, flavorName: i.flavorName, price: i.price, quantity: i.quantity })))
    : []
  const oDate = activeOrder ? (dirty ? (activeOrder.draftPickupDate || activeOrder.pickupDate) : activeOrder.pickupDate) : null
  const oTime = activeOrder ? (dirty ? (activeOrder.draftPickupTime || activeOrder.pickupTime) : activeOrder.pickupTime) : null
  const oTotal = activeOrder ? (dirty ? orderItems.reduce((s, i) => s + i.price * i.quantity, 0) : activeOrder.total) : 0

  async function refreshProducts() {
    const r = await fetch('/api/products')
    if (r.ok) setProducts(await r.json())
  }

  function loadAll() {
    return Promise.all([
      fetch('/api/products').then(r => { if (r.status === 401) { router.push('/'); return [] } return r.ok ? r.json() : [] }).catch(() => []),
      fetch('/api/cart').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/orders').then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([prods, cartData, orders]) => {
      setProducts(Array.isArray(prods) ? prods : [])
      setCart(cartData)
      const list = Array.isArray(orders) ? orders : []
      setActiveOrder(list.find((o: Order) => o.status === 'pending') || null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [router])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  useEffect(() => {
    if (loading || !gridRef.current) return
    const ctx = gsap.context(() => {
      gsap.from(headerRef.current, { y: -60, opacity: 0, duration: 0.7, ease: 'power3.out' })
      const cards = gridRef.current!.querySelectorAll('.product-card')
      gsap.from(cards, { opacity: 0, y: 50, scale: 0.95, duration: 0.6, stagger: 0.08, ease: 'power3.out', delay: 0.2 })
      cards.forEach(card => {
        const img = card.querySelector('img')
        if (!img) return
        gsap.to(img, { yPercent: -15, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } })
      })
    })
    return () => ctx.revert()
  }, [loading, products])

  useEffect(() => {
    if (!cartPanelRef.current) return
    if (panelOpen) gsap.fromTo(cartPanelRef.current, { x: '100%' }, { x: '0%', duration: 0.4, ease: 'power3.out' })
  }, [panelOpen])

  function closePanel() {
    if (!cartPanelRef.current) { setPanelOpen(false); return }
    gsap.to(cartPanelRef.current, { x: '100%', duration: 0.3, ease: 'power3.in', onComplete: () => setPanelOpen(false) })
  }

  function guardedNav(fn: () => void) {
    if (dirty && !confirm('Tienes cambios sin guardar en tu pedido. ¿Salir sin guardar?')) return
    fn()
  }

  // --- Pedido abierto (servidor = fuente de verdad) ---
  async function orderPatch(body: object): Promise<boolean> {
    if (!activeOrder) return false
    const res = await fetch(`/api/orders/${activeOrder.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) { setActiveOrder(await res.json()); return true }
    const err = await res.json().catch(() => ({}))
    alert(err.error || 'No se pudo modificar el pedido')
    return false
  }

  // --- Añadir producto: al pedido abierto o al carrito ---
  async function addProduct(productId: number) {
    const flavorId = selectedFlavors[productId] ?? null
    setAddingId(productId)
    if (activeOrder) {
      const ok = await orderPatch({ op: 'addItem', productId, flavorId, quantity: 1 })
      if (ok) {
        setJustAddedId(productId)
        setTimeout(() => setJustAddedId(c => c === productId ? null : c), 1000)
      }
    } else {
      const res = await fetch('/api/cart', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, flavorId }),
      })
      if (res.ok) setCart(await res.json())
      else { const err = await res.json().catch(() => ({})); alert(err.error || 'No se pudo añadir al carrito') }
    }
    setAddingId(null)
  }

  async function orderConfirm() {
    setBusy(true)
    await orderPatch({ op: 'confirm' })
    await refreshProducts()
    setBusy(false)
  }
  async function orderCancel() {
    if (!confirm('¿Cancelar este pedido?')) return
    setBusy(true)
    const res = await fetch(`/api/orders/${activeOrder!.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'cancel' }),
    })
    if (res.ok) { setActiveOrder(null); setCartStep('items'); closePanel(); await refreshProducts() }
    else { const err = await res.json().catch(() => ({})); alert(err.error || 'No se pudo cancelar') }
    setBusy(false)
  }
  function openPickupEditor() {
    setPickupDate(oDate || '')
    setPickupTime(oTime || '')
    setCartStep('pickup')
  }
  async function chooseOrderTime(time: string) {
    const ok = await orderPatch({ op: 'setPickup', pickupDate, pickupTime: time })
    if (ok) setCartStep('items')
  }

  // --- Carrito (antes del primer pedido) ---
  async function updateCartQuantity(itemId: number, quantity: number) {
    const res = await fetch('/api/cart', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId, quantity }) })
    if (res.ok) setCart(await res.json())
    else { const err = await res.json().catch(() => ({})); alert(err.error || 'No se pudo actualizar la cantidad') }
  }
  async function removeFromCart(itemId: number) {
    const res = await fetch('/api/cart', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId }) })
    if (res.ok) setCart(await res.json())
  }
  async function placeOrder() {
    if (!pickupDate || !pickupTime) { alert('Selecciona el día y la hora de recogida'); return }
    setPlacing(true)
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note.trim() || null, pickupDate, pickupTime }),
    })
    if (res.ok) {
      const data = await res.json()
      setCart({ items: [] }); setNote(''); setPickupDate(''); setPickupTime(''); setCartStep('items')
      setActiveOrder(data.order)
      setOrderDone(true)
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Error al realizar el pedido')
    }
    setPlacing(false)
  }

  async function logout() {
    guardedNav(async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/') })
  }

  const cartCount = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0
  const cartTotal = cart?.items.reduce((s, i) => s + i.quantity * i.product.price, 0) ?? 0
  const orderCount = orderItems.reduce((s, i) => s + i.quantity, 0)
  const badgeCount = activeOrder ? orderCount : cartCount

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p style={{ color: 'var(--muted)' }} className="text-sm">Cargando catálogo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header ref={headerRef} className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
              style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <span className="text-xs font-black" style={{ color: 'var(--accent2)' }}>BS</span>
          </div>
          <span className="font-semibold text-sm tracking-wide" style={{ color: 'var(--accent2)' }}>Blesser Store</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => guardedNav(() => router.push('/store/pedidos'))}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
            <Package size={16} />
            <span className="hidden sm:inline">Historial</span>
          </button>
          <button onClick={() => { setCartStep('items'); setPanelOpen(true) }}
                  className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
            <ShoppingCart size={16} />
            <span>{activeOrder ? 'Mi pedido' : 'Carrito'}</span>
            {badgeCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                    style={{ background: dirty ? '#f59e0b' : 'var(--accent2)', color: 'var(--bg)' }}>
                {badgeCount}
              </span>
            )}
          </button>
          <button onClick={logout} className="p-2 rounded-xl transition-all cursor-pointer" style={{ color: 'var(--muted)' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeOrder && (
          <div className="mb-6 p-3 rounded-xl flex items-center justify-between gap-3"
               style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <span className="text-sm" style={{ color: '#f59e0b' }}>
              Tienes un pedido abierto.{dirty ? ' Tienes cambios sin guardar.' : ' Lo que añadas se sumará a ese pedido.'}
            </span>
            <button onClick={() => { setCartStep('items'); setPanelOpen(true) }}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold cursor-pointer"
                    style={{ background: '#f59e0b', color: 'var(--bg)' }}>
              {dirty ? 'Revisar y guardar' : 'Ver pedido'}
            </button>
          </div>
        )}

        <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--accent2)' }}>Catálogo</h2>

        {products.length === 0 ? (
          <div className="text-center py-20">
            <Package size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
            <p style={{ color: 'var(--muted)' }}>No hay productos disponibles</p>
          </div>
        ) : (
          <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(product => {
              const inStockFlavors = product.flavors.filter(f => f.inStock)
              const selected = selectedFlavors[product.id] ?? null
              const imgs: string[] = JSON.parse(product.images || '[]')

              return (
                <div key={product.id} className="product-card rounded-2xl overflow-hidden flex flex-col"
                     style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <Link href={`/store/${product.id}`} className="block">
                    <div className="aspect-square relative overflow-hidden" style={{ background: 'var(--surface2)' }}>
                      {imgs.length > 0 ? (
                        <img src={imgs[0]} alt={product.name} className="w-full h-full object-cover" style={{ willChange: 'transform' }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center flex-col">
                          <div className="text-5xl mb-2">💨</div>
                          <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{product.category}</span>
                        </div>
                      )}
                      <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-bold"
                           style={{ background: 'var(--bg)', color: 'var(--accent2)' }}>
                        {product.price} €
                      </div>
                    </div>
                  </Link>

                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div>
                      <Link href={`/store/${product.id}`}>
                        <h3 className="font-bold text-base leading-tight hover:opacity-80 transition-opacity"
                            style={{ color: 'var(--accent2)' }}>{product.name}</h3>
                      </Link>
                      {product.specs && (
                        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{product.specs}</p>
                      )}
                    </div>

                    {product.flavors.length > 0 && (
                      <div>
                        <p className="text-xs mb-2 font-medium" style={{ color: 'var(--muted)' }}>SABOR</p>
                        <select
                          value={selected ?? ''}
                          onChange={e => setSelectedFlavors(prev => ({
                            ...prev, [product.id]: e.target.value ? Number(e.target.value) : null
                          }))}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
                          <option value="">Sin especificar</option>
                          {product.flavors.map(f => (
                            <option key={f.id} value={f.id} disabled={!f.inStock}>
                              {f.name}{!f.inStock ? ' (Agotado)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      onClick={() => addProduct(product.id)}
                      disabled={addingId === product.id || inStockFlavors.length === 0}
                      className="mt-auto w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 cursor-pointer"
                      style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                      {justAddedId === product.id ? '✓ Añadido'
                        : addingId === product.id ? 'Añadiendo...'
                        : inStockFlavors.length === 0 ? 'Sin stock'
                        : activeOrder ? 'Añadir a mi pedido' : 'Añadir al carrito'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {panelOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={closePanel} />
          <div ref={cartPanelRef} className="w-full max-w-sm flex flex-col"
               style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)', transform: 'translateX(100%)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--accent2)' }}>
                {activeOrder ? 'Tu pedido' : 'Carrito'}
                {dirty && <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>sin guardar</span>}
              </h3>
              <button onClick={closePanel} className="cursor-pointer" style={{ color: 'var(--muted)' }}>✕</button>
            </div>

            {orderDone && activeOrder ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(34,197,94,0.12)' }}>
                  <CheckCircle2 size={36} style={{ color: '#22c55e' }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--accent2)' }}>¡Pedido enviado!</h3>
                <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                  Tu pedido se ha recibido. Puedes seguir añadiendo productos; recuerda <b>guardar</b> los cambios.
                </p>
                <button onClick={() => setOrderDone(false)}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                        style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                  Ver mi pedido
                </button>
              </div>
            ) : activeOrder && cartStep === 'pickup' ? (
              /* ===== PEDIDO ABIERTO · PASO 2: recogida ===== */
              <>
                <button onClick={() => setCartStep('items')}
                        className="flex items-center gap-1.5 px-4 pt-3 text-sm cursor-pointer self-start" style={{ color: 'var(--muted)' }}>
                  <ChevronLeft size={16} /> Pedido
                </button>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="rounded-xl p-3 space-y-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2">
                      <Clock size={14} style={{ color: 'var(--accent2)' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--accent2)' }}>Recogida · L-S de 14:00 a 21:00</span>
                    </div>
                    <div>
                      <p className="text-xs mb-1.5 flex items-center gap-1" style={{ color: 'var(--muted)' }}><Calendar size={12} /> Día</p>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {pickupDays.map(d => (
                          <button key={d.value} onClick={() => { setPickupDate(d.value); setPickupTime('') }}
                            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer capitalize transition-all"
                            style={{
                              background: pickupDate === d.value ? 'var(--accent2)' : 'var(--surface)',
                              color: pickupDate === d.value ? 'var(--bg)' : 'var(--accent)',
                              border: `1px solid ${pickupDate === d.value ? 'var(--accent2)' : 'var(--border)'}`,
                            }}>
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {pickupDate && (
                      <div>
                        <p className="text-xs mb-1.5 flex items-center gap-1" style={{ color: 'var(--muted)' }}><Clock size={12} /> Hora</p>
                        {timeSlots.length === 0 ? (
                          <p className="text-xs" style={{ color: 'var(--danger)' }}>No quedan horas ese día.</p>
                        ) : (
                          <div className="grid grid-cols-4 gap-1.5">
                            {timeSlots.map(t => (
                              <button key={t} disabled={busy} onClick={() => chooseOrderTime(t)}
                                className="px-2 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 transition-all"
                                style={{
                                  background: pickupTime === t ? 'var(--accent2)' : 'var(--surface)',
                                  color: pickupTime === t ? 'var(--bg)' : 'var(--accent)',
                                  border: `1px solid ${pickupTime === t ? 'var(--accent2)' : 'var(--border)'}`,
                                }}>
                                {t}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => setCartStep('items')}
                          className="w-full py-3 rounded-xl font-semibold text-sm cursor-pointer"
                          style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                    Listo
                  </button>
                </div>
              </>
            ) : activeOrder ? (
              /* ===== PEDIDO ABIERTO · PASO 1: artículos ===== */
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {orderItems.length === 0 ? (
                    <p className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
                      El pedido está vacío. Añade productos desde el catálogo.
                    </p>
                  ) : orderItems.map(item => (
                    <div key={`${item.productId}:${item.flavorId}`} className="flex gap-3 p-3 rounded-xl"
                         style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--accent2)' }}>{item.productName}</p>
                        {item.flavorName && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{item.flavorName}</p>}
                        <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--accent)' }}>{(item.quantity * item.price).toFixed(2)} €</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button disabled={busy} onClick={() => orderPatch({ op: 'setQty', productId: item.productId, flavorId: item.flavorId, quantity: item.quantity - 1 })}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-50"
                                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
                            <Minus size={15} />
                          </button>
                          <span className="text-sm font-semibold w-6 text-center" style={{ color: 'var(--accent2)' }}>{item.quantity}</span>
                          <button disabled={busy} onClick={() => orderPatch({ op: 'setQty', productId: item.productId, flavorId: item.flavorId, quantity: item.quantity + 1 })}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-50"
                                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                      <button disabled={busy} onClick={() => orderPatch({ op: 'removeItem', productId: item.productId, flavorId: item.flavorId })}
                              className="self-start p-2 rounded-lg cursor-pointer disabled:opacity-50" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                  {/* Resumen recogida -> paso 2 */}
                  <button onClick={openPickupEditor}
                          className="w-full flex items-center justify-between gap-2 rounded-xl p-3 cursor-pointer"
                          style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--accent)' }}>
                      <Clock size={14} style={{ color: 'var(--accent2)' }} />
                      {oDate ? `${formatDayLabel(new Date(oDate + 'T00:00:00'))} · ${oTime}` : 'Elige día y hora'}
                    </span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>Cambiar <ChevronRight size={14} /></span>
                  </button>

                  <div className="flex justify-between items-center">
                    <span className="font-semibold" style={{ color: 'var(--accent2)' }}>Total</span>
                    <span className="font-bold text-lg" style={{ color: 'var(--accent2)' }}>{oTotal.toFixed(2)} €</span>
                  </div>

                  <button onClick={orderConfirm} disabled={!dirty || busy}
                          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 cursor-pointer"
                          style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                    {busy ? 'Guardando...' : dirty ? 'Guardar cambios' : 'Sin cambios'}
                  </button>
                  <button onClick={orderCancel} disabled={busy}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50"
                          style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                    Cancelar pedido
                  </button>
                  <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>Pago en efectivo al recoger</p>
                </div>
              </>
            ) : cartStep === 'pickup' ? (
              /* ===== CARRITO · PASO 2: recogida ===== */
              <>
                <button onClick={() => setCartStep('items')}
                        className="flex items-center gap-1.5 px-4 pt-3 text-sm cursor-pointer self-start" style={{ color: 'var(--muted)' }}>
                  <ChevronLeft size={16} /> Artículos
                </button>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="rounded-xl p-3 space-y-3" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2">
                      <Clock size={14} style={{ color: 'var(--accent2)' }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--accent2)' }}>Recogida · L-S de 14:00 a 21:00</span>
                    </div>
                    <div>
                      <p className="text-xs mb-1.5 flex items-center gap-1" style={{ color: 'var(--muted)' }}><Calendar size={12} /> Día</p>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {pickupDays.map(d => (
                          <button key={d.value} onClick={() => { setPickupDate(d.value); setPickupTime('') }}
                            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer capitalize transition-all"
                            style={{
                              background: pickupDate === d.value ? 'var(--accent2)' : 'var(--surface)',
                              color: pickupDate === d.value ? 'var(--bg)' : 'var(--accent)',
                              border: `1px solid ${pickupDate === d.value ? 'var(--accent2)' : 'var(--border)'}`,
                            }}>
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {pickupDate && (
                      <div>
                        <p className="text-xs mb-1.5 flex items-center gap-1" style={{ color: 'var(--muted)' }}><Clock size={12} /> Hora</p>
                        {timeSlots.length === 0 ? (
                          <p className="text-xs" style={{ color: 'var(--danger)' }}>No quedan horas disponibles hoy, elige otro día.</p>
                        ) : (
                          <div className="grid grid-cols-4 gap-1.5">
                            {timeSlots.map(t => (
                              <button key={t} onClick={() => setPickupTime(t)}
                                className="px-2 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                                style={{
                                  background: pickupTime === t ? 'var(--accent2)' : 'var(--surface)',
                                  color: pickupTime === t ? 'var(--bg)' : 'var(--accent)',
                                  border: `1px solid ${pickupTime === t ? 'var(--accent2)' : 'var(--border)'}`,
                                }}>
                                {t}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Nota para el pedido (opcional)" rows={2}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)' }} />
                </div>
                <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold" style={{ color: 'var(--accent2)' }}>Total</span>
                    <span className="font-bold text-lg" style={{ color: 'var(--accent2)' }}>{cartTotal.toFixed(2)} €</span>
                  </div>
                  <button onClick={placeOrder} disabled={placing || !pickupDate || !pickupTime}
                          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 cursor-pointer"
                          style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                    {placing ? 'Enviando pedido...' : !pickupDate || !pickupTime ? 'Elige día y hora de recogida' : 'Realizar pedido'}
                  </button>
                  <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>Pago en efectivo al recoger</p>
                </div>
              </>
            ) : (
              /* ===== CARRITO · PASO 1: artículos ===== */
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {!cart?.items.length ? (
                    <div className="text-center py-16">
                      <ShoppingCart size={32} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--muted)' }}>El carrito está vacío</p>
                    </div>
                  ) : cart.items.map(item => (
                    <div key={item.id} className="flex gap-3 p-3 rounded-xl"
                         style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--accent2)' }}>{item.product.name}</p>
                        {item.flavor && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{item.flavor.name}</p>}
                        <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--accent)' }}>{(item.quantity * item.product.price).toFixed(2)} €</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
                            <Minus size={15} />
                          </button>
                          <span className="text-sm font-semibold w-6 text-center" style={{ color: 'var(--accent2)' }}>{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                      <button onClick={() => removeFromCart(item.id)}
                              className="self-start p-2 rounded-lg cursor-pointer" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                {cartCount > 0 && (
                  <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold" style={{ color: 'var(--accent2)' }}>Total</span>
                      <span className="font-bold text-lg" style={{ color: 'var(--accent2)' }}>{cartTotal.toFixed(2)} €</span>
                    </div>
                    <button onClick={() => setCartStep('pickup')}
                            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                            style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                      Continuar a recogida <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
