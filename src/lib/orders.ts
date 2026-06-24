import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { sendMessage } from '@/lib/telegram'
import { formatDayLabel } from '@/lib/pickup'
import { effectivePrice, isSaleActive } from '@/lib/price'

// Descuenta las unidades de oferta de los productos vendidos en liquidación.
// Cuando saleUnits llega a 0 la oferta deja de estar activa automáticamente.
export async function consumeSaleUnits(lines: { productId: number | null; onSale: boolean; quantity: number }[]) {
  const byProd = new Map<number, number>()
  for (const l of lines) if (l.onSale && l.productId) byProd.set(l.productId, (byProd.get(l.productId) || 0) + l.quantity)
  for (const [pid, qty] of byProd) {
    const p = await prisma.product.findUnique({ where: { id: pid } })
    if (p && p.saleUnits != null) {
      await prisma.product.update({ where: { id: pid }, data: { saleUnits: Math.max(0, p.saleUnits - qty) } })
    }
  }
}

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
    include: { items: { orderBy: { id: 'asc' } }, accessCode: true },
  })
}

// Ajusta el stock de un sabor. delta = cambio en unidades PEDIDAS (positivo = se pide más).
async function adjustStock(flavorId: number, deltaOrdered: number) {
  const flavor = await prisma.flavor.findUnique({ where: { id: flavorId } })
  if (!flavor) return
  if (deltaOrdered > 0 && flavor.stock < deltaOrdered) {
    throw new OrderEditError(`No hay stock suficiente de ${flavor.name}.`, 409)
  }
  const newStock = Math.max(0, flavor.stock - deltaOrdered)
  await prisma.flavor.update({
    where: { id: flavorId },
    data: { stock: newStock, inStock: newStock > 0 },
  })
}

// Ajusta las unidades de oferta de un producto. delta positivo = se pide más (consume), negativo = se devuelve.
async function adjustSaleUnits(productId: number, onSale: boolean, delta: number) {
  if (!onSale) return
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product || product.saleUnits == null) return
  if (delta > 0 && product.saleUnits < delta) {
    throw new OrderEditError(
      `Solo quedan ${product.saleUnits} unidad${product.saleUnits === 1 ? '' : 'es'} en oferta de ${product.name}.`,
      409
    )
  }
  await prisma.product.update({
    where: { id: productId },
    data: { saleUnits: Math.max(0, product.saleUnits - delta) },
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
      if (item.productId) await adjustSaleUnits(item.productId, item.onSale, delta)
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
      if (item.flavorId) await adjustStock(item.flavorId, -item.quantity)
      if (item.productId) await adjustSaleUnits(item.productId, item.onSale, -item.quantity)
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
      const onSale = isSaleActive(product)
      // Si ya existe una línea con mismo producto+sabor, sumamos
      const existing = order.items.find(i => i.productId === edit.productId && i.flavorId === (edit.flavorId ?? null))
      if (existing) {
        await adjustSaleUnits(product.id, existing.onSale, qty)
        await prisma.orderItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + qty } })
      } else {
        await adjustSaleUnits(product.id, onSale, qty)
        await prisma.orderItem.create({
          data: {
            orderId,
            productId: edit.productId,
            flavorId: edit.flavorId ?? null,
            productName: product.name,
            flavorName,
            price: effectivePrice(product),
            onSale,
            quantity: qty,
          },
        })
      }
      break
    }
    case 'cancel': {
      if (order.status === 'cancelled') break
      // Devolver stock y unidades de oferta de todas las líneas
      for (const i of order.items) {
        if (i.flavorId) await adjustStock(i.flavorId, -i.quantity)
        if (i.productId) await adjustSaleUnits(i.productId, i.onSale, -i.quantity)
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

type OrderForNotify = {
  id: number; total: number; pickupDate: string | null; pickupTime: string | null
  items: { productName: string; flavorName: string | null; price: number; quantity: number }[]
}

// Aviso detallado a Telegram (contenido completo del pedido)
export async function notifyOrderChange(order: OrderForNotify, clientLabel: string, title: string) {
  const lines = order.items.map(
    i => `• ${i.quantity}x ${i.productName}${i.flavorName ? ` — ${i.flavorName}` : ''} · ${(i.price * i.quantity).toFixed(2)} €`
  )
  const pickup = order.pickupDate && order.pickupTime
    ? `${formatDayLabel(new Date(order.pickupDate + 'T00:00:00'))} a las ${order.pickupTime}`
    : '—'
  const msg =
    `${title} <b>#${order.id}</b>\n\n` +
    `👤 Cliente: <b>${clientLabel}</b>\n` +
    `📅 Recogida: <b>${pickup}</b>\n\n` +
    `${lines.join('\n') || '(sin productos)'}\n\n` +
    `💰 <b>Total: ${order.total.toFixed(2)} €</b>`
  await sendMessage(msg)
}

export type DesiredItem = { productId: number; flavorId: number | null; quantity: number; price?: number; onSale?: boolean }
export type DraftLine = { productId: number; flavorId: number | null; productName: string; flavorName: string | null; price: number; onSale: boolean; quantity: number }

type OrderWithItems = { items: { productId: number | null; flavorId: number | null; productName: string; flavorName: string | null; price: number; quantity: number }[] }

// Borrador inicial = copia de las líneas reales del pedido (precios y onSale fijos)
export function draftFromOrder(order: OrderWithItems): DraftLine[] {
  return order.items.map(i => ({
    productId: i.productId!, flavorId: i.flavorId, productName: i.productName,
    flavorName: i.flavorName, price: i.price, onSale: i.onSale, quantity: i.quantity,
  }))
}

// Aplica el borrador al pedido real (ajusta stock y total) y limpia el borrador.
export async function confirmOrderDraft(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
  if (!order) throw new OrderEditError('Pedido no encontrado', 404)
  const draft = (order.draftItems as unknown as DraftLine[] | null) ?? null
  if (!draft) return prisma.order.findUnique({ where: { id: orderId }, include: { items: { orderBy: { id: 'asc' } }, accessCode: true } })

  const desired: DesiredItem[] = draft.map(d => ({ productId: d.productId, flavorId: d.flavorId, quantity: d.quantity, price: d.price, onSale: d.onSale }))
  const pickupDate = order.draftPickupDate ?? order.pickupDate ?? undefined
  const pickupTime = order.draftPickupTime ?? order.pickupTime ?? undefined
  await applyOrderSave(orderId, desired, pickupDate && pickupTime ? { pickupDate, pickupTime } : undefined)

  await prisma.order.update({
    where: { id: orderId },
    data: { draftItems: Prisma.DbNull, draftPickupDate: null, draftPickupTime: null, pendingChanges: false },
  })
  return prisma.order.findUnique({ where: { id: orderId }, include: { items: { orderBy: { id: 'asc' } }, accessCode: true } })
}

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

  // Cantidades actuales por sabor y por producto en oferta
  const curByFlavor = new Map<number, number>()
  const curSaleByProduct = new Map<number, number>()
  for (const it of order.items) {
    if (it.flavorId) curByFlavor.set(it.flavorId, (curByFlavor.get(it.flavorId) || 0) + it.quantity)
    if (it.onSale && it.productId) curSaleByProduct.set(it.productId, (curSaleByProduct.get(it.productId) || 0) + it.quantity)
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
      throw new OrderEditError(`No hay stock suficiente de ${flavor.name}.`, 409)
    }
    const newStock = Math.max(0, flavor.stock - delta)
    stockUpdates.push({ id: fid, stock: newStock, inStock: newStock > 0 })
  }

  // Resolver nombres/precio de las líneas y calcular delta de saleUnits por producto
  const lineData: { orderId: number; productId: number; flavorId: number | null; productName: string; flavorName: string | null; price: number; onSale: boolean; quantity: number }[] = []
  const desSaleByProduct = new Map<number, number>()
  for (const d of mergedDesired) {
    const product = await prisma.product.findUnique({ where: { id: d.productId } })
    if (!product) throw new OrderEditError('Producto no encontrado', 404)
    let flavorName: string | null = null
    if (d.flavorId) {
      const f = await prisma.flavor.findUnique({ where: { id: d.flavorId } })
      if (!f) throw new OrderEditError('Sabor no encontrado', 404)
      flavorName = f.name
    }
    // Preservar precio y onSale del draft si existen; recalcular solo para líneas nuevas sin precio guardado
    const onSale = d.onSale ?? isSaleActive(product)
    const price = d.price ?? effectivePrice(product)
    if (onSale) desSaleByProduct.set(d.productId, (desSaleByProduct.get(d.productId) || 0) + d.quantity)
    lineData.push({
      orderId, productId: d.productId, flavorId: d.flavorId,
      productName: product.name, flavorName, price, onSale, quantity: d.quantity,
    })
  }
  const total = lineData.reduce((s, l) => s + l.price * l.quantity, 0)

  // Validar y aplicar deltas de saleUnits
  const allSaleProductIds = new Set<number>([...curSaleByProduct.keys(), ...desSaleByProduct.keys()])
  for (const pid of allSaleProductIds) {
    const delta = (desSaleByProduct.get(pid) || 0) - (curSaleByProduct.get(pid) || 0)
    if (delta !== 0) await adjustSaleUnits(pid, true, delta)
  }

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

  return prisma.order.findUnique({ where: { id: orderId }, include: { items: { orderBy: { id: 'asc' } }, accessCode: true } })
}
