import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { applyOrderEdit, notifyOrderModified, OrderEditError, EditOp } from '@/lib/orders'
import { isValidPickup } from '@/lib/pickup'

const ACTION_LABELS: Record<string, string> = {
  setQty: 'Cambió una cantidad',
  removeItem: 'Eliminó una línea',
  addItem: 'Añadió un producto',
  cancel: '❌ Canceló el pedido',
  setPickup: '📅 Cambió el día/hora de recogida',
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
    await notifyOrderModified(orderId, label, ACTION_LABELS[edit.op] ?? 'Modificó el pedido')
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof OrderEditError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
