import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { applyOrderEdit, applyOrderSave, notifyOrderChange, OrderEditError, EditOp, DesiredItem } from '@/lib/orders'
import { isValidPickup } from '@/lib/pickup'

// Guardar el pedido completo de una vez (un solo aviso a Telegram)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get('bs_token')?.value
  const user = token ? verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const orderId = Number(id)

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.accessCodeId !== user.codeId) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  const body = await req.json() as { items: DesiredItem[]; pickupDate: string; pickupTime: string }

  if (!body.pickupDate || !body.pickupTime || !isValidPickup(body.pickupDate, body.pickupTime)) {
    return NextResponse.json({ error: 'El día u hora de recogida no son válidos' }, { status: 400 })
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'El pedido no puede quedar vacío. Si no quieres nada, cancélalo.' }, { status: 400 })
  }

  try {
    const updated = await applyOrderSave(orderId, body.items, { pickupDate: body.pickupDate, pickupTime: body.pickupTime })
    const accessCode = await prisma.accessCode.findUnique({ where: { id: user.codeId } })
    const label = accessCode?.clientName ? `${accessCode.clientName} (${user.code})` : user.code
    if (updated) await notifyOrderChange(updated, label, '✏️ Pedido MODIFICADO')
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof OrderEditError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
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

  const edit = (await req.json()) as EditOp

  // Los clientes no editan la nota desde aquí
  if (edit.op === 'setNote') {
    return NextResponse.json({ error: 'Operación no permitida' }, { status: 403 })
  }
  // Si cambian la recogida, validamos día y hora
  if (edit.op === 'setPickup') {
    if (!isValidPickup(edit.pickupDate, edit.pickupTime)) {
      return NextResponse.json({ error: 'El día u hora de recogida no son válidos' }, { status: 400 })
    }
  }

  try {
    const updated = await applyOrderEdit(orderId, edit)
    const accessCode = await prisma.accessCode.findUnique({ where: { id: user.codeId } })
    const label = accessCode?.clientName ? `${accessCode.clientName} (${user.code})` : user.code
    if (updated) {
      const title = edit.op === 'cancel' ? '❌ Pedido CANCELADO' : '✏️ Pedido MODIFICADO'
      await notifyOrderChange(updated, label, title)
    }
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof OrderEditError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
