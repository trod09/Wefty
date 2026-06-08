'use client';

import React from 'react';
import { Reveal } from './hooks';
import EnterAppButton from './EnterAppButton';

export default function Footer() {
  const [email, setEmail] = React.useState('');
  return (
    <footer id="join" className="relative bg-ink text-bone pt-32 md:pt-48 pb-12 overflow-hidden">
      <div className="absolute inset-0 grid-noise-dark opacity-50 pointer-events-none" />

      <div className="relative max-w-[1440px] mx-auto px-8 md:px-12">
        {/* CTA block */}
        <div className="grid grid-cols-12 gap-6 mb-24 md:mb-40">
          <div className="col-span-12 md:col-span-7">
            <Reveal>
              <h2 className="font-serif font-light text-[56px] md:text-[120px] leading-[0.92] tracking-[-0.03em] text-bone">
                The pool is open.
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="mt-8 text-[18px] md:text-[20px] leading-[1.5] text-ash-200 max-w-[42ch]">
                Bring your Shopify, leave with a forecast. Founders read every application.
              </p>
            </Reveal>
            <Reveal delay={250} className="mt-8 flex">
              <EnterAppButton tone="bone">Probar Wefty</EnterAppButton>
            </Reveal>
          </div>
          <div className="col-span-12 md:col-span-5 md:flex md:items-end">
            <Reveal delay={300} className="w-full">
              <form
                onSubmit={(e) => { e.preventDefault(); }}
                className="w-full"
              >
                <label className="block font-mono text-[10px] tracking-[0.18em] uppercase text-ash-300">Work email</label>
                <div className="mt-3 underline-input border-b border-bone/30 flex items-center pb-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@brand.co"
                    className="flex-1 bg-transparent text-bone placeholder:text-ash-400 text-[20px] md:text-[24px] font-serif tracking-[-0.01em]"
                  />
                  <button type="submit" className="ml-4 font-mono text-[11px] tracking-[0.18em] uppercase text-bone ul-anim">
                    Apply ⟶
                  </button>
                </div>
                <p className="mt-4 font-mono text-[10px] tracking-[0.18em] uppercase text-ash-400">
                  Avg. response · 36 hours · No mailing list. No drip.
                </p>
              </form>
            </Reveal>
          </div>
        </div>

        {/* Oversized wordmark */}
        <div className="relative">
          <Reveal>
            <div
              className="font-serif font-light leading-none select-none text-bone"
              style={{
                fontSize: 'clamp(120px, 23vw, 360px)',
                letterSpacing: '-0.06em',
              }}
            >
              Wefty.
            </div>
          </Reveal>
        </div>

        {/* Footer grid */}
        <div className="mt-20 grid grid-cols-12 gap-8 pb-12 border-t border-bone/15 pt-12">
          <div className="col-span-12 md:col-span-4">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-300">Manifesto</div>
            <p className="mt-4 max-w-[36ch] text-[15px] leading-[1.55] text-ash-200">
              We believe the market intelligence the giants buy from consultancies should belong to the brands that actually make the clothes.
            </p>
          </div>
          {COLS.map((col) => (
            <div key={col.title} className="col-span-6 md:col-span-2">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-300">{col.title}</div>
              <ul className="mt-4 space-y-3 text-[14px]">
                {col.items.map((it) => (
                  <li key={it}>
                    <a href="#" className="ul-anim text-bone">{it}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-bone/15 pt-8 flex flex-wrap items-end justify-between gap-6 font-mono text-[10px] tracking-[0.18em] uppercase text-ash-300">
          <div className="flex flex-wrap items-center gap-6">
            <span>© 2026 Wefty Cooperative S.L.</span>
            <span>·</span>
            <span>Madrid · Lisbon</span>
            <span>·</span>
            <span>Carrer de la Princesa 24, 08003</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="ul-anim text-ash-300">Privacy</a>
            <a href="#" className="ul-anim text-ash-300">Terms</a>
            <a href="#" className="ul-anim text-ash-300">SOC 2 report</a>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-electric live-dot" />
              All systems · normal
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

const COLS = [
  { title: 'Product', items: ['Forecasts', 'Benchmarks', 'Trends', 'Integrations'] },
  { title: 'Pool', items: ['Members', 'Categories', 'Methodology', 'Changelog'] },
  { title: 'Company', items: ['About', 'Research', 'Careers', 'Press'] },
  { title: 'Resources', items: ['Docs', 'API', 'Status', 'Contact'] },
];
