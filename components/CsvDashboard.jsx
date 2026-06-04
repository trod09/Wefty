'use client';

// Dashboard automático para los datos del CSV subido en /upload.
// Detecta qué columnas son numéricas y cuáles de texto, y dibuja:
//  - tarjetas KPI (total y media de cada columna numérica), con color de marca
//  - un gráfico de barras: agrupa por una columna de texto y suma una numérica
//    (o cuenta filas si no hay numéricas), mostrando el top 8.
// Todo se calcula en el navegador a partir de los datos ya parseados.
import React, { useMemo } from 'react';
import { EASE, useReveal } from './hooks';
import { MonoLabel } from './primitives';
import { CornerCrosshairs } from './decor';

// Colores de marca para dar variedad a KPIs y barras.
const PALETTE = ['#2D6BE4', '#C85A3F', '#1B2D6B', '#E07A5F'];

// Intenta leer un valor de celda como número, tolerando símbolos de moneda,
// porcentajes y separadores de miles/decimales en formato europeo o anglosajón.
function parseNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[€$£%\s]/g, '');
  if (s === '') return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // El separador más a la derecha es el decimal; el otro son miles.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const parts = s.split(',');
    // "19,90" -> decimal; "1,234" (3 dígitos) -> miles.
    if (parts.length === 2 && parts[1].length !== 3) s = parts.join('.');
    else s = parts.join('');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Formatea un número para mostrarlo (sin decimales si es grande).
function formatNumber(n) {
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.abs(n) >= 1000 ? Math.round(n) : Math.round(n * 100) / 100;
  return rounded.toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

// Clasifica cada columna como numérica o de texto y precalcula totales.
function analyze(headers, rows) {
  return headers.map((name, i) => {
    const values = rows.map((r) => String(r[i] ?? '').trim());
    const nonEmpty = values.filter((v) => v !== '');
    const nums = nonEmpty.map(parseNumber).filter((x) => x !== null);
    const isNumeric = nonEmpty.length > 0 && nums.length / nonEmpty.length >= 0.7;
    const sum = nums.reduce((a, b) => a + b, 0);
    return {
      name,
      index: i,
      nonEmpty,
      isNumeric,
      distinct: new Set(nonEmpty).size,
      sum,
      avg: nums.length ? sum / nums.length : 0,
    };
  });
}

export default function CsvDashboard({ headers, rows }) {
  const [ref, isIn] = useReveal({ threshold: 0.15 });

  const { kpis, chart } = useMemo(() => {
    const cols = analyze(headers, rows);
    const numericCols = cols.filter((c) => c.isNumeric);
    const textCols = cols.filter((c) => !c.isNumeric && c.distinct > 0);

    // KPIs: totales de columnas numéricas; si no hay, valores distintos de texto.
    let kpis;
    if (numericCols.length) {
      kpis = numericCols.slice(0, 3).map((c) => ({
        label: `Total · ${c.name}`,
        value: formatNumber(c.sum),
        sub: `media ${formatNumber(c.avg)}`,
      }));
    } else {
      kpis = textCols.slice(0, 3).map((c) => ({
        label: `${c.name}`,
        value: c.distinct.toLocaleString('es-ES'),
        sub: 'valores distintos',
      }));
    }

    // Gráfico: agrupa por la 1ª columna de texto (o la 1ª que haya) y suma la
    // 1ª columna numérica; si no hay numérica, cuenta filas.
    const dim = textCols[0] || cols[0];
    const measure = numericCols[0] || null;
    let chart = null;
    if (dim) {
      const map = new Map();
      rows.forEach((r) => {
        const key = String(r[dim.index] ?? '').trim() || '(vacío)';
        const val = measure ? parseNumber(r[measure.index]) ?? 0 : 1;
        map.set(key, (map.get(key) || 0) + val);
      });
      const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
      const top = entries.slice(0, 8);
      const max = Math.max(...top.map((e) => e[1]), 1);
      chart = {
        title: measure ? `${measure.name} por ${dim.name}` : `Filas por ${dim.name}`,
        total: entries.length,
        bars: top.map((e, i) => ({
          label: e[0],
          value: e[1],
          pct: (e[1] / max) * 100,
          color: PALETTE[i % PALETTE.length],
        })),
      };
    }

    return { kpis, chart };
  }, [headers, rows]);

  if (!headers.length) return null;

  return (
    <div ref={ref} className="relative border border-ink/12 bg-bone">
      <CornerCrosshairs size={12} inset={-1} opacity={0.6} />

      {/* Barra de título */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-ink/10">
        <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-ash-500">
          Resumen visual de tus datos
        </span>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-electric live-dot" />
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-electric">
            En tu navegador
          </span>
        </div>
      </div>

      <div className="p-6 md:p-10">
        {/* KPIs */}
        {kpis.length ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-0">
            {kpis.map((k, i) => (
              <div
                key={i}
                className="md:px-8 md:border-l md:border-ink/10 first:md:border-l-0 first:md:pl-0"
              >
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">
                  {k.label}
                </div>
                <div
                  className="mt-2 font-serif text-[36px] md:text-[44px] leading-none tracking-[-0.02em] tnum break-all"
                  style={{ color: PALETTE[i % PALETTE.length] }}
                >
                  {k.value}
                </div>
                {k.sub ? (
                  <div className="mt-2 font-mono text-[10px] tracking-[0.12em] uppercase text-ash-400">
                    {k.sub}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {/* Gráfico de barras */}
        {chart && chart.bars.length ? (
          <div className="mt-12 border-t border-ink/10 pt-10">
            <div className="flex items-baseline justify-between mb-6 gap-4">
              <MonoLabel>{chart.title}</MonoLabel>
              <MonoLabel>top {chart.bars.length} de {chart.total}</MonoLabel>
            </div>
            <div className="space-y-4">
              {chart.bars.map((b, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-4 mb-1.5">
                    <span className="font-mono text-[12px] tracking-[0.04em] text-ink truncate">
                      {b.label}
                    </span>
                    <span className="font-mono text-[12px] tnum text-ash-600 flex-shrink-0">
                      {formatNumber(b.value)}
                    </span>
                  </div>
                  <div className="h-2.5 bg-ink/8 relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${b.pct}%`,
                        background: b.color,
                        transform: isIn ? 'scaleX(1)' : 'scaleX(0)',
                        transformOrigin: '0 50%',
                        transition: `transform 1100ms ${EASE} ${i * 80}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
