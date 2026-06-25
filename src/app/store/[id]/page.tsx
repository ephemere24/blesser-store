'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingCart, CheckCircle, XCircle, ChevronLeft, ChevronRight, Plus, Minus, Heart, Share2 } from 'lucide-react'
import { gsap } from 'gsap'
import { effectivePrice, discountPct, isSaleActive } from '@/lib/price'
import SaleCountdown from '@/components/SaleCountdown'
import SiteBackground from '@/components/SiteBackground'

interface Flavor { id: number; name: string; inStock: boolean; stock: number }
interface Product {
  id: number; name: string; price: number; description: string
  specs: string; category: string; images: string; flavors: Flavor[]
  onSale: boolean; salePrice: number | null; saleEndsAt: string | null; saleUnits: number | null
}

function ImageGallery({ images, name, category }: { images: string[]; name: string; category: string }) {
  const [current, setCurrent] = useState(0)
  const imgRef = useRef<HTMLImageElement>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  function changeTo(idx: number) {
    if (!imgRef.current) { setCurrent(idx); return }
    gsap.to(imgRef.current, {
      opacity: 0, scale: 1.03, duration: 0.15, ease: 'power2.in',
      onComplete: () => {
        setCurrent(idx)
        gsap.to(imgRef.current, { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out' })
      },
    })
  }

  const goNext = () => changeTo((current + 1) % images.length)
  const goPrev = () => changeTo((current - 1 + images.length) % images.length)

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    // Solo si el gesto es claramente horizontal y supera el umbral
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext()
      else goPrev()
    }
  }

  if (images.length === 0) {
    return (
      <div className="rounded-2xl aspect-square flex items-center justify-center mb-6"
           style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <div className="text-center">
          <div className="text-8xl mb-3">💨</div>
          <span className="text-sm font-mono" style={{ color: 'var(--muted)' }}>{category}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <div className="rounded-2xl aspect-square relative overflow-hidden"
           style={{ background: 'var(--surface2)', border: '1px solid var(--border)', touchAction: 'pan-y' }}
           onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <img ref={imgRef} src={images[current]} alt={name} className="w-full h-full object-cover select-none" draggable={false} />
        {images.length > 1 && (
          <>
            <button onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full items-center justify-center cursor-pointer hidden sm:flex"
              style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
              <ChevronLeft size={18} />
            </button>
            <button onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full items-center justify-center cursor-pointer hidden sm:flex"
              style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => changeTo(i)} className="rounded-full transition-all cursor-pointer"
                  style={{ width: i === current ? 20 : 6, height: 6, background: i === current ? 'white' : 'rgba(255,255,255,0.4)' }} />
              ))}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button key={i} onClick={() => changeTo(i)}
              className="shrink-0 w-16 h-16 rounded-xl overflow-hidden cursor-pointer transition-all"
              style={{ border: `2px solid ${i === current ? 'var(--accent2)' : 'var(--border)'}` }}>
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProductPage() {
  const { id } = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedFlavor, setSelectedFlavor] = useState<number | null>(null)
  const [qty, setQty] = useState(1)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [cartCount, setCartCount] = useState(0)
  const [isFav, setIsFav] = useState(false)
  const [shared, setShared] = useState(false)
  const [, setSaleTick] = useState(0)

  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const infoRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    fetch(`/api/products/${id}`).then(r => {
      if (r.status === 401) { router.push('/'); return null }
      if (!r.ok) { router.push('/store'); return null }
      return r.json()
    }).then(data => {
      if (data) setProduct(data)
      setLoading(false)
    })
    // ¿Está marcado como favorito?
    fetch('/api/favorites').then(r => r.ok ? r.json() : []).then((favs: { id: number }[]) => {
      setIsFav((favs || []).some(p => String(p.id) === String(id)))
    }).catch(() => {})
    // ¿Hay un pedido abierto? Entonces se añade a ese pedido, no al carrito.
    fetch('/api/orders').then(r => r.ok ? r.json() : []).then((orders) => {
      const pending = (orders || []).find((o: { status: string; id: number; pendingChanges?: boolean; items?: { quantity: number }[]; draftItems?: { quantity: number }[] | null }) => o.status === 'pending')
      setActiveOrderId(pending?.id ?? null)
      if (pending) {
        const list = (pending.pendingChanges && pending.draftItems) ? pending.draftItems : (pending.items ?? [])
        setCartCount(list.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0))
      } else {
        fetch('/api/cart').then(r => r.ok ? r.json() : null).then((cart) => {
          setCartCount((cart?.items ?? []).reduce((s: number, i: { quantity: number }) => s + i.quantity, 0))
        })
      }
    })
  }, [id, router])

  useEffect(() => {
    if (loading || !product) return
    const ctx = gsap.context(() => {
      gsap.from(headerRef.current, { y: -40, opacity: 0, duration: 0.5, ease: 'power3.out' })
      gsap.from(galleryRef.current, { opacity: 0, scale: 0.96, duration: 0.7, ease: 'power3.out', delay: 0.1 })
      if (infoRef.current) {
        gsap.from(Array.from(infoRef.current.children), {
          opacity: 0, y: 25, duration: 0.5, stagger: 0.07, ease: 'power3.out', delay: 0.2,
        })
      }
    }, pageRef)
    return () => ctx.revert()
  }, [loading, product])

  async function toggleFavorite() {
    if (!product) return
    const next = !isFav
    setIsFav(next) // optimista
    const res = await fetch('/api/favorites', {
      method: next ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id }),
    })
    if (!res.ok) setIsFav(!next) // revertir si falla
  }

  async function shareProduct() {
    if (!product) return
    const url = window.location.href
    const price = effectivePrice(product)
    const text = `Mira este producto en Blesser Store: ${product.name} — ${price}€`
    if (navigator.share) {
      try { await navigator.share({ title: product.name, text, url }) } catch { /* cancelado */ }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        setShared(true)
        setTimeout(() => setShared(false), 1500)
      } catch { alert('No se pudo copiar el enlace') }
    }
  }

  async function addToCart() {
    if (!product) return
    setAdding(true)
    if (btnRef.current) gsap.to(btnRef.current, { scale: 0.96, duration: 0.1, yoyo: true, repeat: 1 })
    const res = activeOrderId
      ? await fetch(`/api/orders/${activeOrderId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'addItem', productId: product.id, flavorId: selectedFlavor, quantity: qty }),
        })
      : await fetch('/api/cart', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id, flavorId: selectedFlavor, quantity: qty }),
        })
    if (res.ok) {
      setAdded(true)
      setCartCount(c => c + qty)
      if (btnRef.current) gsap.fromTo(btnRef.current, { scale: 1.05 }, { scale: 1, duration: 0.3, ease: 'elastic.out(1, 0.5)' })
      setTimeout(() => setAdded(false), 900)
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'No se pudo añadir')
    }
    setAdding(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!product) return null

  const inStockFlavors = product.flavors.filter(f => f.inStock)
  const outOfStockFlavors = product.flavors.filter(f => !f.inStock)
  const images: string[] = JSON.parse(product.images || '[]')

  return (
    <>
    <SiteBackground />
    <div ref={pageRef} className="min-h-screen relative" style={{ background: 'transparent', zIndex: 1 }}>
      <header ref={headerRef} className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3"
              style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/store" className="p-2 rounded-xl transition-all cursor-pointer"
              style={{ color: 'var(--muted)', background: 'var(--surface2)' }}>
          <ArrowLeft size={16} />
        </Link>
        <span className="flex-1 font-semibold text-sm" style={{ color: 'var(--accent2)' }}>{product.category}</span>
        <button onClick={toggleFavorite} aria-label="Favorito"
                className="p-2 rounded-xl transition-all cursor-pointer"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: isFav ? '#ef4444' : 'var(--muted)' }}>
          <Heart size={16} fill={isFav ? '#ef4444' : 'none'} />
        </button>
        <button onClick={shareProduct} aria-label="Compartir"
                className="p-2 rounded-xl transition-all cursor-pointer"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
          <Share2 size={16} />
        </button>
        <Link href="/store?cart=1"
              className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
          <ShoppingCart size={16} />
          <span>{activeOrderId ? 'Mi pedido' : 'Carrito'}</span>
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                  style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
              {cartCount}
            </span>
          )}
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div ref={galleryRef}>
          <ImageGallery images={images} name={product.name} category={product.category} />
        </div>

        <div ref={infoRef} className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--accent2)' }}>{product.name}</h1>
            <div className="text-right shrink-0">
              {discountPct(product) != null && (
                <span className="block text-sm line-through" style={{ color: 'var(--muted)' }}>{product.price} €</span>
              )}
              <span className="text-2xl font-bold" style={{ color: discountPct(product) != null ? '#f87171' : 'var(--accent2)' }}>{effectivePrice(product)} €</span>
            </div>
          </div>

          {discountPct(product) != null && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold tracking-wide"
                    style={{ background: 'var(--danger)', color: '#fff' }}>
                LIQUIDACIÓN −{discountPct(product)}%
              </span>
              {isSaleActive(product) && product.saleEndsAt && (
                <SaleCountdown endsAt={product.saleEndsAt} size="md" onExpire={() => setSaleTick(t => t + 1)} />
              )}
              {isSaleActive(product) && product.saleUnits != null && (
                <span className="text-xs font-semibold" style={{ color: '#f87171' }}>
                  ¡Solo quedan {product.saleUnits} a este precio!
                </span>
              )}
            </div>
          )}

          {product.specs && (
            <p className="text-sm px-3 py-2 rounded-xl inline-block"
               style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              {product.specs}
            </p>
          )}

          {product.description && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--accent)' }}>{product.description}</p>
          )}

          {product.flavors.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-3 tracking-widest" style={{ color: 'var(--muted)' }}>
                SABORES DISPONIBLES
              </h3>
              <div className="flex flex-wrap gap-2">
                {inStockFlavors.map(f => (
                  <button key={f.id}
                    onClick={() => { setSelectedFlavor(f.id === selectedFlavor ? null : f.id); setQty(1) }}
                    className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5"
                    style={{
                      background: selectedFlavor === f.id ? 'var(--accent2)' : 'var(--surface2)',
                      color: selectedFlavor === f.id ? 'var(--bg)' : 'var(--accent)',
                      border: `1px solid ${selectedFlavor === f.id ? 'var(--accent2)' : 'var(--border)'}`,
                    }}>
                    <CheckCircle size={12} />{f.name}
                  </button>
                ))}
                {outOfStockFlavors.map(f => (
                  <span key={f.id} className="px-3 py-1.5 rounded-xl text-sm flex items-center gap-1.5 opacity-40"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                    <XCircle size={12} />{f.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {inStockFlavors.length > 0 && (
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center rounded-xl overflow-hidden shrink-0"
                   style={{ border: '1px solid var(--border)', background: 'var(--surface2)' }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1}
                        className="w-11 h-11 flex items-center justify-center cursor-pointer disabled:opacity-30 transition-colors"
                        style={{ color: 'var(--accent2)' }}>
                  <Minus size={16} />
                </button>
                <input
                  type="number" min={1} max={99} value={qty}
                  onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) setQty(Math.min(99, v)) }}
                  className="w-10 text-center text-sm font-bold outline-none bg-transparent"
                  style={{ color: 'var(--accent2)' }}
                />
                <button onClick={() => setQty(q => Math.min(99, q + 1))}
                        className="w-11 h-11 flex items-center justify-center cursor-pointer transition-colors"
                        style={{ color: 'var(--accent2)' }}>
                  <Plus size={16} />
                </button>
              </div>
              <button ref={btnRef}
                onClick={addToCart}
                disabled={adding}
                className="flex-1 py-3 rounded-2xl font-semibold text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: added ? '#22c55e' : 'var(--accent2)', color: 'var(--bg)' }}>
                <ShoppingCart size={16} />
                {added ? '✓ Añadido' : adding ? 'Añadiendo...' : activeOrderId ? 'Añadir a pedido' : 'Añadir al carrito'}
              </button>
            </div>
          )}
          {inStockFlavors.length === 0 && (
            <div className="mt-4 w-full py-4 rounded-2xl text-center text-sm font-semibold opacity-40"
                 style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
              Sin stock
            </div>
          )}
        </div>
      </div>
      {shared && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm font-medium z-50 bs-rise"
             style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
          ✓ Enlace copiado
        </div>
      )}
    </div>
    </>
  )
}
