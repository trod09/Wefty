'use client';

// «Brújula de fases» — raíl fijo en el borde derecho (solo escritorio) que
// marca en qué capítulo del relato estás mientras haces scroll. Acompaña al
// hilo de demanda: mismo orden, misma historia. Decorativa (aria-hidden) y
// sin coste: un IntersectionObserver con banda central, cero trabajo por frame.
import { useEffect, useState } from 'react';

const FASES = ['Inicio', 'El problema', 'Cómo funciona', 'La red', 'Tu pedido'];

export default function BrujulaFases() {
  const [activa, setActiva] = useState(0);

  useEffect(() => {
    const secciones = [...document.querySelectorAll('[data-fase]')];
    if (!secciones.length) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) setActiva(Number(e.target.dataset.fase));
        }
      },
      // Banda central del viewport: la sección que la cruza es la activa.
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    secciones.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, []);

  return (
    <div
      aria-hidden="true"
      className="hidden lg:flex fixed right-7 top-1/2 -translate-y-1/2 z-20 flex-col items-end gap-5 pointer-events-none"
    >
      {FASES.map((nombre, i) => {
        const esActiva = i === activa;
        return (
          <div key={nombre} className="flex items-center gap-3">
            <span
              className="font-mono text-[10px] tracking-[0.18em] uppercase transition-opacity duration-200"
              style={{ color: '#9db4ec', opacity: esActiva ? 1 : 0 }}
            >
              {nombre}
            </span>
            <span
              className="font-mono text-[10px] tnum transition-colors duration-200"
              style={{ color: esActiva ? '#9db4ec' : '#3a3c42' }}
            >
              0{i + 1}
            </span>
            <span
              className="block h-px w-9 origin-right transition-[transform,background-color] duration-200 ease-out"
              style={{
                background: esActiva ? '#7da3f0' : 'rgba(245,245,247,0.18)',
                transform: esActiva ? 'scaleX(1)' : 'scaleX(0.45)',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
