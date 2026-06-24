'use client'

const eur = (n: number) => `${n.toFixed(0)}€`

// Barras verticales agrupadas (ingresos + beneficio) por periodo.
export function EvolutionChart({ data }: { data: { month: string; revenue: number; profit: number }[] }) {
  if (data.length === 0) return <Empty />
  const max = Math.max(1, ...data.map(d => Math.max(d.revenue, d.profit)))
  const W = Math.max(320, data.length * 64)
  const H = 180
  const pad = 24
  const bw = (W - pad * 2) / data.length
  const labelMonth = (m: string) => {
    const [y, mm] = m.split('-')
    return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString('es-ES', { month: 'short' })
  }
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H + 24} viewBox={`0 0 ${W} ${H + 24}`}>
        {data.map((d, i) => {
          const x = pad + i * bw
          const rh = (d.revenue / max) * H
          const ph = (Math.max(0, d.profit) / max) * H
          const w = bw * 0.34
          return (
            <g key={d.month}>
              <rect x={x + bw * 0.16} y={H - rh} width={w} height={rh} rx={3} fill="var(--accent2)" opacity={0.85} />
              <rect x={x + bw * 0.5} y={H - ph} width={w} height={ph} rx={3} fill="#22c55e" opacity={0.85} />
              <text x={x + bw / 2} y={H + 16} textAnchor="middle" fontSize="10" fill="var(--muted)">{labelMonth(d.month)}</text>
            </g>
          )
        })}
      </svg>
      <div className="flex gap-4 mt-1 text-xs" style={{ color: 'var(--muted)' }}>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: 'var(--accent2)' }} /> Ingresos</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: '#22c55e' }} /> Beneficio</span>
      </div>
    </div>
  )
}

// Barras horizontales para rankings (productos, clientes…).
export function HBars({ items, color = 'var(--accent2)', unit = '€' }: {
  items: { label: string; value: number; sub?: string }[]
  color?: string
  unit?: string
}) {
  if (items.length === 0) return <Empty />
  const max = Math.max(1, ...items.map(i => i.value))
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="truncate pr-2" style={{ color: 'var(--accent)' }}>{it.label}{it.sub ? <span style={{ color: 'var(--muted)' }}> · {it.sub}</span> : null}</span>
            <span className="font-semibold shrink-0" style={{ color: 'var(--accent2)' }}>{unit === '€' ? `${it.value.toFixed(2)} €` : `${it.value}${unit}`}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Empty() {
  return <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>Sin datos en este periodo.</p>
}

export { eur as eurInt }
