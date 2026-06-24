'use client'

// Barras verticales agrupadas (ingresos + beneficio) por periodo, con rejilla y etiquetas.
export function EvolutionChart({ data }: { data: { month: string; revenue: number; profit: number }[] }) {
  if (data.length === 0) return <ChartEmpty />
  const max = Math.max(1, ...data.map(d => Math.max(d.revenue, d.profit)))
  const H = 170
  const padT = 18
  const padB = 26
  const W = Math.max(320, data.length * 70)
  const padX = 8
  const bw = (W - padX * 2) / data.length
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB)
  const labelMonth = (m: string) => {
    const [yy, mm] = m.split('-')
    return new Date(Number(yy), Number(mm) - 1, 1).toLocaleDateString('es-ES', { month: 'short' })
  }
  const grid = [0, 0.5, 1]
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ minWidth: '100%' }}>
        {/* rejilla */}
        {grid.map((g, i) => (
          <line key={i} x1={0} x2={W} y1={y(max * g)} y2={y(max * g)} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
        ))}
        {data.map((d, i) => {
          const x = padX + i * bw
          const w = bw * 0.30
          const gap = bw * 0.10
          const baseY = y(0)
          return (
            <g key={d.month}>
              <rect x={x + bw / 2 - w - gap / 2} y={y(d.revenue)} width={w} height={baseY - y(d.revenue)} rx={4} fill="var(--accent2)">
                <title>{`${labelMonth(d.month)}: ${d.revenue.toFixed(2)} €`}</title>
              </rect>
              <rect x={x + bw / 2 + gap / 2} y={y(Math.max(0, d.profit))} width={w} height={baseY - y(Math.max(0, d.profit))} rx={4} fill="#22c55e" opacity={0.9}>
                <title>{`Beneficio: ${d.profit.toFixed(2)} €`}</title>
              </rect>
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)" className="capitalize">{labelMonth(d.month)}</text>
            </g>
          )
        })}
      </svg>
      <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--muted)' }}>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'var(--accent2)' }} /> Ingresos</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#22c55e' }} /> Beneficio</span>
      </div>
    </div>
  )
}

// Barras horizontales para rankings (productos, clientes…) con número de posición.
export function HBars({ items, color = 'var(--accent2)', unit = '€' }: {
  items: { label: string; value: number; sub?: string }[]
  color?: string
  unit?: string
}) {
  if (items.length === 0) return <ChartEmpty />
  const max = Math.max(1, ...items.map(i => i.value))
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-5 text-xs font-bold text-center shrink-0" style={{ color: 'var(--muted)' }}>{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="truncate pr-2" style={{ color: 'var(--accent)' }}>{it.label}{it.sub ? <span style={{ color: 'var(--muted)' }}> · {it.sub}</span> : null}</span>
              <span className="font-semibold shrink-0 tabular-nums" style={{ color: 'var(--accent2)' }}>{unit === '€' ? `${it.value.toFixed(2)} €` : `${it.value}${unit}`}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: color }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ChartEmpty() {
  return <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Sin datos en este periodo.</p>
}
