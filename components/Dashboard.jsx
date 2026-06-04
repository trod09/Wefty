'use client';

import React from 'react';
import { EASE, useReveal, useCountUp, Reveal } from './hooks';
import { SectionLabel } from './primitives';
import { CornerCrosshairs, Annotation } from './decor';

// Forecast dashboard mockup — bars grow from 0 with stagger, numbers count up,
// and a "Live" dot pulses.

export default function Dashboard() {
  const [ref, isIn] = useReveal({ threshold: 0.25 });
  return (
    <section id="product" ref={ref} className="relative py-32 md:py-48 bg-bone">
      <div className="max-w-[1440px] mx-auto px-8 md:px-12">
        <div className="grid grid-cols-12 gap-6 mb-16 md:mb-24">
          <div className="col-span-12 md:col-span-3">
            <SectionLabel index="04" title="The product" />
          </div>
          <div className="col-span-12 md:col-span-9">
            <Reveal>
              <h2 className="font-serif font-light text-[44px] md:text-[80px] leading-[0.98] tracking-[-0.025em] max-w-[18ch]">
                A forecast you can <span className="emph emph-blue">actually</span> pin to a fabric order.
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="mt-8 text-[18px] leading-[1.5] text-ash-600 max-w-[58ch]">
                Drop a new SKU, get a per-variant forecast in seconds. Size curve, color split, expected sell-through at 4/8/12 weeks, and the comparable releases the model is leaning on.
              </p>
            </Reveal>
          </div>
        </div>

        <Reveal>
          <DashboardMock isIn={isIn} />
        </Reveal>

        <div className="mt-10 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-8 md:col-start-4">
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-ash-400">
              UI is illustrative. Data shown is composited from pool member &ldquo;PALOMA KNIT,&rdquo; consented for demo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardMock({ isIn }) {
  const sizes = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const sizePct = [3, 9, 19, 28, 23, 13, 5];
  const total = useCountUp(642, { isIn, duration: 1800 });
  const sellThrough = useCountUp(78, { isIn, duration: 1800 });
  const confidence = useCountUp(92, { isIn, duration: 1800 });
  const markdown = useCountUp(11, { isIn, duration: 1800 });

  const variants = [
    { name: 'Bone', hex: '#EDEAE0', share: 0.34 },
    { name: 'Slate', hex: '#5B6573', share: 0.27 },
    { name: 'Cobalt', hex: '#2D6BE4', share: 0.22 },
    { name: 'Ink', hex: '#0A0A0A', share: 0.17 },
  ];

  return (
    <div className="bg-bone border border-ink/12 relative">
      <CornerCrosshairs size={12} inset={-1} color="#0A0A0A" opacity={0.6} />
      {/* Title bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-ink/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-ink/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-ink/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-ink/15" />
          </div>
          <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-ash-500 ml-3">weft.app / forecasts / new drop</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-electric live-dot" />
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-electric">Live model · v24.07</span>
        </div>
      </div>

      {/* Inner */}
      <div className="grid grid-cols-12">
        {/* Sidebar */}
        <aside className="hidden md:block md:col-span-2 border-r border-ink/10">
          <div className="px-6 py-6 space-y-6">
            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-400">Workspace</div>
              <div className="mt-2 font-serif text-[18px] tracking-[-0.01em]">Paloma Knit</div>
            </div>
            <ul className="space-y-3 font-mono text-[11px] tracking-[0.14em] uppercase">
              {['Overview', 'Drops', 'Forecasts', 'Benchmarks', 'Trends', 'Pool'].map((x, i) => (
                <li key={x} className={i === 2 ? 'text-ink' : 'text-ash-500'}>
                  {i === 2 ? <span className="mr-2 inline-block w-1 h-3 bg-electric align-middle"></span> : null}
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main */}
        <div className="col-span-12 md:col-span-10 p-6 md:p-10">
          {/* Breadcrumb + drop info */}
          <div className="flex items-baseline justify-between gap-6 flex-wrap">
            <div>
              <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-ash-500">Drop · FW26 · Knitwear</div>
              <div className="mt-2 font-serif text-[36px] md:text-[44px] tracking-[-0.02em] leading-[1.0]">
                Marlow crewneck — recycled merino
              </div>
              <div className="mt-3 font-mono text-[11px] tracking-[0.14em] uppercase text-ash-500">
                Status · forecasted &nbsp;·&nbsp; Pool comp set · 87 brands &nbsp;·&nbsp; Confidence · {confidence}%
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-9 px-4 border border-ink/15 font-mono text-[11px] tracking-[0.14em] uppercase hover:border-ink/60 transition-colors">Export PO</button>
              <button className="h-9 px-4 bg-ink text-bone font-mono text-[11px] tracking-[0.14em] uppercase">Lock plan</button>
            </div>
          </div>

          {/* Top stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 mt-8 border-t border-b border-ink/10 py-6">
            <DashStat label="Suggested buy" value={`${total} u`} />
            <DashStat label="Expected sell-through · 8wk" value={`${sellThrough}%`} highlight />
            <DashStat label="Modeled markdown" value={`${markdown}%`} />
            <DashStat label="Reorder window" value="Week 4" />
          </div>

          {/* Bars + side panel */}
          <div className="grid grid-cols-12 gap-8 mt-10">
            <div className="col-span-12 md:col-span-8">
              <div className="flex items-baseline justify-between">
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">Size curve · units forecast</div>
                <div className="flex items-center gap-6">
                  <Annotation label="+18% vs category median" />
                  <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500 hidden md:block">Category median ▭</div>
                </div>
              </div>

              <div className="mt-5 flex items-end gap-3 md:gap-6" style={{ height: 220 }}>
                {sizes.map((s, i) => {
                  const u = Math.round((sizePct[i] / 100) * total);
                  const heightPct = (sizePct[i] / Math.max(...sizePct)) * 100;
                  const medianPct = (Math.max(...sizePct) * 0.8 * (i === 2 || i === 3 || i === 4 ? 0.9 : 0.7)) / Math.max(...sizePct) * 100;
                  return (
                    <div key={s} className="flex-1 flex flex-col items-center">
                      <div className="w-full relative" style={{ height: 180 }}>
                        <div
                          className="bar absolute bottom-0 left-0 right-0 bg-ink"
                          style={{
                            height: `${heightPct}%`,
                            transitionDelay: `${300 + i * 90}ms`,
                            transform: isIn ? 'scaleY(1)' : 'scaleY(0)',
                            transformOrigin: '0 100%',
                            transition: `transform 1400ms ${EASE}`,
                          }}
                        />
                        {/* category median marker */}
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-ash-400"
                          style={{ bottom: `${medianPct}%`, opacity: isIn ? 1 : 0, transition: `opacity 800ms ${EASE} ${1200 + i * 90}ms` }}
                        />
                      </div>
                      <div className="mt-3 font-mono text-[11px] tracking-[0.14em] uppercase text-ash-500">{s}</div>
                      <div className="font-mono text-[12px] tnum">{u}u</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="col-span-12 md:col-span-4">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">Color split</div>
              <div className="mt-5 space-y-4">
                {variants.map((v, i) => {
                  const u = Math.round(v.share * total);
                  return (
                    <div key={v.name}>
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-3 h-3 border border-ink/15" style={{ background: v.hex }} />
                          <span className="font-mono text-[12px] tracking-[0.06em]">{v.name}</span>
                        </div>
                        <span className="font-mono text-[12px] tnum">{u}u · {Math.round(v.share * 100)}%</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-ink/8 relative overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-ink"
                          style={{
                            width: `${v.share * 100}%`,
                            transform: isIn ? 'translateX(0)' : 'translateX(-100%)',
                            transition: `transform 1200ms ${EASE} ${600 + i * 100}ms`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comp set */}
              <div className="mt-8 border-t border-ink/10 pt-6">
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">Top comparable releases</div>
                <ul className="mt-4 space-y-3 font-mono text-[12px]">
                  {[
                    ['BRAND-038', 'Merino crew · AW24', '0.93'],
                    ['BRAND-112', 'Wool half-zip · AW25', '0.88'],
                    ['BRAND-077', 'Cashmere crew · FW23', '0.81'],
                  ].map((row) => (
                    <li key={row[0]} className="flex items-baseline justify-between gap-3">
                      <span className="text-ash-500">{row[0]}</span>
                      <span className="flex-1 truncate">{row[1]}</span>
                      <span className="tnum">{row[2]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer strip */}
      <div className="border-t border-ink/10 px-6 py-4 flex items-center justify-between font-mono text-[10px] tracking-[0.16em] uppercase text-ash-500">
        <span>Last refresh · 4 min ago</span>
        <span>Trained on 412 brands · 1.84B GMV pool · 87 SKU comps</span>
        <span>Model v24.07</span>
      </div>
    </div>
  );
}

function DashStat({ label, value, highlight }) {
  return (
    <div className="md:px-6 md:border-r md:border-ink/10 last:md:border-r-0 first:md:pl-0">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">{label}</div>
      <div className={`mt-2 font-serif text-[28px] md:text-[32px] tracking-[-0.02em] leading-none tnum ${highlight ? 'text-electric' : ''}`}>{value}</div>
    </div>
  );
}
