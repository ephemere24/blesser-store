/* Verificación de los cálculos de rentabilidad por producto.
   Ejecutar: npx tsx scripts/test-inventory.ts */
import { computeProductStats } from '../src/lib/inventory'

let failed = 0
function eq(name: string, got: number, exp: number, tol = 0.01) {
  const ok = Math.abs(got - exp) <= tol
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${name}: got ${got.toFixed(4)} | esperado ${exp.toFixed(4)}`)
}
function is(name: string, got: boolean, exp: boolean) {
  const ok = got === exp
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${name}: got ${got} | esperado ${exp}`)
}

// Compras: 50 uds por 450 € (9/ud) + 20 uds por 200 € (10/ud)
const purchases = [
  { units: 50, productCost: 450, shipping: 0, insurance: 0, otherCosts: 0 },
  { units: 20, productCost: 200, shipping: 0, insurance: 0, otherCosts: 0 },
]
// Precio de venta actual 16 €

// --- Caso 1: vendidas 30 uds (aún en negativo) ---
const s1 = computeProductStats(purchases, [{ productId: 1, price: 16, quantity: 30 }], 16)
eq('inversión', s1.invested, 650)
eq('uds compradas', s1.unitsBought, 70)
eq('coste/ud (ponderado)', s1.costPerUnit, 650 / 70)
eq('uds vendidas', s1.unitsSold, 30)
eq('ingresos', s1.revenue, 480)
eq('posición neta', s1.netPosition, -170)
is('¿recuperado?', s1.recovered, false)
eq('faltan para break-even', s1.unitsToBreakEven, 11) // ceil(170/16)=11
eq('beneficio/ud', s1.profitPerUnit, 16 - 650 / 70)
eq('margen %', s1.marginPct, ((16 - 650 / 70) / 16) * 100)
eq('progreso %', s1.progressPct, (480 / 650) * 100)

// Comprobación: vender 11 más cubre la inversión
const s1b = computeProductStats(purchases, [{ productId: 1, price: 16, quantity: 41 }], 16)
is('con 41 vendidas ya recuperado', s1b.recovered, true)

// --- Caso 2: vendidas 45 uds (en positivo) ---
const s2 = computeProductStats(purchases, [{ productId: 1, price: 16, quantity: 45 }], 16)
eq('ingresos', s2.revenue, 720)
eq('posición neta', s2.netPosition, 70)
is('¿recuperado?', s2.recovered, true)
eq('faltan para break-even', s2.unitsToBreakEven, 0)

// --- Caso 3: sin ventas ---
const s3 = computeProductStats(purchases, [], 16)
eq('faltan = toda la inversión / precio', s3.unitsToBreakEven, Math.ceil(650 / 16)) // 41
eq('progreso 0', s3.progressPct, 0)

console.log(failed === 0 ? '\nTODOS LOS CÁLCULOS CORRECTOS ✅' : `\n${failed} FALLOS ❌`)
process.exit(failed === 0 ? 0 : 1)
