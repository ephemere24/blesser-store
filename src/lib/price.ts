export type Priceable = {
  price: number
  onSale?: boolean | null
  salePrice?: number | null
  saleEndsAt?: string | Date | null
  saleUnits?: number | null
}

// ¿La liquidación está activa ahora mismo? (respeta fecha de fin y unidades restantes)
export function isSaleActive(p: Priceable, now: Date = new Date()): boolean {
  if (!p.onSale || p.salePrice == null) return false
  if (p.saleEndsAt && new Date(p.saleEndsAt).getTime() <= now.getTime()) return false
  if (p.saleUnits != null && p.saleUnits <= 0) return false
  return true
}

// Precio que paga el cliente: el de liquidación si está activa, si no el normal.
export function effectivePrice(p: Priceable, now: Date = new Date()): number {
  return isSaleActive(p, now) ? (p.salePrice as number) : p.price
}

// Precio efectivo de una variante concreta. Si la variante tiene precio propio
// (override), se usa como precio base; la liquidación (product-level) sigue mandando
// si está activa. Si no hay override, equivale a effectivePrice del producto.
export function variantPrice(p: Priceable, flavor?: { price?: number | null } | null, now: Date = new Date()): number {
  const base: Priceable = flavor?.price != null ? { ...p, price: flavor.price } : p
  return effectivePrice(base, now)
}

// Porcentaje de descuento (entero) si hay liquidación activa y válida; null si no.
export function discountPct(p: Priceable, now: Date = new Date()): number | null {
  if (!isSaleActive(p, now) || p.salePrice == null || p.salePrice >= p.price || p.price <= 0) return null
  return Math.round((1 - p.salePrice / p.price) * 100)
}
