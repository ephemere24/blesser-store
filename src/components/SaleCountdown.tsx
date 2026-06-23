'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return { d, h, m, s }
}
const pad = (n: number) => n.toString().padStart(2, '0')

/** Cuenta atrás de una oferta. Llama a onExpire cuando llega a cero. */
export default function SaleCountdown({ endsAt, onExpire, size = 'sm' }: { endsAt: string | Date; onExpire?: () => void; size?: 'sm' | 'md' }) {
  const end = new Date(endsAt).getTime()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (end <= Date.now()) { onExpire?.(); return }
    const t = setInterval(() => {
      const n = Date.now()
      setNow(n)
      if (n >= end) { clearInterval(t); onExpire?.() }
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end])

  const remaining = end - now
  if (remaining <= 0) return null
  const { d, h, m, s } = parts(remaining)
  const label = d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg font-bold tabular-nums ${size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'}`}
      style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)' }}
    >
      <Clock size={size === 'md' ? 14 : 12} />
      {label}
    </span>
  )
}
