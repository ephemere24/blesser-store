import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const purchases = await prisma.purchase.findMany({
    include: { product: { select: { id: true, name: true } }, flavor: { select: { id: true, name: true } } },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
  })
  return NextResponse.json(purchases)
}

// Tipo de variante en una compra con varias variantes (sabores/modelos).
interface VariantInput { flavorId?: number | null; name?: string; units: number; cost: number }

function parseVariants(raw: unknown): VariantInput[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((v): VariantInput => ({
      flavorId: v?.flavorId != null ? Number(v.flavorId) : null,
      name: (v?.name || '').trim(),
      units: Math.floor(Number(v?.units)),
      cost: Number(v?.cost),
    }))
    .filter(v => v.units > 0 && !isNaN(v.cost) && v.cost >= 0)
}

// Compra con varias variantes: crea un producto nuevo (oculto) o reabastece uno existente.
// Crea una fila Purchase por variante y suma el stock al sabor correspondiente.
async function postWithVariants(b: { mode?: string; productId?: number; name?: string; category?: string | null; date?: string; note?: string; variants: unknown }) {
  const variants = parseVariants(b.variants)
  if (variants.length === 0) {
    return NextResponse.json({ error: 'Añade al menos una variante con cantidad y coste' }, { status: 400 })
  }
  const date = b.date || new Date().toISOString().slice(0, 10)
  const note = (b.note || '').trim() || null
  const isNew = b.mode === 'new' || !b.productId

  if (isNew) {
    const name = (b.name || '').trim()
    if (!name) return NextResponse.json({ error: 'Indica el nombre del producto' }, { status: 400 })
    if (variants.some(v => !v.name)) return NextResponse.json({ error: 'Cada variante necesita un nombre' }, { status: 400 })
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name,
          price: 0,
          category: (b.category || '')?.toString().trim() || null,
          visible: false, // nace oculto hasta completarlo en Catálogo
          flavors: { create: variants.map(v => ({ name: v.name!, stock: v.units, inStock: v.units > 0 })) },
        },
        include: { flavors: true },
      })
      for (const v of variants) {
        const fl = created.flavors.find(f => f.name === v.name)!
        await tx.purchase.create({ data: { productId: created.id, flavorId: fl.id, units: v.units, productCost: v.cost, note, date } })
      }
      return created
    })
    return NextResponse.json({ ok: true, product })
  }

  // Reabastecer producto existente
  const productId = Number(b.productId)
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { flavors: true } })
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  await prisma.$transaction(async (tx) => {
    for (const v of variants) {
      let flavorId = v.flavorId ?? null
      let currentStock = 0
      if (flavorId != null) {
        const fl = product.flavors.find(f => f.id === flavorId)
        if (!fl) throw new Error('Sabor no pertenece al producto')
        currentStock = fl.stock ?? 0
      } else {
        // Variante nueva sobre un producto existente
        const newFl = await tx.flavor.create({ data: { name: (v.name || 'Sin nombre').trim(), productId, stock: 0, inStock: false } })
        flavorId = newFl.id
      }
      await tx.purchase.create({ data: { productId, flavorId, units: v.units, productCost: v.cost, note, date } })
      const newStock = currentStock + v.units
      await tx.flavor.update({ where: { id: flavorId }, data: { stock: newStock, inStock: newStock > 0 } })
    }
  })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const b = await req.json()
  // Nuevo flujo: compra con varias variantes (crear producto o reabastecer)
  if (Array.isArray(b.variants)) return postWithVariants(b)
  const productId = Number(b.productId)
  const units = Math.floor(Number(b.units))
  const productCost = Number(b.productCost)
  if (!productId || !units || units <= 0) {
    return NextResponse.json({ error: 'Indica producto y unidades (mayor que 0)' }, { status: 400 })
  }
  if (isNaN(productCost) || productCost < 0) {
    return NextResponse.json({ error: 'Indica el coste del producto' }, { status: 400 })
  }
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { flavors: true } })
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

  // Sabor al que sumar el stock (opcional). Si el producto tiene un solo sabor, se auto-asigna.
  let flavorId: number | null = b.flavorId != null ? Number(b.flavorId) : null
  const addToStock = b.addToStock !== false // por defecto sí suma
  if (flavorId == null && product.flavors.length === 1) flavorId = product.flavors[0].id
  if (flavorId != null && !product.flavors.some(f => f.id === flavorId)) {
    return NextResponse.json({ error: 'El sabor no pertenece a este producto' }, { status: 400 })
  }
  // Si se pide sumar al stock pero hay varios sabores y no se eligió ninguno, no sumar en silencio.
  if (addToStock && flavorId == null && product.flavors.length > 1) {
    return NextResponse.json({ error: 'Elige el sabor al que sumar el stock' }, { status: 400 })
  }

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        productId,
        flavorId: flavorId ?? undefined,
        units,
        productCost,
        shipping: Number(b.shipping) || 0,
        insurance: Number(b.insurance) || 0,
        otherCosts: Number(b.otherCosts) || 0,
        note: (b.note || '').trim() || null,
        date: b.date || new Date().toISOString().slice(0, 10),
      },
    })
    // Sumar las unidades al stock del sabor elegido
    if (addToStock && flavorId != null) {
      const fl = product.flavors.find(f => f.id === flavorId)!
      const newStock = (fl.stock ?? 0) + units
      await tx.flavor.update({ where: { id: flavorId }, data: { stock: newStock, inStock: newStock > 0 } })
    }
    return created
  })
  return NextResponse.json({ ok: true, purchase })
}
