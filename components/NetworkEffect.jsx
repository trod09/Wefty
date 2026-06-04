'use client';

import React from 'react';
import { Reveal } from './hooks';
import { CornerCrosshairs } from './decor';

// Network Effect section — dark background, live canvas of brands appearing
// and connecting to their closest neighbors. An accuracy counter ticks up.

export default function NetworkEffect() {
  const wrapRef = React.useRef(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setInView(true);
        });
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Accuracy counter — sweeps from 67 to 89 as the network "fills in"
  const [accuracy, setAccuracy] = React.useState(67);
  const [brandsCount, setBrandsCount] = React.useState(8);

  React.useEffect(() => {
    if (!inView) return;
    let raf;
    const start = performance.now();
    const dur = 5200;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setAccuracy(67 + Math.round((89 - 67) * eased * 10) / 10);
      setBrandsCount(Math.round(8 + (412 - 8) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView]);

  return (
    <section
      id="network"
      ref={wrapRef}
      className="relative bg-ink text-bone py-32 md:py-56 overflow-hidden"
    >
      <div className="absolute inset-0 grid-noise-dark opacity-70 pointer-events-none" />

      <div className="relative max-w-[1440px] mx-auto px-8 md:px-12">
        <div className="grid grid-cols-12 gap-6 mb-16 md:mb-24">
          <div className="col-span-12 md:col-span-3">
            <div className="flex items-baseline gap-4">
              <span className="font-mono text-[11px] tracking-[0.18em] text-ash-300 tnum">[03]</span>
              <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-ash-300">The network effect</span>
            </div>
          </div>
          <div className="col-span-12 md:col-span-9">
            <Reveal>
              <h2 className="font-serif font-light text-[44px] md:text-[88px] leading-[0.96] tracking-[-0.025em] max-w-[16ch] text-bone">
                Every brand that joins <span className="emph" style={{ color: '#7DA3F0' }}>sharpens</span> the forecast for the next one.
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-8 text-[18px] leading-[1.5] text-ash-200 max-w-[52ch]">
                Watch the model improve in real time as comparable brands enter the pool. The denser the network, the smaller your error bars.
              </p>
            </Reveal>
          </div>
        </div>

        {/* Live counter strip */}
        <div className="mb-10 md:mb-14 grid grid-cols-2 md:grid-cols-4 gap-y-8 md:gap-0">
          <NetStat
            label="Brands in pool"
            value={brandsCount.toString()}
            color="bone"
          />
          <NetStat
            label="Forecast accuracy"
            value={`${accuracy.toFixed(1)}%`}
            highlight
          />
          <NetStat label="SKUs forecasted (TTM)" value={`${Math.round(brandsCount * 84.2).toLocaleString()}`} />
          <NetStat label="Avg. confidence ↑" value={`+${Math.round((brandsCount - 8) * 0.08)}σ`} last />
        </div>

        <NetworkCanvas inView={inView} />

        {/* Annotation */}
        <div className="mt-10 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-6">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-300">Legend</div>
            <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px]">
              <LegendDot color="#FAFAF7" label="Brand node" />
              <LegendDot color="#2D6BE4" label="New brand joining" />
              <LegendDot color="#1B2D6B" label="Affinity link" line />
            </div>
          </div>
          <div className="col-span-12 md:col-span-6 md:text-right">
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-ash-300">
              Real model output, anonymized. Replayed at 1,200× speed.
            </p>
          </div>
        </div>

        {/* Big closing line */}
        <div className="mt-32 md:mt-48">
          <Reveal>
            <p className="font-serif font-light text-[44px] md:text-[80px] leading-[1.0] tracking-[-0.025em] max-w-[18ch]">
              Solo, your data is anecdote. Pooled, it is a market.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function NetStat({ label, value, highlight, last }) {
  return (
    <div className={`md:px-8 md:border-l md:border-bone/15 ${last ? 'md:border-r' : ''}`}>
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-300">{label}</div>
      <div
        className="mt-3 font-serif text-[36px] md:text-[48px] leading-none tnum tracking-[-0.02em]"
        style={highlight ? { color: '#7DA3F0' } : {}}
      >
        {value}
      </div>
    </div>
  );
}

function LegendDot({ color, label, line }) {
  return (
    <span className="flex items-center gap-2">
      {line ? (
        <span className="inline-block w-6 h-px" style={{ background: color }} />
      ) : (
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      )}
      <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-ash-300">{label}</span>
    </span>
  );
}

// The animated network — points appear, then connect to nearest neighbors.
function NetworkCanvas({ inView }) {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    if (!inView) return;
    const canvas = canvasRef.current;
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

    // We'll spawn up to N nodes over the duration. Each gets a category 0..C-1.
    const N = 110;
    const C = 6; // categories
    const categoryColors = ['#FAFAF7', '#D4D4CE', '#B6B6AC', '#8A8A82', '#FAFAF7', '#D4D4CE'];

    const nodes = [];
    // Spawn placement — gentle clustering by category, with jitter
    const center = (cat) => {
      const a = (cat / C) * Math.PI * 2 + 0.2;
      return { x: w / 2 + Math.cos(a) * (w * 0.27), y: h / 2 + Math.sin(a) * (h * 0.32) };
    };

    let last = performance.now();
    let spawnAt = performance.now() + 80;
    const spawnDur = 5200;
    const startTime = performance.now();

    const newNode = () => {
      const cat = Math.floor(Math.random() * C);
      const c = center(cat);
      const jitter = 100 + Math.random() * 100;
      const ang = Math.random() * Math.PI * 2;
      return {
        x: c.x + Math.cos(ang) * jitter * Math.random(),
        y: c.y + Math.sin(ang) * jitter * Math.random(),
        vx: 0, vy: 0,
        cat,
        born: performance.now(),
        // brand new ones are highlighted
        glow: 1,
        r: 1.6 + Math.random() * 1.2,
      };
    };

    let raf;
    const tick = (now) => {
      const dt = Math.min(40, now - last);
      last = now;
      // Spawn new nodes through the duration
      const elapsed = now - startTime;
      const target = Math.min(N, Math.floor((elapsed / spawnDur) * N) + 6);
      while (nodes.length < target && now > spawnAt) {
        nodes.push(newNode());
        spawnAt = now + 25 + Math.random() * 30;
      }

      // Gentle drift toward category center
      nodes.forEach((n) => {
        const c = center(n.cat);
        const k = 0.0006;
        n.vx += (c.x - n.x) * k;
        n.vy += (c.y - n.y) * k;
        // a tiny brownian
        n.vx += (Math.random() - 0.5) * 0.04;
        n.vy += (Math.random() - 0.5) * 0.04;
        n.vx *= 0.95; n.vy *= 0.95;
        n.x += n.vx; n.y += n.vy;
        n.glow = Math.max(0, n.glow - dt / 900);
      });

      // Draw
      ctx.clearRect(0, 0, w, h);

      // Affinity links: each node connects to nearest 2 of same category
      // (skipped on early frames for clarity)
      const sameCat = {};
      nodes.forEach((n, i) => {
        (sameCat[n.cat] = sameCat[n.cat] || []).push({ i, n });
      });
      Object.values(sameCat).forEach((arr) => {
        arr.forEach(({ i, n }) => {
          // find nearest 2 in arr (excluding self)
          const dists = arr
            .filter((x) => x.i !== i)
            .map((x) => ({ x, d: Math.hypot(x.n.x - n.x, x.n.y - n.y) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 2);
          dists.forEach(({ x, d }) => {
            const op = Math.max(0, Math.min(0.45, 1 - d / 180));
            ctx.strokeStyle = `rgba(27,45,107,${op.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(x.n.x, x.n.y);
            ctx.stroke();
          });
        });
      });

      // Cross-cluster faint links: each node connects to 1 nearest of any category
      nodes.forEach((n, i) => {
        let best = null;
        let bd = Infinity;
        nodes.forEach((m, j) => {
          if (j === i) return;
          const d = Math.hypot(m.x - n.x, m.y - n.y);
          if (d < bd) { bd = d; best = m; }
        });
        if (best && bd < 120) {
          ctx.strokeStyle = `rgba(45,107,228,${(0.05 + (1 - bd / 120) * 0.18).toFixed(3)})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(best.x, best.y);
          ctx.stroke();
        }
      });

      // Nodes themselves
      nodes.forEach((n) => {
        const color = categoryColors[n.cat];
        // glow halo for new ones
        if (n.glow > 0.05) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + n.glow * 12, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(45,107,228,${(n.glow * 0.45).toFixed(3)})`;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + (n.glow > 0.05 ? 1 : 0), 0, Math.PI * 2);
        ctx.fillStyle = n.glow > 0.05 ? '#2D6BE4' : color;
        ctx.fill();
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [inView]);

  return (
    <div className="relative border border-bone/15 aspect-[16/9] bg-ink overflow-hidden">
      <CornerCrosshairs size={14} inset={-1} color="#FAFAF7" opacity={0.55} />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute top-5 left-5 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-electric live-dot" />
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-electric">Live · pool simulation</span>
      </div>
      <div className="absolute top-5 right-5 font-mono text-[10px] tracking-[0.18em] uppercase text-ash-300">
        weft.network · view 03
      </div>
      <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-300">
          Each dot = one anonymized DTC brand. Lines = high affinity to your category.
        </div>
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-300 hidden md:block">
          Sample · streetwear · denim · swim · sneakers · knit · workwear
        </div>
      </div>
    </div>
  );
}
