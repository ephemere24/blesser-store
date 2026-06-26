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

  // Reconciliación de sabores POR ID (no borrar/recrear): así se conserva el STOCK,
  // que se gestiona desde Facturación, y los enlaces de compras/pedidos.
  // - Sabor con id  → solo actualizamos el nombre (el stock NO se toca aquí).
  // - Sabor sin id  → nuevo, empieza con stock 0 (se rellena con una compra).
  // - Sabores que el admin quitó → se eliminan.
  let flavorOps: object | undefined = undefined
  if (Array.isArray(flavors)) {
    const incoming = flavors as { id?: number; name: string }[]
    const keepIds = incoming.filter(f => f.id).map(f => Number(f.id))
    flavorOps = {
      deleteMany: keepIds.length ? { id: { notIn: keepIds } } : {},
      update: incoming.filter(f => f.id).map(f => ({ where: { id: Number(f.id) }, data: { name: String(f.name) } })),
      create: incoming.filter(f => !f.id).map(f => ({ name: String(f.name), stock: 0, inStock: false })),
    }
  }

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
      flavors: flavorOps,
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
