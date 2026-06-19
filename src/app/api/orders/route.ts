import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

async function notifyTelegram(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) {
    console.warn('Telegram no configurado (faltan TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID)')
    return
  }
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
  } catch (e) {
    console.error('Error enviando notificación Telegram:', e)
  }
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('bs_token')?.value
  const user = token ? verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { note } = await req.json().catch(() => ({ note: null }))

  const cart = await prisma.cart.findUnique({
    where: { accessCodeId: user.codeId },
    include: { items: { include: { product: true, flavor: true } } },
  })

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
  }

  const accessCode = await prisma.accessCode.findUnique({ where: { id: user.codeId } })
  const total = cart.items.reduce((s, i) => s + i.quantity * i.product.price, 0)

  const order = await prisma.order.create({
    data: {
      accessCodeId: user.codeId,
      total,
      note: note || null,
      items: {
        create: cart.items.map(i => ({
          productName: i.product.name,
          flavorName: i.flavor?.name ?? null,
          price: i.product.price,
          quantity: i.quantity,
        })),
      },
    },
    include: { items: true },
  })

  // Vaciar el carrito
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })

  // Notificar por Telegram
  const clientLabel = accessCode?.clientName
    ? `${accessCode.clientName} (${user.code})`
    : user.code
  const lines = order.items.map(
    i => `• ${i.quantity}x ${i.productName}${i.flavorName ? ` — ${i.flavorName}` : ''} · ${(i.price * i.quantity).toFixed(2)} €`
  )
  const message =
    `🛒 <b>Nuevo pedido #${order.id}</b>\n\n` +
    `👤 Cliente: <b>${clientLabel}</b>\n\n` +
    `${lines.join('\n')}\n\n` +
    `💰 <b>Total: ${total.toFixed(2)} €</b>` +
    (note ? `\n\n📝 Nota: ${note}` : '')

  await notifyTelegram(message)

  return NextResponse.json({ ok: true, orderId: order.id })
}
