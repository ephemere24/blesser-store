import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

function getUser(req: NextRequest) {
  const token = req.cookies.get('bs_token')?.value
  return token ? verifyToken(token) : null
}

// Lista de productos favoritos del cliente (mismo formato que el catálogo).
export async function GET(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const favs = await prisma.favorite.findMany({
    where: { accessCodeId: user.codeId },
    orderBy: { createdAt: 'desc' },
    include: { product: { include: { flavors: { orderBy: { id: 'asc' } } } } },
  })
  return NextResponse.json(favs.map(f => f.product))
}

export async function POST(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { productId } = await req.json().catch(() => ({}))
  if (!productId) return NextResponse.json({ error: 'Falta productId' }, { status: 400 })

  await prisma.favorite.upsert({
    where: { accessCodeId_productId: { accessCodeId: user.codeId, productId: Number(productId) } },
    create: { accessCodeId: user.codeId, productId: Number(productId) },
    update: {},
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = getUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { productId } = await req.json().catch(() => ({}))
  if (!productId) return NextResponse.json({ error: 'Falta productId' }, { status: 400 })

  await prisma.favorite.deleteMany({ where: { accessCodeId: user.codeId, productId: Number(productId) } })
  return NextResponse.json({ ok: true })
}
