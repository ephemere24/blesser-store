// Pruebas de variantPrice (precio por variante) y dailySeries (serie diaria del Resumen).
import { variantPrice } from '../src/lib/price'
import { dailySeries, BillingOrder } from '../src/lib/billing'

let ok = true
function eq(label: string, got: number, exp: number) {
  const pass = Math.abs(got - exp) < 1e-9
  if (!pass) ok = false
  console.log(`${pass ? '✓' : '✗'} ${label}: got ${got.toFixed(4)} | esperado ${exp.toFixed(4)}`)
}

// --- variantPrice ---
const base = { price: 16, onSale: false, salePrice: null, saleEndsAt: null, saleUnits: null }
eq('sin variante → precio general', variantPrice(base, null), 16)
eq('variante con override', variantPrice(base, { price: 12 }), 12)
eq('variante con price null → general', variantPrice(base, { price: null }), 16)

const onSale = { price: 16, onSale: true, salePrice: 10, saleEndsAt: null, saleUnits: 5 }
eq('liquidación manda sobre override', variantPrice(onSale, { price: 12 }), 10)
eq('liquidación sin variante', variantPrice(onSale, null), 10)

// --- dailySeries ---
const cost = new Map<number, number>([[1, 4]]) // coste/ud = 4
const mkOrder = (id: number, date: string, qty: number, price: number): BillingOrder => ({
  id, total: qty * price, createdAt: `${date}T12:00:00.000Z`, status: 'completed',
  accessCodeId: 1, customerName: null, clientName: 'X', payWith: null,
  items: [{ productId: 1, productName: 'P', price, onSale: false, quantity: qty }],
})
const orders = [mkOrder(1, '2026-06-02', 2, 10), mkOrder(2, '2026-06-02', 1, 10), mkOrder(3, '2026-06-05', 3, 10)]
const series = dailySeries(orders, cost, '2026-06-01', '2026-06-30')
eq('días del mes (zero-fill)', series.length, 30)
const d2 = series.find(s => s.date === '2026-06-02')!
eq('día 2 ingresos (3 uds × 10)', d2.revenue, 30)
eq('día 2 beneficio (30 − 3×4)', d2.profit, 18)
eq('día 2 pedidos', d2.orders, 2)
const d1 = series.find(s => s.date === '2026-06-01')!
eq('día sin ventas = 0', d1.revenue, 0)
const totalRev = series.reduce((s, x) => s + x.revenue, 0)
eq('ingresos totales del mes', totalRev, 60)

console.log(ok ? '\nTODOS LOS CÁLCULOS CORRECTOS ✅' : '\nHAY ERRORES ❌')
process.exit(ok ? 0 : 1)
