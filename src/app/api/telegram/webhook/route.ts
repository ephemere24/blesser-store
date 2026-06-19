import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { answerCallback, editMessageText } from '@/lib/telegram'

// Genera un código de acceso único tipo BLESSxxxx
async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = `BLESS${Math.floor(1000 + Math.random() * 9000)}`
    const existing = await prisma.accessCode.findUnique({ where: { code } })
    if (!existing) return code
  }
  // Fallback muy improbable
  return `BLESS${Date.now().toString().slice(-6)}`
}

export async function POST(req: NextRequest) {
  // Seguridad: Telegram envía este header con el secreto configurado en el webhook.
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.JWT_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = await req.json().catch(() => null)
  const cb = update?.callback_query
  if (!cb) return NextResponse.json({ ok: true })

  // Solo aceptamos acciones desde el chat autorizado
  const chatId = cb.message?.chat?.id
  if (String(chatId) !== String(process.env.TELEGRAM_CHAT_ID)) {
    await answerCallback(cb.id, 'No autorizado')
    return NextResponse.json({ ok: true })
  }

  const [action, idStr] = String(cb.data || '').split(':')
  const requestId = Number(idStr)
  const messageId = cb.message?.message_id

  const request = await prisma.accessRequest.findUnique({ where: { id: requestId } })
  if (!request) {
    await answerCallback(cb.id, 'Solicitud no encontrada')
    return NextResponse.json({ ok: true })
  }
  if (request.status !== 'pending') {
    await answerCallback(cb.id, `Ya estaba ${request.status === 'approved' ? 'aceptada' : 'rechazada'}`)
    return NextResponse.json({ ok: true })
  }

  const baseInfo = `👤 <b>${request.name}</b>\n📞 ${request.phone}`

  if (action === 'approve') {
    const code = await generateUniqueCode()
    await prisma.$transaction([
      prisma.accessCode.create({
        data: { code, clientName: request.name, phone: request.phone },
      }),
      prisma.accessRequest.update({
        where: { id: requestId },
        data: { status: 'approved', generatedCode: code },
      }),
    ])
    await answerCallback(cb.id, 'Solicitud aceptada')
    if (messageId) {
      await editMessageText(chatId, messageId,
        `✅ <b>Solicitud ACEPTADA</b>\n\n${baseInfo}\n\n🔑 Código generado: <code>${code}</code>\n\nPásaselo al cliente.`)
    }
  } else if (action === 'reject') {
    await prisma.accessRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' },
    })
    await answerCallback(cb.id, 'Solicitud rechazada')
    if (messageId) {
      await editMessageText(chatId, messageId,
        `❌ <b>Solicitud RECHAZADA</b>\n\n${baseInfo}`)
    }
  } else {
    await answerCallback(cb.id)
  }

  return NextResponse.json({ ok: true })
}
