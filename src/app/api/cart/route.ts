import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { isSaleActive } from '@/lib/price'

async function getCart(codeId: number) {
  return prisma.cart.upsert({
    where: { accessCodeId: codeId },
    create: { accessCodeId: codeId },
    update: {},
    include: {
      items: {
        include: { product: true, flavor: true },
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

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

  const wanted = (existing?.quantity ?? 0) + quantity

  // Validar stock disponible del sabor (si se ha seleccionado uno)
  if (flavorId) {
    const flavor = await prisma.flavor.findUnique({ where: { id: flavorId } })
    if (!flavor || flavor.stock < wanted) {
      return NextResponse.json(
        { error: 'No hay stock suficiente de este sabor.' },
        { status: 409 }
      )
    }
  }

  // Validar unidades de oferta (liquidación por unidades)
  if (isSaleActive(product) && product.saleUnits != null) {
    if (wanted > product.saleUnits) {
      return NextResponse.json(
        { error: `Solo quedan ${product.saleUnits} unidad${product.saleUnits === 1 ? '' : 'es'} en oferta de ${product.name}` },
        { status: 409 }
      )
    }
  }

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

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get('bs_token')?.value
  const user = token ? verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { itemId, quantity } = await req.json()

  const cart = await prisma.cart.findUnique({ where: { accessCodeId: user.codeId } })
  if (!cart) return NextResponse.json({ error: 'Carrito no encontrado' }, { status: 404 })

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: itemId, cartId: cart.id } })
  } else {
    const item = await prisma.cartItem.findUnique({ where: { id: itemId } })
    if (item?.flavorId) {
      const flavor = await prisma.flavor.findUnique({ where: { id: item.flavorId } })
      if (!flavor || flavor.stock < quantity) {
        return NextResponse.json(
          { error: 'No hay stock suficiente de este sabor.' },
          { status: 409 }
        )
      }
    }
    if (item?.productId) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (product && isSaleActive(product) && product.saleUnits != null && quantity > product.saleUnits) {
        return NextResponse.json(
          { error: `Solo quedan ${product.saleUnits} unidad${product.saleUnits === 1 ? '' : 'es'} en oferta de ${product.name}` },
          { status: 409 }
        )
      }
    }
    await prisma.cartItem.update({
      where: { id: itemId, cartId: cart.id },
      data: { quantity },
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
