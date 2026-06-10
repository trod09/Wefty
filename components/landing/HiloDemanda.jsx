'use client';

// «El hilo de demanda» — el lienzo fijo de fondo de la landing, conducido por
// el scroll (con inercia suave). Acompaña el relato por fases:
//
//   0 · HERO          fondo limpio: solo la retícula sutil, el texto y el CTA.
//   1 · EL PROBLEMA   fondo limpio: el concepto lo cuentan las piezas de la
//                     propia sección.
//   2 · CÓMO FUNCIONA nacen las barras ya ordenándose y una curva azul se
//                     dibuja sobre las puntas: el modelo encontrando el patrón.
//   3 · LA RED        el hilo se retira y cede el escenario a la esfera.
//   4 · CIERRE        todo se asienta en una curva de tallas perfecta.
//
// Reglas duras: un solo requestAnimationFrame (se pausa con la pestaña
// oculta), todo en canvas (cero reflow), posiciones de fase cacheadas (nada de
// medir el DOM por frame) e inercia para que el scroll nunca dé tirones.
// prefers-reduced-motion: el lienzo no arranca (sin bucle ni listeners) — las
// secciones ya son legibles y completas por sí mismas.
import { useEffect, useRef } from 'react';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
// Progreso 0→1 de s entre a y b, con suavizado (ease in-out).
const tramo = (s, a, b) => {
  const x = clamp01((s - a) / (b - a));
  return x * x * (3 - 2 * x);
};

export default function HiloDemanda() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');

    let raf = 0;
    let W = 0;
    let H = 0;
    let sObjetivo = 0;
    let sAnim = 0;
    let topes = [];

    const medirLienzo = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const medirFases = () => {
      topes = [...document.querySelectorAll('[data-fase]')].map((el) => {
        const r = el.getBoundingClientRect();
        const ini = r.top + window.scrollY;
        return { ini, fin: ini + r.height };
      });
    };

    const etapaDelScroll = () => {
      if (!topes.length) return 0;
      const y = window.scrollY + H * 0.55;
      for (let i = 0; i < topes.length; i++) {
        if (y < topes[i].ini) return i;
        if (y < topes[i].fin) return i + clamp01((y - topes[i].ini) / (topes[i].fin - topes[i].ini));
      }
      return topes.length;
    };

    // Ruido suave por capas de senos (la "demanda" cruda de las barras).
    const ruido = (u, t) =>
      0.5 +
      0.24 * Math.sin(u * 7.1 + t * 0.40) +
      0.16 * Math.sin(u * 16.3 - t * 0.26 + 1.7) +
      0.10 * Math.sin(u * 33.7 + t * 0.12 + 4.2);

    const pintar = (ms) => {
      const t = ms / 1000;
      sAnim += (sObjetivo - sAnim) * 0.07;
      const s = sAnim;
      ctx.clearRect(0, 0, W, H);

      // — Diales del relato (cada uno 0..1 según la etapa) —
      // Hero y El problema descansan; las barras nacen en "Cómo funciona".
      const entradaBarras = tramo(s, 1.95, 2.45);
      const orden = tramo(s, 1.95, 2.85);
      const curva = tramo(s, 2.05, 2.85);
      const red = tramo(s, 2.95, 3.45) * (1 - tramo(s, 3.85, 4.35));
      const calma = tramo(s, 3.9, 4.5);

      if (entradaBarras > 0.01) {
        const n = Math.max(40, Math.min(72, Math.floor(W / 22)));
        const paso = W / n;
        const barra = Math.max(3, paso * 0.4);
        const campoH = H * 0.30;
        const baseY = H * 0.96;

        const alturas = new Array(n);
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1);
          const hRuido = ruido(u, t);
          const hCampana = 0.18 + 0.78 * Math.exp(-((u - 0.5) * (u - 0.5)) / 0.05);
          const respira = 1 + 0.025 * calma * Math.sin(t * 0.9 + i * 0.45);
          alturas[i] = clamp01((hRuido * (1 - orden) + hCampana * orden) * respira) * campoH;
        }

        const alphaBarras = entradaBarras * (1 - red * 0.96);
        for (let i = 0; i < n; i++) {
          const x = i * paso + (paso - barra) / 2;
          const h = alturas[i];
          ctx.fillStyle = calma > 0.01
            ? `rgba(99, 138, 230, ${(0.10 + 0.30 * calma) * alphaBarras})`
            : `rgba(245, 245, 247, ${0.085 * alphaBarras})`;
          ctx.fillRect(x, baseY - h, barra, h);
        }

        // La curva del modelo, dibujándose sobre las puntas.
        if (curva > 0.01) {
          const alphaCurva = curva * (1 - red * 0.95) * entradaBarras;
          const hasta = Math.max(2, Math.floor(curva * n));
          const punto = (i) => [i * paso + paso / 2, baseY - alturas[i] - 3];
          for (const [grosor, alpha] of [[5, 0.10 * alphaCurva], [1.6, 0.85 * alphaCurva]]) {
            ctx.strokeStyle = `rgba(125, 163, 240, ${alpha})`;
            ctx.lineWidth = grosor;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(...punto(0));
            for (let i = 1; i < hasta; i++) ctx.lineTo(...punto(i));
            ctx.stroke();
          }
          if (curva < 0.999) {
            const [fx, fy] = punto(hasta - 1);
            ctx.fillStyle = `rgba(157, 180, 236, ${0.9 * alphaCurva})`;
            ctx.beginPath();
            ctx.arc(fx, fy, 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      raf = requestAnimationFrame(pintar);
    };

    const alScroll = () => { sObjetivo = etapaDelScroll(); };
    const alRedimensionar = () => {
      medirLienzo();
      medirFases();
      alScroll();
    };

    medirLienzo();
    medirFases();
    alScroll();
    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('resize', alRedimensionar);
    const ro = new ResizeObserver(() => { medirFases(); alScroll(); });
    ro.observe(document.body);
    raf = requestAnimationFrame(pintar);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', alScroll);
      window.removeEventListener('resize', alRedimensionar);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="fixed inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
