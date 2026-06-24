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
    include: { product: { select: { id: true, name: true } } },
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
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

  const purchase = await prisma.purchase.create({
    data: {
      productId,
      units,
      productCost,
      shipping: Number(b.shipping) || 0,
      insurance: Number(b.insurance) || 0,
      otherCosts: Number(b.otherCosts) || 0,
      note: (b.note || '').trim() || null,
      date: b.date || new Date().toISOString().slice(0, 10),
    },
  })
  return NextResponse.json({ ok: true, purchase })
}
