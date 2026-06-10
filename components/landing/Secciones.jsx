'use client';

// Secciones 03–05 de la landing de Wefty: cómo funciona, la red y el cierre
// (El problema vive en su propio fichero, Problema.jsx). Todas entran con
// reveals suaves al hacer scroll (RevelarLp). Copy brevísimo: si sobra una
// palabra, fuera.
import EnterAppButton from '@/components/EnterAppButton';
import RevelarLp from './RevelarLp';
import EsferaRed from './EsferaRed';

const MONO = 'font-mono text-[11px] tracking-[0.18em] uppercase';
const CONT = 'max-w-[1440px] mx-auto px-6 md:px-12';
const TXT2 = '#8A8A8F';
const TXT3 = '#5d5e63';

function CabeceraSeccion({ n, titulo }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className={`${MONO} tnum`} style={{ color: TXT3 }}>[{n}]</span>
      <span className={MONO} style={{ color: TXT2 }}>{titulo}</span>
    </div>
  );
}

// ——— 03 · CÓMO FUNCIONA ———————————————————————————————————————————————
const PASOS = [
  {
    n: '01',
    titulo: 'Sube tus ventas',
    texto: 'Un CSV de tu tienda basta. Wefty reconoce tus columnas, vengan como vengan.',
  },
  {
    n: '02',
    titulo: 'Wefty aprende',
    texto: 'De tus datos y de la red: limpia tu histórico, pone a competir varios modelos y se queda con el que menos falla.',
  },
  {
    n: '03',
    titulo: 'Recibe tu pedido óptimo',
    texto: 'Unidades por producto, talla y color. Listo para mandar a fábrica.',
  },
];

export function ComoFunciona() {
  return (
    <section className="border-t border-white/[0.07]">
      <div className={`${CONT} py-24 md:py-36`}>
        <RevelarLp>
          <CabeceraSeccion n="03" titulo="Cómo funciona" />
        </RevelarLp>
        <RevelarLp>
          <h2 className="mt-9 font-serif font-light text-[clamp(34px,5.6vw,76px)] leading-[1.02] tracking-[-0.03em]">
            Tres pasos. Cero magia.
          </h2>
        </RevelarLp>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-12">
          {PASOS.map((p, i) => (
            <RevelarLp key={p.n} retardo={0.12 + i * 0.16}>
              <div className="border-t border-white/15 pt-6">
                <span className={`${MONO} tnum`} style={{ color: '#9db4ec' }}>[{p.n}]</span>
                <h3 className="mt-4 font-serif text-[26px] md:text-[30px] leading-tight tracking-[-0.015em] text-[#F5F5F7]">
                  {p.titulo}
                </h3>
                <p className="mt-3 text-[15px] md:text-[16px] leading-[1.55] max-w-[36ch]" style={{ color: TXT2 }}>
                  {p.texto}
                </p>
              </div>
            </RevelarLp>
          ))}
        </div>
      </div>
    </section>
  );
}

// ——— 04 · LA RED (el diferenciador) ——————————————————————————————————
// Texto a la izquierda, esfera-constelación protagonista a la derecha (en
// móvil, esfera arriba y texto debajo): la legibilidad nunca compite con la
// pieza. El zoom de la esfera lo conduce el scroll desde EsferaRed.
export function LaRed() {
  return (
    <section className="relative border-t border-white/[0.07] overflow-hidden">
      <div className={`${CONT} relative z-10 py-24 md:py-36`}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-12 items-center">
          <div className="lg:col-span-6 order-2 lg:order-1">
            <RevelarLp>
              <CabeceraSeccion n="04" titulo="La red" />
            </RevelarLp>
            <RevelarLp retardo={0.1}>
              <h2 className="mt-9 font-serif font-light text-[clamp(34px,5.6vw,72px)] leading-[1.04] tracking-[-0.03em] max-w-[15ch]">
                Tus datos solos valen poco.
                <br />
                <span style={{ color: '#7da3f0' }}>La inteligencia de cientos de marcas vale mucho.</span>
              </h2>
            </RevelarLp>
            <RevelarLp retardo={0.25}>
              <p className="mt-8 text-[16px] md:text-[18px] leading-[1.55] max-w-[46ch]" style={{ color: TXT2 }}>
                Cada marca que se une afina las predicciones de todas las demás — con datos
                anonimizados y agregados. Nadie ve nada tuyo; todas piden mejor.
              </p>
            </RevelarLp>
          </div>

          <div className="lg:col-span-6 order-1 lg:order-2">
            <RevelarLp retardo={0.1}>
              <EsferaRed className="block w-full aspect-square max-w-[420px] sm:max-w-[520px] lg:max-w-none mx-auto" />
            </RevelarLp>
          </div>
        </div>
      </div>
    </section>
  );
}

// ——— 05 · CIERRE ———————————————————————————————————————————————————————
export function CierreCta() {
  return (
    <section className="relative border-t border-white/[0.07]">
      {/* El hilo de demanda se asienta aquí en su curva perfecta, detrás */}
      <div className={`${CONT} relative z-10 pt-28 md:pt-40 pb-36 md:pb-44 text-center`}>
        <RevelarLp>
          <h2 className="mx-auto font-serif font-light text-[clamp(38px,7vw,96px)] leading-[1.0] tracking-[-0.033em] max-w-[14ch]">
            Tu próximo pedido, sin adivinar.
          </h2>
        </RevelarLp>
        <RevelarLp retardo={0.18}>
          <div className="mt-11 flex flex-col items-center gap-5">
            <EnterAppButton tone="bone">Probar Wefty</EnterAppButton>
            <span className="font-mono text-[11px] tracking-[0.14em] uppercase" style={{ color: TXT3 }}>
              Con un simple CSV de ventas
            </span>
          </div>
        </RevelarLp>
      </div>

      {/* Pie mínimo */}
      <div className={`${CONT} relative z-10 pb-8`}>
        <div className="hairline-dark" />
        <div className="pt-5 flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-serif text-[18px] tracking-[-0.02em] text-[#F5F5F7]">Wefty</span>
          <span className={MONO} style={{ color: TXT3 }}>
            © 2026 · Predicción de stock para moda
          </span>
        </div>
      </div>
    </section>
  );
}
