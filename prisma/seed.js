const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Códigos de acceso
  for (const c of [
    { code: 'BLESS001', clientName: 'Cliente 1' },
    { code: 'BLESS002', clientName: 'Cliente 2' },
    { code: 'BLESS003', clientName: 'Cliente 3' },
    { code: 'VIP2024', clientName: 'VIP' },
  ]) {
    await prisma.accessCode.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    })
  }

  const products = [
    {
      name: 'Rock me x Blesser', price: 18,
      description: 'El vaper exclusivo de la colección Blesser. Potencia y sabor en cada calada.',
      specs: '6% nicotina · 25.000 caladas', category: 'Rock me x Blesser', position: 1,
      flavors: [
        { name: 'Piña Colada', inStock: true }, { name: 'Lima Limón', inStock: true },
        { name: 'Fresa Plátano', inStock: true }, { name: 'Coca-Cola Ice', inStock: true },
        { name: 'Red Bull', inStock: true }, { name: 'Limonada Rosa', inStock: true },
        { name: 'Algodón de Azúcar', inStock: true }, { name: 'Sandía Frambuesa', inStock: true },
        { name: 'Doble Manzana', inStock: true }, { name: 'Osito Gominola', inStock: false },
      ],
    },
    {
      name: 'Crystal Pro Max', price: 15,
      description: 'Diseño ultra-compacto con cuerpo cristalino translúcido. Ideal para llevar siempre encima.',
      specs: '5% nicotina · 15.000 caladas', category: 'Crystal Pro', position: 2,
      flavors: [
        { name: 'Mango Hielo', inStock: true }, { name: 'Menta Fresca', inStock: true },
        { name: 'Uva Negra', inStock: true }, { name: 'Melocotón Ice', inStock: true },
        { name: 'Tropical Mix', inStock: true }, { name: 'Fresa Kiwi', inStock: false },
      ],
    },
    {
      name: 'Elfbar 600', price: 9,
      description: 'El clásico que nunca falla. Compacto, potente y con una autonomía perfecta para el día a día.',
      specs: '2% nicotina · 600 caladas', category: 'Elfbar', position: 3,
      flavors: [
        { name: 'Blueberry', inStock: true }, { name: 'Watermelon Ice', inStock: true },
        { name: 'Pink Lemonade', inStock: true }, { name: 'Peach Ice', inStock: true },
        { name: 'Cola Ice', inStock: true }, { name: 'Lychee Ice', inStock: true },
        { name: 'Strawberry Kiwi', inStock: true }, { name: 'Menthol', inStock: false },
      ],
    },
    {
      name: 'Lost Mary BM600', price: 10,
      description: 'Forma redondeada única, perfecta para el agarre. Sabores intensos y vapor denso.',
      specs: '2% nicotina · 600 caladas', category: 'Lost Mary', position: 4,
      flavors: [
        { name: 'Citrus Sunrise', inStock: true }, { name: 'Triple Mango', inStock: true },
        { name: 'Sour Apple Ice', inStock: true }, { name: 'Cherry Ice', inStock: true },
        { name: 'Pineapple Ice', inStock: true }, { name: 'Berry Burst', inStock: false },
      ],
    },
    {
      name: 'Hayati Pro Ultra', price: 22,
      description: 'La bestia de las caladas. Batería de larga duración y pantalla LED de nivel de líquido.',
      specs: '5% nicotina · 15.000 caladas · Con pantalla', category: 'Hayati', position: 5,
      flavors: [
        { name: 'Watermelon Bubblegum', inStock: true }, { name: 'Blue Razz Ice', inStock: true },
        { name: 'Strawberry Banana', inStock: true }, { name: 'Grape Ice', inStock: true },
        { name: 'Passion Fruit Mango', inStock: true }, { name: 'Cool Mint', inStock: true },
        { name: 'Rainbow', inStock: false },
      ],
    },
    {
      name: 'Randm Tornado 7000', price: 16,
      description: 'Diseño aerodinámico con luz RGB. Caladas suaves con sabores intensos.',
      specs: '5% nicotina · 7.000 caladas · RGB', category: 'Randm', position: 6,
      flavors: [
        { name: 'Mixed Berries', inStock: true }, { name: 'Coconut Melon', inStock: true },
        { name: 'Blueberry Raspberry', inStock: true }, { name: 'Banana Ice', inStock: true },
        { name: 'Peach Mango Watermelon', inStock: true }, { name: 'Aloe Grape', inStock: false },
      ],
    },
  ]

  for (const { flavors, ...data } of products) {
    const exists = await prisma.product.findFirst({ where: { name: data.name } })
    if (!exists) {
      await prisma.product.create({ data: { ...data, flavors: { create: flavors } } })
    }
  }

  console.log('✅ Seed completado: ' + products.length + ' productos, 4 códigos de acceso')
}

main().catch(console.error).finally(() => prisma.$disconnect())
