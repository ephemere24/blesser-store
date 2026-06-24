'use client'

import { useEffect, useState } from 'react'
import Ferrofluid from './Ferrofluid'

/**
 * Fondo animado Ferrofluid para el sitio de clientes.
 * Se fija a pantalla completa, detrás de todo el contenido (z-index 0),
 * sobre el color de fondo base. Respeta prefers-reduced-motion.
 *
 * Para que se vea, el contenedor raíz de la página debe tener fondo
 * transparente y un z-index/posición que lo sitúe por encima (z-index >= 1).
 */
export default function SiteBackground() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: 'var(--bg)',
      }}
    >
      <Ferrofluid
        colors={['#ffffff', '#94a3b8', '#ffffff']}
        speed={0.1}
        scale={1}
        turbulence={1.1}
        fluidity={0.1}
        rimWidth={0.2}
        sharpness={3}
        shimmer={1}
        glow={1.6}
        flowDirection="down"
        opacity={0.55}
        mouseInteraction={false}
        paused={reduced}
      />
    </div>
  )
}
