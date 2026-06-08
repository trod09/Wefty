'use client';

import React from 'react';
import { EASE, useReveal, useScrollProgress, useCountUp, Reveal } from './hooks';
import { SectionLabel, MonoLabel } from './primitives';
import { CornerCrosshairs } from './decor';

// How it works — three sequential steps with scroll-driven number scaling.

export default function HowItWorks() {
  return (
    <section id="how" className="relative py-32 md:py-48">
      <div className="max-w-[1440px] mx-auto px-8 md:px-12">
        <div className="grid grid-cols-12 gap-6 mb-20 md:mb-32">
          <div className="col-span-12 md:col-span-3">
            <SectionLabel index="02" title="How the co-op works" />
          </div>
          <div className="col-span-12 md:col-span-9">
            <Reveal>
              <h2 className="font-serif font-light text-[44px] md:text-[80px] leading-[0.98] tracking-[-0.025em] max-w-[16ch]">
                One connection. <span className="emph emph-blue">Hundreds</span> of brands working for you.
              </h2>
            </Reveal>
          </div>
        </div>

        <div className="space-y-32 md:space-y-48">
          <Step
            n="01"
            title="Connect your Shopify."
            body="One OAuth click. We read your historical orders, products, and variants. No customer PII. Setup is under three minutes."
            kicker="Step one"
            art={<StepArtConnect />}
          />
          <Step
            n="02"
            title="Your data joins the pool."
            body="Sales are anonymized and aggregated. Your brand is invisible to other members; only the cross-brand patterns surface. You can opt out of any SKU at any time."
            kicker="Step two"
            reverse
            art={<StepArtPool />}
          />
          <Step
            n="03"
            title="Forecasts flow back."
            body="Drop a new SKU into Wefty, get a size-by-color forecast trained on hundreds of comparable releases — yours and everyone else's."
            kicker="Step three"
            art={<StepArtForecast />}
          />
        </div>
      </div>
    </section>
  );
}

function Step({ n, title, body, kicker, art, reverse }) {
  const ref = React.useRef(null);
  const p = useScrollProgress(ref);
  // Number scales from 0.6 to 1.4 as user scrolls past, color shifts from ash to electric near middle
  const scale = 0.85 + Math.max(0, Math.min(1, (p - 0.15) * 1.4)) * 0.6;
  const opacity = 0.18 + Math.max(0, Math.min(1, (p - 0.05) * 1.4)) * 0.82;
  const colorMix = Math.max(0, Math.min(1, (p - 0.25) * 1.6));
  const r = Math.round(10 + (45 - 10) * colorMix);
  const g = Math.round(10 + (107 - 10) * colorMix);
  const b = Math.round(10 + (228 - 10) * colorMix);

  return (
    <div ref={ref} className="grid grid-cols-12 gap-6 items-center">
      <div className={`col-span-12 md:col-span-6 ${reverse ? 'md:order-2' : ''}`}>
        <div className="flex items-baseline gap-6 md:gap-8 overflow-hidden">
          <span
            className="font-serif font-light tnum leading-none select-none"
            style={{
              fontSize: 'clamp(120px, 18vw, 240px)',
              transform: `scale(${scale.toFixed(3)})`,
              transformOrigin: '0 80%',
              color: `rgb(${r}, ${g}, ${b})`,
              opacity,
              transition: 'color 200ms linear',
              letterSpacing: '-0.05em',
            }}
          >
            {n}
          </span>
        </div>
        <div className="mt-8 md:mt-10">
          <MonoLabel>{kicker}</MonoLabel>
          <Reveal>
            <h3 className="mt-4 font-serif font-light text-[32px] md:text-[44px] leading-[1.05] tracking-[-0.02em] max-w-[18ch]">{title}</h3>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 text-[16px] md:text-[17px] leading-[1.55] text-ash-600 max-w-[42ch]">{body}</p>
          </Reveal>
        </div>
      </div>
      <div className={`col-span-12 md:col-span-6 ${reverse ? 'md:order-1' : ''}`}>
        <Reveal delay={150} className="mask-reveal">
          {art}
        </Reveal>
      </div>
    </div>
  );
}

// Art: a stylized Shopify OAuth card
function StepArtConnect() {
  return (
    <div className="relative bg-bone border border-ink/10 aspect-[4/3] overflow-hidden">
      <CornerCrosshairs size={10} inset={-1} color="#0A0A0A" opacity={0.5} />
      <div className="absolute inset-0 grid-noise opacity-50" />
      <div className="relative h-full flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-ink/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-ink/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-ink/15" />
          </div>
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-ash-400">connect.wefty.co</span>
          <span className="w-12" />
        </div>
        <div className="flex-1 flex items-center justify-center p-10">
          <div className="w-full max-w-[360px]">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">Connect store</div>
            <div className="mt-3 font-serif text-[28px] leading-[1.1] tracking-[-0.015em]">Authorize Wefty to read your Shopify orders &amp; products.</div>
            <div className="mt-8 border border-ink/15">
              <div className="flex items-center justify-between px-4 h-12 border-b border-ink/10">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ash-500">Store</span>
                <span className="font-mono text-[12px]">paloma-knit.myshopify.com</span>
              </div>
              <div className="flex items-center justify-between px-4 h-12">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ash-500">Scope</span>
                <span className="font-mono text-[12px]">read_orders, read_products</span>
              </div>
            </div>
            <button className="mt-6 w-full h-12 bg-ink text-bone font-medium text-[14px] tracking-[-0.005em] flex items-center justify-center gap-3">
              Authorize <span className="font-mono text-[11px] tracking-[0.18em]">⟶</span>
            </button>
            <div className="mt-3 font-mono text-[10px] tracking-[0.16em] uppercase text-ash-400 text-center">No customer PII transferred.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Art: a pool of anonymized brands — many dots feeding into one nucleus
function StepArtPool() {
  const [ref, isIn] = useReveal({ threshold: 0.35 });
  const ringCount = 24;
  return (
    <div ref={ref} className="relative bg-bone border border-ink/10 aspect-[4/3] overflow-hidden">
      <CornerCrosshairs size={10} inset={-1} color="#0A0A0A" opacity={0.5} />
      <div className="absolute inset-0 grid-noise opacity-40" />
      <svg viewBox="0 0 400 300" className="absolute inset-0 w-full h-full">
        {/* connector lines into center */}
        {Array.from({ length: ringCount }).map((_, i) => {
          const a = (i / ringCount) * Math.PI * 2;
          const r = 110 + (i % 3) * 6;
          const x = 200 + Math.cos(a) * r;
          const y = 150 + Math.sin(a) * r * 0.78;
          return (
            <line
              key={`l${i}`}
              x1={x} y1={y} x2={200} y2={150}
              stroke="#0A0A0A" strokeWidth="1"
              style={{
                strokeOpacity: isIn ? 0.07 : 0,
                transition: `stroke-opacity 800ms ${EASE} ${600 + i * 40}ms`,
              }}
            />
          );
        })}
        {/* Outer ring of brand nodes */}
        {Array.from({ length: ringCount }).map((_, i) => {
          const a = (i / ringCount) * Math.PI * 2;
          const r = 110 + (i % 3) * 6;
          const x = 200 + Math.cos(a) * r;
          const y = 150 + Math.sin(a) * r * 0.78;
          return (
            <circle
              key={`c${i}`} cx={x} cy={y}
              r={isIn ? 2.2 : 0}
              fill="#0A0A0A" opacity="0.55"
              style={{
                transition: `r 700ms ${EASE} ${i * 40}ms`,
              }}
            />
          );
        })}
        {/* Inner pool */}
        <circle
          cx="200" cy="150"
          r={isIn ? 52 : 0}
          fill="#0A0A0A"
          style={{ transition: `r 1100ms ${EASE} ${ringCount * 40 + 200}ms` }}
        />
        <circle
          cx="200" cy="150"
          r={isIn ? 52 : 0}
          fill="none" stroke="#2D6BE4" strokeOpacity="0.4"
          style={{ transition: `r 1100ms ${EASE} ${ringCount * 40 + 200}ms` }}
        />
      </svg>
      <div className="absolute top-5 left-5 right-5 flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">The pool</div>
          <div className="mt-1 font-serif text-[20px] tracking-[-0.01em]">Anonymized · aggregated · sharded</div>
        </div>
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none"
        style={{
          opacity: isIn ? 1 : 0,
          transition: `opacity 600ms ${EASE} ${ringCount * 40 + 700}ms`,
        }}
      >
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-bone">Wefty pool</div>
        <div className="font-serif text-[20px] text-bone tnum">
          <PoolBrandsCount isIn={isIn} delay={ringCount * 40 + 700} />
        </div>
      </div>
      <div className="absolute bottom-5 left-5 font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">
        No identifiers leave your store.
      </div>
    </div>
  );
}

function PoolBrandsCount({ isIn, delay = 0 }) {
  const [started, setStarted] = React.useState(false);
  React.useEffect(() => {
    if (!isIn) return;
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [isIn, delay]);
  const v = useCountUp(412, { isIn: started, duration: 1400 });
  return <>{v} brands</>;
}

// Art: a tiny forecast distribution — bars per size, colored bars per variant
function StepArtForecast() {
  const sizes = ['XS', 'S', 'M', 'L', 'XL'];
  const values = [12, 24, 38, 28, 14];
  const [ref, isIn] = useReveal({ threshold: 0.35 });
  return (
    <div ref={ref} className="relative bg-bone border border-ink/10 aspect-[4/3] overflow-hidden">
      <CornerCrosshairs size={10} inset={-1} color="#0A0A0A" opacity={0.5} />
      <div className="absolute inset-0 grid-noise opacity-40" />
      <div className="relative h-full flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/10">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">Forecast — SKU draft #4012</div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-electric live-dot" />
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-electric">Live</span>
          </div>
        </div>
        <div className="flex-1 flex items-end justify-between px-10 pb-12 pt-8">
          {values.map((v, i) => {
            const fullH = v * 3; // px
            return (
              <div key={i} className="flex-1 mx-1.5 flex flex-col items-center">
                <div className="w-full bg-ink/5 relative" style={{ height: 160 }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-ink"
                    style={{
                      height: `${isIn ? fullH : 0}px`,
                      transition: `height 1300ms ${EASE} ${200 + i * 110}ms`,
                    }}
                  />
                  <div
                    className="absolute left-0 right-0 border-t-2 border-electric"
                    style={{
                      bottom: `${isIn ? fullH : 0}px`,
                      transition: `bottom 1300ms ${EASE} ${200 + i * 110}ms, opacity 600ms ${EASE} ${900 + i * 110}ms`,
                      opacity: isIn ? 1 : 0,
                    }}
                  />
                </div>
                <div className="mt-3 font-mono text-[10px] tracking-[0.16em] uppercase text-ash-500">{sizes[i]}</div>
                <div className="font-mono text-[11px] tnum">
                  <ForecastUnitCount target={v} isIn={isIn} delay={400 + i * 110} />u
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ForecastUnitCount({ target, isIn, delay = 0 }) {
  const [started, setStarted] = React.useState(false);
  React.useEffect(() => {
    if (!isIn) return;
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [isIn, delay]);
  const v = useCountUp(target, { isIn: started, duration: 900 });
  return <>{v}</>;
}
