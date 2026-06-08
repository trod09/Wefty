'use client';

import React from 'react';
import { Reveal } from './hooks';
import { SectionLabel, Hairline } from './primitives';

export default function FAQ() {
  return (
    <section className="relative py-32 md:py-48 bg-bone">
      <div className="max-w-[1440px] mx-auto px-8 md:px-12">
        <div className="grid grid-cols-12 gap-6 mb-16 md:mb-24">
          <div className="col-span-12 md:col-span-3">
            <SectionLabel index="07" title="Questions" />
          </div>
          <div className="col-span-12 md:col-span-9">
            <Reveal>
              <h2 className="font-serif font-light text-[44px] md:text-[80px] leading-[0.98] tracking-[-0.025em] max-w-[16ch]">
                The honest questions, answered.
              </h2>
            </Reveal>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-10 md:col-start-3">
            <Reveal>
              <Hairline />
            </Reveal>
            {FAQS.map((q, i) => (
              <Reveal key={i} delay={i * 40}>
                <FAQItem q={q.q} a={q.a} idx={i + 1} />
                <Hairline />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: 'Does my data ever leave my Shopify store identifiably?',
    a: 'No. The agent we install runs on Shopify’s side and emits anonymized aggregates only. Brand identifiers are stripped before transmission and the cipher is held by us in a key-management service you can audit. SOC 2 Type II audited; report on request.',
  },
  {
    q: 'How accurate is the forecast on a brand-new SKU?',
    a: 'Mean absolute percentage error sits at 11–14% for SKUs with at least one comparable release in the pool, vs ~33% for solo brands forecasting manually. Confidence intervals are surfaced on every prediction — we don’t pretend to be sure when we’re not.',
  },
  {
    q: 'What if I want to keep a launch confidential?',
    a: 'Flag the SKU as private in the dashboard. It contributes to nothing, is invisible to the model, and never appears in any pool query. You can also delay any SKU’s entry into the pool by up to 90 days.',
  },
  {
    q: 'How is this different from a Shopify analytics app?',
    a: 'Analytics apps show you your own data more prettily. Wefty shows you the patterns across hundreds of comparable brands — what is selling that you don’t carry yet, what color is rising in your category, what fit your peers are walking away from.',
  },
  {
    q: 'Who can join the co-op?',
    a: 'DTC fashion brands between roughly €2M and €30M in annual revenue, on Shopify, in categories where we have density: streetwear, denim, swimwear, sneakers, knitwear, workwear. We invite by category to keep the comp set sharp.',
  },
  {
    q: 'Can I cancel? Do I get my data back?',
    a: 'You can cancel at the end of any annual term. On cancellation, your contributions are purged from training within 30 days and your dashboard is exported as CSV.',
  },
  {
    q: 'Why annual contracts only?',
    a: 'The pool only works when members commit. Forecasting models trained on monthly churners would be unstable. Annual contracts keep the cohort steady and prices reasonable.',
  },
  {
    q: 'Is there a free trial?',
    a: 'No trial. A free 30-minute scoping call where we run your last six months through the model and show you what we would have called differently.',
  },
];

function FAQItem({ q, a, idx }) {
  return (
    <details className="group">
      <summary className="flex items-start gap-6 md:gap-10 py-7 md:py-9">
        <span className="font-mono text-[11px] tracking-[0.18em] tnum text-ash-400 pt-2 hidden md:block">{String(idx).padStart(2, '0')}</span>
        <span className="flex-1 font-serif text-[22px] md:text-[28px] tracking-[-0.015em] leading-[1.2]">{q}</span>
        <span className="pt-2 ml-auto font-mono text-[12px] text-ink/60 group-open:text-electric transition-colors">
          <span className="inline-block group-open:hidden">+</span>
          <span className="hidden group-open:inline-block">−</span>
        </span>
      </summary>
      <div className="acc-body pb-9 md:pl-[88px] pr-12">
        <p className="text-[16px] leading-[1.6] text-ash-600 max-w-[64ch]">{a}</p>
      </div>
    </details>
  );
}
