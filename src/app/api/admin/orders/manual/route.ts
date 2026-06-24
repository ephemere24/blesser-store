import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'
import { effectivePrice, isSaleActive } from '@/lib/price'
import { consumeSaleUnits } from '@/lib/orders'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

type ManualItem = { productId: number; flavorId: number | null; quantity: number }

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    items: ManualItem[]; customerName: string; customerPhone?: string
    pickupDate: string; pickupTime: string; note?: string
  }

  const name = (body.customerName || '').trim()
  if (!name) return NextResponse.json({ error: 'Indica el nombre del cliente' }, { status: 400 })
  if (!body.pickupDate || !body.pickupTime) return NextResponse.json({ error: 'Indica día y hora de recogida' }, { status: 400 })
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Añade al menos un producto' }, { status: 400 })
  }

  // Fusionar líneas y resolver datos de producto/sabor
  const merged = new Map<string, ManualItem>()
  for (const it of body.items) {
    const q = Math.max(0, Math.floor(it.quantity))
    if (q <= 0) continue
    const key = `${it.productId}:${it.flavorId ?? 'null'}`
    const ex = merged.get(key)
    if (ex) ex.quantity += q
    else merged.set(key, { productId: it.productId, flavorId: it.flavorId ?? null, quantity: q })
  }

  const lines: { productId: number; flavorId: number | null; productName: string; flavorName: string | null; price: number; onSale: boolean; quantity: number }[] = []
  for (const it of merged.values()) {
    const product = await prisma.product.findUnique({ where: { id: it.productId } })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    let flavorName: string | null = null
    if (it.flavorId) {
      const f = await prisma.flavor.findUnique({ where: { id: it.flavorId } })
      if (!f) return NextResponse.json({ error: 'Sabor no encontrado' }, { status: 404 })
      flavorName = f.name
    }
    if (isSaleActive(product) && product.saleUnits != null && it.quantity > product.saleUnits) {
      return NextResponse.json(
        { error: `Solo quedan ${product.saleUnits} unidad${product.saleUnits === 1 ? '' : 'es'} en oferta de ${product.name}` },
        { status: 409 }
      )
    }
    lines.push({ productId: it.productId, flavorId: it.flavorId, productName: product.name, flavorName, price: effectivePrice(product), onSale: isSaleActive(product), quantity: it.quantity })
  }
  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0)

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        manual: true,
        customerName: name,
        customerPhone: body.customerPhone?.trim() || null,
        total,
        note: body.note?.trim() || null,
        pickupDate: body.pickupDate,
        pickupTime: body.pickupTime,
        items: { create: lines },
      },
      include: { items: true },
    })
    // Descontar stock por sabor
    for (const l of lines) {
      if (l.flavorId) {
        const flavor = await tx.flavor.findUnique({ where: { id: l.flavorId } })
        if (flavor) {
          const newStock = Math.max(0, flavor.stock - l.quantity)
          await tx.flavor.update({ where: { id: l.flavorId }, data: { stock: newStock, inStock: newStock > 0 } })
        }
      }
    }
    return created
  })

  await consumeSaleUnits(order.items)

  return NextResponse.json({ ok: true, order })
}
