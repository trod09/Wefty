'use client';

// Shared hooks and small utilities.
import React, { useState, useEffect, useRef } from 'react';

// Easing curve referenced throughout
export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

// Reveal on scroll: returns [ref, isIn]
export function useReveal(opts = {}) {
  const ref = useRef(null);
  const [isIn, setIsIn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setIsIn(true);
            io.disconnect();
          }
        });
      },
      { threshold: opts.threshold ?? 0.18, rootMargin: opts.rootMargin ?? '0px 0px -10% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, isIn];
}

// Apply 'in' class on reveal
export function Reveal({ children, className = '', as: As = 'div', delay = 0, threshold, rootMargin, style }) {
  const [ref, isIn] = useReveal({ threshold, rootMargin });
  return (
    <As
      ref={ref}
      className={`reveal ${isIn ? 'in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </As>
  );
}

// Scroll progress for an element: 0 when element top hits viewport bottom, 1 when bottom hits top.
export function useScrollProgress(ref) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf;
    const tick = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height + vh;
      const passed = vh - r.top;
      const prog = Math.max(0, Math.min(1, passed / total));
      setP(prog);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return p;
}

// Counts up to target when isIn becomes true
export function useCountUp(target, { duration = 1600, isIn = true, decimals = 0 } = {}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!isIn) return;
    const start = performance.now();
    const from = 0;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart
      const val = from + (target - from) * eased;
      setV(decimals === 0 ? Math.round(val) : Number(val.toFixed(decimals)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isIn, target, duration, decimals]);
  return v;
}

// Magnetic effect — attach to a button. Strength is pixels of max displacement.
export function useMagnetic(strength = 10, radius = 140) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) {
        el.style.transform = 'translate(0,0)';
        return;
      }
      const k = (1 - dist / radius) * strength;
      const nx = (dx / Math.max(1, dist)) * k;
      const ny = (dy / Math.max(1, dist)) * k;
      el.style.transform = `translate(${nx.toFixed(2)}px, ${ny.toFixed(2)}px)`;
    };
    const onLeave = () => {
      el.style.transform = 'translate(0,0)';
    };
    window.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [strength, radius]);
  return ref;
}
