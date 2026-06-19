// Importa los datos exportados de SQLite (backup-data.json) a la base de datos actual.
// Uso: node prisma/import-backup.js /ruta/backup-data.json
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const prisma = new PrismaClient()
const file = process.argv[2] || '/app/backup-data.json'

async function main() {
  const raw = fs.readFileSync(file, 'utf8')
  const data = JSON.parse(raw)

  // Códigos de acceso
  for (const c of data.accessCodes) {
    await prisma.accessCode.upsert({
      where: { code: c.code },
      update: { clientName: c.clientName, active: c.active },
      create: { code: c.code, clientName: c.clientName, active: c.active },
    })
  }

  // Productos + sabores
  for (const p of data.products) {
    await prisma.product.create({
      data: {
        name: p.name,
        price: p.price,
        description: p.description,
        specs: p.specs,
        category: p.category,
        images: p.images,
        visible: p.visible,
        position: p.position,
        flavors: {
          create: (p.flavors || []).map(f => ({ name: f.name, inStock: f.inStock, stock: f.stock ?? 0 })),
        },
      },
    })
  }

  const codes = await prisma.accessCode.count()
  const products = await prisma.product.count()
  const flavors = await prisma.flavor.count()
  console.log(`Importado: codes=${codes} products=${products} flavors=${flavors}`)
  process.exit(0)
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
