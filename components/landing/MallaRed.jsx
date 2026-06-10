'use client';

// «Malla de la red» — la metáfora del pool de datos para la sección La Red.
// Puntos (marcas) que derivan despacio y se conectan con líneas tenues cuando
// se acercan; un brillo recorre los nodos como información circulando.
// Mismas reglas que el campo del hero: canvas puro, un rAF, pausa fuera de
// pantalla y fotograma estático con prefers-reduced-motion.
import { useEffect, useRef } from 'react';

export default function MallaRed({ className = '' }) {
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

    // Posiciones deterministas (sin Math.random): fracciones áureas por índice.
    const frac = (x) => x - Math.floor(x);

    const pintar = (ms) => {
      const t = reducirMovimiento ? 12 : ms / 1000;
      ctx.clearRect(0, 0, ancho, alto);

      const n = ancho < 640 ? 22 : 38;
      const puntos = [];
      for (let i = 0; i < n; i++) {
        const bx = frac(i * 0.61803);
        const by = frac(i * 0.38197 + 0.17);
        const x = (bx + 0.035 * Math.sin(t * 0.16 + i * 1.7)) * ancho;
        const y = (by + 0.045 * Math.sin(t * 0.12 + i * 2.3 + 1.1)) * alto;
        // Un brillo viaja por los nodos: información circulando por la red.
        const brillo = 0.35 + 0.65 * Math.max(0, Math.sin(t * 0.55 - i * 0.5));
        puntos.push({ x, y, brillo });
      }

      // Líneas entre vecinos cercanos (alpha según distancia).
      const radio = Math.min(ancho, alto) * 0.24;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = puntos[i].x - puntos[j].x;
          const dy = puntos[i].y - puntos[j].y;
          const d = Math.hypot(dx, dy);
          if (d < radio) {
            const a = (1 - d / radio) * 0.22 * Math.max(puntos[i].brillo, puntos[j].brillo);
            ctx.strokeStyle = `rgba(91, 141, 238, ${a})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(puntos[i].x, puntos[i].y);
            ctx.lineTo(puntos[j].x, puntos[j].y);
            ctx.stroke();
          }
        }
      }

      for (const p of puntos) {
        ctx.fillStyle = `rgba(157, 180, 236, ${0.25 + 0.55 * p.brillo})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.6 + 1.2 * p.brillo, 0, Math.PI * 2);
        ctx.fill();
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
