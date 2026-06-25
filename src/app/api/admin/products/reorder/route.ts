import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

// Reescribe la posición (orden) de los productos según el array de ids recibido.
// El índice en el array pasa a ser la posición → ese es el orden que ve el cliente.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { ids } = await req.json().catch(() => ({}))
  if (!Array.isArray(ids) || ids.some(x => typeof x !== 'number')) {
    return NextResponse.json({ error: 'ids inválidos' }, { status: 400 })
  }

  await prisma.$transaction(
    ids.map((id, index) => prisma.product.update({ where: { id }, data: { position: index } }))
  )
  return NextResponse.json({ ok: true })
}
