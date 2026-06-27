'use client'

import React, { forwardRef } from 'react'

interface StarBorderProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: string       // color del brillo del borde
  speed?: string       // duración de la animación (p.ej. '6s')
  innerClassName?: string
  innerStyle?: React.CSSProperties
}

// Botón con borde animado (dos "estrellas" que recorren el borde superior e inferior).
// Adaptado de ReactBits "Star Border" al tema oscuro de Blesser Store.
const StarBorder = forwardRef<HTMLButtonElement, StarBorderProps>(function StarBorder(
  { color = 'var(--accent2)', speed = '6s', innerClassName = '', innerStyle, children, className = '', style, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={`bs-star-border relative inline-block overflow-hidden rounded-2xl cursor-pointer disabled:opacity-50 ${className}`}
      style={{ padding: '1.5px 0', ...style }}
    >
      <span className="bs-star bs-star-bottom" style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }} />
      <span className="bs-star bs-star-top" style={{ background: `radial-gradient(circle, ${color}, transparent 10%)`, animationDuration: speed }} />
      <span className={`relative z-[1] flex items-center justify-center gap-2 rounded-2xl ${innerClassName}`} style={innerStyle}>
        {children}
      </span>
    </button>
  )
})

export default StarBorder
