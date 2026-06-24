import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const expenses = await prisma.expense.findMany({ orderBy: [{ date: 'desc' }, { id: 'desc' }] })
  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const b = await req.json()
  const amount = Number(b.amount)
  const category = (b.category || '').trim()
  if (!category) return NextResponse.json({ error: 'Indica la categoría del gasto' }, { status: 400 })
  if (isNaN(amount) || amount <= 0) return NextResponse.json({ error: 'Indica un importe válido' }, { status: 400 })

  const expense = await prisma.expense.create({
    data: {
      category,
      amount,
      description: (b.description || '').trim() || null,
      date: b.date || new Date().toISOString().slice(0, 10),
    },
  })
  return NextResponse.json({ ok: true, expense })
}
