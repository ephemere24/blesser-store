import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

// Renombrar: actualiza también los productos que usaban el nombre antiguo (enlace por nombre).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const b = await req.json()
  const name = (b.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Indica el nombre' }, { status: 400 })
  const current = await prisma.category.findUnique({ where: { id: Number(id) } })
  if (!current) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
  const dup = await prisma.category.findFirst({ where: { name, NOT: { id: Number(id) } } })
  if (dup) return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 400 })
  const [category] = await prisma.$transaction([
    prisma.category.update({ where: { id: Number(id) }, data: { name } }),
    prisma.product.updateMany({ where: { category: current.name }, data: { category: name } }),
  ])
  return NextResponse.json({ ok: true, category })
}

// Eliminar: los productos con esa categoría quedan sin categoría (null).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const current = await prisma.category.findUnique({ where: { id: Number(id) } })
  if (!current) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
  await prisma.$transaction([
    prisma.product.updateMany({ where: { category: current.name }, data: { category: null } }),
    prisma.category.delete({ where: { id: Number(id) } }),
  ])
  return NextResponse.json({ ok: true })
}
