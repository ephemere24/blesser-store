// Cálculo de costes para el módulo de Facturación.

export interface PurchaseLot {
  units: number
  productCost: number
  shipping?: number | null
  insurance?: number | null
  otherCosts?: number | null
}

// Coste total de un lote (producto + envío + seguro + otros).
export function lotTotal(p: PurchaseLot): number {
  return p.productCost + (p.shipping ?? 0) + (p.insurance ?? 0) + (p.otherCosts ?? 0)
}

// Coste por unidad de un lote concreto.
export function lotUnitCost(p: PurchaseLot): number {
  if (p.units <= 0) return 0
  return lotTotal(p) / p.units
}

// Coste/unidad por MEDIA PONDERADA de todos los lotes de un producto:
// (suma de costes totales de los lotes) / (suma de unidades compradas).
export function weightedUnitCost(lots: PurchaseLot[]): number {
  let totalCost = 0
  let totalUnits = 0
  for (const l of lots) {
    totalCost += lotTotal(l)
    totalUnits += l.units
  }
  if (totalUnits <= 0) return 0
  return totalCost / totalUnits
}
