import { prisma } from '@/lib/db'

// Genera un código de acceso único tipo BLESSxxxx
export async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = `BLESS${Math.floor(1000 + Math.random() * 9000)}`
    const existing = await prisma.accessCode.findUnique({ where: { code } })
    if (!existing) return code
  }
  return `BLESS${Date.now().toString().slice(-6)}`
}

export async function getSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } })
  return s?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}
