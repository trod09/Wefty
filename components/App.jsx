'use client';

import React from 'react';
import { Reveal } from './hooks';
import { SectionLabel } from './primitives';
import { BrandMarquee, PullQuote, WordmarkBand } from './decor';
import Nav from './Nav';
import Hero from './Hero';
import Problem from './Problem';
import HowItWorks from './HowItWorks';
import NetworkEffect from './NetworkEffect';
import Dashboard from './Dashboard';
import Trust from './Trust';
import Pricing from './Pricing';
import FAQ from './FAQ';
import Footer from './Footer';

export default function App() {
  return (
    <div className="min-h-screen bg-bone text-ink">
      <Nav />
      <main>
        <Hero />
        <BrandMarqueeSection />
        <Problem />
        <HowItWorks />
        <NetworkEffect />
        <Dashboard />
        <Trust />
        <PullQuoteSection />
        <Pricing />
        <FAQ />
        <WordmarkSection />
      </main>
      <Footer />
    </div>
  );
}

const POOL_BRANDS = [
  'Paloma Knit', 'Offcourse', 'Roam Atelier', 'Halcyon Knitwear', 'Cobalt Denim',
  'Sundial Swim', 'Nineteen Cycles', 'Hours Studio', 'Field & Loam',
  'Marlow Goods', 'Northbound', 'Cedar & Sons', 'Index Sportswear', 'Quiet Type'
];

function BrandMarqueeSection() {
  return (
    <section aria-label="Pool members" className="relative">
      <div className="max-w-[1440px] mx-auto px-8 md:px-12 pt-4 pb-4">
        <div className="flex items-baseline justify-between mb-3">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">
            ↳ A few of the 412 brands currently in the pool
          </span>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-400">
            roster · q3 ’26
          </span>
        </div>
      </div>
      <BrandMarquee items={POOL_BRANDS} />
    </section>
  );
}

function PullQuoteSection() {
  return (
    <section className="relative py-32 md:py-48 bg-bone">
      <div className="max-w-[1440px] mx-auto px-8 md:px-12">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-2">
            <SectionLabel index="—" title="Field note" />
          </div>
          <div className="col-span-12 md:col-span-10 md:pl-8">
            <Reveal>
              <PullQuote source="— Inés Marçal, Founder · Paloma Knit · €11M ARR · pool member since ’24">
                <span>We bought </span>
                <span className="emph emph-blue">forty percent less</span>
                <span> of the wrong fabric this season. The pool didn’t tell us what to make. It told us what </span>
                <span className="emph emph-clay">not</span>
                <span> to.</span>
              </PullQuote>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function WordmarkSection() {
  return (
    <section aria-hidden className="relative">
      <WordmarkBand>Stock the right thing.</WordmarkBand>
    </section>
  );
}
