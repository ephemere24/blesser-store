import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const closures = await prisma.closure.findMany({ orderBy: [{ date: 'asc' }, { time: 'asc' }] })
  return NextResponse.json(closures)
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { date, time } = await req.json()
  if (!date) return NextResponse.json({ error: 'Falta la fecha' }, { status: 400 })

  // Si se cierra el día completo, eliminamos las franjas sueltas de ese día
  if (!time) {
    await prisma.closure.deleteMany({ where: { date, time: { not: null } } })
  }
  const closure = await prisma.closure.upsert({
    where: { date_time: { date, time: time ?? null } },
    update: {},
    create: { date, time: time ?? null },
  })
  return NextResponse.json(closure)
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await req.json()
  await prisma.closure.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
