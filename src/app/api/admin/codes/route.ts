import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const codes = await prisma.accessCode.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(codes)
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { code, clientName } = await req.json()
  const newCode = await prisma.accessCode.create({
    data: { code: code.toUpperCase().trim(), clientName },
  })
  return NextResponse.json(newCode)
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id, ids, active } = await req.json()
  const targetIds: number[] = Array.isArray(ids) ? ids : [id]
  await prisma.accessCode.updateMany({ where: { id: { in: targetIds } }, data: { active } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id, ids } = await req.json()
  const targetIds: number[] = Array.isArray(ids) ? ids : [id]

  // Eliminar primero los datos dependientes (carrito y pedidos) para evitar
  // que la clave foránea bloquee el borrado de los códigos.
  await prisma.$transaction([
    prisma.cart.deleteMany({ where: { accessCodeId: { in: targetIds } } }),
    prisma.order.deleteMany({ where: { accessCodeId: { in: targetIds } } }),
    prisma.accessCode.deleteMany({ where: { id: { in: targetIds } } }),
  ])

  return NextResponse.json({ ok: true })
}
