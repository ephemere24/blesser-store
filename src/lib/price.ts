export type Priceable = {
  price: number
  onSale?: boolean | null
  salePrice?: number | null
  saleEndsAt?: string | Date | null
}

// ¿La liquidación está activa ahora mismo? (respeta la fecha de fin si es temporal)
export function isSaleActive(p: Priceable, now: Date = new Date()): boolean {
  if (!p.onSale || p.salePrice == null) return false
  if (p.saleEndsAt && new Date(p.saleEndsAt).getTime() <= now.getTime()) return false
  return true
}

// Precio que paga el cliente: el de liquidación si está activa, si no el normal.
export function effectivePrice(p: Priceable, now: Date = new Date()): number {
  return isSaleActive(p, now) ? (p.salePrice as number) : p.price
}

// Porcentaje de descuento (entero) si hay liquidación activa y válida; null si no.
export function discountPct(p: Priceable, now: Date = new Date()): number | null {
  if (!isSaleActive(p, now) || p.salePrice == null || p.salePrice >= p.price || p.price <= 0) return null
  return Math.round((1 - p.salePrice / p.price) * 100)
}
