import { prisma } from '@/lib/db'
import { sendMessage } from '@/lib/telegram'

export type EditOp =
  | { op: 'setQty'; itemId: number; quantity: number }
  | { op: 'removeItem'; itemId: number }
  | { op: 'addItem'; productId: number; flavorId: number | null; quantity: number }
  | { op: 'cancel' }
  | { op: 'setPickup'; pickupDate: string; pickupTime: string }
  | { op: 'setNote'; note: string | null }

export class OrderEditError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

async function recalcAndGet(orderId: number) {
  const items = await prisma.orderItem.findMany({ where: { orderId } })
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0)
  await prisma.order.update({ where: { id: orderId }, data: { total } })
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, accessCode: true },
  })
}

// Ajusta el stock de un sabor. delta = cambio en unidades PEDIDAS (positivo = se pide más).
async function adjustStock(flavorId: number, deltaOrdered: number) {
  const flavor = await prisma.flavor.findUnique({ where: { id: flavorId } })
  if (!flavor) return
  if (deltaOrdered > 0 && flavor.stock < deltaOrdered) {
    throw new OrderEditError(`Sin stock suficiente. Quedan ${flavor.stock} unidades.`, 409)
  }
  const newStock = Math.max(0, flavor.stock - deltaOrdered)
  await prisma.flavor.update({
    where: { id: flavorId },
    data: { stock: newStock, inStock: newStock > 0 },
  })
}

/**
 * Aplica una operación de edición a un pedido. Reajusta el stock y el total.
 * Lanza OrderEditError si algo no es válido.
 */
export async function applyOrderEdit(orderId: number, edit: EditOp) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })
  if (!order) throw new OrderEditError('Pedido no encontrado', 404)
  if (order.status === 'completed') {
    throw new OrderEditError('El pedido ya está completado y no se puede modificar', 409)
  }
  if (order.status === 'cancelled' && edit.op !== 'cancel') {
    throw new OrderEditError('El pedido está cancelado', 409)
  }

  switch (edit.op) {
    case 'setQty': {
      const item = order.items.find(i => i.id === edit.itemId)
      if (!item) throw new OrderEditError('Línea no encontrada', 404)
      const newQty = Math.max(0, Math.floor(edit.quantity))
      const delta = newQty - item.quantity
      if (item.flavorId) await adjustStock(item.flavorId, delta)
      if (newQty <= 0) {
        await prisma.orderItem.delete({ where: { id: item.id } })
      } else {
        await prisma.orderItem.update({ where: { id: item.id }, data: { quantity: newQty } })
      }
      break
    }
    case 'removeItem': {
      const item = order.items.find(i => i.id === edit.itemId)
      if (!item) throw new OrderEditError('Línea no encontrada', 404)
      if (item.flavorId) await adjustStock(item.flavorId, -item.quantity) // devolver stock
      await prisma.orderItem.delete({ where: { id: item.id } })
      break
    }
    case 'addItem': {
      const qty = Math.max(1, Math.floor(edit.quantity))
      const product = await prisma.product.findUnique({ where: { id: edit.productId } })
      if (!product) throw new OrderEditError('Producto no encontrado', 404)
      let flavorName: string | null = null
      if (edit.flavorId) {
        const flavor = await prisma.flavor.findUnique({ where: { id: edit.flavorId } })
        if (!flavor) throw new OrderEditError('Sabor no encontrado', 404)
        flavorName = flavor.name
        await adjustStock(edit.flavorId, qty)
      }
      // Si ya existe una línea con mismo producto+sabor, sumamos
      const existing = order.items.find(i => i.productId === edit.productId && i.flavorId === (edit.flavorId ?? null))
      if (existing) {
        await prisma.orderItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + qty } })
      } else {
        await prisma.orderItem.create({
          data: {
            orderId,
            productId: edit.productId,
            flavorId: edit.flavorId ?? null,
            productName: product.name,
            flavorName,
            price: product.price,
            quantity: qty,
          },
        })
      }
      break
    }
    case 'cancel': {
      if (order.status === 'cancelled') break
      // Devolver stock de todas las líneas
      for (const i of order.items) {
        if (i.flavorId) await adjustStock(i.flavorId, -i.quantity)
      }
      await prisma.order.update({ where: { id: orderId }, data: { status: 'cancelled' } })
      break
    }
    case 'setPickup': {
      await prisma.order.update({
        where: { id: orderId },
        data: { pickupDate: edit.pickupDate, pickupTime: edit.pickupTime },
      })
      break
    }
    case 'setNote': {
      await prisma.order.update({ where: { id: orderId }, data: { note: edit.note } })
      break
    }
  }

  return recalcAndGet(orderId)
}

// Aviso a Telegram cuando un cliente modifica su pedido
export async function notifyOrderModified(orderId: number, clientLabel: string, action: string) {
  await sendMessage(`✏️ <b>Pedido #${orderId} modificado</b>\n\n👤 ${clientLabel}\n${action}`)
}

export type DesiredItem = { productId: number; flavorId: number | null; quantity: number }

/**
 * Guarda el estado COMPLETO de un pedido de una sola vez (reconcilia stock y total).
 * Sustituye las líneas por las indicadas y ajusta el inventario según el cambio neto.
 */
export async function applyOrderSave(
  orderId: number,
  desired: DesiredItem[],
  pickup?: { pickupDate: string; pickupTime: string }
) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
  if (!order) throw new OrderEditError('Pedido no encontrado', 404)
  if (order.status === 'completed') throw new OrderEditError('El pedido ya está completado', 409)
  if (order.status === 'cancelled') throw new OrderEditError('El pedido está cancelado', 409)

  // Cantidades actuales por sabor
  const curByFlavor = new Map<number, number>()
  for (const it of order.items) {
    if (it.flavorId) curByFlavor.set(it.flavorId, (curByFlavor.get(it.flavorId) || 0) + it.quantity)
  }

  // Fusionar líneas deseadas por producto+sabor
  const mergedMap = new Map<string, DesiredItem>()
  for (const d of desired) {
    const q = Math.max(0, Math.floor(d.quantity))
    if (q <= 0) continue
    const key = `${d.productId}:${d.flavorId ?? 'null'}`
    const ex = mergedMap.get(key)
    if (ex) ex.quantity += q
    else mergedMap.set(key, { productId: d.productId, flavorId: d.flavorId ?? null, quantity: q })
  }
  const mergedDesired = [...mergedMap.values()]

  const desByFlavor = new Map<number, number>()
  for (const d of mergedDesired) {
    if (d.flavorId) desByFlavor.set(d.flavorId, (desByFlavor.get(d.flavorId) || 0) + d.quantity)
  }

  // Validar y preparar ajustes de stock (cambio neto por sabor)
  const stockUpdates: { id: number; stock: number; inStock: boolean }[] = []
  const flavorIds = new Set<number>([...curByFlavor.keys(), ...desByFlavor.keys()])
  for (const fid of flavorIds) {
    const flavor = await prisma.flavor.findUnique({ where: { id: fid } })
    if (!flavor) continue
    const delta = (desByFlavor.get(fid) || 0) - (curByFlavor.get(fid) || 0)
    if (delta > 0 && flavor.stock < delta) {
      throw new OrderEditError(`Sin stock suficiente de ${flavor.name}. Quedan ${flavor.stock} unidades.`, 409)
    }
    const newStock = Math.max(0, flavor.stock - delta)
    stockUpdates.push({ id: fid, stock: newStock, inStock: newStock > 0 })
  }

  // Resolver nombres/precio de las líneas
  const lineData: { orderId: number; productId: number; flavorId: number | null; productName: string; flavorName: string | null; price: number; quantity: number }[] = []
  for (const d of mergedDesired) {
    const product = await prisma.product.findUnique({ where: { id: d.productId } })
    if (!product) throw new OrderEditError('Producto no encontrado', 404)
    let flavorName: string | null = null
    if (d.flavorId) {
      const f = await prisma.flavor.findUnique({ where: { id: d.flavorId } })
      if (!f) throw new OrderEditError('Sabor no encontrado', 404)
      flavorName = f.name
    }
    lineData.push({
      orderId, productId: d.productId, flavorId: d.flavorId,
      productName: product.name, flavorName, price: product.price, quantity: d.quantity,
    })
  }
  const total = lineData.reduce((s, l) => s + l.price * l.quantity, 0)

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId } })
    if (lineData.length) await tx.orderItem.createMany({ data: lineData })
    for (const su of stockUpdates) {
      await tx.flavor.update({ where: { id: su.id }, data: { stock: su.stock, inStock: su.inStock } })
    }
    await tx.order.update({
      where: { id: orderId },
      data: { total, ...(pickup ? { pickupDate: pickup.pickupDate, pickupTime: pickup.pickupTime } : {}) },
    })
  })

  return prisma.order.findUnique({ where: { id: orderId }, include: { items: true, accessCode: true } })
}
