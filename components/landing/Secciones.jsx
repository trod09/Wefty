'use client';

// Secciones 02–05 de la landing de Wefty: el problema, cómo funciona, la red
// y el cierre. Todas entran con reveals suaves al hacer scroll (RevelarLp) y
// los únicos "gráficos" son glifos de barras hechos con divs — datos, no
// ilustraciones. Copy brevísimo: si sobra una palabra, fuera.
import EnterAppButton from '@/components/EnterAppButton';
import RevelarLp from './RevelarLp';
import MallaRed from './MallaRed';
import CampoDemanda from './CampoDemanda';

const MONO = 'font-mono text-[11px] tracking-[0.18em] uppercase';
const CONT = 'max-w-[1440px] mx-auto px-6 md:px-12';
const TXT2 = '#8A8A8F';
const TXT3 = '#5d5e63';
const EMBER = '#E07A5F';

function CabeceraSeccion({ n, titulo }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className={`${MONO} tnum`} style={{ color: TXT3 }}>[{n}]</span>
      <span className={MONO} style={{ color: TXT2 }}>{titulo}</span>
    </div>
  );
}

// Glifo de barras: alturas en %, las "extra" en ámbar (sobrante) o fantasma
// (venta perdida). Crecen escalonadas al revelarse la tarjeta (solo transform).
function GlifoBarras({ vendidas, extra, fantasma = false }) {
  return (
    <div className="flex items-end gap-2 h-[92px]" aria-hidden="true">
      {vendidas.map((h, i) => (
        <span
          key={`v${i}`}
          className="lp-barra w-5 rounded-sm"
          style={{ height: `${h}%`, background: 'rgba(245,245,247,0.16)', '--bd': `${i * 0.06}s` }}
        />
      ))}
      {extra.map((h, i) => (
        <span
          key={`e${i}`}
          className="lp-barra w-5 rounded-sm"
          style={
            fantasma
              ? { height: `${h}%`, border: '1px dashed rgba(245,245,247,0.35)', background: 'transparent', '--bd': `${(vendidas.length + i) * 0.06}s` }
              : { height: `${h}%`, background: 'rgba(224,122,95,0.55)', '--bd': `${(vendidas.length + i) * 0.06}s` }
          }
        />
      ))}
    </div>
  );
}

// ——— 02 · EL PROBLEMA ———————————————————————————————————————————————
export function Problema() {
  return (
    <section className="border-t border-white/[0.07]">
      <div className={`${CONT} py-24 md:py-36`}>
        <RevelarLp>
          <CabeceraSeccion n="02" titulo="El problema" />
        </RevelarLp>
        <RevelarLp>
          <h2 className="mt-9 font-serif font-light text-[clamp(34px,5.6vw,76px)] leading-[1.02] tracking-[-0.03em] max-w-[16ch]">
            Adivinar siempre acaba en una de estas dos facturas.
          </h2>
        </RevelarLp>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
          <RevelarLp retardo={0.1}>
            <div
              className="h-full rounded-xl border border-[#232428] p-7 md:p-9 transition-colors duration-300 hover:border-[#3a3c42]"
              style={{ background: 'linear-gradient(150deg, #16171b 0%, #121316 100%)' }}
            >
              <span className={MONO} style={{ color: EMBER }}>Fabricas de más</span>
              <div className="mt-7">
                <GlifoBarras vendidas={[46, 58, 50, 38]} extra={[64, 72]} />
              </div>
              <p className="mt-7 text-[16px] md:text-[17px] leading-[1.5] max-w-[34ch]" style={{ color: TXT2 }}>
                Lo que sobra es dinero muerto:
                <span className="text-[#F5F5F7]"> acaba liquidado en rebajas.</span>
              </p>
            </div>
          </RevelarLp>

          <RevelarLp retardo={0.25}>
            <div
              className="h-full rounded-xl border border-[#232428] p-7 md:p-9 transition-colors duration-300 hover:border-[#3a3c42]"
              style={{ background: 'linear-gradient(150deg, #16171b 0%, #121316 100%)' }}
            >
              <span className={MONO} style={{ color: '#9db4ec' }}>Fabricas de menos</span>
              <div className="mt-7">
                <GlifoBarras vendidas={[46, 58, 50, 38]} extra={[64, 56]} fantasma />
              </div>
              <p className="mt-7 text-[16px] md:text-[17px] leading-[1.5] max-w-[34ch]" style={{ color: TXT2 }}>
                Lo que falta es venta perdida:
                <span className="text-[#F5F5F7]"> clientes que querían comprar y no pudieron.</span>
              </p>
            </div>
          </RevelarLp>
        </div>

        <RevelarLp retardo={0.35}>
          <p className={`${MONO} mt-10`} style={{ color: TXT3 }}>
            Dos caras del mismo error — pedir a ojo.
          </p>
        </RevelarLp>
      </div>
    </section>
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
export function LaRed() {
  return (
    <section className="relative border-t border-white/[0.07] overflow-hidden">
      {/* La malla de puntos conectándose, desvanecida hacia los bordes */}
      <div className="absolute inset-0 lp-mascara-radial pointer-events-none">
        <MallaRed className="block w-full h-full" />
      </div>

      <div className={`${CONT} relative z-10 py-28 md:py-44 text-center`}>
        <RevelarLp>
          <div className="flex items-baseline justify-center gap-4">
            <span className={`${MONO} tnum`} style={{ color: TXT3 }}>[04]</span>
            <span className={MONO} style={{ color: TXT2 }}>La red</span>
          </div>
        </RevelarLp>

        <RevelarLp retardo={0.1}>
          <h2 className="mt-10 mx-auto font-serif font-light text-[clamp(36px,6vw,84px)] leading-[1.04] tracking-[-0.03em] max-w-[20ch]">
            Tus datos solos valen poco.
            <br />
            <span style={{ color: '#7da3f0' }}>La inteligencia de cientos de marcas vale mucho.</span>
          </h2>
        </RevelarLp>

        <RevelarLp retardo={0.3}>
          <p className="mt-9 mx-auto text-[16px] md:text-[18px] leading-[1.55] max-w-[52ch]" style={{ color: TXT2 }}>
            Cada marca que se une afina las predicciones de todas las demás — con datos
            anonimizados y agregados. Nadie ve nada tuyo; todas piden mejor.
          </p>
        </RevelarLp>
      </div>
    </section>
  );
}

// ——— 05 · CIERRE ———————————————————————————————————————————————————————
export function CierreCta() {
  return (
    <section className="relative border-t border-white/[0.07] overflow-hidden">
      {/* Eco del hero: el campo de demanda despide la página */}
      <div className="absolute inset-x-0 bottom-0 h-[18vh] lp-mascara-arriba pointer-events-none opacity-70">
        <CampoDemanda className="block w-full h-full" />
      </div>

      <div className={`${CONT} relative z-10 pt-28 md:pt-40 pb-32 md:pb-40 text-center`}>
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
