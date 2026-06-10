// Landing de Wefty — composición de la página / (y solo de esa página).
// 5 secciones como máximo: hero, problema, cómo funciona, la red y CTA final.
// Estética "dark editorial premium" en continuidad con el producto (/upload):
// mismo fondo radial, misma textura de rejilla, tipografía y acentos.
//
// En la parte 1 el hero está completo; las demás secciones son esqueletos
// marcados que se construyen en la parte 2.
import HeroWefty from './HeroWefty';

function SeccionPendiente({ n, titulo }) {
  return (
    <section className="border-t border-white/[0.07]">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-20 flex items-baseline gap-4">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase" style={{ color: '#5d5e63' }}>
          [{n}]
        </span>
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase" style={{ color: '#8A8A8F' }}>
          {titulo} — se construye en la parte 2
        </span>
      </div>
    </section>
  );
}

export default function LandingWefty() {
  return (
    <div
      className="relative min-h-screen overflow-x-clip text-[#F5F5F7]"
      style={{ background: 'radial-gradient(140% 100% at 50% 0%, #0F1014 0%, #0A0A0B 60%)' }}
    >
      <div className="absolute inset-0 grid-noise-dark opacity-70 pointer-events-none" />
      <div className="relative">
        <HeroWefty />
        <SeccionPendiente n="02" titulo="El problema" />
        <SeccionPendiente n="03" titulo="Cómo funciona" />
        <SeccionPendiente n="04" titulo="La red" />
        <SeccionPendiente n="05" titulo="Empieza hoy" />
      </div>
    </div>
  );
}
