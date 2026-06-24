import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminToken } from '@/lib/auth'

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  return token ? verifyAdminToken(token) : null
}

// Datos brutos para el módulo de Facturación. El cálculo se hace en cliente con src/lib/billing.
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [ordersRaw, purchases, expenses, products] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ['completed', 'ready', 'pending'] } },
      include: {
        items: { select: { productId: true, productName: true, price: true, onSale: true, quantity: true }, orderBy: { id: 'asc' } },
        accessCode: { select: { clientName: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.purchase.findMany({ select: { productId: true, units: true, productCost: true, shipping: true, insurance: true, otherCosts: true } }),
    prisma.expense.findMany({ select: { id: true, category: true, amount: true, date: true } }),
    prisma.product.findMany({ select: { id: true, name: true, category: true, price: true } }),
  ])

  const orders = ordersRaw.map(o => ({
    id: o.id,
    total: o.total,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    accessCodeId: o.accessCodeId,
    customerName: o.customerName,
    clientName: o.accessCode?.clientName ?? null,
    payWith: o.payWith,
    items: o.items,
  }))

  return NextResponse.json({ orders, purchases, expenses, products })
}
