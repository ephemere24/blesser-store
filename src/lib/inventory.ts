import { lotTotal, PurchaseLot } from './costing'

export interface InvOrderItem { productId: number | null; price: number; quantity: number }

export interface ProductStats {
  invested: number      // total gastado en compras de este producto
  unitsBought: number   // unidades compradas
  costPerUnit: number   // invested / unitsBought (media ponderada)
  unitsSold: number     // unidades vendidas (pedidos entregados)
  revenue: number       // ingresos generados por este producto
  netPosition: number   // revenue - invested  (>= 0 ⇒ inversión recuperada)
  recovered: boolean
  unitsToBreakEven: number // unidades que faltan por vender para recuperar la inversión
  salePrice: number     // precio de venta de referencia (actual)
  profitPerUnit: number // salePrice - costPerUnit
  marginPct: number
  progressPct: number   // % de la inversión ya recuperada (0..100)
  realizedProfit: number // beneficio contable de lo vendido: revenue - unitsSold*costPerUnit
}

// purchases: lotes de UN producto. items: líneas vendidas de UN producto. salePrice: precio actual.
export function computeProductStats(
  purchases: PurchaseLot[], items: InvOrderItem[], salePrice: number
): ProductStats {
  const invested = purchases.reduce((s, p) => s + lotTotal(p), 0)
  const unitsBought = purchases.reduce((s, p) => s + p.units, 0)
  const costPerUnit = unitsBought > 0 ? invested / unitsBought : 0

  const unitsSold = items.reduce((s, i) => s + i.quantity, 0)
  const revenue = items.reduce((s, i) => s + i.price * i.quantity, 0)

  const netPosition = revenue - invested
  const recovered = netPosition >= 0
  const unitsToBreakEven = recovered || salePrice <= 0 ? 0 : Math.ceil((invested - revenue) / salePrice)

  const profitPerUnit = salePrice - costPerUnit
  const marginPct = salePrice > 0 ? (profitPerUnit / salePrice) * 100 : 0
  const progressPct = invested > 0 ? Math.min(100, (revenue / invested) * 100) : (revenue > 0 ? 100 : 0)
  const realizedProfit = revenue - unitsSold * costPerUnit

  return {
    invested, unitsBought, costPerUnit, unitsSold, revenue,
    netPosition, recovered, unitsToBreakEven, salePrice, profitPerUnit, marginPct, progressPct, realizedProfit,
  }
}
