import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const { name, phone } = await req.json().catch(() => ({ name: '', phone: '' }))

  const cleanName = (name || '').trim()
  const cleanPhone = (phone || '').trim()

  if (cleanName.length < 2 || cleanPhone.length < 6) {
    return NextResponse.json({ error: 'Introduce un nombre y un teléfono válidos' }, { status: 400 })
  }

  const request = await prisma.accessRequest.create({
    data: { name: cleanName, phone: cleanPhone },
  })

  const message =
    `🔑 <b>Nueva solicitud de acceso</b>\n\n` +
    `👤 Nombre: <b>${cleanName}</b>\n` +
    `📞 Teléfono: <b>${cleanPhone}</b>`

  await sendMessage(message, [[
    { text: '✅ Aceptar', callback_data: `approve:${request.id}` },
    { text: '❌ Rechazar', callback_data: `reject:${request.id}` },
  ]])

  return NextResponse.json({ ok: true })
}
