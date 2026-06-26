import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

// Ajuste manual del stock de un sabor (recuentos, defectuosos, regalos).
// No afecta a la inversión ni al coste/unidad: solo corrige las unidades reales.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const { stock } = await req.json().catch(() => ({}))
  const units = Math.max(0, Math.floor(Number(stock)))
  if (isNaN(units)) return NextResponse.json({ error: 'Stock inválido' }, { status: 400 })

  const flavor = await prisma.flavor.update({
    where: { id: Number(id) },
    data: { stock: units, inStock: units > 0 },
  })
  return NextResponse.json(flavor)
}
