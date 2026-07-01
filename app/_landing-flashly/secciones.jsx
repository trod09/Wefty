'use client';

// ===========================================================================
// Secciones restantes del piloto Flashly: Cómo funciona, Modo lanzamiento,
// La red, Cierre y el Pie. Mismo lenguaje que el hero (tokens + lf-* + Reveal),
// así claro y oscuro son el mismo marcado cambiando de tema.
// Las clases (lf-card, lf-tile, lf-grad, text-txt…) viven en flashly.css, que
// LandingFlashly.jsx ya importa.
// ===========================================================================
import { Reveal, useReveal } from '@/components/hooks';

// Etiqueta de sección reutilizable: índice azul + título mono
function Etiqueta({ idx, children }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="font-mono text-[11px] tracking-[0.18em] text-brand tnum">{idx}</span>
      <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-txt3">{children}</span>
    </div>
  );
}

// ——— 02 · Cómo funciona ———
function PasoSubir() {
  return (
    <div className="rounded-xl border border-lineSoft p-4 mb-5" style={{ background: 'var(--surface-2)' }}>
      <div
        className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 font-mono text-[12px] text-txt2"
        style={{ background: 'var(--surface-1)' }}
      >
        <span className="w-2 h-2 rounded-sm" style={{ background: 'var(--brand)' }} />
        ventas_2025.csv
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {['fecha', 'referencia', 'talla', 'color', 'unidades'].map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] text-txt3" style={{ background: 'var(--surface-1)' }}>
            {c} <b className="text-ok">✓</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function PasoAnalizar() {
  const [ref, isIn] = useReveal({ threshold: 0.3 });
  return (
    <div ref={ref} className="rounded-xl border border-lineSoft p-4 mb-5" style={{ background: 'var(--surface-2)' }}>
      <svg viewBox="0 0 280 120" className="w-full h-auto" aria-hidden="true">
        <line x1="0" y1="100" x2="280" y2="100" stroke="var(--line)" strokeWidth="1" />
        <line x1="168" y1="14" x2="168" y2="100" stroke="var(--bad)" strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
        <polyline
          className={`lf-draw ${isIn ? 'in' : ''}`}
          pathLength="1"
          points="0,86 28,80 56,84 84,68 112,72 140,52 168,60 196,38 224,46 252,28 280,34"
          fill="none"
          stroke="var(--brand)"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="168" cy="60" r="4" fill="var(--bad)" />
        <circle cx="252" cy="28" r="4" fill="var(--brand)" />
      </svg>
      <p className="mt-2 flex gap-4 font-mono text-[10px] text-txt3">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--bad)' }} /> rotura detectada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--brand)' }} /> tendencia
        </span>
      </p>
    </div>
  );
}

function PasoRecibir() {
  const filas = [
    ['S', '128', 'curva estable', false],
    ['M', '204', 'rotura en abril', true],
    ['L', '156', 'tendencia +8%', false],
  ];
  return (
    <div className="rounded-xl border border-lineSoft p-4 mb-5 overflow-hidden" style={{ background: 'var(--surface-2)' }}>
      <table className="w-full text-left">
        <thead>
          <tr className="font-mono text-[10px] uppercase tracking-[0.1em] text-txt3">
            <th className="pb-2 font-normal">Talla</th>
            <th className="pb-2 font-normal">Uds</th>
            <th className="pb-2 font-normal">Por qué</th>
          </tr>
        </thead>
        <tbody className="text-[13px]">
          {filas.map(([t, u, w, hot]) => (
            <tr key={t} className="border-t border-lineSoft">
              <td className="py-1.5 font-mono text-txt2">{t}</td>
              <td className={`py-1.5 tnum ${hot ? 'text-brand font-semibold' : 'text-txt'}`}>{u}</td>
              <td className={`py-1.5 ${hot ? 'text-brand' : 'text-txt3'}`}>{w}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PASOS = [
  { num: 'Paso 01', tit: 'Sube tu CSV de ventas', desc: 'Sin integraciones ni configuración. Wefty reconoce tus columnas automáticamente.', visual: PasoSubir },
  { num: 'Paso 02', tit: 'El motor analiza tu histórico', desc: 'Estacionalidad, tendencias, curvas de talla y roturas de stock detectadas. Todo validado contra tus propias ventas.', visual: PasoAnalizar },
  { num: 'Paso 03', tit: 'Recibe tu pedido óptimo', desc: 'Por talla y color, con tres escenarios, los riesgos en euros y la explicación de cada número.', visual: PasoRecibir },
];

const CAPACIDADES = [
  ['Validación real', 'Cada predicción se contrasta con tu propio histórico antes de llegar a ti.'],
  ['Roturas y picos', 'Detecta roturas de stock y picos atípicos para no aprender de datos contaminados.'],
  ['Máximo margen', 'Pondera coste, PVP y precio de liquidación: maximiza margen, no unidades.'],
];

export function ComoFunciona() {
  return (
    <section id="como-funciona" className="relative">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24">
        <Reveal>
          <Etiqueta idx="02">Cómo funciona</Etiqueta>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="max-w-[760px] font-display font-bold text-[clamp(28px,4vw,44px)] leading-[1.1] tracking-[-0.02em] text-txt">
            De un CSV de ventas a tu pedido óptimo, <span className="lf-grad">en tres pasos.</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {PASOS.map((p, i) => {
            const Visual = p.visual;
            return (
              <Reveal key={p.num} delay={80 + i * 60}>
                <article className="lf-card lf-tile rounded-2xl border border-line p-6 h-full" style={{ background: 'var(--card-grad, var(--surface-1))' }}>
                  <Visual />
                  <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-txt3">{p.num}</span>
                  <h3 className="mt-2 font-display font-bold text-[19px] text-txt">{p.tit}</h3>
                  <p className="mt-2 text-[14px] leading-[1.6] text-txt2">{p.desc}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
        <Reveal delay={120}>
          <div className="mt-10 grid sm:grid-cols-3 gap-6 rounded-2xl border border-lineSoft p-6" style={{ background: 'var(--surface-2)' }}>
            {CAPACIDADES.map(([t, d]) => (
              <div key={t}>
                <p className="font-display font-semibold text-[15px] text-txt">{t}</p>
                <p className="mt-1.5 text-[13px] leading-[1.55] text-txt3">{d}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ——— 03 · Modo lanzamiento ———
function PanelLanzamiento() {
  const [ref, isIn] = useReveal({ threshold: 0.25 });
  const analogos = [
    ['Análogo 01 · marca anónima #214', 92],
    ['Análogo 02 · marca anónima #122', 87],
    ['Análogo 03 · marca anónima #078', 81],
  ];
  const cols = [
    ['XS', 36, 30],
    ['S', 78, 66],
    ['M', 118, 100],
    ['L', 84, 71],
    ['XL', 44, 37],
  ];
  return (
    <div ref={ref} className="lf-card lf-card-glow rounded-2xl border border-line p-6 md:p-7" style={{ background: 'var(--card-grad, var(--surface-1))' }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-txt2">REF Nueva-001 · Vestido midi</span>
        <span className="rounded-md px-2 py-1 font-mono text-[10px]" style={{ background: 'var(--tint-brand)', color: 'var(--brand)' }}>sin histórico</span>
      </div>
      <p className="mt-4 font-mono text-[12px] text-txt3">
        buscando análogos en la red
        <span className="lf-dots ml-1 inline-flex gap-0.5"><span>.</span><span>.</span><span>.</span></span>
      </p>
      <div className="mt-4 space-y-2.5">
        {analogos.map(([name, sim]) => (
          <div key={name} className="flex items-center gap-3">
            <span className="w-[180px] shrink-0 font-mono text-[11px] text-txt3 truncate">{name}</span>
            <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <span className="block h-full rounded-full" style={{ width: isIn ? `${sim}%` : '0%', background: 'var(--brand)', transition: 'width 900ms cubic-bezier(0.22,1,0.36,1)' }} />
            </span>
            <span className="w-9 text-right font-mono text-[11px] text-brand tnum">{sim}%</span>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-end gap-3 h-[110px] border-t border-lineSoft pt-5">
        {cols.map(([sz, uds, h], i) => (
          <div key={sz} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
            <span className="font-mono text-[11px] text-txt2 tnum">{uds}</span>
            <div className="w-full rounded-t-md" style={{ height: isIn ? `${h}%` : '0%', background: 'var(--data-2)', opacity: 0.6, transition: `height 800ms cubic-bezier(0.22,1,0.36,1) ${i * 60}ms` }} />
            <span className="font-mono text-[10px] text-txt3">{sz}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-txt3">Previsión inicial · esperado</span>
        <span className="font-display font-bold text-[22px] text-txt tnum">360 <span className="font-mono text-[12px] font-normal text-txt3">UDS</span></span>
      </div>
    </div>
  );
}

export function ModoLanzamiento() {
  return (
    <section id="modo-lanzamiento" className="relative">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24 grid md:grid-cols-2 gap-12 md:gap-10 items-center">
        <div>
          <Reveal>
            <Etiqueta idx="03">Modo lanzamiento</Etiqueta>
          </Reveal>
          <Reveal delay={60}>
            <h2 className="font-display font-bold text-[clamp(28px,4vw,44px)] leading-[1.1] tracking-[-0.02em] text-txt">
              Lo más difícil de predecir: <span className="lf-grad">lo que aún no has lanzado.</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 max-w-[520px] text-[clamp(16px,2vw,18px)] leading-[1.6] text-txt2">
              Un producto nuevo no tiene histórico — y ahí es donde más caro sale adivinar. Wefty localiza sus análogos en la red: productos parecidos, en marcas similares a la tuya.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-4 max-w-[520px] text-[15px] leading-[1.6] text-txt3">
              Con cómo se vendieron ellos, construye tu <b className="text-txt2">previsión inicial por talla y color</b> — antes de tu primera venta.
            </p>
          </Reveal>
        </div>
        <Reveal delay={120}>
          <PanelLanzamiento />
        </Reveal>
      </div>
    </section>
  );
}

// ——— 04 · La red ———
const NODOS = [
  ['Nodo 01', 'Las marcas aportan sus ventas, anonimizadas', 'Cada marca de la red comparte su histórico sin nombres, sin precios, sin identidad.'],
  ['Nodo 02', 'La red aprende los patrones', 'Cómo se comporta cada categoría, cada curva de talla, cada temporada — a una escala que ninguna marca alcanza sola.'],
  ['Nodo 03', 'Cada marca predice lo que nunca ha lanzado', 'Un producto nuevo, una categoría nueva: la red ya sabe cómo se vendieron sus análogos.'],
];

export function LaRed() {
  return (
    <section id="la-red" className="relative overflow-hidden">
      <div className="lf-aurora" aria-hidden="true" />
      <div className="relative max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24">
        <Reveal>
          <Etiqueta idx="04">La red</Etiqueta>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="max-w-[820px] font-display font-bold text-[clamp(28px,4vw,44px)] leading-[1.1] tracking-[-0.02em] text-txt">
            Tus datos solos valen poco. <span className="lf-grad">La inteligencia de cientos de marcas vale mucho.</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid md:grid-cols-3 gap-6 md:gap-3 items-stretch">
          {NODOS.map(([n, t, d], i) => (
            <div key={n} className="contents md:flex md:items-center">
              <Reveal delay={80 + i * 70} className="flex-1">
                <article className="lf-card lf-tile rounded-2xl border border-line p-6 h-full" style={{ background: 'var(--card-grad, var(--surface-1))' }}>
                  <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] uppercase text-brand">
                    <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: 'var(--brand)' }} />
                    {n}
                  </span>
                  <p className="mt-3 font-display font-semibold text-[17px] leading-[1.25] text-txt">{t}</p>
                  <p className="mt-2 text-[13px] leading-[1.55] text-txt3">{d}</p>
                </article>
              </Reveal>
              {i < NODOS.length - 1 ? (
                <span className="hidden md:block px-1 text-[18px] text-txt3" aria-hidden="true">→</span>
              ) : null}
            </div>
          ))}
        </div>
        <Reveal delay={140}>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <p className="font-display text-[clamp(16px,2vw,20px)] text-txt2">Cada marca que entra mejora las predicciones de todas.</p>
            <p className="inline-flex items-center gap-2 rounded-full border border-brandLine px-3 py-1.5 font-mono text-[11px] text-brand" style={{ background: 'var(--pill-bg)' }}>
              <b>Anonimizado + agregado</b> · nadie ve los datos de nadie
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ——— 05 · Cierre ———
export function Cierre({ children }) {
  return (
    <section id="empieza" className="relative overflow-hidden">
      <div className="lf-hero-glow pointer-events-none absolute inset-x-0 bottom-0 h-[420px]" aria-hidden="true" />
      <div className="relative max-w-[1200px] mx-auto px-6 md:px-10 py-20 md:py-28 text-center">
        <Reveal>
          <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-txt3">05 · acceso anticipado</p>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="mx-auto mt-4 max-w-[680px] font-display font-bold text-[clamp(32px,5vw,56px)] leading-[1.05] tracking-[-0.025em] text-txt">
            Deja de adivinar. <span className="lf-grad">Empieza hoy.</span>
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <div className="mt-9 flex flex-col items-center gap-3">
            {children}
            <p className="text-[13px] text-txt3">gratis durante el acceso anticipado · con un simple CSV de ventas</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ——— Pie ———
export function Pie() {
  return (
    <footer className="relative overflow-hidden border-t border-line">
      <div className="relative max-w-[1200px] mx-auto px-6 md:px-10 pt-16 pb-10">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <a href="#" className="flex items-center gap-2 font-display font-bold text-[18px] text-txt">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: 'var(--brand)', boxShadow: '0 0 12px var(--glow-brand)' }} />
              Wefty
            </a>
            <p className="mt-3 max-w-[240px] text-[13px] leading-[1.55] text-txt3">Predicción de stock para marcas de moda que venden online.</p>
            <p className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ok">
              <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: 'var(--ok)' }} /> Acceso anticipado abierto
            </p>
          </div>
          {[
            ['Producto', ['El problema', 'Cómo funciona', 'Modo lanzamiento', 'La red', 'Empieza hoy']],
            ['Cuenta', ['Entrar', 'Probar Wefty']],
            ['Legal', ['Privacidad', 'Términos', 'hola@wefty.co']],
          ].map(([titulo, enlaces]) => (
            <nav key={titulo} aria-label={titulo}>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-txt3">{titulo}</p>
              <ul className="mt-3 space-y-2">
                {enlaces.map((e) => (
                  <li key={e}>
                    <a href="#" className="text-[14px] text-txt2 hover:text-txt transition-colors">{e}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-lineSoft pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] text-txt3">© 2026 Wefty · Hecho en España</p>
          <p className="font-mono text-[11px] text-txt3">Datos anonimizados y agregados · nadie ve los datos de nadie</p>
        </div>
      </div>
      <div className="lf-giant pointer-events-none select-none text-center text-[clamp(80px,22vw,300px)]" aria-hidden="true">Wefty</div>
    </footer>
  );
}
