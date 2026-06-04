'use client';

import React from 'react';
import { Reveal } from './hooks';
import { SectionLabel, Stat, Hairline } from './primitives';
import { CornerCrosshairs } from './decor';

// Problem section — the chaos of forecasting today.
// Visualize: scattered data dots, a big "% in markdown" stat, a "decisions in the dark" panel.

export default function Problem() {
  return (
    <section className="relative py-32 md:py-48 bg-cream" style={{ backgroundColor: "rgb(250, 250, 247)" }}>
      <div className="max-w-[1440px] mx-auto px-8 md:px-12">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-3">
            <SectionLabel index="01" title="The problem" />
          </div>

          <div className="col-span-12 md:col-span-9">
            <Reveal>
              <h2 className="font-serif font-light text-[44px] md:text-[80px] leading-[0.98] tracking-[-0.025em] max-w-[16ch]">
                You are forecasting next season with <span className="emph emph-clay">last season&rsquo;s</span> data.
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-10 text-[18px] leading-[1.5] text-ash-600 max-w-[58ch]">
                Every DTC brand sees one slice — its own. Trends are inferred from gut, Instagram saves, and a sample of friendly founders. Buyers at LVMH have a hundred analysts and a global signal. You have a Tuesday call with your ops lead.
              </p>
            </Reveal>
          </div>
        </div>

        {/* Big metric row */}
        <div className="mt-24 md:mt-32 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              <div className="text-clay">
                <Stat value={42} suffix="%" label="of DTC inventory ends in markdown" />
              </div>
              <p className="mt-6 text-[15px] text-ash-500 max-w-[36ch]">Industry average across €2–30M brands surveyed, 2025.</p>
            </Reveal>
          </div>

          <div className="col-span-12 md:col-span-7">
            <Reveal delay={150}>
              <ChaosViz />
            </Reveal>
          </div>
        </div>

        {/* Symptom list */}
        <div className="mt-24 md:mt-32">
          <Reveal>
            <Hairline />
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3">
            {SYMPTOMS.map((s, i) =>
            <Reveal key={i} delay={i * 80}>
                <div className="py-10 md:py-12 md:px-10 md:border-l md:border-ink/10 first:md:border-l-0">
                  <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-400 tnum">{`Symptom 0${i + 1}`}</div>
                  <div className="mt-5 font-serif text-[26px] leading-[1.15] tracking-[-0.015em]">{s.title}</div>
                  <p className="mt-4 text-[15px] text-ash-500 leading-[1.55] max-w-[34ch]">{s.body}</p>
                </div>
              </Reveal>
            )}
          </div>
          <Reveal>
            <Hairline />
          </Reveal>
        </div>
      </div>
    </section>);

}

const SYMPTOMS = [
{ title: 'Overbuy what doesn’t sell.', body: 'You order 8 sizes deep on a silhouette your customer never asked for. It sits, then it discounts.' },
{ title: 'Underbuy the heroes.', body: 'The colorway that becomes the season’s bestseller is gone by week three. You cannot reorder fabric in time.' },
{ title: 'Benchmark against nobody.', body: 'Is a 31% sell-through good? Bad? You have no idea — only what your founder Slack tells you.' }];


// ChaosViz: a small canvas-ish SVG that suggests scattered, noisy, single-source data.
function ChaosViz() {
  const dots = React.useMemo(() => {
    const out = [];
    const seed = (i, k) => {
      // deterministic pseudo-random
      const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 90; i++) {
      out.push({ x: seed(i, 1) * 100, y: seed(i, 2) * 100, r: 0.6 + seed(i, 3) * 1.6, op: 0.15 + seed(i, 4) * 0.6 });
    }
    return out;
  }, []);
  // jagged "trend" line that goes up and crashes
  const path = 'M 2 78 L 10 72 L 16 76 L 22 60 L 28 62 L 34 48 L 40 58 L 46 38 L 52 44 L 58 30 L 64 56 L 70 78 L 78 70 L 86 90 L 96 86';
  return (
    <div className="relative bg-bone border border-ink/10 aspect-[16/10] overflow-hidden">
      <CornerCrosshairs size={10} inset={-1} color="#0A0A0A" opacity={0.55} />
      <div className="absolute inset-0 grid-noise opacity-40" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        {dots.map((d, i) =>
        <circle key={i} cx={d.x} cy={d.y} r={d.r * 0.4} fill="#0A0A0A" opacity={d.op} />
        )}
        <path d={path} fill="none" stroke="#0A0A0A" strokeWidth="0.3" strokeOpacity="0.55" vectorEffect="non-scaling-stroke" />
        {/* Crash arrow */}
        <line x1="86" y1="90" x2="96" y2="86" stroke="#2D6BE4" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute top-5 left-5 right-5 flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">Your data, alone</div>
          <div className="mt-1 font-serif text-[20px] tracking-[-0.01em]">90-day sell-through, single SKU</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">Sample size</div>
          <div className="font-mono text-[12px] tnum text-ink mt-1">n = 1</div>
        </div>
      </div>
      <div className="absolute bottom-5 right-5 font-mono text-[10px] tracking-[0.18em] uppercase text-electric">Noise.</div>
    </div>);

}
