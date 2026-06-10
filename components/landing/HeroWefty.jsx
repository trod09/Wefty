'use client';

// HERO de la landing de Wefty — la pieza visual más importante de la página.
// Composición: nav mínima (logo + entrar), titular que se ensambla palabra a
// palabra con "adivinar" tachado en ámbar, subtítulo y CTA escalonados, y el
// «campo de demanda» (canvas) respirando al fondo.
//
// Accesibilidad y rendimiento: las animaciones viven en clases lp-* cuyo
// estado FINAL es la base CSS — sin JavaScript o con prefers-reduced-motion
// todo es legible al instante. Solo se anima transform/opacity.
import EnterAppButton from '@/components/EnterAppButton';
import { useProductHref } from '@/components/useProductHref';

const MONO = 'font-mono text-[11px] tracking-[0.18em] uppercase';

// Titular en dos líneas; cada palabra entra escalonada. La palabra marcada
// como "tachada" recibe el subrayado-tachón en ámbar al asentarse.
const LINEA_1 = [
  { texto: 'Deja' },
  { texto: 'de' },
  { texto: 'adivinar', tachada: true },
];
const LINEA_2 = [
  { texto: 'cuánto' },
  { texto: 'stock' },
  { texto: 'pedir.' },
];

function Palabras({ palabras, desde }) {
  return palabras.map((p, i) => (
    <span key={p.texto} className="lp-palabra" style={{ '--d': `${desde + i * 0.085}s` }}>
      {p.tachada ? <span className="lp-tachado">{p.texto}</span> : p.texto}
      {i < palabras.length - 1 ? ' ' : ''}
    </span>
  ));
}

export default function HeroWefty() {
  const href = useProductHref();

  return (
    <header className="relative min-h-[100svh] flex flex-col overflow-hidden">
      {/* Nav mínima */}
      <nav className="relative z-20 w-full max-w-[1440px] mx-auto px-6 md:px-12 pt-7 flex items-baseline justify-between">
        <span className="font-serif text-[24px] tracking-[-0.02em] text-[#F5F5F7] select-none">Wefty</span>
        <a href={href} className={`${MONO} text-[#8A8A8F] hover:text-[#F5F5F7] transition-colors`}>
          Entrar →
        </a>
      </nav>

      {/* El campo de demanda lo pinta el lienzo fijo (HiloDemanda), detrás */}

      {/* Contenido */}
      <div className="relative z-10 flex-1 flex items-center">
        <div className="w-full max-w-[1440px] mx-auto px-6 md:px-12 pb-[16vh] md:pb-[14vh]">
          <p className={`${MONO} lp-sube`} style={{ '--d': '0.05s', color: '#9db4ec' }}>
            Predicción de stock · marcas de moda
          </p>

          <h1 className="mt-6 font-serif font-light leading-[0.97] tracking-[-0.035em] text-[#F5F5F7] text-[clamp(46px,9.2vw,116px)] max-w-[12ch]">
            <Palabras palabras={LINEA_1} desde={0.2} />
            <br />
            <Palabras palabras={LINEA_2} desde={0.46} />
          </h1>

          <p
            className="mt-7 text-[17px] md:text-[20px] leading-[1.5] max-w-[46ch] lp-sube"
            style={{ '--d': '0.95s', color: '#8A8A8F' }}
          >
            Wefty predice cuántas unidades fabricar de cada producto, talla y color —
            incluso de los que aún no has lanzado.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4 lp-sube" style={{ '--d': '1.1s' }}>
            <EnterAppButton tone="bone">Probar Wefty</EnterAppButton>
            <span className="font-mono text-[11px] tracking-[0.14em] uppercase" style={{ color: '#5d5e63' }}>
              Con un simple CSV de ventas
            </span>
          </div>
        </div>
      </div>

      {/* Indicador de scroll */}
      <div className="relative z-10 pb-7 flex justify-center lp-sube" style={{ '--d': '1.6s' }}>
        <span className="flex flex-col items-center gap-2.5 font-mono text-[10px] tracking-[0.22em] uppercase" style={{ color: '#5d5e63' }}>
          Desliza
          <span className="lp-linea-scroll" />
        </span>
      </div>
    </header>
  );
}
