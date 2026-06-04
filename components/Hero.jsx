'use client';

import React from 'react';
import { EASE, useReveal, useCountUp, Reveal } from './hooks';
import { SectionLabel, MonoLabel, MagneticButton, Hairline } from './primitives';
import { Fn } from './decor';

// HeroBackground: a soft, slow network of nodes that breathe.
// Uses canvas + simple spring physics for the "soft spring" feel.
function HeroBackground() {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    let w, h;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * DPR; canvas.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Nodes
    const N = 26;
    const nodes = Array.from({ length: N }, (_, i) => {
      const x = Math.random() * w;
      const y = Math.random() * h;
      return {
        x, y,
        // home positions on a rough lattice for slow drift back
        hx: x, hy: y,
        vx: 0, vy: 0,
        r: 1.6 + Math.random() * 1.6,
        // slow target reshuffle
        tx: x, ty: y,
        nextShift: performance.now() + 1500 + Math.random() * 4000,
      };
    });

    let raf;
    const tick = (now) => {
      ctx.clearRect(0, 0, w, h);

      // Reshuffle targets occasionally
      nodes.forEach((n) => {
        if (now > n.nextShift) {
          n.tx = Math.max(40, Math.min(w - 40, n.hx + (Math.random() - 0.5) * 220));
          n.ty = Math.max(40, Math.min(h - 40, n.hy + (Math.random() - 0.5) * 220));
          n.nextShift = now + 3500 + Math.random() * 5000;
        }
        // Spring toward target
        const k = 0.0009;     // stiffness
        const d = 0.94;       // damping
        n.vx += (n.tx - n.x) * k;
        n.vy += (n.ty - n.y) * k;
        n.vx *= d; n.vy *= d;
        n.x += n.vx; n.y += n.vy;
      });

      // Draw edges where distance under threshold
      const max = 180;
      ctx.lineWidth = 1;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < max) {
            const op = (1 - dist / max) * 0.18;
            ctx.strokeStyle = `rgba(10,10,10,${op.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach((n) => {
        // pulse with sin
        const pulse = 0.5 + 0.5 * Math.sin(now / 1200 + n.x * 0.002 + n.y * 0.002);
        const r = n.r + pulse * 0.8;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(10,10,10,${(0.25 + pulse * 0.25).toFixed(3)})`;
        ctx.fill();

        // halo on largest nodes
        if (n.r > 2.7) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 4 + pulse * 2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(45,107,228,${(0.15 + pulse * 0.15).toFixed(3)})`;
          ctx.stroke();
        }
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.55, mixBlendMode: 'multiply', pointerEvents: 'none' }}
    />
  );
}

// Words emerge one by one with blur-in
function HeroTitle({ text, baseDelay = 0 }) {
  const words = text.split(' ');
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    // Two RAFs to ensure the initial styles are committed before the class flips
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setOn(true));
    });
    return () => { cancelAnimationFrame(r1); if (r2) cancelAnimationFrame(r2); };
  }, []);
  return (
    <h1 className="font-serif font-light leading-[0.94] tracking-[-0.035em] text-[15vw] md:text-[120px] lg:text-[148px]">
      {words.map((w, i) => (
        <span
          key={i}
          className={`word-reveal ${on ? 'in' : ''}`}
          style={{ transitionDelay: `${baseDelay + i * 60}ms`, marginRight: '0.18em' }}
        >
          {w}
        </span>
      ))}
    </h1>
  );
}

export default function Hero() {
  return (
    <section id="top" className="relative pt-32 md:pt-40 pb-20 md:pb-28 overflow-hidden">
      <div className="absolute inset-0 grid-noise opacity-60 pointer-events-none" />
      <HeroBackground />

      <div className="relative max-w-[1440px] mx-auto px-8 md:px-12">
        <div className="grid grid-cols-12 gap-6 mb-10 md:mb-14">
          <div className="col-span-12 md:col-span-7">
            <SectionLabel index="00" title="Index — Market intelligence, pooled." />
          </div>
          <div className="col-span-12 md:col-span-5 md:text-right">
            <MonoLabel>Q3 &rsquo;26 · 412 brands in the pool</MonoLabel>
          </div>
        </div>

        <HeroTitle text="Stock the right thing." />

        <div className="grid grid-cols-12 gap-6 mt-10 md:mt-14">
          <div className="col-span-12 md:col-span-5">
            <Reveal delay={700}>
              <p className="text-[18px] md:text-[20px] leading-[1.45] text-ash-600 max-w-[28ch]">
                Weft is a data co-op for DTC fashion. Connect your Shopify; every brand that joins makes the forecasts sharper<Fn n={1} /> — for all of us.
              </p>
            </Reveal>
          </div>

          <div className="col-span-12 md:col-span-7 md:flex md:justify-end md:items-end">
            <Reveal delay={900} className="flex flex-wrap items-center gap-3">
              <MagneticButton as="a" href="#join">Join the pool</MagneticButton>
              <MagneticButton as="a" href="#how" variant="ghost">How it works</MagneticButton>
            </Reveal>
          </div>
        </div>

        {/* Hero footer metrics */}
        <Reveal delay={1200} className="mt-24 md:mt-32">
          <Hairline />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 pt-8">
            <HeroMetric target={1.84} prefix="€" suffix="B" decimals={2} label="GMV in the pool (TTM)" spark={[0.4,0.5,0.55,0.62,0.7,0.74,0.82,0.9,1.0]} />
            <HeroMetric target={412}                              label="Brands contributing" spark={[0.18,0.22,0.28,0.36,0.48,0.6,0.72,0.86,1.0]} />
            <HeroMetric target={89} suffix="%"                    label="Avg. forecast accuracy" spark={[0.67/0.89,0.7/0.89,0.74/0.89,0.78/0.89,0.81/0.89,0.84/0.89,0.86/0.89,0.88/0.89,1.0]} />
            <HeroMetric target={34} prefix="—" suffix="%"         label="Markdown rate reduction" spark={[0.2,0.32,0.38,0.5,0.6,0.7,0.78,0.9,1.0]} last />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function HeroMetric({ target, prefix = '', suffix = '', decimals = 0, label, last, spark }) {
  const [ref, isIn] = useReveal({ threshold: 0.4 });
  const v = useCountUp(target, { isIn, duration: 1800, decimals });
  const display = decimals === 0 ? Math.round(v).toLocaleString() : v.toFixed(decimals);
  return (
    <div ref={ref} className={`md:px-8 md:border-l md:border-ink/10 ${last ? 'md:border-r' : ''}`}>
      <div className="font-serif text-[40px] md:text-[44px] leading-none tracking-[-0.02em] tnum">
        {prefix}{display}{suffix}
      </div>
      <div className="mt-3 font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">{label}</div>
      {spark ? <Sparkbars data={spark} isIn={isIn} /> : null}
    </div>
  );
}

// Tiny stagger-growing bar chart sparkline
function Sparkbars({ data, isIn }) {
  return (
    <div className="mt-4 flex items-end gap-[3px] h-6">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 bg-ink"
          style={{
            height: `${(isIn ? v : 0) * 100}%`,
            opacity: isIn ? (i === data.length - 1 ? 1 : 0.45) : 0,
            transition: `height 1100ms ${EASE} ${i * 60}ms, opacity 600ms ${EASE} ${i * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}
