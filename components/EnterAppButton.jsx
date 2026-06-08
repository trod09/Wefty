'use client';

// Botón de entrada al producto ("Probar Wefty").
// El destino lo decide la sesión vía useProductHref: con sesión → /upload,
// sin sesión → /login. Es un enlace real (<a>), así que funciona el clic
// derecho, abrir en pestaña nueva, etc.
// Reutiliza el mismo lenguaje visual que MagneticButton (flecha + efecto
// magnético). Dos tonos:
//   · 'ink'  → fondo claro (hero): botón oscuro
//   · 'bone' → fondo oscuro (footer): botón claro
import React from 'react';
import { EASE, useMagnetic } from './hooks';
import { useProductHref } from './useProductHref';

export default function EnterAppButton({ children, tone = 'ink', className = '' }) {
  const href = useProductHref();
  const ref = useMagnetic(8, 120);
  const base =
    'relative inline-flex items-center justify-center gap-3 px-7 h-12 font-medium text-[14px] tracking-[-0.005em] magnetic select-none';
  const styles =
    tone === 'bone'
      ? 'bg-bone text-ink hover:bg-electric hover:text-bone'
      : 'bg-ink text-bone hover:bg-electric';
  return (
    <a
      ref={ref}
      href={href}
      className={`${base} ${styles} ${className}`}
      style={{ transition: 'background 350ms ' + EASE + ', color 350ms ' + EASE + ', transform 350ms ' + EASE }}
    >
      <span className="relative z-10">{children}</span>
      <span className="relative z-10 w-3 h-3 flex items-center justify-center">
        <svg viewBox="0 0 12 12" className="w-3 h-3">
          <path d="M2 6 H10 M7 3 L10 6 L7 9" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinecap="square" />
        </svg>
      </span>
    </a>
  );
}
