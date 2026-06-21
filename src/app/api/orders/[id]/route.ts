import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { applyOrderEdit, confirmOrderDraft, draftFromOrder, notifyOrderChange, OrderEditError, DraftLine } from '@/lib/orders'
import { isValidPickup } from '@/lib/pickup'

type ClientOp =
  | { op: 'addItem'; productId: number; flavorId: number | null; quantity?: number }
  | { op: 'setQty'; productId: number; flavorId: number | null; quantity: number }
  | { op: 'removeItem'; productId: number; flavorId: number | null }
  | { op: 'setPickup'; pickupDate: string; pickupTime: string }
  | { op: 'confirm' }
  | { op: 'cancel' }

function withItems(orderId: number) {
  return prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
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
    draftDate = body.pickupDate
    draftTime = body.pickupTime
  } else if (body.op === 'addItem') {
    const product = await prisma.product.findUnique({ where: { id: body.productId } })
    if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    let flavorName: string | null = null
    if (body.flavorId) {
      const f = await prisma.flavor.findUnique({ where: { id: body.flavorId } })
      if (!f) return NextResponse.json({ error: 'Sabor no encontrado' }, { status: 404 })
      flavorName = f.name
    }
    const qty = Math.max(1, Math.floor(body.quantity ?? 1))
    const idx = draft.findIndex(d => d.productId === body.productId && d.flavorId === (body.flavorId ?? null))
    if (idx >= 0) draft[idx].quantity += qty
    else draft.push({ productId: body.productId, flavorId: body.flavorId ?? null, productName: product.name, flavorName, price: product.price, quantity: qty })
  } else if (body.op === 'setQty') {
    const idx = draft.findIndex(d => d.productId === body.productId && d.flavorId === (body.flavorId ?? null))
    if (idx >= 0) {
      const q = Math.max(0, Math.floor(body.quantity))
      if (q <= 0) draft.splice(idx, 1)
      else draft[idx].quantity = q
    }
  } else if (body.op === 'removeItem') {
    const idx = draft.findIndex(d => d.productId === body.productId && d.flavorId === (body.flavorId ?? null))
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
