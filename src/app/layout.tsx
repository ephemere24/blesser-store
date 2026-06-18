import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Blesser Store',
  description: 'Tienda privada Blesser Store',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
