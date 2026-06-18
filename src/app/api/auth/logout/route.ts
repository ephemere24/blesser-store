import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('bs_token')
  response.cookies.delete('bs_admin')
  return response
}
