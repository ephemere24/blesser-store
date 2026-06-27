import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

const DEFAULTS = ['Desechables', 'Cachimba', 'Recargables', 'Líquidos', 'Snus']

async function ensureSeed() {
  const count = await prisma.category.count()
  if (count > 0) return
  await prisma.$transaction(
    DEFAULTS.map((name, i) => prisma.category.create({ data: { name, position: i } }))
  )
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  await ensureSeed()
  const categories = await prisma.category.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }] })
  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const b = await req.json()
  const name = (b.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Indica el nombre de la categoría' }, { status: 400 })
  const exists = await prisma.category.findUnique({ where: { name } })
  if (exists) return NextResponse.json({ error: 'Esa categoría ya existe' }, { status: 400 })
  const max = await prisma.category.aggregate({ _max: { position: true } })
  const category = await prisma.category.create({ data: { name, position: (max._max.position ?? -1) + 1 } })
  return NextResponse.json({ ok: true, category })
}
