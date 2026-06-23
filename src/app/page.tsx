'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { gsap } from 'gsap'
import { Check } from 'lucide-react'

export default function LoginPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(true)
  const [checkingSession, setCheckingSession] = useState(true)
  const [showRequest, setShowRequest] = useState(false)
  const [reqName, setReqName] = useState('')
  const [reqPhone, setReqPhone] = useState('')
  const [reqLoading, setReqLoading] = useState(false)
  const [reqError, setReqError] = useState('')
  const [reqDone, setReqDone] = useState(false)
  const [reqCode, setReqCode] = useState('')
  const router = useRouter()

  const containerRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const footerRef = useRef<HTMLParagraphElement>(null)

  // Si la sesión sigue activa, entrar directo. Si no, autorrellenar el código guardado.
  useEffect(() => {
    let cancelled = false
    fetch('/api/cart').then(r => {
      if (cancelled) return
      if (r.ok) { router.replace('/store'); return }
      const saved = localStorage.getItem('bs_code')
      if (saved) { setCode(saved); setRemember(true) }
      setCheckingSession(false)
    }).catch(() => { if (!cancelled) setCheckingSession(false) })
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    if (checkingSession) return
    const ctx = gsap.context(() => {
      gsap.set([logoRef.current, titleRef.current, subtitleRef.current, formRef.current, footerRef.current], {
        opacity: 0, y: 30,
      })
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.to(logoRef.current, { opacity: 1, y: 0, duration: 0.8 })
        .to(titleRef.current, { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
        .to(subtitleRef.current, { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
        .to(formRef.current, { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
        .to(footerRef.current, { opacity: 1, y: 0, duration: 0.5 }, '-=0.3')
    }, containerRef)
    return () => ctx.revert()
  }, [checkingSession])

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setReqLoading(true)
    setReqError('')
    const res = await fetch('/api/access-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: reqName, phone: reqPhone }),
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      if (data.autoAccepted && data.code) setReqCode(data.code)
      setReqDone(true)
    } else {
      const data = await res.json().catch(() => ({}))
      setReqError(data.error || 'No se pudo enviar la solicitud')
    }
    setReqLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    gsap.to(formRef.current, { scale: 0.98, duration: 0.1, yoyo: true, repeat: 1 })

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })

    if (res.ok) {
      if (remember) localStorage.setItem('bs_code', code.trim())
      else localStorage.removeItem('bs_code')
      gsap.to(containerRef.current, { opacity: 0, y: -20, duration: 0.4, ease: 'power2.in', onComplete: () => router.push('/store') })
    } else {
      const data = await res.json()
      setError(data.error || 'Código incorrecto')
      gsap.fromTo(formRef.current, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' })
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
         style={{ background: 'var(--bg)' }}>
      {/* Fondo animado */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 70%)',
      }} />

      <div className="w-full max-w-sm relative z-10">
        <div ref={logoRef} className="flex justify-center mb-10">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
               style={{ background: 'var(--surface2)', border: '1px solid var(--border)', boxShadow: '0 0 40px rgba(255,255,255,0.05)' }}>
            <span className="text-3xl font-black tracking-tighter" style={{ color: 'var(--accent2)' }}>BS</span>
          </div>
        </div>

        <h1 ref={titleRef} className="text-center text-2xl font-bold mb-1" style={{ color: 'var(--accent2)' }}>
          Blesser Store
        </h1>
        <p ref={subtitleRef} className="text-center text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Introduce tu código de acceso
        </p>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="CÓDIGO DE ACCESO"
            autoFocus
            className="w-full px-4 py-3.5 rounded-xl text-center text-lg font-mono tracking-widest outline-none transition-all"
            style={{
              background: 'var(--surface2)',
              border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
              color: 'var(--accent2)',
            }}
          />

          {error && (
            <p className="text-center text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
          )}

          <button type="button" onClick={() => setRemember(r => !r)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer select-none transition-all"
                  style={{
                    background: remember ? 'rgba(255,255,255,0.06)' : 'var(--surface2)',
                    border: `1px solid ${remember ? 'var(--accent2)' : 'var(--border)'}`,
                  }}>
            <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: remember ? 'var(--accent2)' : 'transparent',
                    border: `2px solid ${remember ? 'var(--accent2)' : 'var(--muted)'}`,
                  }}>
              {remember && <Check size={14} strokeWidth={3} style={{ color: 'var(--bg)' }} />}
            </span>
            <span className="text-sm font-medium" style={{ color: remember ? 'var(--accent2)' : 'var(--muted)' }}>
              Recordar mi código en este dispositivo
            </span>
          </button>

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all disabled:opacity-40 cursor-pointer"
            style={{ background: 'var(--accent2)', color: 'var(--bg)' }}
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>

        <button
          onClick={() => { setShowRequest(true); setReqDone(false); setReqError('') }}
          className="w-full text-center text-sm mt-4 cursor-pointer transition-opacity hover:opacity-80"
          style={{ color: 'var(--muted)', textDecoration: 'underline' }}
        >
          ¿No tienes código? Solicita acceso
        </button>

        <p ref={footerRef} className="text-center text-xs mt-8" style={{ color: 'var(--muted)' }}>
          Venta exclusiva para mayores de 18 años
        </p>
      </div>

      {/* Modal de solicitud de acceso */}
      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
             style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
             onClick={() => setShowRequest(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
               onClick={e => e.stopPropagation()}>
            {reqDone && reqCode ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--accent2)' }}>¡Acceso concedido!</h3>
                <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>Este es tu código de acceso. Guárdalo:</p>
                <div className="text-2xl font-black font-mono tracking-widest py-3 mb-4 rounded-xl"
                     style={{ background: 'var(--surface2)', color: 'var(--accent2)', border: '1px solid var(--border)' }}>
                  {reqCode}
                </div>
                <button onClick={() => { setCode(reqCode); setShowRequest(false) }}
                        className="w-full py-3 rounded-xl font-semibold text-sm cursor-pointer"
                        style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                  Usar este código
                </button>
              </div>
            ) : reqDone ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--accent2)' }}>Solicitud enviada</h3>
                <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                  Hemos recibido tu solicitud. Nos pondremos en contacto contigo para darte tu código de acceso.
                </p>
                <button onClick={() => setShowRequest(false)}
                        className="w-full py-3 rounded-xl font-semibold text-sm cursor-pointer"
                        style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                  Entendido
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--accent2)' }}>Solicitar acceso</h3>
                <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
                  Déjanos tus datos y te contactaremos con tu código.
                </p>
                <form onSubmit={handleRequest} className="space-y-3">
                  <input
                    type="text" value={reqName} onChange={e => setReqName(e.target.value)}
                    placeholder="Tu nombre" autoFocus
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />
                  <input
                    type="tel" value={reqPhone} onChange={e => setReqPhone(e.target.value)}
                    placeholder="Tu teléfono"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--accent2)' }} />

                  {reqError && (
                    <p className="text-center text-sm" style={{ color: 'var(--danger)' }}>{reqError}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setShowRequest(false)}
                            className="flex-1 py-3 rounded-xl text-sm cursor-pointer"
                            style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={reqLoading || !reqName.trim() || !reqPhone.trim()}
                            className="flex-1 py-3 rounded-xl font-semibold text-sm cursor-pointer disabled:opacity-40"
                            style={{ background: 'var(--accent2)', color: 'var(--bg)' }}>
                      {reqLoading ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
