'use client';

// «Campo de demanda» — la animación protagonista del hero de la landing.
// Un horizonte de barras finas (la demanda de un catálogo imaginario, semana a
// semana) que respira con un vaivén orgánico, mientras una "lectura" azul
// eléctrico lo recorre despacio iluminando las barras a su paso: la metáfora
// de Wefty leyendo la demanda.
//
// Reglas duras de rendimiento:
//  · Canvas puro (cero reflow del DOM), un solo requestAnimationFrame.
//  · ~50-90 rectángulos por fotograma: coste despreciable, 60fps también en móvil.
//  · prefers-reduced-motion → UN fotograma estático, sin bucle.
//  · El bucle se pausa cuando el hero sale del viewport (IntersectionObserver).
import { useEffect, useRef } from 'react';

export default function CampoDemanda({ className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let ancho = 0;
    let alto = 0;
    let visible = true;

    const medir = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ancho = canvas.clientWidth;
      alto = canvas.clientHeight;
      canvas.width = Math.round(ancho * dpr);
      canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Altura 0..1 de la barra i: tres capas de senos a distinta frecuencia y
    // velocidad → un "ruido" suave que parece demanda real, nunca se repite a
    // simple vista y deriva muy despacio.
    const altura = (i, n, t) => {
      const x = i / n;
      const v =
        0.45 +
        0.21 * Math.sin(x * 7.1 + t * 0.40) +
        0.15 * Math.sin(x * 16.3 - t * 0.26 + 1.7) +
        0.10 * Math.sin(x * 33.7 + t * 0.12 + 4.2);
      return Math.max(0.06, Math.min(0.96, v));
    };

    const pintar = (ms) => {
      const t = ms / 1000;
      ctx.clearRect(0, 0, ancho, alto);

      const n = Math.max(36, Math.floor(ancho / 16));
      const paso = ancho / n;
      const barra = Math.max(3, paso * 0.42);
      // La "lectura" recorre el campo en ~26 s, con un respiro fuera de cuadro.
      const foco = reducirMovimiento ? 0.5 : ((t * 0.05) % 1.3) - 0.15;

      for (let i = 0; i < n; i++) {
        const x = i * paso + (paso - barra) / 2;
        const h = altura(i, n, reducirMovimiento ? 18 : t) * (alto * 0.88);
        const d = i / n - foco;
        const brillo = Math.exp(-(d * d) / 0.004); // campana estrecha alrededor del foco

        ctx.fillStyle = brillo > 0.02
          ? `rgba(63, 123, 236, ${0.10 + 0.55 * brillo})`
          : 'rgba(245, 245, 247, 0.085)';
        ctx.fillRect(x, alto - h, barra, h);

        // Remate luminoso en los picos que la lectura está tocando.
        if (brillo > 0.35) {
          ctx.fillStyle = `rgba(157, 180, 236, ${0.55 * brillo})`;
          ctx.fillRect(x, alto - h - 2, barra, 2);
        }
      }

      if (!reducirMovimiento && visible) raf = requestAnimationFrame(pintar);
    };

    const arrancar = () => {
      cancelAnimationFrame(raf);
      if (reducirMovimiento) pintar(0);
      else raf = requestAnimationFrame(pintar);
    };

    medir();
    arrancar();

    const alRedimensionar = () => {
      medir();
      if (reducirMovimiento) pintar(0);
    };
    window.addEventListener('resize', alRedimensionar);

    // Pausa el bucle cuando el campo no se ve (scroll más abajo): cero trabajo.
    const observador = new IntersectionObserver(([entrada]) => {
      visible = entrada.isIntersecting;
      if (visible) arrancar();
      else cancelAnimationFrame(raf);
    });
    observador.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', alRedimensionar);
      observador.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
