'use client';

// Small reusable UI primitives.
import React from 'react';
import { EASE, useReveal, useCountUp, useMagnetic } from './hooks';

export function MonoLabel({ children, className = '' }) {
  return (
    <span className={`font-mono text-[11px] tracking-[0.18em] uppercase text-ash-500 ${className}`}>
      {children}
    </span>
  );
}

export function SectionLabel({ index, title, className = '' }) {
  return (
    <div className={`flex items-baseline gap-4 ${className}`}>
      <span className="font-mono text-[11px] tracking-[0.18em] text-ash-400 tnum">[{index}]</span>
      <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-ash-500">{title}</span>
    </div>
  );
}

export function MagneticButton({ children, variant = 'primary', as = 'button', href, onClick, className = '' }) {
  const ref = useMagnetic(8, 120);
  const base =
    'relative inline-flex items-center justify-center gap-3 px-7 h-12 font-medium text-[14px] tracking-[-0.005em] magnetic select-none';
  const styles =
    variant === 'primary'
      ? 'bg-ink text-bone hover:bg-electric'
      : 'bg-transparent text-ink border border-ink/15 hover:border-ink/60';
  const inner = (
    <>
      <span className="relative z-10">{children}</span>
      <span className="relative z-10 w-3 h-3 flex items-center justify-center">
        <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M2 6 H10 M7 3 L10 6 L7 9" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinecap="square"/></svg>
      </span>
    </>
  );
  const cls = `${base} ${styles} ${className}`;
  if (as === 'a') {
    return (
      <a ref={ref} href={href} onClick={onClick} className={cls} style={{ transition: 'background 350ms ' + EASE + ', color 350ms ' + EASE + ', transform 350ms ' + EASE }}>
        {inner}
      </a>
    );
  }
  return (
    <button ref={ref} onClick={onClick} className={cls} style={{ transition: 'background 350ms ' + EASE + ', color 350ms ' + EASE + ', transform 350ms ' + EASE }}>
      {inner}
    </button>
  );
}

// Underline-animated text link
export function UnderlineLink({ children, href = '#', className = '', dark = false }) {
  return (
    <a
      href={href}
      className={`ul-anim ${dark ? 'text-bone' : 'text-ink'} ${className}`}
      style={{ paddingBottom: 2 }}
    >
      {children}
    </a>
  );
}

// Generic hairline divider
export function Hairline({ dark = false, className = '' }) {
  return <div className={`${dark ? 'hairline-dark' : 'hairline'} ${className}`} />;
}

// Animated number that counts when in viewport
export function Stat({ value, suffix = '', prefix = '', decimals = 0, label, big = true }) {
  const [ref, isIn] = useReveal({ threshold: 0.4 });
  const v = useCountUp(value, { isIn, duration: 1600, decimals });
  return (
    <div ref={ref}>
      <div className={`${big ? 'text-[72px] md:text-[96px]' : 'text-[40px]'} font-serif tnum leading-[0.95] tracking-[-0.02em]`}>
        {prefix}{decimals === 0 ? v : v.toFixed(decimals)}{suffix}
      </div>
      {label ? <div className="mt-3 font-mono text-[11px] tracking-[0.18em] uppercase text-ash-500">{label}</div> : null}
    </div>
  );
}
