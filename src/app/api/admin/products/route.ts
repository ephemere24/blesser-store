import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const products = await prisma.product.findMany({
    include: { flavors: { orderBy: { name: 'asc' } } },
    orderBy: { position: 'asc' },
  })
  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const data = await req.json()
  const { flavors, ...productData } = data

  const cleanFlavors = flavors?.map(({ name, stock }: { name: string; stock?: number }) => {
    const units = Math.max(0, Math.floor(Number(stock) || 0))
    return { name, stock: units, inStock: units > 0 }
  })

  const product = await prisma.product.create({
    data: {
      ...productData,
      flavors: cleanFlavors ? { create: cleanFlavors } : undefined,
    },
    include: { flavors: true },
  })
  return NextResponse.json(product)
}
