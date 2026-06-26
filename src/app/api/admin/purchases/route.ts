import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const purchases = await prisma.purchase.findMany({
    include: { product: { select: { id: true, name: true } }, flavor: { select: { id: true, name: true } } },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
  })
  return NextResponse.json(purchases)
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const b = await req.json()
  const productId = Number(b.productId)
  const units = Math.floor(Number(b.units))
  const productCost = Number(b.productCost)
  if (!productId || !units || units <= 0) {
    return NextResponse.json({ error: 'Indica producto y unidades (mayor que 0)' }, { status: 400 })
  }
  if (isNaN(productCost) || productCost < 0) {
    return NextResponse.json({ error: 'Indica el coste del producto' }, { status: 400 })
  }
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { flavors: true } })
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

  // Sabor al que sumar el stock (opcional). Si el producto tiene un solo sabor, se auto-asigna.
  let flavorId: number | null = b.flavorId != null ? Number(b.flavorId) : null
  const addToStock = b.addToStock !== false // por defecto sí suma
  if (flavorId == null && product.flavors.length === 1) flavorId = product.flavors[0].id
  if (flavorId != null && !product.flavors.some(f => f.id === flavorId)) {
    return NextResponse.json({ error: 'El sabor no pertenece a este producto' }, { status: 400 })
  }

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        productId,
        flavorId: flavorId ?? undefined,
        units,
        productCost,
        shipping: Number(b.shipping) || 0,
        insurance: Number(b.insurance) || 0,
        otherCosts: Number(b.otherCosts) || 0,
        note: (b.note || '').trim() || null,
        date: b.date || new Date().toISOString().slice(0, 10),
      },
    })
    // Sumar las unidades al stock del sabor elegido
    if (addToStock && flavorId != null) {
      const fl = product.flavors.find(f => f.id === flavorId)!
      const newStock = (fl.stock ?? 0) + units
      await tx.flavor.update({ where: { id: flavorId }, data: { stock: newStock, inStock: newStock > 0 } })
    }
    return created
  })
  return NextResponse.json({ ok: true, purchase })
}
