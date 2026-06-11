'use client';

// Titular estilo hero de la landing, para el producto: el texto se DECODIFICA
// al cargar (caracteres entrelazándose que se van asentando, mismos glifos y
// duración que la landing), con un glitch ocasional en la parte principal y
// el remate en degradado neón (clase .em-neon).
// Accesibilidad: la frase real viaja en el aria-label; el SSR pinta el texto
// final (legible sin JavaScript) y con prefers-reduced-motion no hay efecto.
import { useEffect, useRef } from 'react';

const GLYPHS = '!<>-_\\/[]{}—=+*^?#01';

export default function TituloDecodificado({ texto, acento = '', duracion = 1100 }) {
  const refTexto = useRef(null);
  const refAcento = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const objetivos = [[refTexto.current, texto]];
    if (acento && refAcento.current) objetivos.push([refAcento.current, acento]);

    // — decodificación, una sola vez al montar —
    let raf = 0;
    const t0 = performance.now();
    const total = objetivos.reduce((a, [, fin]) => a + fin.length, 0);
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duracion);
      let asentadas = Math.floor(p * total);
      for (const [el, fin] of objetivos) {
        const n = fin.length;
        const fijas = Math.max(0, Math.min(n, asentadas));
        asentadas -= n;
        let out = fin.slice(0, fijas);
        for (let i = fijas; i < n; i++) {
          const ch = fin[i];
          out += /\s/.test(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
      }
      if (p < 1) raf = requestAnimationFrame(tick);
      else objetivos.forEach(([el, fin]) => { el.textContent = fin; });
    };
    raf = requestAnimationFrame(tick);

    // — glitch ocasional sobre la parte principal, como en la landing —
    let timeoutGlitch = 0;
    const intervalo = setInterval(() => {
      const el = refTexto.current;
      if (!el || Math.random() > 0.5) return;
      el.classList.add('glitching');
      timeoutGlitch = setTimeout(() => el.classList.remove('glitching'), 340);
    }, 4200);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(intervalo);
      clearTimeout(timeoutGlitch);
    };
  }, [texto, acento, duracion]);

  return (
    <span aria-label={acento ? `${texto} ${acento}` : texto}>
      <span aria-hidden="true">
        <span ref={refTexto} className="glitch-suave" data-text={texto}>{texto}</span>
        {acento ? <> <em ref={refAcento} className="em-neon">{acento}</em></> : null}
      </span>
    </span>
  );
}
