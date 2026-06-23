import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Cierres futuros, para que la web oculte días/franjas no disponibles.
export async function GET(req: NextRequest) {
  const token = req.cookies.get('bs_token')?.value
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const today = new Date().toISOString().slice(0, 10)
  const closures = await prisma.closure.findMany({
    where: { date: { gte: today } },
    select: { date: true, time: true },
  })
  return NextResponse.json(closures)
}
