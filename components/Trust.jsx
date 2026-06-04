'use client';

import React from 'react';
import { Reveal } from './hooks';
import { SectionLabel, Hairline, MonoLabel } from './primitives';

// Trust / privacy section.

export default function Trust() {
  return (
    <section className="relative py-32 md:py-48 bg-cream">
      <div className="max-w-[1440px] mx-auto px-8 md:px-12">
        <div className="grid grid-cols-12 gap-6 mb-16 md:mb-24">
          <div className="col-span-12 md:col-span-3">
            <SectionLabel index="05" title="Trust · privacy" />
          </div>
          <div className="col-span-12 md:col-span-9">
            <Reveal>
              <h2 className="font-serif font-light text-[44px] md:text-[80px] leading-[0.98] tracking-[-0.025em] max-w-[18ch]">
                Your data is the product. <span className="emph emph-blue">Yours</span> stays yours.
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="mt-8 text-[18px] leading-[1.5] text-ash-600 max-w-[58ch]">
                Membership in the co-op is governed by a simple rule: nothing identifiable about your brand ever leaves your store. The pool sees patterns, not parties.
              </p>
            </Reveal>
          </div>
        </div>

        <Reveal>
          <Hairline />
        </Reveal>

        <div className="grid grid-cols-12">
          {PILLARS.map((p, i) => (
            <Reveal key={i} delay={i * 80} className={`col-span-12 md:col-span-6 lg:col-span-3 py-12 md:py-16 md:px-10 md:border-r md:border-ink/10 last:md:border-r-0`}>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-400 tnum">{`0${i + 1}`}</div>
              <div className="mt-5 font-serif text-[24px] tracking-[-0.015em] leading-[1.15]">{p.title}</div>
              <p className="mt-4 text-[14px] text-ash-500 leading-[1.6] max-w-[34ch]">{p.body}</p>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <Hairline />
        </Reveal>

        {/* Compliance row */}
        <div className="mt-16 md:mt-24 grid grid-cols-12 gap-6 items-center">
          <div className="col-span-12 md:col-span-3">
            <MonoLabel>Certifications &amp; standards</MonoLabel>
          </div>
          <div className="col-span-12 md:col-span-9">
            <div className="flex flex-wrap items-center gap-x-12 gap-y-4">
              {['SOC 2 Type II', 'GDPR', 'ISO 27001', 'CCPA', 'EU data residency'].map((c) => (
                <div key={c} className="font-serif text-[20px] tracking-[-0.01em] text-ink/80">{c}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const PILLARS = [
  { title: 'Anonymized at the edge.', body: 'Brand identifiers are stripped before data leaves your store. We hold the cipher, never your name beside your numbers.' },
  { title: 'Aggregated, never individual.', body: 'Pool queries return cohort-level patterns. No member can ever inspect another member’s sales line by line.' },
  { title: 'Temporal delay built in.', body: 'Your contributions enter the pool with a rolling 14-day delay, so no one can reverse-engineer this week’s drop.' },
  { title: 'Opt-out at SKU level.', body: 'Flag a hero, a collab, or any sensitive SKU as private. It contributes to nothing and is invisible to the model.' },
];
