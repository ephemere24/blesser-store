// Billetes de euro habituales (no monedas: lo relevante para preparar cambio).
export const EURO_BILLS = [5, 10, 20, 50, 100, 200, 500]

// Billetes mayores que el total → sugerencias de "con cuánto pagar".
export function suggestedBills(total: number, max = 4): number[] {
  return EURO_BILLS.filter(b => b > total).slice(0, max)
}

// Cambio a preparar. payWith null/exacto → 0.
export function changeFor(total: number, payWith: number | null | undefined): number {
  if (payWith == null) return 0
  return Math.max(0, Math.round((payWith - total) * 100) / 100)
}

// Texto corto para Telegram/agenda.
export function paymentLabel(total: number, payWith: number | null | undefined): string {
  if (payWith == null) return 'Pago exacto (sin cambio)'
  const change = changeFor(total, payWith)
  if (change <= 0) return `Paga con ${payWith}€ (exacto)`
  return `Paga con ${payWith}€ → cambio ${change.toFixed(2)}€`
}
