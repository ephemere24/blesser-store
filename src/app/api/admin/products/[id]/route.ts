import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const data = await req.json()
  // Extraemos campos que no deben ir al update
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { flavors, id: _id, createdAt, updatedAt, ...productData } = data

  // Los sabores pueden venir con id/productId de la BD — los limpiamos.
  // La disponibilidad (inStock) se deriva del stock.
  const cleanFlavors = flavors?.map(({ name, stock }: { name: string; stock?: number }) => {
    const units = Math.max(0, Math.floor(Number(stock) || 0))
    return { name, stock: units, inStock: units > 0 }
  })

  const product = await prisma.product.update({
    where: { id: Number(id) },
    data: {
      name: String(productData.name),
      price: Number(productData.price),
      description: String(productData.description ?? ''),
      specs: String(productData.specs ?? ''),
      category: String(productData.category ?? ''),
      visible: Boolean(productData.visible),
      onSale: Boolean(productData.onSale),
      salePrice: productData.onSale && productData.salePrice != null ? Number(productData.salePrice) : null,
      saleEndsAt: productData.onSale && productData.saleEndsAt ? new Date(productData.saleEndsAt) : null,
      saleUnits: productData.onSale && productData.saleUnits != null ? Math.max(0, Math.floor(Number(productData.saleUnits))) : null,
      position: Number(productData.position),
      images: String(productData.images ?? '[]'),
      flavors: cleanFlavors
        ? { deleteMany: {}, create: cleanFlavors }
        : undefined,
    },
    include: { flavors: true },
  })
  return NextResponse.json(product)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  await prisma.product.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const data = await req.json()

  const product = await prisma.product.update({
    where: { id: Number(id) },
    data,
  })
  return NextResponse.json(product)
}
