'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })

    if (res.ok) {
      router.push('/store')
    } else {
      const data = await res.json()
      setError(data.error || 'Código incorrecto')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
               style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <span className="text-3xl font-black tracking-tighter"
                  style={{ color: 'var(--accent2)' }}>BS</span>
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold mb-1" style={{ color: 'var(--accent2)' }}>
          Blesser Store
        </h1>
        <p className="text-center text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Introduce tu código de acceso
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
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

        <p className="text-center text-xs mt-8" style={{ color: 'var(--muted)' }}>
          Venta exclusiva para mayores de 18 años
        </p>
      </div>
    </div>
  )
}
