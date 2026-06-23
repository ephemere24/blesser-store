import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { verifyAdminToken } from '@/lib/auth'

// Comprobar si la sesión de admin sigue activa
export async function GET(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  if (token && verifyAdminToken(token)) return NextResponse.json({ ok: true })
  return NextResponse.json({ ok: false }, { status: 401 })
}

export async function POST(req: NextRequest) {
  const { password, remember } = await req.json()

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12 // 30 días o 12h
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET!, { expiresIn: remember ? '30d' : '12h' })

  const response = NextResponse.json({ ok: true })
  response.cookies.set('bs_admin', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge,
    path: '/',
  })
  return response
}
