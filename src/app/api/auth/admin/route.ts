import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET!, { expiresIn: '8h' })

  const response = NextResponse.json({ ok: true })
  response.cookies.set('bs_admin', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  return response
}
