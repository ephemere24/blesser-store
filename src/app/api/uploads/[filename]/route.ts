import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return new NextResponse('Not found', { status: 404 })
  }

  const filepath = path.join(process.cwd(), 'public', 'uploads', filename)
  try {
    const file = await readFile(filepath)
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    }
    const contentType = mimeTypes[ext] ?? 'application/octet-stream'
    return new NextResponse(file, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000' },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
