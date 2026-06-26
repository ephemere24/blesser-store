import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'
import { restoreOrderStock } from '@/lib/orders'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: { orderBy: { id: 'asc' } }, accessCode: true },
  })
  return NextResponse.json(orders)
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id, status } = await req.json()
  const order = await prisma.order.update({ where: { id }, data: { status } })
  return NextResponse.json(order)
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id, ids } = await req.json()
  const targetIds: number[] = Array.isArray(ids) && ids.length > 0 ? ids : (id ? [id] : [])
  if (targetIds.length === 0) return NextResponse.json({ ok: true })

  // Antes de borrar, devolver el stock de cada pedido (los cancelados ya lo devolvieron).
  const orders = await prisma.order.findMany({ where: { id: { in: targetIds } }, include: { items: true } })
  for (const o of orders) await restoreOrderStock(o)

  await prisma.order.deleteMany({ where: { id: { in: targetIds } } })
  return NextResponse.json({ ok: true })
}
