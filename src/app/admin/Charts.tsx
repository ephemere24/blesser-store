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

// Barras diarias de ingresos (para el Resumen de un mes). Etiqueta cada ~5 días.
export function DailyBars({ data }: { data: { date: string; revenue: number }[] }) {
  if (data.length === 0 || data.every(d => d.revenue === 0)) return <ChartEmpty />
  const max = Math.max(1, ...data.map(d => d.revenue))
  const H = 150, padT = 14, padB = 22, padX = 6
  const W = Math.max(320, data.length * 14)
  const bw = (W - padX * 2) / data.length
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB)
  const baseY = y(0)
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ minWidth: '100%' }}>
        <line x1={0} x2={W} y1={baseY} y2={baseY} stroke="var(--border)" strokeWidth={1} opacity={0.6} />
        {data.map((d, i) => {
          const x = padX + i * bw
          const day = Number(d.date.slice(8, 10))
          return (
            <g key={d.date}>
              <rect x={x + bw * 0.18} y={y(d.revenue)} width={bw * 0.64} height={Math.max(0, baseY - y(d.revenue))} rx={2} fill="var(--accent2)">
                <title>{`${d.date}: ${d.revenue.toFixed(2)} €`}</title>
              </rect>
              {(day === 1 || day % 5 === 0) && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted)">{day}</text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Curva suave estilo "gráfica de bolsa": evolución acumulada en el mes.
// Línea verde/roja según termine por encima o por debajo de 0, relleno degradado,
// base punteada en 0 y etiquetas de valor a la derecha + días abajo.
export function StockLine({ data, fmt = (v: number) => v.toFixed(0), height = 210 }: {
  data: { label: string; value: number }[]
  fmt?: (v: number) => string
  height?: number
}) {
  if (data.length < 2) return <ChartEmpty />
  const W = 720, H = height
  const padT = 16, padB = 24, padL = 6, padR = 52
  const plotW = W - padL - padR
  const n = data.length
  const values = data.map(d => d.value)
  let lo = Math.min(0, ...values), hi = Math.max(0, ...values)
  if (lo === hi) { hi += 1; lo -= 1 }
  const padV = (hi - lo) * 0.1
  lo -= padV; hi += padV
  const x = (i: number) => padL + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1))
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB)
  const pts: [number, number][] = data.map((d, i) => [x(i), y(d.value)])

  // Curva suave (Catmull-Rom → Bézier)
  let line = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    line += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  const baseY = H - padB
  const area = `${line} L ${pts[n - 1][0].toFixed(1)} ${baseY} L ${pts[0][0].toFixed(1)} ${baseY} Z`

  const last = values[n - 1]
  const up = last >= 0
  const color = up ? '#22c55e' : '#ef4444'
  const gid = `sg-${up ? 'up' : 'dn'}`
  const zeroY = lo < 0 && hi > 0 ? y(0) : baseY
  const yLabels = [hi - padV, (hi + lo) / 2, lo + padV]

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', height: 'auto' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* etiquetas de valor a la derecha */}
      {yLabels.map((v, i) => (
        <text key={i} x={W - padR + 8} y={y(v) + 4} fontSize="12" fill="var(--muted)">{fmt(v)}</text>
      ))}
      {/* base en 0 punteada */}
      <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke="var(--muted)" strokeWidth={1} strokeDasharray="2 4" opacity={0.5} />
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pts[n - 1][0]} cy={pts[n - 1][1]} r={3.5} fill={color} />
      {/* etiquetas del eje X: ~6 repartidas */}
      {(() => {
        const ticks = Math.min(6, n)
        const seen = new Set<number>()
        return Array.from({ length: ticks }, (_, t) => (ticks <= 1 ? 0 : Math.round((t * (n - 1)) / (ticks - 1))))
          .filter(i => !seen.has(i) && (seen.add(i), true))
          .map(i => (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--muted)">{data[i].label}</text>
          ))
      })()}
    </svg>
  )
}

// Mini-gráfico de línea (evolución de la posición neta de un producto, "como una acción").
export function Sparkline({ values, width = 96, height = 30 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} />
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const stepX = width / (values.length - 1)
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4)
  const pts = values.map((v, i) => `${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = values[values.length - 1]
  const color = last >= 0 ? '#22c55e' : '#ef4444'
  // Línea base en cero si el rango lo cruza
  const zeroY = min < 0 && max > 0 ? y(0) : null
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {zeroY != null && <line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 2" />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(values.length - 1) * stepX} cy={y(last)} r={2} fill={color} />
    </svg>
  )
}

function ChartEmpty() {
  return <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Sin datos en este periodo.</p>
}
