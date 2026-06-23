'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { getTimeSlots, dateToValue } from '@/lib/pickup'

interface Closure { id: number; date: string; time: string | null }

const DOW = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7 // lun=0 .. dom=6
  x.setDate(x.getDate() - dow)
  return x
}

export default function HorarioTab() {
  const [closures, setClosures] = useState<Closure[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [selDay, setSelDay] = useState<string | null>(null)
  const [localClosed, setLocalClosed] = useState<Set<string>>(new Set())

  const dragging = useRef(false)
  const dragAction = useRef<'close' | 'open'>('close')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/closures')
    if (res.ok) setClosures(await res.json())
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // Fin de arrastre global
  useEffect(() => {
    const up = () => { if (dragging.current) { dragging.current = false; persist() } }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selDay, closures, localClosed])

  const todayMonday = mondayOf(new Date())
  const today = dateToValue(new Date())

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i)
    return { date: dateToValue(d), dow: DOW[i], num: d.getDate(), isSunday: i === 6, isPast: dateToValue(d) < today }
  })

  function dayState(date: string, isSunday: boolean) {
    if (isSunday) return 'sunday'
    if (closures.some(c => c.date === date && !c.time)) return 'full'
    if (closures.some(c => c.date === date && c.time)) return 'partial'
    return 'open'
  }
  function isWholeDayClosed(date: string) { return closures.some(c => c.date === date && !c.time) }
  function closureId(date: string, time: string | null) { return closures.find(c => c.date === date && c.time === time)?.id }

  function selectDay(date: string) {
    setSelDay(date)
    setLocalClosed(new Set(closures.filter(c => c.date === date && c.time).map(c => c.time as string)))
  }

  async function persist() {
    if (!selDay) return
    const server = new Set(closures.filter(c => c.date === selDay && c.time).map(c => c.time as string))
    const toAdd = [...localClosed].filter(t => !server.has(t))
    const toRemove = [...server].filter(t => !localClosed.has(t))
    for (const t of toAdd) {
      await fetch('/api/admin/closures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selDay, time: t }) })
    }
    for (const t of toRemove) {
      const id = closureId(selDay, t)
      if (id) await fetch('/api/admin/closures', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    }
    if (toAdd.length || toRemove.length) load()
  }

  function applyCell(time: string) {
    setLocalClosed(prev => {
      const next = new Set(prev)
      if (dragAction.current === 'close') next.add(time)
      else next.delete(time)
      return next
    })
  }
  function onCellDown(time: string) {
    dragAction.current = localClosed.has(time) ? 'open' : 'close'
    dragging.current = true
    applyCell(time)
  }
  function onGridMove(e: React.PointerEvent) {
    if (!dragging.current) return
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const t = el?.dataset?.time
    if (t) applyCell(t)
  }

  async function toggleWholeDay(date: string) {
    if (isWholeDayClosed(date)) {
      const id = closureId(date, null); if (id) await fetch('/api/admin/closures', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    } else {
      await fetch('/api/admin/closures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, time: null }) })
    }
    await load()
    if (selDay === date) setLocalClosed(new Set())
  }

  if (loading) return <p className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>Cargando...</p>

  const wkEnd = new Date(weekStart); wkEnd.setDate(wkEnd.getDate() + 6)
  const weekLabel = `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]} – ${wkEnd.getDate()} ${MONTHS[wkEnd.getMonth()]}`
  const canPrev = weekStart > todayMonday
  const slots = selDay ? getTimeSlots(selDay, new Date(), []) : []
  const selWholeClosed = selDay ? isWholeDayClosed(selDay) : false

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold mb-1" style={{ color: 'var(--accent2)' }}>Horario de recogida</h2>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Cierra días o franjas para que no se puedan reservar. Toca un día para ver sus horas.</p>
      </div>

      {/* Navegación de semana */}
      <div className="flex items-center justify-between">
        <button onClick={() => { if (canPrev) { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); setSelDay(null) } }}
          disabled={!canPrev} className="p-2 rounded-xl cursor-pointer disabled:opacity-30"
          style={{ background: 'var(--surface2)', color: 'var(--accent2)' }}><ChevronLeft size={18} /></button>
        <span className="text-sm font-semibold" style={{ color: 'var(--accent2)' }}>{weekLabel}</span>
        <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); setSelDay(null) }}
          className="p-2 rounded-xl cursor-pointer" style={{ background: 'var(--surface2)', color: 'var(--accent2)' }}><ChevronRight size={18} /></button>
      </div>

      {/* Semana */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(d => {
          const state = dayState(d.date, d.isSunday)
          const disabled = d.isSunday || d.isPast
          const sel = selDay === d.date
          const bg = sel ? 'var(--accent2)'
            : state === 'full' ? 'rgba(239,68,68,0.18)'
            : state === 'partial' ? 'rgba(245,158,11,0.18)'
            : 'var(--surface2)'
          const fg = sel ? 'var(--bg)'
            : state === 'full' ? 'var(--danger)'
            : state === 'partial' ? '#f59e0b'
            : disabled ? 'var(--muted)' : 'var(--accent)'
          return (
            <button key={d.date} disabled={disabled} onClick={() => selectDay(d.date)}
              className="rounded-xl py-2 flex flex-col items-center cursor-pointer disabled:cursor-not-allowed"
              style={{ background: bg, color: fg, border: `1px solid ${sel ? 'var(--accent2)' : 'var(--border)'}`, opacity: disabled ? 0.45 : 1 }}>
              <span className="text-[10px] uppercase">{d.dow}</span>
              <span className="text-base font-bold leading-tight">{d.num}</span>
              <span className="text-[9px] leading-none mt-0.5">
                {d.isSunday ? 'cerr.' : state === 'full' ? 'cerr.' : state === 'partial' ? 'parc.' : ''}
              </span>
            </button>
          )
        })}
      </div>

      {/* Submenú de franjas del día seleccionado */}
      {selDay && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <button type="button" onClick={() => toggleWholeDay(selDay)} className="flex items-center gap-2 cursor-pointer select-none w-full">
            <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: selWholeClosed ? 'var(--danger)' : 'transparent', border: `2px solid ${selWholeClosed ? 'var(--danger)' : 'var(--muted)'}` }}>
              {selWholeClosed && <Check size={13} strokeWidth={3} style={{ color: 'var(--bg)' }} />}
            </span>
            <span className="text-sm font-medium" style={{ color: selWholeClosed ? 'var(--danger)' : 'var(--accent2)' }}>Cerrar todo el día</span>
          </button>

          {!selWholeClosed && (
            <>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Toca una hora para cerrarla, o mantén pulsado y arrastra para marcar varias.</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5" style={{ touchAction: 'none' }} onPointerMove={onGridMove}>
                {slots.map(t => {
                  const closed = localClosed.has(t)
                  return (
                    <div key={t} data-time={t}
                      onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); onCellDown(t) }}
                      className="px-1 py-2.5 rounded-lg text-xs font-medium text-center cursor-pointer select-none"
                      style={{
                        background: closed ? 'rgba(239,68,68,0.18)' : 'var(--surface2)',
                        color: closed ? 'var(--danger)' : 'var(--accent)',
                        border: `1px solid ${closed ? 'var(--danger)' : 'var(--border)'}`,
                        textDecoration: closed ? 'line-through' : 'none',
                      }}>
                      {t}
                    </div>
                  )
                })}
              </div>
              {slots.length === 0 && <p className="text-xs" style={{ color: 'var(--muted)' }}>No quedan horas en este día.</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
