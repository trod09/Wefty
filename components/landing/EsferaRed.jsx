'use client';

// «Esfera de la red» — la pieza protagonista de la sección [04] La Red.
// Una constelación 3D de nodos (esfera de Fibonacci: reparto uniforme) que
// rota despacio, con las marcas en azul eléctrico, líneas finas entre vecinos
// y pulsos de luz viajando por las conexiones: la inteligencia circulando.
//
// 3D a mano sobre canvas 2D (sin three.js ni nada): rotación Y+X, proyección
// en perspectiva y sombreado por profundidad. El ZOOM va ligado al progreso
// real de la sección en el viewport, con inercia — al adentrarte, se encienden
// más nodos y las conexiones ganan presencia.
//
// Rendimiento: topología de enlaces precalculada UNA vez (3 vecinos más
// cercanos por nodo, nunca todos contra todos), 140 nodos en escritorio y 64
// en móvil, un solo rAF que se PAUSA fuera de pantalla, devicePixelRatio
// limitado a 2. Con prefers-reduced-motion: un fotograma estático, sin bucle.
import { useEffect, useRef } from 'react';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const frac = (x) => x - Math.floor(x);

export default function EsferaRed({ className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let W = 0;
    let H = 0;
    let visible = true;
    let pObjetivo = reducir ? 0.85 : 0; // progreso de scroll (0 lejos · 1 dentro)
    let pAnim = pObjetivo;

    let N = 0;
    let nodos = [];   // posiciones 3D unitarias + "sello" determinista por nodo
    let enlaces = []; // pares [i, j] de vecinos cercanos (topología fija)

    const esMovil = () => window.innerWidth < 640;

    const construir = () => {
      N = esMovil() ? 64 : 140;
      nodos = [];
      const ANGULO_AUREO = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i++) {
        const y = 1 - (2 * (i + 0.5)) / N;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const th = i * ANGULO_AUREO;
        nodos.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, sello: frac(i * 0.7548) });
      }
      // 3 vecinos más cercanos por nodo, sin duplicar pares (se calcula una vez).
      const vistos = new Set();
      enlaces = [];
      for (let i = 0; i < N; i++) {
        const distancias = [];
        for (let j = 0; j < N; j++) {
          if (j === i) continue;
          const dx = nodos[i].x - nodos[j].x;
          const dy = nodos[i].y - nodos[j].y;
          const dz = nodos[i].z - nodos[j].z;
          distancias.push([j, dx * dx + dy * dy + dz * dz]);
        }
        distancias.sort((a, b) => a[1] - b[1]);
        for (let k = 0; k < 3; k++) {
          const j = distancias[k][0];
          const clave = i < j ? i * 1000 + j : j * 1000 + i;
          if (!vistos.has(clave)) {
            vistos.add(clave);
            enlaces.push([i, j]);
          }
        }
      }
    };

    const medir = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Progreso de la sección en el viewport: 0 cuando asoma por abajo,
    // 1 poco después de quedar centrada (el zoom culmina ahí y se mantiene).
    const leerScroll = () => {
      const rect = canvas.getBoundingClientRect();
      const vh = window.innerHeight;
      const crudo = (vh - rect.top) / (vh + rect.height);
      pObjetivo = clamp01(crudo * 1.9);
    };

    const pintar = (ms) => {
      const t = reducir ? 40 : ms / 1000;
      if (!reducir) pAnim += (pObjetivo - pAnim) * 0.08; // inercia del zoom
      const e = pAnim * pAnim * (3 - 2 * pAnim); // suavizado
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const zoomIni = esMovil() ? 0.7 : 0.55;
      const zoomFin = esMovil() ? 1.0 : 1.15;
      const R = Math.min(W, H) * 0.42 * (zoomIni + (zoomFin - zoomIni) * e);

      // Rotación continua sobre su eje + cabeceo fijo con un vaivén mínimo.
      const giro = reducir ? 0.8 : t * 0.12;
      const cabeceo = 0.32 + (reducir ? 0 : 0.05 * Math.sin(t * 0.07));
      const cosY = Math.cos(giro), sinY = Math.sin(giro);
      const cosX = Math.cos(cabeceo), sinX = Math.sin(cabeceo);
      const F = 3.1; // distancia focal de la perspectiva

      const proy = new Array(N);
      for (let i = 0; i < N; i++) {
        const q = nodos[i];
        const x1 = q.x * cosY + q.z * sinY;
        const z1 = -q.x * sinY + q.z * cosY;
        const y1 = q.y * cosX - z1 * sinX;
        const z2 = q.y * sinX + z1 * cosX;
        const esc = F / (F + z2);
        proy[i] = { x: cx + x1 * R * esc, y: cy + y1 * R * esc, z: z2, esc };
      }

      // — Enlaces: más presentes cuanto más te adentras (e) y más de frente (prof) —
      for (const [a, b] of enlaces) {
        const A = proy[a], B = proy[b];
        const prof = 1 - (A.z + B.z + 2) / 4; // 0 detrás · 1 delante
        const alpha = (0.035 + 0.20 * prof) * (0.45 + 0.75 * e);
        ctx.strokeStyle = `rgba(91, 141, 238, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }

      // — Pulsos: destellos que recorren una conexión (dos a la vez, desfasados) —
      if (!reducir && enlaces.length) {
        for (let s = 0; s < 2; s++) {
          const ciclo = t / 1.15 + s * 0.5;
          const k = Math.floor(ciclo);
          const fase = ciclo - k;
          const [a, b] = enlaces[(k * 37 + s * 101) % enlaces.length];
          const A = proy[a], B = proy[b];
          const px = A.x + (B.x - A.x) * fase;
          const py = A.y + (B.y - A.y) * fase;
          const alphaP = Math.sin(fase * Math.PI) * (0.35 + 0.55 * e);
          // La conexión se enciende al paso del pulso…
          ctx.strokeStyle = `rgba(125, 163, 240, ${alphaP * 0.45})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(A.x, A.y);
          ctx.lineTo(B.x, B.y);
          ctx.stroke();
          // …y el destello viaja con halo y núcleo.
          ctx.fillStyle = `rgba(63, 123, 236, ${alphaP * 0.3})`;
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(200, 218, 255, ${alphaP})`;
          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // — Nodos: marcas en azul eléctrico (se encienden más con el zoom),
      //   el resto en gris tenue; tamaño y alpha según profundidad —
      const fraccionMarcas = 0.16 + 0.3 * e;
      for (let i = 0; i < N; i++) {
        const pr = proy[i];
        const prof = 1 - (pr.z + 1) / 2;
        if (nodos[i].sello < fraccionMarcas) {
          ctx.fillStyle = `rgba(63, 123, 236, ${(0.10 + 0.16 * prof) * (0.5 + 0.7 * e)})`;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, (5 + 2 * e) * pr.esc, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(157, 180, 236, ${0.45 + 0.5 * prof})`;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, (1.8 + 0.9 * e) * pr.esc, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(245, 245, 247, ${0.10 + 0.22 * prof})`;
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, 1.3 * pr.esc, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!reducir && visible) raf = requestAnimationFrame(pintar);
    };

    const arrancar = () => {
      cancelAnimationFrame(raf);
      if (reducir) pintar(0);
      else raf = requestAnimationFrame(pintar);
    };

    const alRedimensionar = () => {
      medir();
      construir();
      leerScroll();
      if (reducir) pintar(0);
    };

    construir();
    medir();
    leerScroll();
    arrancar();

    window.addEventListener('resize', alRedimensionar);
    if (!reducir) window.addEventListener('scroll', leerScroll, { passive: true });

    // Fuera de pantalla, ni un frame: el observador pausa y reanuda el bucle.
    const observador = new IntersectionObserver(([entrada]) => {
      visible = entrada.isIntersecting;
      if (visible) arrancar();
      else cancelAnimationFrame(raf);
    });
    observador.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('scroll', leerScroll);
      observador.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
