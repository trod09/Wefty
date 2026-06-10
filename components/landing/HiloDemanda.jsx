'use client';

// «El hilo de demanda» — la animación protagonista de TODA la landing.
// Un lienzo fijo a pantalla completa, detrás del contenido, conducido por el
// scroll (con inercia suave). Cuenta la historia del producto en cinco fases,
// una por sección:
//
//   0 · HERO          caos: barras ruidosas, la lectura azul patrullando.
//   1 · EL PROBLEMA   aparecen los errores: tapas ámbar (sobreproducción)
//                     y huecos fantasma (venta perdida).
//   2 · CÓMO FUNCIONA el ruido se limpia y una curva azul se dibuja sobre
//                     las puntas: el modelo encontrando el patrón.
//   3 · LA RED        las barras se disuelven en una malla de puntos que se
//                     conectan: la inteligencia compartida.
//   4 · CIERRE        todo vuelve y se asienta en una curva de tallas
//                     perfecta, serena: el pedido resuelto.
//
// Reglas duras: un solo requestAnimationFrame, todo en canvas (cero reflow),
// posiciones de fase cacheadas (nada de medir el DOM en cada frame), inercia
// para que el scroll nunca dé tirones, y con prefers-reduced-motion se pinta
// UN fotograma estático (la curva final) sin bucle ni listeners.
import { useEffect, useRef } from 'react';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
// Progreso 0→1 de s entre a y b, con suavizado (ease in-out).
const tramo = (s, a, b) => {
  const x = clamp01((s - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const frac = (x) => x - Math.floor(x);

export default function HiloDemanda() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let W = 0;
    let H = 0;
    let sObjetivo = 0; // etapa que pide el scroll (0..5)
    let sAnim = reducir ? 4.6 : 0; // etapa animada con inercia
    let topes = []; // [{ini, fin}] de cada sección [data-fase], en px de documento

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

    // Etapa continua 0..5: dentro de la sección i vale i + progreso local.
    const etapaDelScroll = () => {
      if (!topes.length) return 0;
      const y = window.scrollY + H * 0.55; // punto de lectura: media pantalla
      for (let i = 0; i < topes.length; i++) {
        if (y < topes[i].ini) return i; // hueco entre secciones
        if (y < topes[i].fin) return i + clamp01((y - topes[i].ini) / (topes[i].fin - topes[i].ini));
      }
      return topes.length;
    };

    // Ruido suave por capas de senos (la "demanda" cruda).
    const ruido = (u, t) =>
      0.5 +
      0.24 * Math.sin(u * 7.1 + t * 0.40) +
      0.16 * Math.sin(u * 16.3 - t * 0.26 + 1.7) +
      0.10 * Math.sin(u * 33.7 + t * 0.12 + 4.2);

    const pintar = (ms) => {
      const t = reducir ? 18 : ms / 1000;
      if (!reducir) sAnim += (sObjetivo - sAnim) * 0.07; // inercia del relato
      const s = sAnim;
      ctx.clearRect(0, 0, W, H);

      // — Diales del relato (cada uno 0..1 según la etapa) —
      const errores = tramo(s, 0.85, 1.45) * (1 - tramo(s, 1.95, 2.55)); // nacen en El problema, se limpian después
      const orden = tramo(s, 1.95, 2.85) * (1 - 0.25 * tramo(s, 2.9, 3.4) * (1 - tramo(s, 3.9, 4.3))); // hacia la campana
      const curva = tramo(s, 2.05, 2.85); // la línea del modelo se dibuja
      const red = tramo(s, 2.95, 3.45) * (1 - tramo(s, 3.85, 4.35)); // barras ⇄ malla
      const escaner = 1 - tramo(s, 1.7, 2.35); // la lectura patrulla al principio
      const calma = tramo(s, 3.9, 4.5); // respiración final, todo azulado

      const n = Math.max(40, Math.min(72, Math.floor(W / 22)));
      const paso = W / n;
      const barra = Math.max(3, paso * 0.4);
      const campoH = H * 0.30;
      const baseY = H * 0.96;
      const foco = ((t * 0.05) % 1.3) - 0.15;

      // Alturas: ruido (amortiguado por el orden) mezclado con la campana de tallas.
      const alturas = new Array(n);
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const hRuido = ruido(u, t);
        const hCampana = 0.18 + 0.78 * Math.exp(-((u - 0.5) * (u - 0.5)) / 0.05);
        const respira = 1 + 0.025 * calma * Math.sin(t * 0.9 + i * 0.45);
        alturas[i] = clamp01((hRuido * (1 - orden) + hCampana * orden) * respira) * campoH;
      }

      // — Barras (se desvanecen cuando manda la red) —
      const alphaBarras = (1 - red * 0.92);
      for (let i = 0; i < n; i++) {
        const x = i * paso + (paso - barra) / 2;
        let h = alturas[i];
        const u = i / (n - 1);

        const esSobrante = i % 7 === 2;
        const esFaltante = i % 9 === 4;

        // Venta perdida: la barra real se encoge y deja un hueco fantasma.
        let hueco = 0;
        if (esFaltante && errores > 0.01) {
          hueco = h * 0.42 * errores;
          h -= hueco;
        }

        const d = u - foco;
        const brillo = escaner > 0.01 ? Math.exp(-(d * d) / 0.004) * escaner : 0;
        const azulFinal = 0.10 + 0.30 * calma;
        ctx.fillStyle = brillo > 0.02
          ? `rgba(63, 123, 236, ${(0.10 + 0.5 * brillo) * alphaBarras})`
          : calma > 0.01
            ? `rgba(99, 138, 230, ${azulFinal * alphaBarras})`
            : `rgba(245, 245, 247, ${0.085 * alphaBarras})`;
        ctx.fillRect(x, baseY - h, barra, h);

        // Sobreproducción: tapa ámbar creciendo sobre la demanda real.
        if (esSobrante && errores > 0.01) {
          const tapa = alturas[i] * 0.5 * errores;
          ctx.fillStyle = `rgba(224, 122, 95, ${0.5 * errores * alphaBarras})`;
          ctx.fillRect(x, baseY - h - tapa, barra, tapa);
        }
        // Hueco fantasma: contorno discontinuo de lo que no pudiste vender.
        if (hueco > 1) {
          ctx.strokeStyle = `rgba(245, 245, 247, ${0.35 * errores * alphaBarras})`;
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, baseY - alturas[i] + 0.5, barra - 1, hueco - 1);
          ctx.setLineDash([]);
        }
      }

      // — La curva del modelo, dibujándose sobre las puntas —
      if (curva > 0.01) {
        const alphaCurva = curva * (1 - red * 0.85);
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
        // El frente de dibujo, como una pluma luminosa.
        if (curva < 0.999) {
          const [fx, fy] = punto(hasta - 1);
          ctx.fillStyle = `rgba(157, 180, 236, ${0.9 * alphaCurva})`;
          ctx.beginPath();
          ctx.arc(fx, fy, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // — La red: las puntas se disuelven en nodos que se conectan —
      if (red > 0.01) {
        const m = Math.min(n, W < 640 ? 26 : 44);
        const puntos = [];
        for (let k = 0; k < m; k++) {
          const i = Math.floor((k / (m - 1)) * (n - 1));
          const bx = i * paso + paso / 2;
          const by = baseY - alturas[i];
          const nx = (frac(k * 0.61803) * 0.9 + 0.05) * W + 9 * Math.sin(t * 0.16 + k * 1.7);
          const ny = (0.16 + 0.6 * frac(k * 0.38197 + 0.17)) * H + 7 * Math.sin(t * 0.12 + k * 2.3);
          const x = bx + (nx - bx) * red;
          const y = by + (ny - by) * red;
          const brillo = 0.35 + 0.65 * Math.max(0, Math.sin(t * 0.55 - k * 0.5));
          puntos.push({ x, y, brillo });
        }
        const radio = Math.min(W, H) * 0.22;
        for (let a = 0; a < m; a++) {
          for (let b = a + 1; b < m; b++) {
            const dx = puntos[a].x - puntos[b].x;
            const dy = puntos[a].y - puntos[b].y;
            const d = Math.hypot(dx, dy);
            if (d < radio) {
              const alpha = (1 - d / radio) * 0.22 * red * Math.max(puntos[a].brillo, puntos[b].brillo);
              ctx.strokeStyle = `rgba(91, 141, 238, ${alpha})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(puntos[a].x, puntos[a].y);
              ctx.lineTo(puntos[b].x, puntos[b].y);
              ctx.stroke();
            }
          }
        }
        for (const p of puntos) {
          ctx.fillStyle = `rgba(157, 180, 236, ${(0.25 + 0.55 * p.brillo) * red})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.5 + 1.3 * p.brillo * red, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!reducir) raf = requestAnimationFrame(pintar);
    };

    const alScroll = () => { sObjetivo = etapaDelScroll(); };
    const alRedimensionar = () => {
      medirLienzo();
      medirFases();
      alScroll();
      if (reducir) pintar(0);
    };

    medirLienzo();
    medirFases();
    alScroll();
    if (reducir) {
      pintar(0); // un fotograma sereno: la curva final
    } else {
      window.addEventListener('scroll', alScroll, { passive: true });
      raf = requestAnimationFrame(pintar);
    }
    window.addEventListener('resize', alRedimensionar);
    // Si el contenido cambia de altura (imágenes, fuentes…), re-medimos fases.
    const ro = new ResizeObserver(() => { medirFases(); alScroll(); });
    ro.observe(document.body);

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
