'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart, LogOut, Package, Plus, Minus, Trash2, CheckCircle2 } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface Flavor { id: number; name: string; inStock: boolean }
interface Product {
  id: number; name: string; price: number; description: string
  specs: string; category: string; images: string; flavors: Flavor[]
}
interface CartItem {
  id: number; productId: number; flavorId: number | null; quantity: number; product: Product; flavor: Flavor | null
}
interface Cart { items: CartItem[] }

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [cartOpen, setCartOpen] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [selectedFlavors, setSelectedFlavors] = useState<Record<number, number | null>>({})
  const [note, setNote] = useState('')
  const [placing, setPlacing] = useState(false)
  const [orderDone, setOrderDone] = useState<number | null>(null)
  const router = useRouter()

  const headerRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const cartPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then(r => {
        if (r.status === 401) { router.push('/'); return [] }
        return r.json()
      }),
      fetch('/api/cart').then(r => {
        if (r.status === 401) return null
        return r.json()
      }),
    ]).then(([prods, cartData]) => {
      setProducts(prods || [])
      setCart(cartData)
      setLoading(false)
    })
  }, [router])

  useEffect(() => {
    if (loading || !gridRef.current) return
    const ctx = gsap.context(() => {
      // Header slide down
      gsap.from(headerRef.current, { y: -60, opacity: 0, duration: 0.7, ease: 'power3.out' })

      // Cards stagger entrance
      const cards = gridRef.current!.querySelectorAll('.product-card')
      gsap.from(cards, {
        opacity: 0, y: 50, scale: 0.95,
        duration: 0.6, stagger: 0.08, ease: 'power3.out', delay: 0.2,
      })

      // Parallax on images
      cards.forEach(card => {
        const img = card.querySelector('img')
        if (!img) return
        gsap.to(img, {
          yPercent: -15,
          ease: 'none',
          scrollTrigger: {
            trigger: card,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        })
      })
    })
    return () => ctx.revert()
  }, [loading, products])

  // Animación carrito
  useEffect(() => {
    if (!cartPanelRef.current) return
    if (cartOpen) {
      gsap.fromTo(cartPanelRef.current, { x: '100%' }, { x: '0%', duration: 0.4, ease: 'power3.out' })
    }
  }, [cartOpen])

  function closeCart() {
    if (!cartPanelRef.current) { setCartOpen(false); return }
    gsap.to(cartPanelRef.current, { x: '100%', duration: 0.3, ease: 'power3.in', onComplete: () => setCartOpen(false) })
  }

  async function addToCart(productId: number) {
    const flavorId = selectedFlavors[productId] ?? null
    setAddingId(productId)
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, flavorId }),
    })
    if (res.ok) setCart(await res.json())
    else { const err = await res.json().catch(() => ({})); alert(err.error || 'No se pudo añadir al carrito') }
    setAddingId(null)
  }

  async function updateQuantity(itemId: number, quantity: number) {
    const res = await fetch('/api/cart', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, quantity }),
    })
    if (res.ok) setCart(await res.json())
    else { const err = await res.json().catch(() => ({})); alert(err.error || 'No se pudo actualizar la cantidad') }
  }

  async function removeFromCart(itemId: number) {
    const res = await fetch('/api/cart', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    })
    if (res.ok) setCart(await res.json())
  }

  async function placeOrder() {
    setPlacing(true)
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note.trim() || null }),
    })
    if (res.ok) {
      const data = await res.json()
      setCart({ items: [] })
      setNote('')
      setOrderDone(data.orderId)
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Error al realizar el pedido')
    }
    setPlacing(false)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const cartCount = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0
  const cartTotal = cart?.items.reduce((s, i) => s + i.quantity * i.product.price, 0) ?? 0

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
          <button onClick={() => setCartOpen(true)}
                  className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
            <ShoppingCart size={16} />
            <span>Carrito</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                    style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                {cartCount}
              </span>
            )}
          </button>
          <button onClick={logout} className="p-2 rounded-xl transition-all cursor-pointer"
                  style={{ color: 'var(--muted)' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
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
                      onClick={() => addToCart(product.id)}
                      disabled={addingId === product.id || inStockFlavors.length === 0}
                      className="mt-auto w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 cursor-pointer"
                      style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                      {addingId === product.id ? 'Añadiendo...' : inStockFlavors.length === 0 ? 'Sin stock' : 'Añadir al carrito'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={closeCart} />
          <div ref={cartPanelRef} className="w-full max-w-sm flex flex-col"
               style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)', transform: 'translateX(100%)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="font-bold" style={{ color: 'var(--accent2)' }}>Carrito</h3>
              <button onClick={closeCart} className="cursor-pointer" style={{ color: 'var(--muted)' }}>✕</button>
            </div>

            {orderDone ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                     style={{ background: 'rgba(34,197,94,0.12)' }}>
                  <CheckCircle2 size={36} style={{ color: '#22c55e' }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--accent2)' }}>¡Pedido enviado!</h3>
                <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>
                  Pedido <span className="font-mono">#{orderDone}</span> recibido correctamente.
                </p>
                <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                  Nos pondremos en contacto contigo para coordinar la entrega.
                </p>
                <button onClick={() => { setOrderDone(null); closeCart() }}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                        style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                  Seguir comprando
                </button>
              </div>
            ) : (
              <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!cart?.items.length ? (
                <div className="text-center py-16">
                  <ShoppingCart size={32} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>El carrito está vacío</p>
                </div>
              ) : (
                cart.items.map(item => (
                  <div key={item.id} className="flex gap-3 p-3 rounded-xl"
                       style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--accent2)' }}>{item.product.name}</p>
                      {item.flavor && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{item.flavor.name}</p>
                      )}
                      <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--accent)' }}>
                        {(item.quantity * item.product.price).toFixed(2)} €
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-semibold w-6 text-center" style={{ color: 'var(--accent2)' }}>
                          {item.quantity}
                        </span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.id)}
                            className="self-start p-2 rounded-lg cursor-pointer transition-all"
                            style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
            {cartCount > 0 && (
              <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Nota para el pedido (opcional)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)' }}
                />
                <div className="flex justify-between items-center">
                  <span className="font-semibold" style={{ color: 'var(--accent2)' }}>Total</span>
                  <span className="font-bold text-lg" style={{ color: 'var(--accent2)' }}>{cartTotal.toFixed(2)} €</span>
                </div>
                <button onClick={placeOrder} disabled={placing}
                        className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 cursor-pointer"
                        style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                  {placing ? 'Enviando pedido...' : 'Realizar pedido'}
                </button>
                <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>Pago en efectivo al recoger</p>
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
