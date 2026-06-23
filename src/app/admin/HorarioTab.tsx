'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { CalendarOff, Clock } from 'lucide-react'
import { getPickupDays, getTimeSlots, formatDayLabel } from '@/lib/pickup'

interface Closure { id: number; date: string; time: string | null }

export default function HorarioTab() {
  const [closures, setClosures] = useState<Closure[]>([])
  const [selDay, setSelDay] = useState('')
  const [loading, setLoading] = useState(true)

  const days = useMemo(() => getPickupDays(new Date(), []), [])

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/closures')
    if (res.ok) setClosures(await res.json())
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  function isDayClosed(date: string) { return closures.some(c => c.date === date && !c.time) }
  function closureId(date: string, time: string | null) { return closures.find(c => c.date === date && c.time === time)?.id }
  function isSlotClosed(date: string, time: string) { return closures.some(c => c.date === date && c.time === time) }

  async function add(date: string, time: string | null) {
    await fetch('/api/admin/closures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, time }) })
    load()
  }
  async function remove(id: number) {
    await fetch('/api/admin/closures', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }
  async function toggleDay(date: string) {
    if (isDayClosed(date)) { const id = closureId(date, null); if (id) remove(id) }
    else add(date, null)
  }
  async function toggleSlot(date: string, time: string) {
    if (isSlotClosed(date, time)) { const id = closureId(date, time); if (id) remove(id) }
    else add(date, time)
  }

  if (loading) return <p className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>Cargando...</p>

  const slots = selDay ? getTimeSlots(selDay, new Date(), []) : []

  return (
    <div className="space-y-6">
      {/* Días cerrados */}
      <div>
        <h2 className="font-bold flex items-center gap-2 mb-1" style={{ color: 'var(--accent2)' }}>
          <CalendarOff size={16} /> Días cerrados
        </h2>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          Toca un día para cerrarlo (vacaciones, festivos…). Los días cerrados no se podrán elegir para recoger. Los domingos ya están cerrados por defecto.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {days.map(d => {
            const closed = isDayClosed(d.value)
            return (
              <button key={d.value} onClick={() => toggleDay(d.value)}
                className="px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer capitalize transition-all"
                style={{
                  background: closed ? 'rgba(239,68,68,0.15)' : 'var(--surface2)',
                  color: closed ? 'var(--danger)' : 'var(--accent)',
                  border: `1px solid ${closed ? 'var(--danger)' : 'var(--border)'}`,
                }}>
                {d.label}{closed ? ' · cerrado' : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* Franjas cerradas */}
      <div>
        <h2 className="font-bold flex items-center gap-2 mb-1" style={{ color: 'var(--accent2)' }}>
          <Clock size={16} /> Franjas cerradas
        </h2>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          Elige un día y cierra horas concretas (ej. una tarde que no puedas atender).
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {days.filter(d => !isDayClosed(d.value)).map(d => (
            <button key={d.value} onClick={() => setSelDay(d.value)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer capitalize"
              style={{
                background: selDay === d.value ? 'var(--accent2)' : 'var(--surface2)',
                color: selDay === d.value ? 'var(--bg)' : 'var(--accent)',
                border: '1px solid var(--border)',
              }}>
              {d.label}
            </button>
          ))}
        </div>
        {selDay && (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 mt-3">
            {slots.map(t => {
              const closed = isSlotClosed(selDay, t)
              return (
                <button key={t} onClick={() => toggleSlot(selDay, t)}
                  className="px-1 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all"
                  style={{
                    background: closed ? 'rgba(239,68,68,0.15)' : 'var(--surface2)',
                    color: closed ? 'var(--danger)' : 'var(--accent)',
                    border: `1px solid ${closed ? 'var(--danger)' : 'var(--border)'}`,
                    textDecoration: closed ? 'line-through' : 'none',
                  }}>
                  {t}
                </button>
              )
            })}
          </div>
        )}
        {!selDay && <p className="text-xs" style={{ color: 'var(--muted)' }}>Selecciona un día arriba.</p>}
      </div>
    </div>
  )
}
