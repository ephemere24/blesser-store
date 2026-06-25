'use client'

import { useState, useMemo, DragEvent } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, GripVertical, Search, X, ChevronDown, ChevronRight, ArrowUp, ArrowDown, PackageX, ImageIcon } from 'lucide-react'
import { makeFuse, searchProducts } from '@/lib/search'

interface Flavor { id?: number; name: string; inStock: boolean; stock: number }
export interface Product {
  id: number; name: string; price: number; description: string
  specs: string; category: string; visible: boolean; position: number
  images: string; flavors: Flavor[]; onSale: boolean; salePrice: number | null; saleEndsAt: string | null; saleUnits: number | null
}

const SOLDOUT_KEY = '__soldout__'
function isSoldOut(p: Product) { return p.flavors.length > 0 && !p.flavors.some(f => f.inStock) }
function firstImage(p: Product): string | null {
  try { const a = JSON.parse(p.images || '[]'); return a[0] || null } catch { return null }
}

export default function ProductsTab({ products, onAdd, onEdit, onToggleVisible, onDelete, onReorder }: {
  products: Product[]
  onAdd: () => void
  onEdit: (p: Product) => void
  onToggleVisible: (p: Product) => void
  onDelete: (id: number) => void
  onReorder: (next: Product[]) => void
}) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set([SOLDOUT_KEY]))
  const [dragId, setDragId] = useState<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)

  const fuse = useMemo(() => makeFuse(products), [products])
  const searching = query.trim().length > 0
  const results = useMemo(() => searchProducts(fuse, products, query), [fuse, products, query])

  const available = useMemo(() => products.filter(p => !isSoldOut(p)), [products])
  const soldout = useMemo(() => products.filter(isSoldOut), [products])

  // Agrupar disponibles por categoría, en orden de aparición (= orden por posición)
  const groups = useMemo(() => {
    const out: { category: string; items: Product[] }[] = []
    const idx = new Map<string, number>()
    for (const p of available) {
      const cat = p.category?.trim() || 'Sin categoría'
      if (!idx.has(cat)) { idx.set(cat, out.length); out.push({ category: cat, items: [] }) }
      out[idx.get(cat)!].items.push(p)
    }
    return out
  }, [available])

  function toggle(key: string) {
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  async function persist(newAvailable: Product[]) {
    const next = [...newAvailable, ...soldout].map((p, i) => ({ ...p, position: i }))
    onReorder(next)
    await fetch('/api/admin/products/reorder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map(p => p.id) }),
    })
  }

  function onDrop(target: Product) {
    const dragged = available.find(p => p.id === dragId)
    setDragId(null); setOverId(null)
    if (!dragged || dragged.id === target.id) return
    const dCat = dragged.category?.trim() || 'Sin categoría'
    const tCat = target.category?.trim() || 'Sin categoría'
    if (dCat !== tCat) return // solo se reordena dentro de la misma categoría
    const without = available.filter(p => p.id !== dragged.id)
    const ti = without.findIndex(p => p.id === target.id)
    without.splice(ti, 0, dragged) // insertar antes del objetivo
    persist(without)
  }

  function moveCategory(catIndex: number, dir: -1 | 1) {
    const target = catIndex + dir
    if (target < 0 || target >= groups.length) return
    const g = [...groups]
    const [moved] = g.splice(catIndex, 1)
    g.splice(target, 0, moved)
    persist(g.flatMap(x => x.items))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold" style={{ color: 'var(--accent2)' }}>
          Catálogo ({products.length})
        </h2>
        <button onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
          style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
          <Plus size={14} /> Añadir
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <Search size={16} style={{ color: 'var(--muted)' }} />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre, sabor, categoría, precio…"
          className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--accent2)' }} />
        {query && <button onClick={() => setQuery('')} className="p-1 rounded-lg cursor-pointer" style={{ color: 'var(--muted)' }}><X size={14} /></button>}
      </div>

      {searching ? (
        results.length === 0 ? (
          <Empty text={`No hay productos para «${query}»`} />
        ) : (
          <div className="space-y-2">
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{results.length} resultado(s)</p>
            {results.map(p => <Row key={p.id} p={p} onEdit={onEdit} onToggleVisible={onToggleVisible} onDelete={onDelete} />)}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {groups.length === 0 && soldout.length === 0 && <Empty text="Aún no hay productos. Pulsa «Añadir»." />}

          {groups.map((g, gi) => {
            const open = !collapsed.has(g.category)
            return (
              <div key={g.category} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 px-4 py-3">
                  <button onClick={() => toggle(g.category)} className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    {open ? <ChevronDown size={16} style={{ color: 'var(--muted)' }} /> : <ChevronRight size={16} style={{ color: 'var(--muted)' }} />}
                    <span className="font-semibold truncate" style={{ color: 'var(--accent2)' }}>{g.category}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>{g.items.length}</span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => moveCategory(gi, -1)} disabled={gi === 0}
                      className="p-1.5 rounded-lg cursor-pointer disabled:opacity-30" style={{ background: 'var(--surface2)', color: 'var(--accent)' }} title="Subir categoría"><ArrowUp size={13} /></button>
                    <button onClick={() => moveCategory(gi, 1)} disabled={gi === groups.length - 1}
                      className="p-1.5 rounded-lg cursor-pointer disabled:opacity-30" style={{ background: 'var(--surface2)', color: 'var(--accent)' }} title="Bajar categoría"><ArrowDown size={13} /></button>
                  </div>
                </div>

                {open && (
                  <div className="px-3 pb-3 space-y-2">
                    {g.items.map(p => (
                      <div key={p.id}
                        draggable
                        onDragStart={() => setDragId(p.id)}
                        onDragEnd={() => { setDragId(null); setOverId(null) }}
                        onDragOver={(e: DragEvent) => { e.preventDefault(); if (dragId && dragId !== p.id) setOverId(p.id) }}
                        onDrop={() => onDrop(p)}
                        style={{ borderTop: overId === p.id ? '2px solid var(--accent2)' : '2px solid transparent', opacity: dragId === p.id ? 0.4 : 1 }}>
                        <Row p={p} draggable onEdit={onEdit} onToggleVisible={onToggleVisible} onDelete={onDelete} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {soldout.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--danger)' }}>
              <button onClick={() => toggle(SOLDOUT_KEY)} className="w-full flex items-center gap-2 px-4 py-3 cursor-pointer">
                {!collapsed.has(SOLDOUT_KEY) ? <ChevronDown size={16} style={{ color: 'var(--danger)' }} /> : <ChevronRight size={16} style={{ color: 'var(--danger)' }} />}
                <PackageX size={15} style={{ color: 'var(--danger)' }} />
                <span className="font-semibold flex-1 text-left" style={{ color: 'var(--danger)' }}>Sin stock</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)' }}>{soldout.length}</span>
              </button>
              {!collapsed.has(SOLDOUT_KEY) && (
                <div className="px-3 pb-3 space-y-2">
                  {soldout.map(p => <Row key={p.id} p={p} soldout onEdit={onEdit} onToggleVisible={onToggleVisible} onDelete={onDelete} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ p, draggable, soldout, onEdit, onToggleVisible, onDelete }: {
  p: Product; draggable?: boolean; soldout?: boolean
  onEdit: (p: Product) => void; onToggleVisible: (p: Product) => void; onDelete: (id: number) => void
}) {
  const img = firstImage(p)
  const inStock = p.flavors.filter(f => f.inStock).length
  const total = p.flavors.length
  return (
    <div className="rounded-xl p-2.5 flex items-center gap-3"
         style={{ background: 'var(--surface2)', border: '1px solid var(--border)', opacity: p.visible ? 1 : 0.5 }}>
      {draggable && <GripVertical size={16} className="shrink-0 cursor-grab active:cursor-grabbing" style={{ color: 'var(--muted)' }} />}
      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={16} style={{ color: 'var(--muted)' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold truncate" style={{ color: 'var(--accent2)' }}>{p.name}</p>
          {p.onSale && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--danger)', color: '#fff' }}>OFERTA</span>}
          {!p.visible && <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>Oculto</span>}
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
          {p.price} €{p.category ? ` · ${p.category}` : ''} · {soldout ? <span style={{ color: 'var(--danger)' }}>Agotado</span> : total > 0 ? `${inStock}/${total} sabores` : 'sin sabores'}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => onToggleVisible(p)} className="p-2 rounded-lg cursor-pointer" style={{ background: 'var(--surface)', color: p.visible ? 'var(--success)' : 'var(--muted)' }} title={p.visible ? 'Ocultar' : 'Mostrar'}>
          {p.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button onClick={() => onEdit(p)} className="p-2 rounded-lg cursor-pointer" style={{ background: 'var(--surface)', color: 'var(--accent)' }}><Pencil size={14} /></button>
        <button onClick={() => onDelete(p.id)} className="p-2 rounded-lg cursor-pointer" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}><Trash2 size={14} /></button>
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-12">
      <Search size={32} className="mx-auto mb-2" style={{ color: 'var(--muted)' }} />
      <p className="text-sm" style={{ color: 'var(--muted)' }}>{text}</p>
    </div>
  )
}
