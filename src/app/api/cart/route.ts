import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

async function getCart(codeId: number) {
  return prisma.cart.upsert({
    where: { accessCodeId: codeId },
    create: { accessCodeId: codeId },
    update: {},
    include: {
      items: {
        include: { product: true },
        orderBy: { id: 'asc' },
      },
    },
  })
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('bs_token')?.value
  const user = token ? verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const cart = await getCart(user.codeId)
  return NextResponse.json(cart)
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('bs_token')?.value
  const user = token ? verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { productId, flavorId, quantity = 1 } = await req.json()

  const cart = await prisma.cart.upsert({
    where: { accessCodeId: user.codeId },
    create: { accessCodeId: user.codeId },
    update: {},
  })

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId_flavorId: { cartId: cart.id, productId, flavorId: flavorId ?? null } },
  })

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    })
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId, flavorId: flavorId ?? null, quantity },
    })
  }

  const updated = await getCart(user.codeId)
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get('bs_token')?.value
  const user = token ? verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { itemId } = await req.json()

  const cart = await prisma.cart.findUnique({ where: { accessCodeId: user.codeId } })
  if (!cart) return NextResponse.json({ error: 'Carrito no encontrado' }, { status: 404 })

  await prisma.cartItem.delete({ where: { id: itemId, cartId: cart.id } })

  const updated = await getCart(user.codeId)
  return NextResponse.json(updated)
}
