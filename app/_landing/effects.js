/* ── Wefty landing · efectos (port del prototipo a React) ──────
   initLanding(root) arranca todo y devuelve una función de
   limpieza para el unmount (navegación SPA segura).            */

export function initLanding(root) {
  const live = { on: true };
  const cleanups = [];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const on = (target, ev, fn, opts) => {
    target.addEventListener(ev, fn, opts);
    cleanups.push(() => target.removeEventListener(ev, fn, opts));
  };
  const addNode = (node) => { cleanups.push(() => node.remove()); return node; };
  const addIO = (io) => { cleanups.push(() => io.disconnect()); return io; };
  const addInterval = (id) => { cleanups.push(() => clearInterval(id)); return id; };
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (live.on) fn(); }, ms); timers.add(id); return id; };
  cleanups.push(() => timers.forEach(clearTimeout));

  /* sondas de color para canvas (resuelven var()/oklch a rgb) */
  function probe(varName) {
    const s = document.createElement('span');
    s.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;color:var(' + varName + ')';
    root.appendChild(addNode(s));
    let cache = null; // el color es estático: se resuelve una vez, no por frame
    return () => (cache ??= getComputedStyle(s).color);
  }
  const colA = probe('--neon-a');
  const colB = probe('--neon-b');

  function visible(el, cb) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    addIO(new IntersectionObserver((es) => es.forEach((e) => cb(e.isIntersecting)), { threshold: 0.02 })).observe(el);
  }

  /* ════ nav scrolled ════ */
  const nav = root.querySelector('.nav');
  const onScroll = () => nav && nav.classList.toggle('scrolled', window.scrollY > 10);
  on(window, 'scroll', onScroll, { passive: true });
  onScroll();

  /* ════ cursor HUD ════ */
  if (fine && !reduced) {
    root.classList.add('cursor-fx');
    cleanups.push(() => root.classList.remove('cursor-fx'));
    const dot = addNode(document.createElement('div')); dot.className = 'cursor-dot';
    const ring = addNode(document.createElement('div')); ring.className = 'cursor-ring';
    const coords = addNode(document.createElement('div')); coords.className = 'cursor-coords';
    root.append(ring, dot, coords);
    const m = { x: -100, y: -100 }, s = { x: -100, y: -100 };
    on(window, 'mousemove', (e) => {
      m.x = e.clientX; m.y = e.clientY;
      ring.classList.toggle('hot', !!e.target.closest('a, button, .scenario'));
    }, { passive: true });
    (function loop() {
      if (!live.on) return;
      s.x += (m.x - s.x) * 0.22;
      s.y += (m.y - s.y) * 0.22;
      dot.style.transform = 'translate(' + m.x + 'px,' + m.y + 'px)';
      ring.style.transform = 'translate(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px)';
      coords.style.transform = 'translate(' + (s.x + 22) + 'px,' + (s.y + 14) + 'px)';
      coords.textContent = 'X:' + Math.round(m.x) + ' Y:' + Math.round(m.y);
      requestAnimationFrame(loop);
    })();
  }

  /* ════ HUD progreso lateral ════ */
  const hud = addNode(document.createElement('div'));
  hud.className = 'hud-progress';
  hud.innerHTML = '<span class="pct">0%</span><div class="track"><div class="fill"></div></div><span class="label">scroll</span>';
  root.appendChild(hud);
  const hudFill = hud.querySelector('.fill');
  const hudPct = hud.querySelector('.pct');
  const hudLabel = hud.querySelector('.label');
  let hudRaf = null;
  function updateHud() {
    hudRaf = null;
    if (!live.on) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    hudFill.style.transform = 'scaleY(' + p.toFixed(3) + ')';
    hudPct.textContent = Math.round(p * 100) + '%';
    const mid = window.innerHeight * 0.5;
    let label = 'wefty';
    root.querySelectorAll('[data-screen-label]').forEach((sec) => {
      const r = sec.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) label = sec.getAttribute('data-screen-label');
    });
    hudLabel.textContent = label.toLowerCase();
  }
  on(window, 'scroll', () => { if (!hudRaf) hudRaf = requestAnimationFrame(updateHud); }, { passive: true });
  on(window, 'resize', updateHud);
  updateHud();

  /* ════ reveals ════ */
  const reveals = root.querySelectorAll('.reveal, .wipe');
  if (!reduced && 'IntersectionObserver' in window) {
    const io = addIO(new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 }));
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  /* ════ scramble decode ════ */
  const GLYPHS = '!<>-_\\/[]{}—=+*^?#01';
  function scramble(el, duration) {
    const finals = [];
    (function collect(node) {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) finals.push({ node: child, text: child.textContent });
        else if (child.nodeType === 1) collect(child);
      });
    })(el);
    const total = finals.reduce((a, f) => a + f.text.length, 0);
    const t0 = performance.now();
    (function tick(now) {
      if (!live.on) { finals.forEach((f) => { f.node.textContent = f.text; }); return; }
      const p = Math.min(1, (now - t0) / duration);
      let done = Math.floor(p * total);
      finals.forEach((f) => {
        const n = f.text.length;
        const settled = Math.max(0, Math.min(n, done));
        done -= n;
        let out = f.text.slice(0, settled);
        for (let i = settled; i < n; i++) {
          const ch = f.text[i];
          out += /\s/.test(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        f.node.textContent = out;
      });
      if (p < 1) requestAnimationFrame(tick);
      else finals.forEach((f) => { f.node.textContent = f.text; });
    })(t0);
  }
  if (!reduced && 'IntersectionObserver' in window) {
    const sio = addIO(new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          scramble(e.target, parseInt(e.target.dataset.scramble, 10) || 900);
          sio.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 }));
    root.querySelectorAll('[data-scramble]').forEach((el) => sio.observe(el));
  }

  /* ════ glitch ════ */
  function fireGlitch(el) {
    el.classList.remove('glitching');
    void el.offsetWidth;
    el.classList.add('glitching');
    later(() => el.classList.remove('glitching'), 360);
  }
  if (!reduced) {
    root.querySelectorAll('.glitch').forEach((el, i) => {
      on(el, 'mouseenter', () => fireGlitch(el));
      addInterval(setInterval(() => {
        if (!live.on) return;
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight && Math.random() < 0.55) fireGlitch(el);
      }, 4200 + i * 1300));
    });
  }

  /* ════ terminal del hero ════ */
  const TERM_LINES = [
    [{ t: '$ ', cls: 'p' }, { t: 'wefty analizar ventas_2025.csv', cls: '' }],
    [{ t: '> ', cls: 'dim' }, { t: '4.812 filas · 38 semanas de histórico ', cls: 'dim' }, { t: '✓ columnas reconocidas', cls: 'ok' }],
    [{ t: '> ', cls: 'dim' }, { t: 'estacionalidad ', cls: '' }, { t: '✓', cls: 'ok' }, { t: ' · curvas de talla ', cls: '' }, { t: '✓', cls: 'ok' }, { t: ' · roturas detectadas: ', cls: '' }, { t: '2', cls: 'c' }],
    [{ t: '> ', cls: 'dim' }, { t: 'REF CAM-014 · ARENA — ', cls: 'dim' }, { t: 'pedido óptimo listo', cls: 'c' }]
  ];
  const termBody = root.querySelector('#term-lines');
  const termResult = root.querySelector('#term-result');

  function renderLine(parts) {
    const div = document.createElement('div');
    div.className = 'term-line';
    parts.forEach((p) => {
      const s = document.createElement('span');
      if (p.cls) s.className = p.cls;
      s.textContent = p.t;
      div.appendChild(s);
    });
    return div;
  }

  function typeLines(onDone) {
    if (reduced) {
      TERM_LINES.forEach((l) => termBody.appendChild(renderLine(l)));
      onDone();
      return;
    }
    const caret = document.createElement('span');
    caret.className = 'caret';
    let li = 0;
    function nextLine() {
      if (!live.on) return;
      if (li >= TERM_LINES.length) { caret.remove(); onDone(); return; }
      const parts = TERM_LINES[li];
      const div = document.createElement('div');
      div.className = 'term-line';
      termBody.appendChild(div);
      div.appendChild(caret);
      let pi = 0, ci = 0, span = null;
      const speed = li === 0 ? 34 : 9;
      (function typeChar() {
        if (!live.on) return;
        if (pi >= parts.length) {
          li++;
          later(nextLine, li === 1 ? 500 : 320);
          return;
        }
        if (!span) {
          span = document.createElement('span');
          if (parts[pi].cls) span.className = parts[pi].cls;
          div.insertBefore(span, caret);
        }
        span.textContent += parts[pi].t[ci];
        ci++;
        if (ci >= parts[pi].t.length) { pi++; ci = 0; span = null; }
        later(typeChar, speed + Math.random() * speed);
      })();
    }
    nextLine();
  }

  const SCENARIOS = {
    conservador: { units: [38, 96, 152, 118, 56], risk: 'liquidación <b>900 €</b><br>venta perdida <b>7.400 €</b>' },
    esperado:    { units: [52, 128, 204, 156, 80], risk: 'liquidación <b>2.100 €</b><br>venta perdida <b>3.200 €</b>' },
    agresivo:    { units: [66, 162, 258, 198, 102], risk: 'liquidación <b>5.600 €</b><br>venta perdida <b>800 €</b>' }
  };
  const MAX_UNITS = 258;
  const fmt = (n) => n.toLocaleString('es-ES');
  const rows = root.querySelectorAll('.size-row');
  const totalEl = root.querySelector('#term-total-n');
  const riskEl = root.querySelector('#term-risk');
  let currentTotal = 0, countRaf = null;

  function setScenario(name) {
    const data = SCENARIOS[name];
    if (!data) return;
    let total = 0;
    rows.forEach((row, i) => {
      const u = data.units[i];
      total += u;
      row.querySelector('.units').textContent = fmt(u);
      row.querySelector('.bar').style.width = Math.round((u / MAX_UNITS) * 100) + '%';
    });
    riskEl.innerHTML = data.risk;
    if (reduced) { totalEl.textContent = fmt(total); currentTotal = total; return; }
    const from = currentTotal, to = total, t0 = performance.now(), dur = 460;
    if (countRaf) cancelAnimationFrame(countRaf);
    (function tick(now) {
      if (!live.on) return;
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      totalEl.textContent = fmt(Math.round(from + (to - from) * eased));
      if (p < 1) countRaf = requestAnimationFrame(tick);
    })(t0);
    currentTotal = total;
  }
  root.querySelectorAll('.scenario').forEach((btn) => {
    on(btn, 'click', () => {
      root.querySelectorAll('.scenario').forEach((b) => b.classList.toggle('active', b === btn));
      setScenario(btn.dataset.scenario);
    });
  });

  if (termBody && termResult) {
    const startTerm = () => typeLines(() => {
      termResult.classList.add('show');
      rows.forEach((r) => { r.querySelector('.bar').style.width = '0%'; });
      requestAnimationFrame(() => later(() => setScenario('esperado'), 60));
    });
    if (document.fonts && document.fonts.ready && !reduced) {
      Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]).then(() => { if (live.on) later(startTerm, 700); });
    } else {
      startTerm();
    }
  }

  /* ════ tilt 3D + botones magnéticos ════ */
  if (fine && !reduced) {
    root.querySelectorAll('.holo, .terminal').forEach((card) => {
      card.style.transition = 'transform 0.4s cubic-bezier(0.17, 0.67, 0.3, 1), border-color 0.3s ease';
      on(card, 'mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(1100px) rotateX(' + (-py * 4).toFixed(2) + 'deg) rotateY(' + (px * 6).toFixed(2) + 'deg)';
      });
      on(card, 'mouseleave', () => { card.style.transform = ''; });
    });
    root.querySelectorAll('.btn').forEach((btn) => {
      on(btn, 'mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        btn.style.transform = 'translate(' + (dx * 6).toFixed(1) + 'px,' + (dy * 4).toFixed(1) + 'px)';
      });
      on(btn, 'mouseleave', () => { btn.style.transform = ''; });
    });
  }

  root.querySelectorAll('.step polyline').forEach((p) => p.setAttribute('pathLength', '1'));

  /* ════ footer gigante ════ */
  const giant = root.querySelector('.footer-giant');
  if (giant && 'IntersectionObserver' in window && !reduced) {
    const gio = addIO(new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { giant.classList.add('in'); gio.unobserve(giant); } });
    }, { threshold: 0.25 }));
    gio.observe(giant);
  } else if (giant) {
    giant.classList.add('in');
  }

  /* ════ red de marcas (constelación) ════ */
  (function network() {
    const canvas = root.querySelector('.red-canvas');
    if (!canvas) return;
    const section = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, nodes = [], links = [], pulses = [], running = false;
    const mouse = { x: -9999, y: -9999 };

    function resize() {
      // Fondo decorativo: 1.5x basta y abarata el repintado durante el scroll.
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = section.clientWidth; H = section.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes = [];
      const n = Math.max(26, Math.round((W * H) / 26000));
      for (let i = 0; i < n; i++) {
        nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14, r: 1.5 + Math.random() * 2, hub: Math.random() < 0.14 });
      }
      links = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          if (dx * dx + dy * dy < 200 * 200) links.push([i, j]);
        }
      }
      pulses = [];
    }
    function spawnPulse() {
      if (!links.length) return;
      pulses.push({ link: links[(Math.random() * links.length) | 0], t: 0, speed: 0.5 + Math.random() * 0.8, dir: Math.random() < 0.5 ? 1 : -1 });
      if (pulses.length > 26) pulses.shift();
    }
    let last = 0, pulseTimer = 0;
    function frame(now) {
      if (!live.on || !running) return;
      const dt = Math.min(0.05, (now - last) / 1000) || 0.016;
      last = now;
      ctx.clearRect(0, 0, W, H);
      const a = colA(), b = colB();
      // Sin ratón (móvil, o mientras se hace scroll) saltamos toda su física.
      const hasMouse = mouse.x > -9000;
      nodes.forEach((nd) => {
        nd.x += nd.vx * dt; nd.y += nd.vy * dt;
        if (nd.x < 0 || nd.x > W) nd.vx *= -1;
        if (nd.y < 0 || nd.y > H) nd.vy *= -1;
        if (hasMouse) {
          const dx = mouse.x - nd.x, dy = mouse.y - nd.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 220 * 220 && d2 > 1) {
            const f = 6 / Math.sqrt(d2);
            nd.x += dx * f * dt * 14;
            nd.y += dy * f * dt * 14;
          }
        }
      });
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgb(140, 170, 200)';
      links.forEach(([i, j]) => {
        const n1 = nodes[i], n2 = nodes[j];
        const lx = n1.x - n2.x, ly = n1.y - n2.y;
        const d2 = lx * lx + ly * ly;
        if (d2 > 220 * 220) return;          // distancia² evita Math.hypot por enlace
        const d = Math.sqrt(d2);
        let boost = 0;
        if (hasMouse) {
          const mx = (n1.x + n2.x) / 2, my = (n1.y + n2.y) / 2;
          const md = Math.hypot(mouse.x - mx, mouse.y - my);
          boost = md < 200 ? (1 - md / 200) * 0.35 : 0;
        }
        ctx.globalAlpha = Math.max(0, 0.16 * (1 - d / 220)) + boost * 0.4;
        ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke();
      });
      pulseTimer += dt;
      if (pulseTimer > 0.18) { pulseTimer = 0; spawnPulse(); }
      pulses.forEach((p) => {
        p.t += p.speed * dt;
        const [i, j] = p.link;
        const n1 = p.dir > 0 ? nodes[i] : nodes[j];
        const n2 = p.dir > 0 ? nodes[j] : nodes[i];
        const t = Math.min(1, p.t);
        ctx.globalAlpha = 0.9 * (1 - Math.abs(t - 0.5) * 0.6);
        ctx.fillStyle = Math.random() < 0.5 ? a : b;
        ctx.beginPath();
        ctx.arc(n1.x + (n2.x - n1.x) * t, n1.y + (n2.y - n1.y) * t, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });
      pulses = pulses.filter((p) => p.t < 1);
      nodes.forEach((nd) => {
        ctx.fillStyle = nd.hub ? a : 'rgb(170, 190, 215)';
        ctx.globalAlpha = nd.hub ? 0.95 : 0.5;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r, 0, Math.PI * 2); ctx.fill();
        if (nd.hub) {
          ctx.globalAlpha = 0.12;
          ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r * 4.5, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    if (fine) {
      on(section, 'mousemove', (e) => {
        const r = section.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
      }, { passive: true });
      on(section, 'mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });
    }
    resize();
    on(window, 'resize', resize);
    if (reduced) return;
    visible(canvas, (vis) => {
      if (vis && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      else if (!vis) running = false;
    });
  })();

  /* ════ modo lanzamiento (simulación en bucle) ════ */
  (function launch() {
    const lz = root.querySelector('#lz');
    if (!lz) return;
    const statusText = lz.querySelector('.lz-status-text');
    const dots = lz.querySelector('.lz-dots');
    const nEl = root.querySelector('#lz-n');
    const TOTAL = 360;
    const SEARCH = 'buscando análogos en la red';
    const FOUND = '3 análogos encontrados · previsión sintetizada ✓';
    if (reduced) {
      lz.classList.add('p1', 'p2', 'p3');
      statusText.textContent = FOUND;
      dots.style.display = 'none';
      nEl.textContent = fmt(TOTAL);
      return;
    }
    let runningCycle = false, lzRaf = null;
    function countTo(target, dur) {
      const t0 = performance.now();
      if (lzRaf) cancelAnimationFrame(lzRaf);
      (function tick(now) {
        if (!live.on) return;
        const p = Math.min(1, (now - t0) / dur);
        nEl.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) lzRaf = requestAnimationFrame(tick);
      })(t0);
    }
    function cycle() {
      if (!runningCycle || !live.on) return;
      lz.classList.remove('p1', 'p2', 'p3');
      statusText.textContent = SEARCH;
      dots.style.display = '';
      nEl.textContent = '0';
      later(() => runningCycle && lz.classList.add('p1'), 250);
      later(() => runningCycle && lz.classList.add('p2'), 950);
      later(() => {
        if (!runningCycle) return;
        lz.classList.add('p3');
        statusText.textContent = FOUND;
        dots.style.display = 'none';
        countTo(TOTAL, 550);
      }, 1800);
      later(cycle, 7000);
    }
    addIO(new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !runningCycle) { runningCycle = true; cycle(); }
        else if (!e.isIntersecting) runningCycle = false;
      });
    }, { threshold: 0.25 })).observe(lz);
  })();

  /* ════ esfera de la pool — crece con el scroll ════ */
  (function pool() {
    const canvas = root.querySelector('#pool-sphere');
    if (!canvas) return;
    const section = canvas.closest('.red');
    const anchor = root.querySelector('.pool-wrap');
    const label = root.querySelector('.pool-label');
    const ctx = canvas.getContext('2d');
    const N = 420;
    let pts = [], W = 0, H = 0, running = false;

    (function build() {
      const phi = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2;
        const rad = Math.sqrt(1 - y * y);
        const th = phi * i;
        pts.push({ x: Math.cos(th) * rad, y, z: Math.sin(th) * rad, accent: i % 9 === 4 ? 1 : (i % 9 === 8 ? 2 : 0), tw: Math.random() * Math.PI * 2 });
      }
    })();
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = section.clientWidth; H = section.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const TILT = 0.42, cosT = Math.cos(TILT), sinT = Math.sin(TILT), PERSP = 3.2;
    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    /* Geometría cacheada: medir rectángulos dentro del bucle de dibujo
       (getBoundingClientRect por frame) provocaba layout thrashing y el zoom
       iba a tirones. Se re-mide en resize y al re-entrar a la sección. */
    let vh = window.innerHeight, secTop = 0, secH = 0, axRel = 0, ayRel = 0, anchoAncla = 0;
    function medir() {
      vh = window.innerHeight;
      const sr = section.getBoundingClientRect();
      secTop = sr.top + window.scrollY;
      secH = sr.height;
      const ar = anchor.getBoundingClientRect();
      axRel = ar.left - sr.left + ar.width / 2;
      ayRel = ar.top - sr.top + ar.height / 2;
      anchoAncla = ar.width;
    }
    function scrollProgress() {
      const top = secTop - window.scrollY;
      const start = vh * 0.65;
      const end = -(secH - vh * 0.75);
      return clamp01((start - top) / (start - end));
    }
    function draw(t, p) {
      ctx.clearRect(0, 0, W, H);
      const e = easeInOut(p);
      const cx = lerp(axRel, W / 2, e);
      const cy = lerp(ayRel, H / 2, e);
      const R = lerp(anchoAncla * 0.40, Math.min(W, H) * 0.52, e);
      const rot = t * 0.00035 + e * 3.2;
      const cosR = Math.cos(rot), sinR = Math.sin(rot);
      const a = colA(), b = colB();
      const fade = 1 - e * 0.45;
      const opEtiqueta = (Math.round(clamp01(1 - p * 2.2) * 100) / 100).toString();
      if (label && label.dataset.op !== opEtiqueta) {
        label.dataset.op = opEtiqueta;
        label.style.opacity = opEtiqueta;
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(e * 0.35);
      ctx.strokeStyle = a;
      ctx.globalAlpha = 0.16 * fade;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 1.22, R * 1.22 * Math.abs(sinT) * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const proj = pts.map((q) => {
        const x1 = q.x * cosR + q.z * sinR;
        const z1 = -q.x * sinR + q.z * cosR;
        const y2 = q.y * cosT - z1 * sinT;
        const z2 = q.y * sinT + z1 * cosT;
        const s = PERSP / (PERSP + z2);
        return { q, sx: cx + x1 * R * s, sy: cy + y2 * R * s, z: z2, s };
      }).sort((m, n) => n.z - m.z);
      proj.forEach((o) => {
        const depth = (1 - o.z) / 2;
        const tw = 0.75 + 0.25 * Math.sin(t * 0.002 + o.q.tw);
        ctx.fillStyle = o.q.accent === 1 ? a : (o.q.accent === 2 ? b : 'rgb(175, 195, 218)');
        ctx.globalAlpha = (o.q.accent ? 0.5 + depth * 0.5 : 0.12 + depth * 0.38) * tw * fade;
        ctx.beginPath();
        ctx.arc(o.sx, o.sy, (o.q.accent ? 1.9 : 1.25) * o.s * (1 + e * 0.5), 0, Math.PI * 2);
        ctx.fill();
        if (o.q.accent && depth > 0.72) {
          ctx.globalAlpha = 0.12 * tw * fade;
          ctx.beginPath();
          ctx.arc(o.sx, o.sy, 5.5 * o.s * (1 + e * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
      });
      for (let k = 0; k < 3; k++) {
        const ang = t * (0.0006 + k * 0.00018) + k * 2.2 + e * 1.6;
        const ox = Math.cos(ang) * 1.22;
        const oz = Math.sin(ang) * 1.22;
        const oy2 = -oz * sinT;
        const oz2 = oz * cosT;
        const s = PERSP / (PERSP + oz2);
        ctx.fillStyle = k % 2 ? b : a;
        ctx.globalAlpha = (0.35 + ((1.22 - oz2) / 2.44) * 0.6) * fade;
        ctx.beginPath();
        ctx.arc(cx + ox * R * s, cy + oy2 * R * s, Math.max(0.5, 2.4 * s), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    let pObjetivo = 0;
    let pAnim = 0;
    function frame(now) {
      if (!live.on || !running) return;
      pAnim += (pObjetivo - pAnim) * 0.1; // inercia: suave al bajar y al subir
      if (Math.abs(pObjetivo - pAnim) < 0.0005) pAnim = pObjetivo;
      try { draw(now, pAnim); } catch (err) { console.error('pool-sphere:', err); }
      requestAnimationFrame(frame);
    }
    resize();
    medir();
    pObjetivo = pAnim = scrollProgress();
    on(window, 'scroll', () => { pObjetivo = scrollProgress(); }, { passive: true });
    on(window, 'resize', () => {
      resize();
      medir();
      pObjetivo = scrollProgress();
      if (reduced) draw(40000, 0.25);
    });
    if (reduced) { draw(40000, 0.25); return; }
    addIO(new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !running) {
          medir(); // por si el contenido superior cambió de altura
          pObjetivo = pAnim = scrollProgress();
          running = true;
          requestAnimationFrame(frame);
        } else if (!e.isIntersecting) running = false;
      });
    }, { threshold: 0.02 })).observe(section);
  })();

  /* ════ cadena de montaje (cómo funciona) ════
     Al entrar en viewport, un pulso recorre el conector y enciende los tres
     pasos en secuencia: columnas del CSV validándose → la gráfica dibujándose
     → el pedido materializándose fila a fila. Una sola vez. Los estados
     ocultos solo existen bajo .flujo-armado (sin JS o con movimiento
     reducido, la sección es estática y completa). */
  (function cadenaMontaje() {
    const steps = root.querySelector('#como-funciona .steps');
    const section = root.querySelector('#como-funciona');
    if (!steps || !section || reduced) return;
    const pasos = [...steps.querySelectorAll('.step')];
    if (pasos.length < 3) return;
    section.classList.add('flujo-armado');
    const io = addIO(new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        later(() => pasos[0].classList.add('step-live'), 40);   // el CSV cae ya
        later(() => section.classList.add('flujo-1'), 950);      // pulso →
        later(() => pasos[1].classList.add('step-live'), 1250);  // gráfica
        later(() => section.classList.add('flujo-2'), 1900);     // pulso →
        later(() => pasos[2].classList.add('step-live'), 2150);  // pedido
      });
    }, { threshold: 0.3 }));
    io.observe(steps);
  })();

  /* ── limpieza ── */
  return function cleanup() {
    live.on = false;
    cleanups.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
  };
}
