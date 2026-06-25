'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Heart } from 'lucide-react'
import { effectivePrice, discountPct } from '@/lib/price'
import SiteBackground from '@/components/SiteBackground'

interface Flavor { id: number; name: string; inStock: boolean; stock: number }
interface Product {
  id: number; name: string; price: number; category: string; images: string; specs: string
  flavors: Flavor[]; onSale: boolean; salePrice: number | null; saleEndsAt: string | null; saleUnits: number | null
}

export default function FavoritosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/favorites').then(r => {
      if (r.status === 401) { router.push('/'); return [] }
      return r.ok ? r.json() : []
    }).then((data: Product[]) => { setProducts(data || []); setLoading(false) })
  }, [router])

  async function removeFav(productId: number, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    setProducts(prev => prev.filter(p => p.id !== productId))
    await fetch('/api/favorites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId }) })
  }

  return (
    <>
    <SiteBackground />
    <div className="min-h-screen relative" style={{ background: 'transparent', zIndex: 1 }}>
      <header className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3"
              style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/store" className="p-2 rounded-xl cursor-pointer" style={{ color: 'var(--muted)', background: 'var(--surface2)' }}>
          <ArrowLeft size={16} />
        </Link>
        <span className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--accent2)' }}>
          <Heart size={15} fill="#ef4444" color="#ef4444" /> Mis favoritos
        </span>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <span className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
              <Heart size={26} />
            </span>
            <p className="font-semibold" style={{ color: 'var(--accent2)' }}>Aún no tienes favoritos</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Pulsa el corazón en un producto para guardarlo aquí.</p>
            <Link href="/store" className="inline-block mt-5 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
              Ver catálogo
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(product => {
              const imgs: string[] = JSON.parse(product.images || '[]')
              const eff = effectivePrice(product)
              const pct = discountPct(product)
              return (
                <div key={product.id} className="product-card rounded-2xl overflow-hidden flex flex-col"
                     style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <Link href={`/store/${product.id}`} className="block">
                    <div className="aspect-square relative overflow-hidden" style={{ background: 'var(--surface2)' }}>
                      {imgs.length > 0 ? (
                        <img src={imgs[0]} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center flex-col">
                          <div className="text-5xl mb-2">💨</div>
                          <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{product.category}</span>
                        </div>
                      )}
                      {pct != null && (
                        <div className="absolute top-3 left-3 px-2 py-1 rounded-lg text-xs font-extrabold tracking-wide shadow-lg"
                             style={{ background: 'var(--danger)', color: '#fff' }}>
                          LIQUIDACIÓN −{pct}%
                        </div>
                      )}
                      <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5"
                           style={{ background: 'var(--bg)', color: 'var(--accent2)' }}>
                        {pct != null && <span className="line-through opacity-50 font-medium">{product.price}€</span>}
                        <span style={{ color: pct != null ? '#f87171' : 'var(--accent2)' }}>{eff}€</span>
                      </div>
                      <button onClick={e => removeFav(product.id, e)} aria-label="Quitar de favoritos"
                              className="absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
                              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', color: '#ef4444' }}>
                        <Heart size={16} fill="#ef4444" />
                      </button>
                    </div>
                  </Link>
                  <div className="p-4">
                    <Link href={`/store/${product.id}`}>
                      <h3 className="font-bold text-base leading-tight hover:opacity-80 transition-opacity" style={{ color: 'var(--accent2)' }}>{product.name}</h3>
                    </Link>
                    {product.specs && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{product.specs}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
    </>
  )
}
