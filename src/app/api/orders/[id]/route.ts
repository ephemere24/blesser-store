import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { applyOrderEdit, confirmOrderDraft, draftFromOrder, notifyOrderChange, OrderEditError, DraftLine } from '@/lib/orders'
import { isValidPickup } from '@/lib/pickup'
import { isSaleActive, variantPrice } from '@/lib/price'

type ClientOp =
  | { op: 'addItem'; productId: number; flavorId: number | null; quantity?: number }
  | { op: 'setQty'; productId: number; flavorId: number | null; quantity: number; onSale?: boolean }
  | { op: 'removeItem'; productId: number; flavorId: number | null; onSale?: boolean }
  | { op: 'setPickup'; pickupDate: string; pickupTime: string }
  | { op: 'confirm' }
  | { op: 'cancel' }

function withItems(orderId: number) {
  return prisma.order.findUnique({ where: { id: orderId }, include: { items: { orderBy: { id: 'asc' } } } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('bs_token')?.value
  const user = token ? verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const orderId = Number(id)

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
  if (!order || order.accessCodeId !== user.codeId) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'Este pedido ya no se puede modificar' }, { status: 409 })
  }

  const body = await req.json() as ClientOp

  const accessCode = await prisma.accessCode.findUnique({ where: { id: user.codeId } })
  const label = accessCode?.clientName ? `${accessCode.clientName} (${user.code})` : user.code

  // CONFIRMAR: aplica el borrador al pedido real, ajusta stock, avisa a Telegram
  if (body.op === 'confirm') {
    try {
      const updated = await confirmOrderDraft(orderId)
      if (updated) await notifyOrderChange(updated, label, '✏️ Pedido ACTUALIZADO')
      return NextResponse.json(updated)
    } catch (e) {
      if (e instanceof OrderEditError) return NextResponse.json({ error: e.message }, { status: e.status })
      throw e
    }
  }

  // CANCELAR: devuelve stock del pedido real y avisa
  if (body.op === 'cancel') {
    try {
      await applyOrderEdit(orderId, { op: 'cancel' })
      await prisma.order.update({ where: { id: orderId }, data: { draftItems: Prisma.DbNull, draftPickupDate: null, draftPickupTime: null, pendingChanges: false } })
      const full = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
      if (full) await notifyOrderChange(full, label, '❌ Pedido CANCELADO')
      return NextResponse.json(full)
    } catch (e) {
      if (e instanceof OrderEditError) return NextResponse.json({ error: e.message }, { status: e.status })
      throw e
    }
  }

  // --- Ediciones: solo modifican el BORRADOR (no el pedido real ni la agenda) ---
  const draft: DraftLine[] = (order.draftItems as unknown as DraftLine[] | null) ?? draftFromOrder(order)
  let draftDate = order.draftPickupDate ?? order.pickupDate ?? ''
  let draftTime = order.draftPickupTime ?? order.pickupTime ?? ''

  if (body.op === 'setPickup') {
    if (!isValidPickup(body.pickupDate, body.pickupTime)) {
      return NextResponse.json({ error: 'El día u hora de recogida no son válidos' }, { status: 400 })
    }
    const closed = await prisma.closure.findFirst({ where: { date: body.pickupDate, OR: [{ time: null }, { time: body.pickupTime }] } })
    if (closed) return NextResponse.json({ error: 'Ese día u hora ya no está disponible' }, { status: 409 })
    draftDate = body.pickupDate
    draftTime = body.pickupTime
  } else if (body.op === 'addItem') {
    const product = await prisma.product.findUnique({ where: { id: body.productId } })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    let flavorName: string | null = null
    let flavor: { price: number | null } | null = null
    if (body.flavorId) {
      const f = await prisma.flavor.findUnique({ where: { id: body.flavorId } })
      if (!f) return NextResponse.json({ error: 'Sabor no encontrado' }, { status: 404 })
      flavorName = f.name
      flavor = { price: f.price }
    }
    const qty = Math.max(1, Math.floor(body.quantity ?? 1))
    const onSale = isSaleActive(product)
    // Las unidades nuevas se evalúan según el estado de oferta ACTUAL.
    // Una línea de oferta y otra a precio normal del mismo producto conviven separadas.
    if (onSale && product.saleUnits != null) {
      // Unidades en oferta de este producto ya en el borrador
      const draftOnSale = draft.filter(d => d.productId === body.productId && d.onSale).reduce((s, d) => s + d.quantity, 0)
      // Unidades en oferta ya descontadas por el pedido original (no cuentan contra el restante)
      const origOnSale = order.items.filter(i => i.productId === body.productId && i.onSale).reduce((s, i) => s + i.quantity, 0)
      // Unidades nuevas en oferta que se intentan añadir = (borrador + esta) - original
      const newOnSale = (draftOnSale + qty) - origOnSale
      if (newOnSale > product.saleUnits) {
        const avail = Math.max(0, product.saleUnits - Math.max(0, draftOnSale - origOnSale))
        return NextResponse.json(
          { error: `Solo quedan ${avail} unidad${avail === 1 ? '' : 'es'} en oferta de ${product.name}` },
          { status: 409 }
        )
      }
    }
    const idx = draft.findIndex(d => d.productId === body.productId && d.flavorId === (body.flavorId ?? null) && d.onSale === onSale)
    if (idx >= 0) draft[idx].quantity += qty
    else draft.push({ productId: body.productId, flavorId: body.flavorId ?? null, productName: product.name, flavorName, price: variantPrice(product, flavor), onSale, quantity: qty })
  } else if (body.op === 'setQty') {
    const idx = draft.findIndex(d => d.productId === body.productId && d.flavorId === (body.flavorId ?? null) && (body.onSale === undefined || d.onSale === body.onSale))
    if (idx >= 0) {
      const q = Math.max(0, Math.floor(body.quantity))
      if (q <= 0) draft.splice(idx, 1)
      else draft[idx].quantity = q
    }
  } else if (body.op === 'removeItem') {
    const idx = draft.findIndex(d => d.productId === body.productId && d.flavorId === (body.flavorId ?? null) && (body.onSale === undefined || d.onSale === body.onSale))
    if (idx >= 0) draft.splice(idx, 1)
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      draftItems: draft as unknown as Prisma.InputJsonValue,
      draftPickupDate: draftDate || null,
      draftPickupTime: draftTime || null,
      pendingChanges: true,
    },
  })

  return NextResponse.json(await withItems(orderId))
}
