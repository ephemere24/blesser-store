'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { gsap } from 'gsap'

export default function LoginPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const containerRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const footerRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
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
  }, [])

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
      gsap.to(containerRef.current, { opacity: 0, y: -20, duration: 0.4, ease: 'power2.in', onComplete: () => router.push('/store') })
    } else {
      const data = await res.json()
      setError(data.error || 'Código incorrecto')
      gsap.fromTo(formRef.current, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' })
      setLoading(false)
    }
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

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all disabled:opacity-40 cursor-pointer"
            style={{ background: 'var(--accent2)', color: 'var(--bg)' }}
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>

        <p ref={footerRef} className="text-center text-xs mt-8" style={{ color: 'var(--muted)' }}>
          Venta exclusiva para mayores de 18 años
        </p>
      </div>
    </div>
  )
}
