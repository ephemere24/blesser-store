import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { applyOrderEdit, notifyOrderChange, OrderEditError, EditOp } from '@/lib/orders'
import { isValidPickup } from '@/lib/pickup'

function orderWithItems(orderId: number) {
  return prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('bs_token')?.value
  const user = token ? verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const orderId = Number(id)

  // El pedido debe pertenecer al cliente
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.accessCodeId !== user.codeId) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'Este pedido ya no se puede modificar' }, { status: 409 })
  }

  const body = await req.json() as (EditOp | { op: 'confirm' })

  const accessCode = await prisma.accessCode.findUnique({ where: { id: user.codeId } })
  const label = accessCode?.clientName ? `${accessCode.clientName} (${user.code})` : user.code

  // Confirmar: envía UN aviso a Telegram y limpia la marca de cambios
  if (body.op === 'confirm') {
    await prisma.order.update({ where: { id: orderId }, data: { pendingChanges: false } })
    const full = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (full) await notifyOrderChange(full, label, '✏️ Pedido ACTUALIZADO')
    return NextResponse.json(await orderWithItems(orderId))
  }

  // El cliente no edita la nota desde aquí
  if (body.op === 'setNote') {
    return NextResponse.json({ error: 'Operación no permitida' }, { status: 403 })
  }
  // Validar recogida
  if (body.op === 'setPickup') {
    if (!isValidPickup(body.pickupDate, body.pickupTime)) {
      return NextResponse.json({ error: 'El día u hora de recogida no son válidos' }, { status: 400 })
    }
  }

  try {
    await applyOrderEdit(orderId, body as EditOp)

    if (body.op === 'cancel') {
      const full = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
      if (full) await notifyOrderChange(full, label, '❌ Pedido CANCELADO')
    } else {
      // Cambio silencioso: marca cambios pendientes (sin avisar a Telegram)
      await prisma.order.update({ where: { id: orderId }, data: { pendingChanges: true } })
    }

    return NextResponse.json(await orderWithItems(orderId))
  } catch (e) {
    if (e instanceof OrderEditError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
