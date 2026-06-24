import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  await prisma.expense.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
