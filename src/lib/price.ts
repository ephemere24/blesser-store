export type Priceable = { price: number; onSale?: boolean | null; salePrice?: number | null }

// Precio que paga el cliente: el de liquidación si está activo, si no el normal.
export function effectivePrice(p: Priceable): number {
  return p.onSale && p.salePrice != null ? p.salePrice : p.price
}

// Porcentaje de descuento (entero) si hay liquidación válida; null si no aplica.
export function discountPct(p: Priceable): number | null {
  if (!p.onSale || p.salePrice == null || p.salePrice >= p.price || p.price <= 0) return null
  return Math.round((1 - p.salePrice / p.price) * 100)
}
