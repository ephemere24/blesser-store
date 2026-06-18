'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingCart, CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react'

interface Flavor { id: number; name: string; inStock: boolean }
interface Product {
  id: number; name: string; price: number; description: string
  specs: string; category: string; images: string; flavors: Flavor[]
}

function ImageGallery({ images, name, category }: { images: string[]; name: string; category: string }) {
  const [current, setCurrent] = useState(0)

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
           style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <img src={images[current]} alt={name} className="w-full h-full object-cover" />
        {images.length > 1 && (
          <>
            <button onClick={() => setCurrent(i => (i - 1 + images.length) % images.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all"
              style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setCurrent(i => (i + 1) % images.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all"
              style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className="rounded-full transition-all cursor-pointer"
                  style={{ width: i === current ? 20 : 6, height: 6,
                           background: i === current ? 'white' : 'rgba(255,255,255,0.4)' }} />
              ))}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button key={i} onClick={() => setCurrent(i)}
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
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    fetch(`/api/products/${id}`).then(r => {
      if (r.status === 401) { router.push('/'); return null }
      if (!r.ok) { router.push('/store'); return null }
      return r.json()
    }).then(data => {
      if (data) setProduct(data)
      setLoading(false)
    })
  }, [id, router])

  async function addToCart() {
    if (!product) return
    setAdding(true)
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, flavorId: selectedFlavor }),
    })
    if (res.ok) { setAdded(true); setTimeout(() => setAdded(false), 2000) }
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
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3"
              style={{ background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/store" className="p-2 rounded-xl transition-all cursor-pointer"
              style={{ color: 'var(--muted)', background: 'var(--surface2)' }}>
          <ArrowLeft size={16} />
        </Link>
        <span className="font-semibold text-sm" style={{ color: 'var(--accent2)' }}>
          {product.category}
        </span>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <ImageGallery images={images} name={product.name} category={product.category} />

        {/* Info */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--accent2)' }}>
              {product.name}
            </h1>
            <span className="text-2xl font-bold shrink-0" style={{ color: 'var(--accent2)' }}>
              {product.price} €
            </span>
          </div>

          {product.specs && (
            <p className="text-sm px-3 py-2 rounded-xl inline-block"
               style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              {product.specs}
            </p>
          )}

          {product.description && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--accent)' }}>
              {product.description}
            </p>
          )}

          {product.flavors.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold mb-3 tracking-widest" style={{ color: 'var(--muted)' }}>
                SABORES DISPONIBLES
              </h3>
              <div className="flex flex-wrap gap-2">
                {inStockFlavors.map(f => (
                  <button key={f.id}
                    onClick={() => setSelectedFlavor(f.id === selectedFlavor ? null : f.id)}
                    className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5"
                    style={{
                      background: selectedFlavor === f.id ? 'var(--accent2)' : 'var(--surface2)',
                      color: selectedFlavor === f.id ? 'var(--bg)' : 'var(--accent)',
                      border: `1px solid ${selectedFlavor === f.id ? 'var(--accent2)' : 'var(--border)'}`,
                    }}>
                    <CheckCircle size={12} />
                    {f.name}
                  </button>
                ))}
                {outOfStockFlavors.map(f => (
                  <span key={f.id}
                    className="px-3 py-1.5 rounded-xl text-sm flex items-center gap-1.5 opacity-40"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                    <XCircle size={12} />
                    {f.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={addToCart}
            disabled={adding || inStockFlavors.length === 0}
            className="w-full py-4 rounded-2xl font-semibold text-base transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer mt-4"
            style={{
              background: added ? '#22c55e' : 'var(--accent2)',
              color: 'var(--bg)',
            }}>
            <ShoppingCart size={18} />
            {added ? '¡Añadido!' : adding ? 'Añadiendo...' : inStockFlavors.length === 0 ? 'Sin stock' : 'Añadir al carrito'}
          </button>
        </div>
      </div>
    </div>
  )
}
