/* Verificación de los cálculos de facturación con los datos de prueba.
   Ejecutar: npx tsx scripts/test-billing.ts */
import {
  unitCostMap, computeKpis, byProduct, byClient, cashSummary,
  BillingOrder, BillingPurchase, BillingExpense,
} from '../src/lib/billing'

const purchases: BillingPurchase[] = [
  { productId: 7, units: 50, productCost: 400, shipping: 30, insurance: 10, otherCosts: 10 },
  { productId: 7, units: 20, productCost: 180, shipping: 20, insurance: 0, otherCosts: 0 },
  { productId: 9, units: 40, productCost: 300, shipping: 25, insurance: 0, otherCosts: 0 },
  { productId: 10, units: 25, productCost: 250, shipping: 20, insurance: 0, otherCosts: 0 },
  { productId: 11, units: 100, productCost: 150, shipping: 20, insurance: 0, otherCosts: 0 },
  { productId: 12, units: 30, productCost: 270, shipping: 15, insurance: 0, otherCosts: 0 },
  { productId: 13, units: 40, productCost: 80, shipping: 10, insurance: 0, otherCosts: 0 },
  { productId: 14, units: 60, productCost: 90, shipping: 10, insurance: 0, otherCosts: 5 },
  { productId: 16, units: 50, productCost: 100, shipping: 10, insurance: 0, otherCosts: 0 },
]
const expenses: BillingExpense[] = [
  { id: 1, category: 'Transporte', amount: 45, date: '2026-05-30' },
  { id: 2, category: 'Material', amount: 30, date: '2026-05-10' },
  { id: 3, category: 'Suministros', amount: 60, date: '2026-06-05' },
]
function mk(id: number, date: string, client: string | null, customer: string | null, payWith: number | null,
           items: [number, string, number, boolean, number][]): BillingOrder {
  return {
    id, total: items.reduce((s, [, , p, , q]) => s + p * q, 0), createdAt: date + 'T18:00:00.000Z',
    status: 'completed', accessCodeId: client ? 1 : null, customerName: customer, clientName: client, payWith,
    items: items.map(([productId, productName, price, onSale, quantity]) => ({ productId, productName, price, onSale, quantity })),
  }
}
const orders: BillingOrder[] = [
  mk(1, '2026-04-20', 'Sarita', null, 30, [[7, 'BLESSER 40k', 16, false, 1], [11, 'PILOT', 3.5, true, 2]]),
  mk(2, '2026-04-28', null, 'Carlos', null, [[9, '4EN1', 10, true, 1], [14, 'R&M', 3, true, 2]]),
  mk(3, '2026-05-03', 'Rebecs', null, 20, [[12, 'ROCKME', 15, false, 1]]),
  mk(4, '2026-05-08', 'admin-jose', null, 50, [[7, 'BLESSER 40k', 16, false, 2]]),
  mk(5, '2026-05-12', null, 'Lucia', null, [[16, 'BOOST', 3, true, 3]]),
  mk(6, '2026-05-16', 'Sarita', null, null, [[10, 'VAP80K', 20, false, 1], [11, 'PILOT', 3.5, true, 1]]),
  mk(7, '2026-05-20', 'admin-juanma', null, 20, [[9, '4EN1', 10, true, 2]]),
  mk(8, '2026-05-25', null, 'Mar', 20, [[13, 'UWIN', 8, false, 2]]),
  mk(9, '2026-05-30', 'Rebecs', null, null, [[7, 'BLESSER 40k', 16, false, 1], [16, 'BOOST', 3, true, 1]]),
  mk(10, '2026-06-02', 'Sarita', null, null, [[11, 'PILOT', 3.5, true, 4]]),
  mk(11, '2026-06-06', null, 'Dani', 50, [[12, 'ROCKME', 15, false, 2], [14, 'R&M', 3, true, 1]]),
  mk(12, '2026-06-10', 'admin-jose', null, 30, [[9, '4EN1', 10, true, 1], [7, 'BLESSER 40k', 16, false, 1]]),
  mk(13, '2026-06-14', 'Rebecs', null, 20, [[10, 'VAP80K', 20, false, 1]]),
  mk(14, '2026-06-18', null, 'Carlos', null, [[16, 'BOOST', 3, true, 2], [13, 'UWIN', 8, false, 1]]),
  mk(15, '2026-06-21', 'Sarita', null, 50, [[7, 'BLESSER 40k', 16, false, 3]]),
  mk(16, '2026-06-23', 'admin-juanma', null, 20, [[14, 'R&M', 3, true, 3], [11, 'PILOT', 3.5, true, 2]]),
]

let failed = 0
function eq(name: string, got: number, exp: number, tol = 0.01) {
  const ok = Math.abs(got - exp) <= tol
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${name}: got ${got.toFixed(4)} | esperado ${exp.toFixed(4)}`)
}

const costMap = unitCostMap(purchases)
eq('coste/u P7 (media ponderada)', costMap.get(7)!, 650 / 70)
eq('coste/u P14 (con seguro/otros)', costMap.get(14)!, 105 / 60)

const k = computeKpis(orders, costMap, expenses, '2000-01-01', '2999-12-31')
eq('Ingresos (revenue)', k.revenue, 344.5)
eq('COGS', k.cogs, 202.635714)
eq('Beneficio bruto', k.grossProfit, 141.864286)
eq('Gastos', k.expenses, 135)
eq('Beneficio neto', k.netProfit, 6.864286)
eq('Nº pedidos', k.orderCount, 16)
eq('Ticket medio', k.avgTicket, 344.5 / 16)
eq('Margen bruto %', k.grossMarginPct, (141.864286 / 344.5) * 100)
eq('Unidades vendidas', k.unitsSold, 41)

const prods = byProduct(orders, costMap, '2000-01-01', '2999-12-31')
const p7 = prods.find(p => p.productId === 7)!
eq('P7 revenue', p7.revenue, 128)
eq('P7 unidades', p7.units, 8)
eq('P7 beneficio', p7.profit, 128 - 8 * (650 / 70))

const clients = byClient(orders, '2000-01-01', '2999-12-31')
eq('Cliente Sarita revenue', clients.find(c => c.name === 'Sarita')!.revenue, 108.5)
eq('Suma de clientes = ingresos', clients.reduce((s, c) => s + c.revenue, 0), 344.5)

// Junio 2026 (mes) — revenue esperado: O10 14 + O11 33 + O12 26 + O13 20 + O14 14 + O15 48 + O16 16 = 171
const kJun = computeKpis(orders, costMap, expenses, '2026-06-01', '2026-06-30')
eq('Junio revenue', kJun.revenue, 171)
eq('Junio gastos', kJun.expenses, 60)
eq('Junio nº pedidos', kJun.orderCount, 7)

const cash = cashSummary(orders, '2000-01-01', '2999-12-31')
// cambios: O1 7 + O3 5 + O4 18 + O8 4 + O11 17 + O12 4 + O15 2 + O16 4 = 61 (8 pedidos)
eq('Caja: cobrado', cash.collected, 344.5)
eq('Caja: cambios dados', cash.changeGiven, 61)
eq('Caja: pedidos con cambio', cash.withChangeCount, 8)

console.log(failed === 0 ? '\nTODOS LOS CÁLCULOS CORRECTOS ✅' : `\n${failed} COMPROBACIONES FALLIDAS ❌`)
process.exit(failed === 0 ? 0 : 1)
