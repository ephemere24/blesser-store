'use client'

import { useState, useEffect, useCallback, useRef, DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, LogOut, Users, Package, Upload, GripVertical, X, ImageIcon, CalendarDays, Clock, Check, BarChart3 } from 'lucide-react'
import AgendaTab from './AgendaTab'
import HorarioTab from './HorarioTab'
import FacturacionTab from './FacturacionTab'
import ProductsTab from './ProductsTab'

interface Flavor { id?: number; name: string; inStock: boolean; stock: number }
interface Product {
  id: number; name: string; price: number; description: string
  specs: string; category: string; visible: boolean; position: number
  images: string; flavors: Flavor[]; onSale: boolean; salePrice: number | null; saleEndsAt: string | null; saleUnits: number | null
}
interface AccessCode { id: number; code: string; clientName: string | null; phone?: string | null; active: boolean }

const emptyProduct = {
  name: '', price: 0, description: '', specs: '', category: '',
  visible: true, position: 0, images: '[]', flavors: [] as Flavor[],
  onSale: false, salePrice: null as number | null, saleEndsAt: null as string | null, saleUnits: null as number | null,
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
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [rememberAdmin, setRememberAdmin] = useState(true)
  const [tab, setTab] = useState<'agenda' | 'products' | 'codes' | 'horario' | 'facturacion'>('agenda')
  const [products, setProducts] = useState<Product[]>([])
  const [codes, setCodes] = useState<AccessCode[]>([])
  const [modal, setModal] = useState<{ open: boolean; product: typeof emptyProduct & { id?: number } }>({
    open: false, product: { ...emptyProduct }
  })
  const [flavorInput, setFlavorInput] = useState('')
  const [saleDur, setSaleDur] = useState<{ value: number; unit: 'hours' | 'days' }>({ value: 24, unit: 'hours' })
  const [newCode, setNewCode] = useState({ code: '', clientName: '' })
  const [saving, setSaving] = useState(false)
  const [autoAccept, setAutoAccept] = useState(false)
  const [selectedCodes, setSelectedCodes] = useState<number[]>([])

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

  useEffect(() => {
    if (authed) fetch('/api/admin/settings').then(r => r.ok ? r.json() : null).then(d => { if (d) setAutoAccept(d.autoAccept) })
  }, [authed])

  async function toggleAutoAccept() {
    const v = !autoAccept
    setAutoAccept(v)
    await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoAccept: v }) })
  }
  function toggleSelect(id: number) {
    setSelectedCodes(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }
  function toggleSelectAll() {
    setSelectedCodes(s => s.length === codes.length ? [] : codes.map(c => c.id))
  }
  async function bulkSetActive(active: boolean) {
    await fetch('/api/admin/codes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selectedCodes, active }) })
    setSelectedCodes([]); loadCodes()
  }
  async function bulkDelete() {
    if (!confirm(`¿Eliminar ${selectedCodes.length} código(s)?`)) return
    await fetch('/api/admin/codes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selectedCodes }) })
    setSelectedCodes([]); loadCodes()
  }

  // Recuperar sesión de admin si la cookie sigue válida
  useEffect(() => {
    fetch('/api/auth/admin').then(r => { if (r.ok) setAuthed(true) }).finally(() => setCheckingAuth(false))
  }, [])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/auth/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, remember: rememberAdmin }),
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

  // Mientras se comprueba la sesión guardada
  if (checkingAuth) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // Pantalla de login admin
  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
               style={{ border: '1px solid var(--border)' }}>
            <img src="/logo.jpg" alt="Blesser Store" className="w-full h-full object-cover" />
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
          <button type="button" onClick={() => setRememberAdmin(r => !r)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer select-none transition-all"
                  style={{ background: rememberAdmin ? 'rgba(255,255,255,0.06)' : 'var(--surface2)', border: `1px solid ${rememberAdmin ? 'var(--accent2)' : 'var(--border)'}` }}>
            <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: rememberAdmin ? 'var(--accent2)' : 'transparent', border: `2px solid ${rememberAdmin ? 'var(--accent2)' : 'var(--muted)'}` }}>
              {rememberAdmin && <Check size={14} strokeWidth={3} style={{ color: 'var(--bg)' }} />}
            </span>
            <span className="text-sm font-medium" style={{ color: rememberAdmin ? 'var(--accent2)' : 'var(--muted)' }}>Mantener sesión iniciada</span>
          </button>
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
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center"
               style={{ border: '1px solid var(--border)' }}>
            <img src="/logo.jpg" alt="Blesser Store" className="w-full h-full object-cover" />
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
            { key: 'facturacion', label: 'Facturación', icon: BarChart3 },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key as 'agenda' | 'products' | 'codes' | 'horario' | 'facturacion')}
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

        {/* FACTURACIÓN */}
        {tab === 'facturacion' && <FacturacionTab products={products} />}

        {/* PRODUCTOS */}
        {tab === 'products' && (
          <ProductsTab
            products={products}
            onAdd={() => setModal({ open: true, product: { ...emptyProduct } })}
            onEdit={p => setModal({ open: true, product: { ...p } })}
            onToggleVisible={toggleVisible}
            onDelete={deleteProduct}
            onReorder={setProducts}
          />
        )}

        {/* CÓDIGOS */}
        {tab === 'codes' && (
          <div>
            <h2 className="font-bold mb-4" style={{ color: 'var(--accent2)' }}>Códigos de acceso</h2>

            {/* Auto-aceptar */}
            <button type="button" onClick={toggleAutoAccept}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer select-none transition-all mb-4 text-left"
                    style={{ background: autoAccept ? 'rgba(34,197,94,0.1)' : 'var(--surface2)', border: `1px solid ${autoAccept ? 'var(--success)' : 'var(--border)'}` }}>
              <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: autoAccept ? 'var(--success)' : 'transparent', border: `2px solid ${autoAccept ? 'var(--success)' : 'var(--muted)'}` }}>
                {autoAccept && <Check size={13} strokeWidth={3} style={{ color: 'var(--bg)' }} />}
              </span>
              <span className="min-w-0">
                <span className="text-sm font-semibold block" style={{ color: autoAccept ? 'var(--success)' : 'var(--accent2)' }}>Auto-aceptar solicitudes</span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Si está activo, las solicitudes generan el código al instante (sin aprobar en Telegram). Igual recibes un aviso con los datos.</span>
              </span>
            </button>

            {selectedCodes.length > 0 && (
              <div className="flex items-center gap-2 mb-4 p-2 rounded-xl flex-wrap" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <span className="text-sm font-medium px-2" style={{ color: 'var(--accent2)' }}>{selectedCodes.length} seleccionado(s)</span>
                <button onClick={() => bulkSetActive(false)} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer font-medium" style={{ background: 'var(--surface)', color: 'var(--accent)' }}>Desactivar</button>
                <button onClick={() => bulkSetActive(true)} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer font-medium" style={{ background: 'var(--surface)', color: 'var(--accent)' }}>Activar</button>
                <button onClick={bulkDelete} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>Eliminar</button>
                <button onClick={() => setSelectedCodes([])} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer ml-auto" style={{ color: 'var(--muted)' }}>Cancelar</button>
              </div>
            )}

            <form onSubmit={addCode} className="flex gap-2 mb-4">
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

            {codes.length > 0 && (
              <button onClick={toggleSelectAll} className="text-xs mb-2 cursor-pointer" style={{ color: 'var(--accent)' }}>
                {selectedCodes.length === codes.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
            )}

            <div className="space-y-2">
              {codes.map(c => {
                const sel = selectedCodes.includes(c.id)
                return (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl"
                     style={{ background: sel ? 'var(--surface2)' : 'var(--surface)', border: `1px solid ${sel ? 'var(--accent2)' : 'var(--border)'}`, opacity: c.active ? 1 : 0.5 }}>
                  <button onClick={() => toggleSelect(c.id)}
                          className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 cursor-pointer"
                          style={{ background: sel ? 'var(--accent2)' : 'transparent', border: `2px solid ${sel ? 'var(--accent2)' : 'var(--muted)'}` }}>
                    {sel && <Check size={13} strokeWidth={3} style={{ color: 'var(--bg)' }} />}
                  </button>
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
                )
              })}
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

            {/* Liquidación */}
            <div className="rounded-xl p-3" style={{ background: 'var(--surface2)', border: `1px solid ${modal.product.onSale ? 'var(--danger)' : 'var(--border)'}` }}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={modal.product.onSale}
                    onChange={e => setModal(m => ({ ...m, product: { ...m.product, onSale: e.target.checked } }))} />
                  <span className="text-sm font-medium" style={{ color: modal.product.onSale ? 'var(--danger)' : 'var(--accent)' }}>
                    Marcar como liquidación
                  </span>
                </label>
                {modal.product.onSale && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Precio liquidación</span>
                    <input type="number" min={0} step="0.01" inputMode="decimal"
                      value={modal.product.salePrice ?? ''}
                      onChange={e => setModal(m => ({ ...m, product: { ...m.product, salePrice: e.target.value === '' ? null : Number(e.target.value) } }))}
                      placeholder="€"
                      className="w-24 px-2 py-1.5 rounded-lg text-sm text-center outline-none"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />
                  </div>
                )}
              </div>
              {modal.product.onSale && modal.product.salePrice != null && modal.product.salePrice >= modal.product.price && (
                <p className="text-xs mt-2" style={{ color: 'var(--danger)' }}>El precio de liquidación debería ser menor que el normal ({modal.product.price} €).</p>
              )}

              {modal.product.onSale && (() => {
                const temporal = !!modal.product.saleEndsAt
                const applyDur = (value: number, unit: 'hours' | 'days') => {
                  const ms = unit === 'days' ? value * 86400000 : value * 3600000
                  const ends = new Date(Date.now() + ms).toISOString()
                  setModal(m => ({ ...m, product: { ...m.product, saleEndsAt: ends } }))
                }
                return (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={temporal}
                        onChange={e => {
                          if (e.target.checked) applyDur(saleDur.value, saleDur.unit)
                          else setModal(m => ({ ...m, product: { ...m.product, saleEndsAt: null } }))
                        }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>Oferta por tiempo limitado</span>
                    </label>
                    {temporal && (
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>Duración</span>
                        <input type="number" min={1} value={saleDur.value}
                          onChange={e => { const v = Math.max(1, Number(e.target.value) || 1); setSaleDur(s => ({ ...s, value: v })); applyDur(v, saleDur.unit) }}
                          className="w-20 px-2 py-1.5 rounded-lg text-sm text-center outline-none"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />
                        <select value={saleDur.unit}
                          onChange={e => { const u = e.target.value as 'hours' | 'days'; setSaleDur(s => ({ ...s, unit: u })); applyDur(saleDur.value, u) }}
                          className="px-2 py-1.5 rounded-lg text-sm outline-none"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
                          <option value="hours">horas</option>
                          <option value="days">días</option>
                        </select>
                        {modal.product.saleEndsAt && (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            Termina: {new Date(modal.product.saleEndsAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {modal.product.onSale && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={modal.product.saleUnits != null}
                      onChange={e => setModal(m => ({ ...m, product: { ...m.product, saleUnits: e.target.checked ? 10 : null } }))} />
                    <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>Oferta por unidades limitadas</span>
                  </label>
                  {modal.product.saleUnits != null && (
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>Unidades en oferta</span>
                      <input type="number" min={0} value={modal.product.saleUnits}
                        onChange={e => setModal(m => ({ ...m, product: { ...m.product, saleUnits: Math.max(0, Math.floor(Number(e.target.value) || 0)) } }))}
                        className="w-20 px-2 py-1.5 rounded-lg text-sm text-center outline-none"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>restantes (la oferta termina al llegar a 0)</span>
                    </div>
                  )}
                </div>
              )}
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
