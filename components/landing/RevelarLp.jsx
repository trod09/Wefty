'use client';

// Revela su contenido al entrar en el viewport (IntersectionObserver), con un
// retardo opcional para escalonar bloques hermanos. Las clases lp-revela /
// lp-vis solo animan transform y opacity, y únicamente cuando el usuario NO
// tiene activado "reducir movimiento" (con él, todo es visible al instante).
import { useEffect, useRef } from 'react';

export default function RevelarLp({ children, retardo = 0, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          el.classList.add('lp-vis');
          observador.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' }
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`lp-revela ${className}`}
      style={retardo ? { '--rd': `${retardo}s` } : undefined}
    >
      {children}
    </div>
  );
}
