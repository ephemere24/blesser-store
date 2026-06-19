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

  // ¿Este teléfono ya tiene un código? Entonces se regenerará, no se crea otro usuario.
  const existing = await prisma.accessCode.findFirst({ where: { phone: cleanPhone } })

  const message = existing
    ? `🔁 <b>Solicitud de NUEVO código</b>\n\n` +
      `Este teléfono ya tiene un código: <code>${existing.code}</code>\n\n` +
      `👤 Nombre: <b>${cleanName}</b>\n` +
      `📞 Teléfono: <b>${cleanPhone}</b>\n\n` +
      `⚠️ Si aceptas, se le generará un código NUEVO y el anterior dejará de funcionar (no se crea otro usuario).`
    : `🔑 <b>Nueva solicitud de acceso</b>\n\n` +
      `👤 Nombre: <b>${cleanName}</b>\n` +
      `📞 Teléfono: <b>${cleanPhone}</b>`

  await sendMessage(message, [[
    { text: existing ? '✅ Generar nuevo' : '✅ Aceptar', callback_data: `approve:${request.id}` },
    { text: '❌ Rechazar', callback_data: `reject:${request.id}` },
  ]])

  return NextResponse.json({ ok: true })
}
