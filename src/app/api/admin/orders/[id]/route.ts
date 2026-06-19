import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/auth'
import { applyOrderEdit, OrderEditError, EditOp } from '@/lib/orders'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const orderId = Number(id)
  const edit = (await req.json()) as EditOp

  try {
    const updated = await applyOrderEdit(orderId, edit)
    return NextResponse.json(updated)
  } catch (e) {
    if (e instanceof OrderEditError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
