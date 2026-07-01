'use client';

// ===========================================================================
// PILOTO del rediseño "Flashly" — hero + sección «El problema», en LOS DOS
// MODOS. Un solo marcado: los colores salen de los tokens, así que claro y
// oscuro son el MISMO componente cambiando de tema (no hay nada duplicado).
// Movimiento "wow" con guiños cyberpunk (aurora, escaneo, titular que se
// descodifica, luz en el borde, barrido del botón). Vive en una ruta de vista
// previa (/preview-landing); la landing real (/) no se toca hasta aprobar.
// ===========================================================================
import { useEffect, useRef, useState } from 'react';
import { Reveal, useReveal, useMagnetic } from '@/components/hooks';
import TemaToggle from '@/components/TemaToggle';
import { ComoFunciona, ModoLanzamiento, LaRed, Cierre, Pie } from './secciones';
import './flashly.css';

// ——— Texto que se "descodifica": arranca con caracteres aleatorios y resuelve
//     al texto final. Guiño al glitch del landing actual. ———
function Scramble({ text, className = '' }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOut(text);
      return;
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&/<>·=+';
    const total = 26;
    let frame = 0;
    let raf;
    const tick = () => {
      frame += 1;
      const reveal = Math.floor((frame / total) * text.length);
      let s = '';
      for (let i = 0; i < text.length; i += 1) {
        if (text[i] === ' ') s += ' ';
        else if (i < reveal) s += text[i];
        else s += chars[Math.floor(Math.random() * chars.length)];
      }
      setOut(s);
      if (frame < total) raf = requestAnimationFrame(tick);
      else setOut(text);
    };
    const start = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, 250);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(raf);
    };
  }, [text]);
  return <span className={className}>{out}</span>;
}

// ——— Número que se anima desde su valor anterior hasta el nuevo (no desde 0),
//     para que al cambiar de escenario el total "viaje". ———
function useAnimatedNumber(target, active) {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (!active) return undefined;
    const from = fromRef.current;
    const start = performance.now();
    const dur = 700;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 4);
      setVal(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return val;
}

// ——— Barra superior ———
function Nav() {
  const magRef = useMagnetic(6, 90);
  return (
    <header
      className="sticky top-0 z-40 border-b border-line backdrop-blur-md"
      style={{ background: 'var(--nav-bg)' }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 font-display font-bold text-[18px] tracking-[-0.01em] text-txt">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full live-dot"
            style={{ background: 'var(--brand)', boxShadow: '0 0 12px var(--glow-brand)' }}
          />
          Wefty
        </a>
        <nav className="hidden md:flex items-center gap-8 text-[14px] text-txt2">
          <a href="#problema" className="hover:text-txt transition-colors">El problema</a>
          <a href="#como-funciona" className="hover:text-txt transition-colors">Cómo funciona</a>
          <a href="#modo-lanzamiento" className="hover:text-txt transition-colors">Lanzamiento</a>
          <a href="#la-red" className="hover:text-txt transition-colors">La red</a>
        </nav>
        <div className="flex items-center gap-3">
          <TemaToggle variante="icono" />
          <span ref={magRef} className="magnetic hidden sm:inline-block">
            <a href="/login" className="lf-btn btn-sheen inline-flex items-center gap-2 h-10 px-5 rounded-xl text-[14px] font-medium">
              Probar Wefty <span aria-hidden="true">→</span>
            </a>
          </span>
        </div>
      </div>
    </header>
  );
}

// ——— Datos de los tres escenarios del pedido recomendado ———
const TALLAS = ['XS', 'S', 'M', 'L', 'XL'];
const MAX_UDS = 248; // tope fijo: así se nota el cambio de fill entre escenarios
const ESCENARIOS = {
  conservador: { uds: [40, 100, 160, 120, 60], total: 480, liq: '900 €', perdida: '5.400 €' },
  esperado: { uds: [52, 128, 204, 156, 80], total: 620, liq: '2.100 €', perdida: '3.200 €' },
  agresivo: { uds: [64, 156, 248, 190, 98], total: 756, liq: '4.300 €', perdida: '1.500 €' },
};

// ——— Tarjeta del hero: el pedido recomendado, interactivo (sin terminal) ———
function HeroCard() {
  const [ref, isIn] = useReveal({ threshold: 0.3 });
  const [escenario, setEscenario] = useState('esperado');
  const datos = ESCENARIOS[escenario];
  const total = useAnimatedNumber(datos.total, isIn);
  const peakIdx = datos.uds.indexOf(Math.max(...datos.uds));

  return (
    <div
      ref={ref}
      className="lf-card lf-card-glow rounded-2xl border border-line p-6 md:p-7"
      style={{ background: 'var(--card-grad, var(--surface-1))' }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-txt3">Pedido recomendado</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ok">
          <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: 'var(--ok)' }} />
          en vivo
        </span>
      </div>

      {/* Selector de escenario (interactivo) */}
      <div className="flex gap-1.5 mb-5 p-1 rounded-xl" style={{ background: 'var(--surface-2)' }}>
        {Object.keys(ESCENARIOS).map((k) => {
          const activo = k === escenario;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setEscenario(k)}
              className="flex-1 h-8 rounded-lg font-mono text-[11px] capitalize transition-all"
              style={
                activo
                  ? { background: 'var(--brand)', color: '#fff', boxShadow: '0 4px 14px -4px var(--glow-brand)' }
                  : { color: 'var(--txt-3)', background: 'transparent' }
              }
            >
              {k}
            </button>
          );
        })}
      </div>

      <div className="flex items-end gap-3 h-[150px] mb-5">
        {TALLAS.map((sz, i) => {
          const peak = i === peakIdx;
          const h = (datos.uds[i] / MAX_UDS) * 100;
          return (
            <div key={sz} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
              <span className={`text-[13px] tnum transition-colors ${peak ? 'text-brand font-semibold' : 'text-txt2'}`}>
                {datos.uds[i]}
              </span>
              <div
                className={`w-full rounded-t-md ${peak ? 'lf-peak' : ''}`}
                style={{
                  height: isIn ? `${h}%` : '0%',
                  background: peak ? 'var(--brand)' : 'var(--data-2)',
                  opacity: peak ? 1 : 0.5,
                  transition: `height 700ms cubic-bezier(0.22,1,0.36,1) ${i * 50}ms, background 300ms ease, opacity 300ms ease`,
                }}
              />
              <span className="font-mono text-[11px] text-txt3">{sz}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-end justify-between pt-4 border-t border-lineSoft">
        <p className="font-display font-bold text-[34px] leading-none text-txt tnum">
          {total} <span className="font-mono text-[14px] font-normal text-txt3">UDS</span>
        </p>
        <p key={escenario} className="lf-swap text-right text-[12px] leading-[1.5] text-txt3">
          liquidación <b className="text-warn">{datos.liq}</b>
          <br />
          venta perdida <b className="text-bad">{datos.perdida}</b>
        </p>
      </div>
    </div>
  );
}

// ——— Hero ———
function Hero() {
  const magRef = useMagnetic(8, 110);
  return (
    <section className="relative overflow-hidden">
      <div className="lf-aurora" aria-hidden="true" />
      <div className="lf-hero-glow pointer-events-none absolute inset-x-0 top-0 h-[640px]" aria-hidden="true" />
      <div className="grid-noise-dark pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="lf-scan" aria-hidden="true" />
      <div className="relative max-w-[1200px] mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-16 md:pb-24 grid md:grid-cols-2 gap-12 md:gap-10 items-center">
        <div>
          <Reveal>
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] tracking-[0.14em] uppercase text-brand"
              style={{ background: 'var(--pill-bg)', border: '1px solid var(--brand-line)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: 'var(--brand)' }} />
              Predicción de stock · moda online
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 font-display font-bold text-[clamp(38px,6vw,68px)] leading-[1.04] tracking-[-0.025em] text-txt">
              Deja de adivinar cuánto <Scramble text="stock pedir." className="lf-grad" />
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-6 max-w-[520px] text-[clamp(16px,2vw,19px)] leading-[1.6] text-txt2">
              Wefty predice cuántas unidades producir de cada producto, talla y color. Incluso de los que aún no has lanzado.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <span ref={magRef} className="magnetic inline-block">
                <a href="/login" className="lf-btn btn-sheen inline-flex items-center gap-2 h-12 px-7 rounded-xl text-[15px] font-medium">
                  Probar Wefty <span aria-hidden="true">→</span>
                </a>
              </span>
              <p className="text-[13px] text-txt3">
                sin integraciones · funciona con un <span className="font-mono text-txt2">.csv</span> de ventas
              </p>
            </div>
          </Reveal>
        </div>
        <Reveal delay={160}>
          <HeroCard />
        </Reveal>
      </div>
    </section>
  );
}

// ——— Sección «El problema»: dos tarjetas (de más / de menos) ———
function FacturaMas() {
  return (
    <article className="lf-card lf-tile rounded-2xl border border-line p-7 h-full" style={{ background: 'var(--card-grad, var(--surface-1))' }}>
      <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-txt3">Factura 01</span>
      <h3 className="mt-3 font-display font-bold text-[22px] text-txt">Producir de más</h3>
      <p className="mt-3 text-[15px] leading-[1.6] text-txt2">
        Stock que no rota y acaba liquidado en rebajas. Dinero muerto durmiendo en el almacén.
      </p>
      <div
        className="mt-6 inline-flex items-center gap-3 rounded-xl border border-lineSoft px-4 py-3"
        style={{ background: 'var(--surface-2)' }}
      >
        <span className="text-[15px] text-txt3 line-through">89 €</span>
        <span className="text-[20px] font-semibold text-bad">35 €</span>
        <span
          className="rounded-md px-2 py-1 font-mono text-[12px]"
          style={{ background: 'color-mix(in srgb, var(--bad) 16%, transparent)', color: 'var(--bad)' }}
        >
          −61%
        </span>
      </div>
    </article>
  );
}

function FacturaMenos() {
  const pills = [
    ['XS', false],
    ['S', true],
    ['M', true],
    ['L', true],
    ['XL', false],
  ];
  return (
    <article className="lf-card lf-tile rounded-2xl border border-line p-7 h-full" style={{ background: 'var(--card-grad, var(--surface-1))' }}>
      <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-txt3">Factura 02</span>
      <h3 className="mt-3 font-display font-bold text-[22px] text-txt">Producir de menos</h3>
      <p className="mt-3 text-[15px] leading-[1.6] text-txt2">
        Tallas agotadas a las dos semanas. Venta perdida y clientes que querían comprar y no volverán.
      </p>
      <div className="mt-6 flex items-center gap-2">
        {pills.map(([sz, out]) => (
          <span
            key={sz}
            className={`inline-flex items-center justify-center w-11 h-11 rounded-lg border font-mono text-[13px] ${out ? 'line-through' : ''}`}
            style={
              out
                ? {
                    background: 'color-mix(in srgb, var(--bad) 12%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--bad) 35%, transparent)',
                    color: 'var(--bad)',
                  }
                : { background: 'var(--surface-2)', borderColor: 'var(--line)', color: 'var(--txt-2)' }
            }
          >
            {sz}
          </span>
        ))}
        <span className="ml-2 font-mono text-[12px] uppercase tracking-[0.14em] text-bad">Agotado</span>
      </div>
    </article>
  );
}

function Problema() {
  return (
    <section id="problema" className="relative">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-16 md:py-24">
        <Reveal>
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-[11px] tracking-[0.18em] text-brand tnum">01</span>
            <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-txt3">El problema</span>
          </div>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="max-w-[760px] font-display font-bold text-[clamp(28px,4vw,44px)] leading-[1.1] tracking-[-0.02em] text-txt">
            Pedir a ojo acaba siempre en una de estas <span className="lf-grad">dos facturas.</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <Reveal delay={80}>
            <FacturaMas />
          </Reveal>
          <Reveal delay={140}>
            <FacturaMenos />
          </Reveal>
        </div>
        <Reveal delay={120}>
          <p className="mt-10 max-w-[680px] text-[clamp(17px,2.2vw,22px)] leading-[1.5] text-txt2">
            Dos caras del mismo error: <span className="lf-grad font-semibold">pedir a ojo.</span>
            <span className="block mt-2 text-[15px] text-txt3">
              Y la decisión más difícil sigue siendo la del producto que aún no has lanzado.
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export default function LandingFlashly() {
  const magRef = useMagnetic(8, 110);
  return (
    <div className="lf-root">
      {/* Franja de aviso: esto es la vista previa, la landing real no se ha tocado */}
      <div className="text-center font-mono text-[11px] text-txt3 py-2 border-b border-lineSoft" style={{ background: 'var(--surface-2)' }}>
        Vista previa del rediseño · usa el interruptor (arriba dcha.) y pulsa los escenarios · la landing real
        (<span className="text-txt2">/</span>) no se ha tocado
      </div>
      <Nav />
      <Hero />
      <Problema />
      <ComoFunciona />
      <ModoLanzamiento />
      <LaRed />
      <Cierre>
        <span ref={magRef} className="magnetic inline-block">
          <a href="/login" className="lf-btn btn-sheen inline-flex items-center gap-2 h-12 px-8 rounded-xl text-[15px] font-medium">
            Probar Wefty <span aria-hidden="true">→</span>
          </a>
        </span>
      </Cierre>
      <Pie />
    </div>
  );
}
