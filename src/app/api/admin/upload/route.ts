import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'
import { verifyAdminToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Formato no permitido. Usa JPG, PNG o WebP.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const filepath = path.join(process.cwd(), 'public', 'uploads', filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filepath, buffer)

  return NextResponse.json({ url: `/api/uploads/${filename}` })
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get('bs_admin')?.value
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { url } = await req.json()
  if (!url || !url.startsWith('/uploads/')) {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
  }

  const filename = path.basename(url)
  const filepath = path.join(process.cwd(), 'public', 'uploads', filename)

  try {
    await unlink(filepath)
  } catch {
    // Si ya no existe, no pasa nada
  }

  return NextResponse.json({ ok: true })
}
