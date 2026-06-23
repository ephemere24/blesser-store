'use client'

import { useState, useEffect, useCallback, useRef, DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Eye, EyeOff, LogOut, Users, Package, Upload, GripVertical, X, ImageIcon, CalendarDays, Clock } from 'lucide-react'
import AgendaTab from './AgendaTab'
import HorarioTab from './HorarioTab'

interface Flavor { id?: number; name: string; inStock: boolean; stock: number }
interface Product {
  id: number; name: string; price: number; description: string
  specs: string; category: string; visible: boolean; position: number
  images: string; flavors: Flavor[]
}
interface AccessCode { id: number; code: string; clientName: string | null; phone?: string | null; active: boolean }

const emptyProduct = {
  name: '', price: 0, description: '', specs: '', category: '',
  visible: true, position: 0, images: '[]', flavors: [] as Flavor[]
}

function ImageManager({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        if (res.ok) {
          const { url } = await res.json()
          urls.push(url)
        } else {
          const err = await res.json().catch(() => ({}))
          alert(`Error subiendo ${file.name}: ${err.error || res.status}`)
        }
      } catch (e) {
        alert(`Error de red subiendo ${file.name}: ${e}`)
      }
    }
    onChange([...images, ...urls])
    setUploading(false)
  }

  async function removeImage(idx: number) {
    const url = images[idx]
    await fetch('/api/admin/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    onChange(images.filter((_, i) => i !== idx))
  }

  function onDragStart(e: DragEvent, idx: number) {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: DragEvent, idx: number) {
    e.preventDefault()
    setDropIdx(idx)
  }

  function onDrop(e: DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDropIdx(null); return }
    const reordered = [...images]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(idx, 0, moved)
    onChange(reordered)
    setDragIdx(null)
    setDropIdx(null)
  }

  return (
    <div>
      <label className="text-xs font-medium block mb-2" style={{ color: 'var(--muted)' }}>
        FOTOS {images.length > 0 && <span style={{ color: 'var(--accent)' }}>({images.length}) — arrastra para reordenar</span>}
      </label>

      {/* Zona de subida */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
        className="flex items-center justify-center gap-2 rounded-xl cursor-pointer transition-all mb-3 py-4"
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent2)' : 'var(--border)'}`,
          background: dragOver ? 'rgba(255,255,255,0.03)' : 'var(--surface2)',
          color: 'var(--muted)',
        }}>
        {uploading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Upload size={16} />
            <span className="text-sm">Subir fotos</span>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" multiple hidden
               onChange={e => uploadFiles(e.target.files)} />
      </div>

      {/* Grid de imágenes */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={img} draggable
              onDragStart={e => onDragStart(e, i)}
              onDragOver={e => onDragOver(e, i)}
              onDrop={e => onDrop(e, i)}
              onDragEnd={() => { setDragIdx(null); setDropIdx(null) }}
              className="relative rounded-xl overflow-hidden aspect-square group"
              style={{
                border: `2px solid ${dropIdx === i && dragIdx !== i ? 'var(--accent2)' : i === 0 ? 'rgba(255,255,255,0.2)' : 'var(--border)'}`,
                opacity: dragIdx === i ? 0.4 : 1,
                cursor: 'grab',
              }}>
              <img src={img} alt="" className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1 left-1 text-xs px-1.5 py-0.5 rounded-lg font-bold"
                      style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
                  Portada
                </span>
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                   style={{ background: 'rgba(0,0,0,0.5)' }}>
                <GripVertical size={20} style={{ color: 'white' }} />
              </div>
              <button onClick={() => removeImage(i)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                style={{ background: 'rgba(239,68,68,0.9)', color: 'white' }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div className="flex items-center gap-2 text-xs py-2" style={{ color: 'var(--muted)' }}>
          <ImageIcon size={14} /> Sin fotos — la primera imagen será la portada del catálogo
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [tab, setTab] = useState<'agenda' | 'products' | 'codes' | 'horario'>('agenda')
  const [products, setProducts] = useState<Product[]>([])
  const [codes, setCodes] = useState<AccessCode[]>([])
  const [modal, setModal] = useState<{ open: boolean; product: typeof emptyProduct & { id?: number } }>({
    open: false, product: { ...emptyProduct }
  })
  const [flavorInput, setFlavorInput] = useState('')
  const [newCode, setNewCode] = useState({ code: '', clientName: '' })
  const [saving, setSaving] = useState(false)

  const loadProducts = useCallback(async () => {
    const r = await fetch('/api/admin/products')
    if (r.ok) setProducts(await r.json())
  }, [])

  const loadCodes = useCallback(async () => {
    const r = await fetch('/api/admin/codes')
    if (r.ok) setCodes(await r.json())
  }, [])

  useEffect(() => {
    if (authed) { loadProducts(); loadCodes() }
  }, [authed, loadProducts, loadCodes])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/auth/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { setAuthed(true) }
    else { setAuthError('Contraseña incorrecta') }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  async function saveProduct() {
    setSaving(true)
    const { id, ...data } = modal.product
    const method = id ? 'PUT' : 'POST'
    const url = id ? `/api/admin/products/${id}` : '/api/admin/products'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, price: Number(data.price), position: Number(data.position) }),
    })
    if (res.ok) { await loadProducts(); setModal({ open: false, product: { ...emptyProduct } }) }
    setSaving(false)
  }

  async function deleteProduct(id: number) {
    if (!confirm('¿Eliminar este producto?')) return
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' })
    await loadProducts()
  }

  async function toggleVisible(p: Product) {
    await fetch(`/api/admin/products/${p.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: !p.visible }),
    })
    await loadProducts()
  }

  async function addCode(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin/codes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCode),
    })
    if (res.ok) { setNewCode({ code: '', clientName: '' }); await loadCodes() }
  }

  async function toggleCode(id: number, active: boolean) {
    await fetch('/api/admin/codes', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: !active }),
    })
    await loadCodes()
  }

  async function deleteCode(id: number) {
    if (!confirm('¿Eliminar este código?')) return
    const res = await fetch('/api/admin/codes', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(`No se pudo eliminar el código: ${err.error || res.status}`)
      return
    }
    await loadCodes()
  }

  function addFlavor() {
    if (!flavorInput.trim()) return
    setModal(m => ({
      ...m,
      product: { ...m.product, flavors: [...m.product.flavors, { name: flavorInput.trim(), inStock: true, stock: 0 }] }
    }))
    setFlavorInput('')
  }

  function setFlavorStock(idx: number, stock: number) {
    const safe = Math.max(0, Math.floor(stock || 0))
    setModal(m => ({
      ...m,
      product: {
        ...m.product,
        flavors: m.product.flavors.map((f, i) => i === idx ? { ...f, stock: safe, inStock: safe > 0 } : f)
      }
    }))
  }

  function removeFlavor(idx: number) {
    setModal(m => ({
      ...m,
      product: { ...m.product, flavors: m.product.flavors.filter((_, i) => i !== idx) }
    }))
  }

  // Pantalla de login admin
  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
               style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <span className="text-2xl font-black" style={{ color: 'var(--accent2)' }}>BS</span>
          </div>
        </div>
        <h1 className="text-center text-xl font-bold mb-1" style={{ color: 'var(--accent2)' }}>Panel Admin</h1>
        <p className="text-center text-sm mb-6" style={{ color: 'var(--muted)' }}>Blesser Store</p>
        <form onSubmit={login} className="space-y-4">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full px-4 py-3 rounded-xl text-center outline-none"
            style={{ background: 'var(--surface2)', border: `1px solid ${authError ? 'var(--danger)' : 'var(--border)'}`, color: 'var(--accent2)' }} />
          {authError && <p className="text-center text-sm" style={{ color: 'var(--danger)' }}>{authError}</p>}
          <button type="submit"
            className="w-full py-3 rounded-xl font-semibold cursor-pointer"
            style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
            Entrar
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between"
              style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <span className="text-xs font-black" style={{ color: 'var(--accent2)' }}>BS</span>
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--accent2)' }}>Admin Panel</span>
        </div>
        <button onClick={logout} className="flex items-center gap-2 text-sm cursor-pointer px-3 py-1.5 rounded-xl"
                style={{ color: 'var(--muted)', background: 'var(--surface2)' }}>
          <LogOut size={14} /> Salir
        </button>
      </header>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {[
            { key: 'agenda', label: 'Agenda', icon: CalendarDays },
            { key: 'products', label: 'Productos', icon: Package },
            { key: 'codes', label: 'Códigos', icon: Users },
            { key: 'horario', label: 'Horario', icon: Clock },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key as 'agenda' | 'products' | 'codes' | 'horario')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer shrink-0"
              style={{
                background: tab === key ? 'var(--accent2)' : 'var(--surface2)',
                color: tab === key ? 'var(--bg)' : 'var(--muted)',
                border: '1px solid var(--border)',
              }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* AGENDA */}
        {tab === 'agenda' && <AgendaTab />}

        {/* HORARIO */}
        {tab === 'horario' && <HorarioTab />}

        {/* PRODUCTOS */}
        {tab === 'products' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold" style={{ color: 'var(--accent2)' }}>
                Catálogo ({products.length})
              </h2>
              <button
                onClick={() => setModal({ open: true, product: { ...emptyProduct } })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                <Plus size={14} /> Añadir
              </button>
            </div>

            <div className="space-y-3">
              {products.map(p => (
                <div key={p.id} className="rounded-2xl p-4 flex items-center gap-4"
                     style={{ background: 'var(--surface)', border: `1px solid ${p.visible ? 'var(--border)' : 'rgba(255,255,255,0.05)'}`, opacity: p.visible ? 1 : 0.5 }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--accent2)' }}>{p.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {p.price} € · {p.flavors.length} sabores · pos. {p.position}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleVisible(p)}
                      className="p-2 rounded-xl cursor-pointer transition-all"
                      style={{ background: 'var(--surface2)', color: p.visible ? 'var(--success)' : 'var(--muted)' }}
                      title={p.visible ? 'Ocultar' : 'Mostrar'}>
                      {p.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      onClick={() => setModal({ open: true, product: { ...p } })}
                      className="p-2 rounded-xl cursor-pointer"
                      style={{ background: 'var(--surface2)', color: 'var(--accent)' }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteProduct(p.id)}
                      className="p-2 rounded-xl cursor-pointer"
                      style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CÓDIGOS */}
        {tab === 'codes' && (
          <div>
            <h2 className="font-bold mb-4" style={{ color: 'var(--accent2)' }}>Códigos de acceso</h2>
            <form onSubmit={addCode} className="flex gap-2 mb-6">
              <input value={newCode.code} onChange={e => setNewCode(n => ({ ...n, code: e.target.value.toUpperCase() }))}
                placeholder="CÓDIGO" required
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none font-mono"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />
              <input value={newCode.clientName} onChange={e => setNewCode(n => ({ ...n, clientName: e.target.value }))}
                placeholder="Cliente (opcional)"
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent)' }} />
              <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                <Plus size={14} />
              </button>
            </form>

            <div className="space-y-2">
              {codes.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl"
                     style={{ background: 'var(--surface)', border: '1px solid var(--border)', opacity: c.active ? 1 : 0.5 }}>
                  <code className="text-sm font-mono font-bold flex-1"
                        style={{ color: c.active ? 'var(--accent2)' : 'var(--muted)' }}>
                    {c.code}
                  </code>
                  <span className="text-xs flex-1" style={{ color: 'var(--muted)' }}>
                    {c.clientName || '—'}{c.phone ? ` · ${c.phone}` : ''}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-lg"
                        style={{ background: c.active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                 color: c.active ? 'var(--success)' : 'var(--danger)' }}>
                    {c.active ? 'Activo' : 'Inactivo'}
                  </span>
                  <button onClick={() => toggleCode(c.id, c.active)}
                    className="text-xs px-2 py-1 rounded-lg cursor-pointer"
                    style={{ background: 'var(--surface2)', color: 'var(--accent)' }}>
                    {c.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => deleteCode(c.id)}
                    className="p-1.5 rounded-lg cursor-pointer"
                    style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal producto */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="font-bold text-lg" style={{ color: 'var(--accent2)' }}>
              {modal.product.id ? 'Editar producto' : 'Nuevo producto'}
            </h3>

            {[
              { label: 'Nombre', key: 'name', type: 'text' },
              { label: 'Precio (€)', key: 'price', type: 'number' },
              { label: 'Categoría', key: 'category', type: 'text' },
              { label: 'Especificaciones', key: 'specs', type: 'text' },
              { label: 'Posición (orden)', key: 'position', type: 'number' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted)' }}>{label}</label>
                <input type={type}
                  value={(modal.product as Record<string, unknown>)[key] as string}
                  onChange={e => setModal(m => ({ ...m, product: { ...m.product, [key]: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />
              </div>
            ))}

            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted)' }}>Descripción</label>
              <textarea rows={3}
                value={modal.product.description}
                onChange={e => setModal(m => ({ ...m, product: { ...m.product, description: e.target.value } }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="visible" checked={modal.product.visible}
                onChange={e => setModal(m => ({ ...m, product: { ...m.product, visible: e.target.checked } }))} />
              <label htmlFor="visible" className="text-sm cursor-pointer" style={{ color: 'var(--accent)' }}>
                Visible en la tienda
              </label>
            </div>

            {/* Imágenes */}
            <ImageManager
              images={JSON.parse(modal.product.images || '[]')}
              onChange={imgs => setModal(m => ({ ...m, product: { ...m.product, images: JSON.stringify(imgs) } }))}
            />

            {/* Sabores */}
            <div>
              <label className="text-xs font-medium block mb-2" style={{ color: 'var(--muted)' }}>SABORES</label>
              <div className="flex gap-2 mb-3">
                <input value={flavorInput} onChange={e => setFlavorInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFlavor())}
                  placeholder="Nombre del sabor"
                  className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />
                <button onClick={addFlavor} className="px-3 py-2 rounded-xl cursor-pointer"
                        style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                  <Plus size={14} />
                </button>
              </div>
              <div className="space-y-1.5">
                {modal.product.flavors.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                       style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <span className="flex-1 text-sm" style={{ color: 'var(--accent2)' }}>{f.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-lg font-medium"
                          style={{ background: f.stock > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                   color: f.stock > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {f.stock > 0 ? 'En stock' : 'Agotado'}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>uds</span>
                      <input
                        type="number" min={0} value={f.stock}
                        onChange={e => setFlavorStock(i, Number(e.target.value))}
                        className="w-16 px-2 py-1 rounded-lg text-sm text-center outline-none"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />
                    </div>
                    <button onClick={() => removeFlavor(i)} style={{ color: 'var(--danger)' }} className="cursor-pointer">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal({ open: false, product: { ...emptyProduct } })}
                className="flex-1 py-2.5 rounded-xl text-sm cursor-pointer"
                style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                Cancelar
              </button>
              <button onClick={saveProduct} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
