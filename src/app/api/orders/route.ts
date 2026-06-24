import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { isValidPickup, formatDayLabel } from '@/lib/pickup'
import { effectivePrice, isSaleActive } from '@/lib/price'
import { consumeSaleUnits } from '@/lib/orders'

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

export async function GET(req: NextRequest) {
  const token = req.cookies.get('bs_token')?.value
  const user = token ? verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orders = await prisma.order.findMany({
    where: { accessCodeId: user.codeId },
    include: { items: { orderBy: { id: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orders)
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('bs_token')?.value
  const user = token ? verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { note, pickupDate, pickupTime } = await req.json().catch(() => ({ note: null, pickupDate: null, pickupTime: null }))

  // Validar día y hora de recogida
  if (!pickupDate || !pickupTime) {
    return NextResponse.json({ error: 'Selecciona el día y la hora de recogida' }, { status: 400 })
  }
  if (!isValidPickup(pickupDate, pickupTime)) {
    return NextResponse.json({ error: 'El día u hora de recogida no son válidos' }, { status: 400 })
  }
  const closed = await prisma.closure.findFirst({ where: { date: pickupDate, OR: [{ time: null }, { time: pickupTime }] } })
  if (closed) return NextResponse.json({ error: 'Ese día u hora ya no está disponible' }, { status: 409 })

  const cart = await prisma.cart.findUnique({
    where: { accessCodeId: user.codeId },
    include: { items: { include: { product: true, flavor: true } } },
  })

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
  }

  // Validar stock disponible para los sabores seleccionados
  const stockErrors: string[] = []
  for (const i of cart.items) {
    if (i.flavor && i.flavor.stock < i.quantity) {
      stockErrors.push(`${i.product.name} — ${i.flavor.name}`)
    }
  }
  if (stockErrors.length > 0) {
    return NextResponse.json(
      { error: `No hay stock suficiente:\n${stockErrors.join('\n')}` },
      { status: 409 }
    )
  }

  // Validar unidades de oferta (liquidación por unidades)
  for (const i of cart.items) {
    if (isSaleActive(i.product) && i.product.saleUnits != null) {
      if (i.quantity > i.product.saleUnits) {
        return NextResponse.json(
          { error: `Solo quedan ${i.product.saleUnits} unidad${i.product.saleUnits === 1 ? '' : 'es'} en oferta de ${i.product.name}` },
          { status: 409 }
        )
      }
    }
  }

  const accessCode = await prisma.accessCode.findUnique({ where: { id: user.codeId } })
  const total = cart.items.reduce((s, i) => s + i.quantity * effectivePrice(i.product), 0)

  // Crear pedido, descontar stock y vaciar carrito de forma atómica
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        accessCodeId: user.codeId,
        total,
        note: note || null,
        pickupDate,
        pickupTime,
        items: {
          create: cart.items.map(i => ({
            productId: i.productId,
            flavorId: i.flavorId,
            productName: i.product.name,
            flavorName: i.flavor?.name ?? null,
            price: effectivePrice(i.product),
            onSale: isSaleActive(i.product),
            quantity: i.quantity,
          })),
        },
      },
      include: { items: true },
    })

    // Descontar stock por sabor y recalcular disponibilidad
    for (const i of cart.items) {
      if (i.flavorId) {
        const newStock = Math.max(0, (i.flavor?.stock ?? 0) - i.quantity)
        await tx.flavor.update({
          where: { id: i.flavorId },
          data: { stock: newStock, inStock: newStock > 0 },
        })
      }
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
    return created
  })

  // Descontar unidades de oferta (liquidación por unidades)
  await consumeSaleUnits(order.items)

  // Notificar por Telegram
  const clientLabel = accessCode?.clientName
    ? `${accessCode.clientName} (${user.code})`
    : user.code
  const lines = order.items.map(
    i => `• ${i.quantity}x ${i.productName}${i.flavorName ? ` — ${i.flavorName}` : ''} · ${(i.price * i.quantity).toFixed(2)} €`
  )
  const pickupLabel = `${formatDayLabel(new Date(pickupDate + 'T00:00:00'))} a las ${pickupTime}`
  const message =
    `🛒 <b>Nuevo pedido #${order.id}</b>\n\n` +
    `👤 Cliente: <b>${clientLabel}</b>\n` +
    `📅 Recogida: <b>${pickupLabel}</b>\n\n` +
    `${lines.join('\n')}\n\n` +
    `💰 <b>Total: ${total.toFixed(2)} €</b>` +
    (note ? `\n\n📝 Nota: ${note}` : '')

  await notifyTelegram(message)

  return NextResponse.json({ ok: true, orderId: order.id, order })
}
