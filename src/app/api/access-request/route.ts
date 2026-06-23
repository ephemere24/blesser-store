import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendMessage } from '@/lib/telegram'
import { generateUniqueCode, getSetting } from '@/lib/codes'

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

  const existing = await prisma.accessCode.findFirst({ where: { phone: cleanPhone } })
  const autoAccept = (await getSetting('autoAcceptCodes')) === 'true'

  // --- Auto-aceptación: genera el código al instante ---
  if (autoAccept) {
    const code = await generateUniqueCode()
    if (existing) {
      await prisma.accessCode.update({ where: { id: existing.id }, data: { code, clientName: cleanName, active: true } })
    } else {
      await prisma.accessCode.create({ data: { code, clientName: cleanName, phone: cleanPhone } })
    }
    await prisma.accessRequest.update({ where: { id: request.id }, data: { status: 'approved', generatedCode: code } })

    await sendMessage(
      `✅ <b>Código generado automáticamente</b>\n\n` +
      `👤 Nombre: <b>${cleanName}</b>\n` +
      `📞 Teléfono: <b>${cleanPhone}</b>\n` +
      `🔑 Código: <code>${code}</code>` +
      (existing ? `\n\n(Se regeneró el código de un cliente existente)` : '')
    )

    return NextResponse.json({ ok: true, autoAccepted: true, code })
  }

  // --- Flujo normal: solicitud con aprobación manual en Telegram ---
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

  return NextResponse.json({ ok: true, autoAccepted: false })
}
