import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/auth'
import { getSetting, setSetting } from '@/lib/codes'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const autoAccept = (await getSetting('autoAcceptCodes')) === 'true'
  return NextResponse.json({ autoAccept })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { autoAccept } = await req.json()
  await setSetting('autoAcceptCodes', autoAccept ? 'true' : 'false')
  return NextResponse.json({ ok: true, autoAccept: !!autoAccept })
}
