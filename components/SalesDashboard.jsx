'use client';

// Dashboard de análisis de ventas para /upload.
// Recibe los datos ya parseados (headers + rows) y construye:
//   - una fila de métricas clave (KPIs)
//   - un insight automático sobre el patrón de tallas, en lenguaje natural
//   - 5 gráficos con Recharts (barras, donut, barras horizontales, tarta, área)
// Todo se calcula en el navegador; nada se envía a ningún servidor.
import React, { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, PieChart, Pie, AreaChart, Area, LabelList,
} from 'recharts';
import { MonoLabel } from './primitives';
import { CornerCrosshairs } from './decor';

// ---- Paleta de marca ----------------------------------------------------
const ELECTRIC = '#2D6BE4';
const PIE_PALETTE = ['#2D6BE4', '#C85A3F', '#1B2D6B', '#E07A5F', '#7CA3F0', '#E3B98F', '#3A3A36', '#C9B88F'];

// Mapa de nombres de color de prenda a un hex aproximado (con tildes ya quitadas).
const GARMENT_COLORS = {
  negro: '#0A0A0A', blanco: '#E4E4DE', azul: '#2D6BE4', beige: '#D8C9A8',
  verde: '#4B7A52', burdeos: '#7B2D3A', gris: '#9A9A92', rojo: '#C0392B',
  rosa: '#E2A0B2', amarillo: '#E3C04B', marron: '#6B4A2D', naranja: '#E07A5F',
  morado: '#6B4A8A', crema: '#F0E9DB',
};

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '3XL', '4XL'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ---- Utilidades ---------------------------------------------------------
function findCol(headers, ...names) {
  const norm = (s) => String(s).toLowerCase().trim();
  for (const n of names) {
    const i = headers.findIndex((h) => norm(h) === norm(n));
    if (i >= 0) return i;
  }
  for (const n of names) {
    const i = headers.findIndex((h) => norm(h).includes(norm(n)));
    if (i >= 0) return i;
  }
  return -1;
}

function parseNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[€$£%\s]/g, '');
  if (s === '') return null;
  const ld = s.lastIndexOf('.');
  const lc = s.lastIndexOf(',');
  if (ld >= 0 && lc >= 0) {
    if (lc > ld) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lc >= 0) {
    const p = s.split(',');
    if (p.length === 2 && p[1].length !== 3) s = p.join('.');
    else s = p.join('');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
const fmtEur = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtEur2 = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

function garmentColor(name) {
  const k = String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return GARMENT_COLORS[k];
}

function groupSum(records, keyFn, valFn) {
  const m = new Map();
  records.forEach((r) => {
    const k = keyFn(r);
    if (k === '' || k == null) return;
    m.set(k, (m.get(k) || 0) + valFn(r));
  });
  return m;
}

// ---- Tooltip y tarjetas -------------------------------------------------
function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-ink text-bone px-3 py-2">
      {label != null && label !== '' ? (
        <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-bone/55 mb-1">{label}</div>
      ) : null}
      {payload.map((p, i) => (
        <div key={i} className="font-mono text-[12px] tnum flex items-center gap-2">
          <span className="inline-block w-2 h-2" style={{ background: p.color || p.payload?.fill || ELECTRIC }} />
          <span>{p.payload?.color || p.payload?.categoria || p.name}: {formatter ? formatter(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div className={`relative border border-ink/12 bg-bone p-6 md:p-7 ${className}`}>
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <MonoLabel>{title}</MonoLabel>
        {subtitle ? (
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-ash-400 whitespace-nowrap">{subtitle}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div className="relative border border-ink/12 bg-bone p-5 md:p-6 overflow-hidden">
      <div className="absolute top-0 left-0 h-1 w-full" style={{ background: accent }} />
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-ash-500 leading-tight">{label}</div>
      <div className="mt-3 font-serif text-[30px] md:text-[40px] leading-none tracking-[-0.02em] tnum break-words">
        {value}
      </div>
    </div>
  );
}

const tickMono = { fontSize: 11, fill: '#5A5A55', fontFamily: 'var(--font-jetbrains), monospace' };

// ---- Componente principal ----------------------------------------------
export default function SalesDashboard({ headers, rows }) {
  const data = useMemo(() => {
    const iFecha = findCol(headers, 'fecha', 'date');
    const iProd = findCol(headers, 'producto', 'product');
    const iCat = findCol(headers, 'categoria', 'category');
    const iTalla = findCol(headers, 'talla', 'size');
    const iColor = findCol(headers, 'color');
    const iUnid = findCol(headers, 'unidades_vendidas', 'unidades', 'cantidad', 'units', 'qty');
    const iPrecio = findCol(headers, 'precio_unitario', 'precio', 'price');
    const iIng = findCol(headers, 'ingresos', 'revenue', 'importe', 'total');

    const records = rows.map((r) => {
      const unidades = parseNumber(r[iUnid]) ?? 0;
      const precio = parseNumber(r[iPrecio]) ?? 0;
      const ingresos = iIng >= 0 ? (parseNumber(r[iIng]) ?? unidades * precio) : unidades * precio;
      return {
        fecha: iFecha >= 0 ? String(r[iFecha] ?? '').trim() : '',
        producto: iProd >= 0 ? String(r[iProd] ?? '').trim() : '',
        categoria: iCat >= 0 ? String(r[iCat] ?? '').trim() : '',
        talla: iTalla >= 0 ? String(r[iTalla] ?? '').trim().toUpperCase() : '',
        color: iColor >= 0 ? String(r[iColor] ?? '').trim() : '',
        unidades, precio, ingresos,
      };
    });

    // Métricas clave
    const totalUnidades = records.reduce((a, r) => a + r.unidades, 0);
    const totalIngresos = records.reduce((a, r) => a + r.ingresos, 0);
    const productosDistintos = new Set(records.map((r) => r.producto).filter(Boolean)).size;
    const variantes = new Set(records.filter((r) => r.talla || r.color).map((r) => `${r.talla}|${r.color}`)).size;
    const ticketMedio = records.length ? totalIngresos / records.length : 0;

    // Gráfico: unidades por talla (orden natural de tallas)
    const tallaAgg = groupSum(records, (r) => r.talla, (r) => r.unidades);
    const sizeRank = (s) => { const i = SIZE_ORDER.indexOf(s); return i < 0 ? 999 : i; };
    const tallaSortedByUnits = [...tallaAgg.entries()].sort((a, b) => b[1] - a[1]);
    const top2Tallas = new Set(tallaSortedByUnits.slice(0, 2).map((e) => e[0]));
    const tallaData = [...tallaAgg.entries()]
      .sort((a, b) => sizeRank(a[0]) - sizeRank(b[0]))
      .map(([talla, unidades]) => ({ talla, unidades, fill: top2Tallas.has(talla) ? ELECTRIC : '#A9C2F5' }));

    // Insight de tallas en lenguaje natural
    let insight = null;
    if (tallaSortedByUnits.length >= 2 && totalUnidades > 0) {
      const [a, b] = tallaSortedByUnits;
      const min = tallaSortedByUnits[tallaSortedByUnits.length - 1];
      insight = {
        a: a[0], b: b[0],
        topPct: Math.round(((a[1] + b[1]) / totalUnidades) * 100),
        minTalla: min[0],
        minPct: Math.round((min[1] / totalUnidades) * 100),
      };
    }

    // Gráfico: ventas (unidades) por color
    const colorData = [...groupSum(records, (r) => r.color, (r) => r.unidades).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([color, unidades], i) => ({ color, unidades, fill: garmentColor(color) || PIE_PALETTE[i % PIE_PALETTE.length] }));

    // Gráfico: ingresos por producto (top 8)
    const productoData = [...groupSum(records, (r) => r.producto, (r) => r.ingresos).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([producto, ingresos], i) => ({ producto, ingresos, fill: PIE_PALETTE[i % PIE_PALETTE.length] }));

    // Gráfico: ventas (unidades) por categoría
    const categoriaData = [...groupSum(records, (r) => r.categoria, (r) => r.unidades).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([categoria, unidades], i) => ({ categoria, unidades, fill: PIE_PALETTE[i % PIE_PALETTE.length] }));

    // Gráfico: evolución de ingresos por mes
    const monthMap = new Map();
    records.forEach((r) => {
      if (!/^\d{4}-\d{2}/.test(r.fecha)) return;
      const key = r.fecha.slice(0, 7);
      const o = monthMap.get(key) || { ingresos: 0, unidades: 0 };
      o.ingresos += r.ingresos; o.unidades += r.unidades;
      monthMap.set(key, o);
    });
    const timeData = [...monthMap.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, o]) => {
        const [y, m] = key.split('-');
        return { label: `${MESES[+m - 1]} '${y.slice(2)}`, ingresos: o.ingresos, unidades: o.unidades };
      });

    return {
      kpis: [
        { label: 'Unidades vendidas', value: fmtInt(totalUnidades), accent: PIE_PALETTE[0] },
        { label: 'Ingresos totales', value: fmtEur(totalIngresos), accent: PIE_PALETTE[1] },
        { label: 'Productos distintos', value: fmtInt(productosDistintos), accent: PIE_PALETTE[2] },
        { label: 'Variantes (talla·color)', value: fmtInt(variantes), accent: PIE_PALETTE[3] },
        { label: 'Ticket medio', value: fmtEur2(ticketMedio), accent: PIE_PALETTE[4] },
      ],
      insight, tallaData, colorData, productoData, categoriaData, timeData,
    };
  }, [headers, rows]);

  const { kpis, insight, tallaData, colorData, productoData, categoriaData, timeData } = data;

  return (
    <div className="space-y-5 md:space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
        {kpis.map((k, i) => <Kpi key={i} {...k} />)}
      </div>

      {/* Insight destacado */}
      {insight ? (
        <div className="relative border border-ink/12 bg-ink text-bone p-8 md:p-10 overflow-hidden">
          <CornerCrosshairs size={12} inset={-1} color="#FAFAF7" opacity={0.5} />
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-electric flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-electric live-dot" />
            Insight automático · patrón de tallas
          </div>
          <p className="mt-5 font-serif font-light text-[26px] md:text-[38px] leading-[1.14] tracking-[-0.02em] max-w-[30ch]">
            Las tallas <span className="text-electric">{insight.a}</span> y{' '}
            <span className="text-electric">{insight.b}</span> concentran el{' '}
            <span style={{ color: '#E07A5F' }}>{insight.topPct}%</span> de las unidades vendidas.
            La <span style={{ color: '#E07A5F' }}>{insight.minTalla}</span> apenas rota
            (<span style={{ color: '#E07A5F' }}>{insight.minPct}%</span>).
          </p>
        </div>
      ) : null}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        {/* Unidades por talla */}
        {tallaData.length ? (
          <ChartCard title="Unidades por talla" subtitle="patrón de tallas" className="lg:col-span-7">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tallaData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#0A0A0A" strokeOpacity={0.07} />
                  <XAxis dataKey="talla" tick={tickMono} axisLine={false} tickLine={false} />
                  <YAxis tick={tickMono} axisLine={false} tickLine={false} width={40} />
                  <Tooltip cursor={{ fill: 'rgba(45,107,228,0.06)' }} content={<ChartTooltip formatter={fmtInt} />} />
                  <Bar dataKey="unidades" name="Unidades" radius={[3, 3, 0, 0]} maxBarSize={56}>
                    {tallaData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        ) : null}

        {/* Ventas por color (donut) */}
        {colorData.length ? (
          <ChartCard title="Ventas por color" subtitle="unidades" className="lg:col-span-5">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ChartTooltip formatter={fmtInt} />} />
                  <Pie data={colorData} dataKey="unidades" nameKey="color" cx="50%" cy="50%"
                    innerRadius={52} outerRadius={88} paddingAngle={2} stroke="#FAFAF7" strokeWidth={2}>
                    {colorData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2">
              {colorData.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 border border-ink/15 flex-shrink-0" style={{ background: d.fill }} />
                    <span className="truncate">{d.color}</span>
                  </span>
                  <span className="tnum text-ash-500 flex-shrink-0">{fmtInt(d.unidades)}</span>
                </li>
              ))}
            </ul>
          </ChartCard>
        ) : null}

        {/* Ingresos por producto (barras horizontales) */}
        {productoData.length ? (
          <ChartCard title="Ingresos por producto" subtitle={`top ${productoData.length}`} className="lg:col-span-7">
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productoData} layout="vertical" margin={{ top: 4, right: 64, left: 8, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="producto" width={132} tick={{ ...tickMono, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<ChartTooltip formatter={fmtEur} />} />
                  <Bar dataKey="ingresos" name="Ingresos" radius={[0, 3, 3, 0]} maxBarSize={28}>
                    {productoData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    <LabelList dataKey="ingresos" position="right" formatter={fmtEur}
                      style={{ fontSize: 10, fill: '#5A5A55', fontFamily: 'var(--font-jetbrains), monospace' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        ) : null}

        {/* Ventas por categoría (tarta) */}
        {categoriaData.length ? (
          <ChartCard title="Ventas por categoría" subtitle="unidades" className="lg:col-span-5">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ChartTooltip formatter={fmtInt} />} />
                  <Pie data={categoriaData} dataKey="unidades" nameKey="categoria" cx="50%" cy="50%"
                    outerRadius={88} stroke="#FAFAF7" strokeWidth={2}>
                    {categoriaData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2">
              {categoriaData.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 border border-ink/15 flex-shrink-0" style={{ background: d.fill }} />
                    <span className="truncate">{d.categoria}</span>
                  </span>
                  <span className="tnum text-ash-500 flex-shrink-0">{fmtInt(d.unidades)}</span>
                </li>
              ))}
            </ul>
          </ChartCard>
        ) : null}

        {/* Evolución de ingresos por mes (área) */}
        {timeData.length ? (
          <ChartCard title="Evolución de ingresos" subtitle="por mes" className="lg:col-span-12">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ELECTRIC} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={ELECTRIC} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#0A0A0A" strokeOpacity={0.07} />
                  <XAxis dataKey="label" tick={tickMono} axisLine={false} tickLine={false} />
                  <YAxis tick={tickMono} axisLine={false} tickLine={false} width={48}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                  <Tooltip content={<ChartTooltip formatter={fmtEur} />} />
                  <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke={ELECTRIC} strokeWidth={2.5}
                    fill="url(#gradIngresos)" dot={{ r: 3, fill: ELECTRIC, strokeWidth: 0 }}
                    activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        ) : null}
      </div>
    </div>
  );
}
