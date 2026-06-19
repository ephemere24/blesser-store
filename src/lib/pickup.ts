// Lógica de horario de recogida: Lunes a Sábado, 14:00–21:00, franjas de 15 min.
// Domingos cerrado. Se permiten los próximos 7 días válidos.

export const PICKUP_START_HOUR = 14
export const PICKUP_END_HOUR = 21 // cierre; última franja seleccionable: 20:45
export const SLOT_MINUTES = 15
export const PICKUP_DAYS_AHEAD = 7

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

export function dateToValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDayLabel(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
}

// Próximos días válidos (sin domingos), empezando por hoy.
export function getPickupDays(now: Date = new Date()): { value: string; label: string }[] {
  const days: { value: string; label: string }[] = []
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  while (days.length < PICKUP_DAYS_AHEAD) {
    if (cursor.getDay() !== 0) {
      days.push({ value: dateToValue(cursor), label: formatDayLabel(cursor) })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

// Franjas horarias de un día, desde 14:00 hasta 21:00 inclusive.
// Para hoy, solo se muestran las franjas que aún no han pasado.
export function getTimeSlots(dateValue: string, now: Date = new Date()): string[] {
  const slots: string[] = []
  const isToday = dateValue === dateToValue(now)
  const minMinutes = isToday ? (now.getHours() * 60 + now.getMinutes()) : -1

  const startTotal = PICKUP_START_HOUR * 60
  const endTotal = PICKUP_END_HOUR * 60 // 21:00 inclusive

  for (let total = startTotal; total <= endTotal; total += SLOT_MINUTES) {
    if (total > minMinutes) {
      slots.push(`${pad(Math.floor(total / 60))}:${pad(total % 60)}`)
    }
  }
  return slots
}

// Validación en servidor: comprueba que día y hora son válidos.
export function isValidPickup(dateValue: string, time: string, now: Date = new Date()): boolean {
  const validDay = getPickupDays(now).some(d => d.value === dateValue)
  if (!validDay) return false
  return getTimeSlots(dateValue, now).includes(time)
}
