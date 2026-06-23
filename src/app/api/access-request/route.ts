import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendMessage } from '@/lib/telegram'
import { generateUniqueCode, getSetting } from '@/lib/codes'

export async function POST(req: NextRequest) {
  const { name, phone } = await req.json().catch(() => ({ name: '', phone: '' }))

  const cleanName = (name || '').trim()
  // Normalizar teléfono: quitar espacios/guiones y prefijo +34/0034/34
  const cleanPhone = (phone || '').replace(/[\s-]/g, '').replace(/^(\+34|0034|34)/, '')

  if (cleanName.length < 2) {
    return NextResponse.json({ error: 'Introduce tu nombre' }, { status: 400 })
  }
  // Teléfono español válido: 9 dígitos empezando por 6, 7, 8 o 9
  if (!/^[6-9]\d{8}$/.test(cleanPhone)) {
    return NextResponse.json({ error: 'Introduce un número de teléfono válido (9 dígitos)' }, { status: 400 })
  }

  // Un teléfono solo puede tener un código de acceso
  const existing = await prisma.accessCode.findFirst({ where: { phone: cleanPhone } })
  if (existing) {
    return NextResponse.json({ error: 'Este teléfono ya tiene acceso. Si has perdido tu código, contáctanos.' }, { status: 409 })
  }

  const request = await prisma.accessRequest.create({
    data: { name: cleanName, phone: cleanPhone },
  })
  const autoAccept = (await getSetting('autoAcceptCodes')) === 'true'

  // --- Auto-aceptación: genera el código al instante ---
  if (autoAccept) {
    const code = await generateUniqueCode()
    await prisma.accessCode.create({ data: { code, clientName: cleanName, phone: cleanPhone } })
    await prisma.accessRequest.update({ where: { id: request.id }, data: { status: 'approved', generatedCode: code } })

    await sendMessage(
      `✅ <b>Código generado automáticamente</b>\n\n` +
      `👤 Nombre: <b>${cleanName}</b>\n` +
      `📞 Teléfono: <b>${cleanPhone}</b>\n` +
      `🔑 Código: <code>${code}</code>`
    )

    return NextResponse.json({ ok: true, autoAccepted: true, code })
  }

  // --- Flujo normal: solicitud con aprobación manual en Telegram ---
  await sendMessage(
    `🔑 <b>Nueva solicitud de acceso</b>\n\n` +
    `👤 Nombre: <b>${cleanName}</b>\n` +
    `📞 Teléfono: <b>${cleanPhone}</b>`,
    [[
      { text: '✅ Aceptar', callback_data: `approve:${request.id}` },
      { text: '❌ Rechazar', callback_data: `reject:${request.id}` },
    ]]
  )

  return NextResponse.json({ ok: true, autoAccepted: false })
}
