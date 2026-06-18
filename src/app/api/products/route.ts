import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('bs_token')?.value
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const products = await prisma.product.findMany({
    where: { visible: true },
    include: { flavors: { orderBy: { name: 'asc' } } },
    orderBy: { position: 'asc' },
  })

  return NextResponse.json(products)
}
