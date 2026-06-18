import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { code } = await req.json()

  if (!code) return NextResponse.json({ error: 'Código requerido' }, { status: 400 })

  const accessCode = await prisma.accessCode.findUnique({
    where: { code: code.toUpperCase().trim() },
  })

  if (!accessCode || !accessCode.active) {
    return NextResponse.json({ error: 'Código inválido' }, { status: 401 })
  }

  const token = signToken({ codeId: accessCode.id, code: accessCode.code })

  const response = NextResponse.json({ ok: true, clientName: accessCode.clientName })
  response.cookies.set('bs_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
