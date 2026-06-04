'use client';

import React from 'react';
import { Reveal } from './hooks';
import { SectionLabel, MagneticButton } from './primitives';

export default function Pricing() {
  return (
    <section id="pricing" className="relative py-32 md:py-48">
      <div className="max-w-[1440px] mx-auto px-8 md:px-12">
        <div className="grid grid-cols-12 gap-6 mb-16 md:mb-24">
          <div className="col-span-12 md:col-span-3">
            <SectionLabel index="06" title="Membership" />
          </div>
          <div className="col-span-12 md:col-span-9">
            <Reveal>
              <h2 className="font-serif font-light text-[44px] md:text-[80px] leading-[0.98] tracking-[-0.025em] max-w-[18ch]">
                Pay for the <span className="emph emph-blue">pool</span>. Not for seats.
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="mt-8 text-[18px] leading-[1.5] text-ash-600 max-w-[52ch]">
                One flat fee per brand. No per-user pricing, no usage meters, no surprise true-ups. Annual contracts only — the model rewards commitment.
              </p>
            </Reveal>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink/12 border border-ink/12">
          {TIERS.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <PriceCard tier={t} />
            </Reveal>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-8 md:col-start-4">
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-ash-500">
              All tiers include · SOC 2 · SKU-level opt-out · Slack support · 14-day pool delay
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const TIERS = [
  {
    name: 'Starter',
    price: '€299',
    cadence: 'per month',
    tag: 'For brands €2–8M',
    summary: 'Get the pool working for your next two seasons.',
    features: [
      'Up to 200 SKUs forecasted/mo',
      'Category benchmarks · monthly',
      'Trend signals · weekly digest',
      '1 Shopify store',
      'Email + Slack support',
    ],
    cta: 'Join the pool',
  },
  {
    name: 'Growth',
    price: '€799',
    cadence: 'per month',
    tag: 'For brands €8–18M',
    summary: 'For the brand placing real fabric orders against the pool.',
    features: [
      'Up to 1,000 SKUs forecasted/mo',
      'Category benchmarks · weekly',
      'Trend signals · real-time',
      'Up to 3 stores',
      'PO export · ERP webhook',
      'Dedicated success contact',
    ],
    cta: 'Join the pool',
    featured: true,
  },
  {
    name: 'Scale',
    price: '€2,000+',
    cadence: 'per month',
    tag: 'For brands €18M+',
    summary: 'Custom comparator pools, model fine-tuning, multi-brand groups.',
    features: [
      'Unlimited SKUs',
      'Custom comp-set construction',
      'Private brand pools (group co-ops)',
      'Fine-tuned model on your fit',
      'Quarterly market reviews',
      'SLA · 99.9% uptime',
    ],
    cta: 'Talk to founders',
  },
];

function PriceCard({ tier }) {
  return (
    <div className={`price-card relative bg-bone ${tier.featured ? 'md:-my-6' : ''}`}>
      <div className="p-8 md:p-10 h-full flex flex-col">
        <div className="flex items-baseline justify-between">
          <div className="font-serif text-[28px] tracking-[-0.015em]">{tier.name}</div>
          {tier.featured ? (
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-electric border border-electric/40 px-2 py-1">Most fitted</span>
          ) : null}
        </div>
        <div className="mt-2 font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">{tier.tag}</div>

        <div className="mt-10 flex items-baseline gap-2">
          <span className="font-serif text-[64px] md:text-[72px] leading-none tnum tracking-[-0.02em]">{tier.price}</span>
          <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-ash-500">{tier.cadence}</span>
        </div>
        <p className="mt-4 text-[15px] text-ash-600 leading-[1.5] max-w-[34ch]">{tier.summary}</p>

        <ul className="mt-10 space-y-3 flex-1">
          {tier.features.map((f) => (
            <li key={f} className="flex items-baseline gap-3 text-[14px]">
              <span className="font-mono text-[10px] tracking-[0.18em] text-electric mt-0.5">+</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <MagneticButton variant={tier.featured ? 'primary' : 'ghost'} className="w-full">
            {tier.cta}
          </MagneticButton>
        </div>
      </div>
    </div>
  );
}
