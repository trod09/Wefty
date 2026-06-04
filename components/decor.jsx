'use client';

// Decorative furniture used throughout: corner brackets, annotation markers,
// pull quotes, marquees, etc.
import React from 'react';

// Four corner crosshair brackets layered absolutely inside a relative parent.
export function CornerCrosshairs({ size = 10, color = 'currentColor', strokeWidth = 1, inset = 6, opacity = 0.55, hideOnDark }) {
  const s = strokeWidth;
  const common = {
    position: 'absolute',
    width: size,
    height: size,
    pointerEvents: 'none',
    opacity,
  };
  return (
    <>
      {/* TL */}
      <span style={{ ...common, top: inset, left: inset }}>
        <span style={{ position: 'absolute', top: 0, left: 0, width: size, height: s, background: color }} />
        <span style={{ position: 'absolute', top: 0, left: 0, width: s, height: size, background: color }} />
      </span>
      {/* TR */}
      <span style={{ ...common, top: inset, right: inset }}>
        <span style={{ position: 'absolute', top: 0, right: 0, width: size, height: s, background: color }} />
        <span style={{ position: 'absolute', top: 0, right: 0, width: s, height: size, background: color }} />
      </span>
      {/* BL */}
      <span style={{ ...common, bottom: inset, left: inset }}>
        <span style={{ position: 'absolute', bottom: 0, left: 0, width: size, height: s, background: color }} />
        <span style={{ position: 'absolute', bottom: 0, left: 0, width: s, height: size, background: color }} />
      </span>
      {/* BR */}
      <span style={{ ...common, bottom: inset, right: inset }}>
        <span style={{ position: 'absolute', bottom: 0, right: 0, width: size, height: s, background: color }} />
        <span style={{ position: 'absolute', bottom: 0, right: 0, width: s, height: size, background: color }} />
      </span>
    </>
  );
}

// Horizontal marquee band of brand names — pool member roster.
export function BrandMarquee({ items, dark = false }) {
  const repeated = [...items, ...items, ...items];
  return (
    <div className={`relative overflow-hidden border-y ${dark ? 'border-bone/15 bg-ink text-bone' : 'border-ink/10 bg-bone text-ink'}`}>
      <div className="marquee flex items-center whitespace-nowrap py-6 will-change-transform">
        {repeated.map((it, i) => (
          <span key={i} className="flex items-center flex-shrink-0">
            <span className="font-serif text-[24px] md:text-[34px] tracking-[-0.015em] px-8">{it}</span>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${dark ? 'bg-bone/40' : 'bg-ink/30'}`} />
          </span>
        ))}
      </div>
    </div>
  );
}

// A serif italic pull-quote, optionally with caret and source line
export function PullQuote({ children, source, mark = '\u201C', className = '' }) {
  return (
    <figure className={`relative ${className}`}>
      <span
        aria-hidden
        className="font-serif select-none leading-none"
        style={{
          position: 'absolute',
          top: '-0.45em',
          left: '-0.1em',
          fontSize: 'clamp(120px, 14vw, 220px)',
          color: '#2D6BE4',
          opacity: 0.18,
          fontStyle: 'italic',
        }}
      >
        {mark}
      </span>
      <blockquote className="relative font-serif font-light text-[36px] md:text-[64px] leading-[1.05] tracking-[-0.02em] max-w-[18ch]">
        {children}
      </blockquote>
      {source ? (
        <figcaption className="mt-8 font-mono text-[11px] tracking-[0.18em] uppercase text-ash-500">
          {source}
        </figcaption>
      ) : null}
    </figure>
  );
}

// Infinite-rotating oversized wordmark band
export function WordmarkBand({ children, dark = false }) {
  const repeated = Array.from({ length: 8 }).fill(children);
  return (
    <div className={`relative overflow-hidden ${dark ? 'bg-ink text-bone' : 'bg-bone text-ink'} py-10 md:py-14`}>
      <div
        className="flex items-center whitespace-nowrap"
        style={{ animation: 'marquee 50s linear infinite', willChange: 'transform' }}
      >
        {repeated.map((c, i) => (
          <span
            key={i}
            className="font-serif font-light px-8 flex items-center"
            style={{ fontSize: 'clamp(72px, 14vw, 180px)', letterSpacing: '-0.035em', lineHeight: 1 }}
          >
            <span>{c}</span>
            <span
              aria-hidden
              className={`mx-10 inline-block rounded-full`}
              style={{
                width: 'clamp(8px, 1.2vw, 14px)',
                height: 'clamp(8px, 1.2vw, 14px)',
                background: '#2D6BE4',
              }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

// Small annotation marker: a dot connected by a thin line to a label
export function Annotation({ label, side = 'right', dark = false }) {
  const color = dark ? 'rgba(250,250,247,0.7)' : 'rgba(10,10,10,0.5)';
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: '#2D6BE4', boxShadow: `0 0 0 4px rgba(45,107,228,0.12)` }}
      />
      <span className="inline-block w-8 h-px" style={{ background: color }} />
      <span className={`font-mono text-[10px] tracking-[0.18em] uppercase ${dark ? 'text-ash-300' : 'text-ash-500'}`}>{label}</span>
    </span>
  );
}

// Inline footnote superscript marker
export function Fn({ n, color = '#2D6BE4' }) {
  return (
    <sup className="font-mono text-[10px] tracking-[0.04em] tnum ml-0.5" style={{ color }}>
      {String(n).padStart(2, '0')}
    </sup>
  );
}
