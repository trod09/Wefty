'use client';

// Dashboard de análisis de ventas para /upload.
// Recibe los datos ya parseados (headers + rows) y construye una narrativa
// en capas: titular (insight), signos vitales (KPIs), gráfico protagonista
// (tallas), gráficos de apoyo (color, producto, categoría) y evolución temporal.
// Estética "dark editorial premium": superficie casi-negra, gradientes sutiles,
// color solo en los datos. Todo se calcula en el navegador.
import React, { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, PieChart, Pie, AreaChart, Area, LabelList, ReferenceLine,
} from 'recharts';
import StockEngine from '@/components/StockEngine';

// ---- Paleta ------------------------------------------------------------
const ELECTRIC = '#2D6BE4';
const EMBER = '#E07A5F';        // único acento de apoyo
const MUTED = '#43464D';        // barras "que apenas rotan" (gris apagado sobre oscuro)
const SURFACE = '#141518';      // fondo de tarjeta (para separar slices del donut)
const TXT = '#F5F5F7';          // títulos
const TXT2 = '#8A8A8F';         // secundario
const PIE_PALETTE = ['#2D6BE4', '#C85A3F', '#1B2D6B', '#E07A5F', '#7CA3F0', '#E8A07F', '#34488A', '#B5734E'];

// Mapa de nombres de color de prenda a un hex aproximado (con tildes ya quitadas).
const GARMENT_COLORS = {
  negro: '#2A2A2E', blanco: '#E4E4DE', azul: '#2D6BE4', beige: '#D8C9A8',
  verde: '#4B7A52', burdeos: '#9B3A4A', gris: '#9A9A92', rojo: '#C0392B',
  rosa: '#E2A0B2', amarillo: '#E3C04B', marron: '#6B4A2D', naranja: '#E07A5F',
  morado: '#6B4A8A', crema: '#F0E9DB',
};

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '3XL', '4XL'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const LABEL = 'font-mono text-[10px] tracking-[0.18em] uppercase';

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

// Tooltip oscuro personalizado: título con muestra de color + líneas de dato.
function tip(title, accent, lines) {
  return (
    <div className="rounded-lg border border-[#2a2c31] px-3.5 py-2.5 shadow-2xl" style={{ background: 'rgba(25,26,30,0.97)' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: accent }} />
        <span className="font-mono text-[11px] tracking-[0.06em]" style={{ color: TXT }}>{title}</span>
      </div>
      {lines.map((l, i) => (
        <div key={i} className="font-mono text-[11px] tnum" style={{ color: i === 0 ? TXT : TXT2 }}>{l}</div>
      ))}
    </div>
  );
}

// ---- Piezas de UI -------------------------------------------------------
function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div
      className={`group relative rounded-xl border border-[#232428] p-6 md:p-7 transition-all duration-300 hover:border-[#3a3c42] ${className}`}
      style={{ background: 'linear-gradient(150deg, #16171b 0%, #121316 100%)' }}
    >
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <span className={LABEL} style={{ color: TXT2 }}>{title}</span>
        {subtitle ? <span className={`${LABEL} whitespace-nowrap`} style={{ color: '#5d5e63' }}>{subtitle}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Kpi({ label, value, principal = false }) {
  if (principal) {
    return (
      <div
        className="relative col-span-2 lg:row-span-2 rounded-xl p-6 md:p-8 flex flex-col justify-between overflow-hidden border border-[#2a3654] transition-all duration-300"
        style={{
          background: 'linear-gradient(150deg, rgba(45,107,228,0.18) 0%, rgba(45,107,228,0.04) 38%, #141518 100%)',
          boxShadow: '0 0 60px -26px rgba(45,107,228,0.75)',
        }}
      >
        <div className={LABEL} style={{ color: '#9db4ec' }}>{label}</div>
        <div className="mt-6 font-serif text-[48px] md:text-[68px] leading-[0.92] tracking-[-0.025em] tnum break-words" style={{ color: TXT }}>
          {value}
        </div>
      </div>
    );
  }
  return (
    <div
      className="relative rounded-xl border border-[#232428] p-5 md:p-6 transition-all duration-300 hover:border-[#3a3c42]"
      style={{ background: 'linear-gradient(150deg, #16171b 0%, #121316 100%)' }}
    >
      <div className={LABEL} style={{ color: TXT2 }}>{label}</div>
      <div className="mt-3 font-serif text-[28px] md:text-[36px] leading-none tracking-[-0.02em] tnum break-words" style={{ color: TXT }}>
        {value}
      </div>
    </div>
  );
}

const tickMono = { fontSize: 11, fill: TXT2, fontFamily: 'var(--font-jetbrains), monospace' };

// Desplegable de filtro con estilo oscuro de Loop. value vacío = "todos".
function FilterSelect({ label, value, onChange, options, allLabel }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL} style={{ color: TXT2 }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 min-w-[170px] rounded-lg border border-[#232428] px-3 text-[14px] text-[#F5F5F7] outline-none transition-colors focus:border-[#3F7BEC] cursor-pointer"
        style={{ background: '#0E0F12', colorScheme: 'dark' }}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ---- Componente principal ----------------------------------------------
export default function SalesDashboard({ headers, rows }) {
  // 1) Leemos las filas una sola vez (no depende de los filtros). De aquí salen
  //    los "records" ya parseados y las opciones para los desplegables.
  const parsed = useMemo(() => {
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

    // Opciones para los filtros: valores distintos, sin vacíos, ordenados.
    const categorias = [...new Set(records.map((r) => r.categoria).filter(Boolean))].sort();
    const productos = [...new Set(records.map((r) => r.producto).filter(Boolean))].sort();

    return { records, categorias, productos };
  }, [headers, rows]);

  // 2) Estado de los filtros. Valor vacío significa "todos / sin filtrar".
  const [fCategoria, setFCategoria] = useState('');
  const [fProducto, setFProducto] = useState('');

  // Si cambian los datos cargados (otro CSV o el histórico), limpiamos filtros
  // para no esconder datos por un filtro que ya no aplica.
  useEffect(() => {
    setFCategoria('');
    setFProducto('');
  }, [headers, rows]);

  // 3) Aplicamos los filtros activos sobre los records.
  const filtered = useMemo(() => {
    return parsed.records.filter((r) => {
      if (fCategoria && r.categoria !== fCategoria) return false;
      if (fProducto && r.producto !== fProducto) return false;
      return true;
    });
  }, [parsed.records, fCategoria, fProducto]);

  const hayFiltros = Boolean(fCategoria || fProducto);
  const limpiarFiltros = () => {
    setFCategoria('');
    setFProducto('');
  };

  // 4) Todo el análisis (métricas, insights, gráficos) se calcula sobre los
  //    datos YA filtrados, así que reacciona al instante a cada filtro.
  const data = useMemo(() => {
    const records = filtered;

    // Métricas clave
    const totalUnidades = records.reduce((a, r) => a + r.unidades, 0);
    const totalIngresos = records.reduce((a, r) => a + r.ingresos, 0);
    const productosDistintos = new Set(records.map((r) => r.producto).filter(Boolean)).size;
    const variantes = new Set(records.filter((r) => r.talla || r.color).map((r) => `${r.talla}|${r.color}`)).size;
    const ticketMedio = records.length ? totalIngresos / records.length : 0;

    // Gráfico protagonista: unidades por talla (orden natural), color por intensidad
    const tallaAgg = groupSum(records, (r) => r.talla, (r) => r.unidades);
    const tallaEntries = [...tallaAgg.entries()];
    const avgTalla = tallaEntries.length ? tallaEntries.reduce((a, e) => a + e[1], 0) / tallaEntries.length : 0;
    const sizeRank = (s) => { const i = SIZE_ORDER.indexOf(s); return i < 0 ? 999 : i; };
    const tallaData = tallaEntries
      .sort((a, b) => sizeRank(a[0]) - sizeRank(b[0]))
      .map(([talla, unidades]) => ({
        talla, unidades,
        pct: totalUnidades ? unidades / totalUnidades : 0,
        above: unidades >= avgTalla, // por encima/por debajo de la media
      }));

    // Insight de tallas en lenguaje natural
    const tallaSortedByUnits = [...tallaAgg.entries()].sort((a, b) => b[1] - a[1]);
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

    // Apoyo: ventas (unidades) por color
    const colorData = [...groupSum(records, (r) => r.color, (r) => r.unidades).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([color, unidades], i) => ({ color, unidades, fill: garmentColor(color) || PIE_PALETTE[i % PIE_PALETTE.length] }));
    const totalColorU = colorData.reduce((a, d) => a + d.unidades, 0);
    const top3ColorPct = totalColorU ? Math.round(colorData.slice(0, 3).reduce((a, d) => a + d.unidades, 0) / totalColorU * 100) : 0;

    // Apoyo: ingresos por producto (top 8), con unidades
    const unidProd = groupSum(records, (r) => r.producto, (r) => r.unidades);
    const productoData = [...groupSum(records, (r) => r.producto, (r) => r.ingresos).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([producto, ingresos]) => ({ producto, ingresos, unidades: unidProd.get(producto) || 0 }));

    // Apoyo: ventas (unidades) por categoría
    const categoriaData = [...groupSum(records, (r) => r.categoria, (r) => r.unidades).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([categoria, unidades], i) => ({ categoria, unidades, fill: PIE_PALETTE[i % PIE_PALETTE.length] }));

    // ---- Insights accionables (sobre los datos reales) ------------------
    // 1) Color que no rota: el color con menos unidades y su % del total.
    const coloresReales = colorData.filter((d) => d.color);
    let insightColor = null;
    if (coloresReales.length >= 2 && totalUnidades > 0) {
      const peor = coloresReales[coloresReales.length - 1]; // colorData viene ordenado desc
      insightColor = { color: peor.color, pct: Math.round((peor.unidades / totalUnidades) * 100) };
    }

    // 2) Producto estrella: el que más factura y su % sobre los ingresos.
    const prodPorIngresos = [...groupSum(records, (r) => r.producto, (r) => r.ingresos).entries()]
      .filter(([p]) => p)
      .sort((a, b) => b[1] - a[1]);
    let insightEstrella = null;
    if (prodPorIngresos.length > 0 && totalIngresos > 0) {
      const [prod, ing] = prodPorIngresos[0];
      insightEstrella = { producto: prod, pct: Math.round((ing / totalIngresos) * 100) };
    }

    // 3) Concentración de catálogo: mínimo de productos que suman el 80% de ingresos.
    let insightConcentracion = null;
    if (prodPorIngresos.length >= 2 && totalIngresos > 0) {
      let acumulado = 0;
      let n = 0;
      for (const [, ing] of prodPorIngresos) {
        acumulado += ing;
        n += 1;
        if (acumulado >= totalIngresos * 0.8) break;
      }
      insightConcentracion = {
        pct: Math.round((acumulado / totalIngresos) * 100),
        n,
        total: prodPorIngresos.length,
      };
    }

    // 4) y 5) Variantes (talla+color): la ganadora y las que apenas venden.
    const varAgg = groupSum(
      records.filter((r) => r.talla && r.color),
      (r) => `${r.talla}|||${r.color}`,
      (r) => r.unidades
    );
    const varEntries = [...varAgg.entries()];
    let insightVariante = null;
    let insightMuertas = null;
    if (varEntries.length > 0) {
      const ordenadas = [...varEntries].sort((a, b) => b[1] - a[1]);
      const [topKey, topU] = ordenadas[0];
      const [tTalla, tColor] = topKey.split('|||');
      insightVariante = {
        talla: tTalla,
        color: tColor,
        pct: totalUnidades ? Math.round((topU / totalUnidades) * 100) : 0,
      };
      // "Muertas": venden menos del 25% de la media de ventas por variante.
      const mediaVar = varEntries.reduce((a, e) => a + e[1], 0) / varEntries.length;
      const umbral = mediaVar * 0.25;
      const muertas = varEntries.filter(([, u]) => u < umbral).length;
      if (muertas >= 1 && varEntries.length >= 3) {
        insightMuertas = { n: muertas, total: varEntries.length };
      }
    }

    // Evolución de ingresos por mes
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
        { label: 'Ingresos totales', value: fmtEur(totalIngresos), principal: true },
        { label: 'Unidades vendidas', value: fmtInt(totalUnidades) },
        { label: 'Productos distintos', value: fmtInt(productosDistintos) },
        { label: 'Variantes (talla·color)', value: fmtInt(variantes) },
        { label: 'Ticket medio', value: fmtEur2(ticketMedio) },
      ],
      totalUnidades, totalIngresos,
      insight, avgTalla, tallaData, colorData, top3ColorPct, productoData, categoriaData, timeData,
      insightColor, insightEstrella, insightConcentracion, insightVariante, insightMuertas,
    };
  }, [filtered]);

  const {
    kpis, totalUnidades, totalIngresos, insight, avgTalla,
    tallaData, colorData, top3ColorPct, productoData, categoriaData, timeData,
    insightColor, insightEstrella, insightConcentracion, insightVariante, insightMuertas,
  } = data;

  // Lista de insights de apoyo: dato real + qué implica para el inventario.
  // Cada uno solo aparece si hay datos suficientes para calcularlo.
  const em = (txt, color) => <span className="font-medium" style={{ color }}>{txt}</span>;
  const insightsApoyo = [
    insightColor && {
      key: 'color', label: 'Color que no rota', accent: EMBER,
      body: <>El color {em(insightColor.color, EMBER)} solo representa el {em(`${insightColor.pct}%`, EMBER)} de tus ventas — posible exceso de inventario.</>,
    },
    insightEstrella && {
      key: 'estrella', label: 'Producto estrella', accent: ELECTRIC,
      body: <>{em(insightEstrella.producto, ELECTRIC)} concentra el {em(`${insightEstrella.pct}%`, ELECTRIC)} de tus ingresos — protégelo en stock y campañas.</>,
    },
    insightConcentracion && {
      key: 'concentracion', label: 'Concentración de catálogo', accent: ELECTRIC,
      body: <>El {em(`${insightConcentracion.pct}%`, ELECTRIC)} de tus ventas viene de solo {em(insightConcentracion.n, ELECTRIC)} de tus {insightConcentracion.total} productos — el resto pesa poco.</>,
    },
    insightVariante && {
      key: 'variante', label: 'Variante ganadora', accent: ELECTRIC,
      body: <>Tu variante estrella es {em(`${insightVariante.talla}/${insightVariante.color}`, ELECTRIC)} ({em(`${insightVariante.pct}%`, ELECTRIC)}) — asegura su stock.</>,
    },
    insightMuertas && {
      key: 'muertas', label: 'Variantes muertas', accent: EMBER,
      body: <>Tienes {em(insightMuertas.n, EMBER)} {insightMuertas.n === 1 ? 'variante' : 'variantes'} con ventas mínimas — {insightMuertas.n === 1 ? 'candidata' : 'candidatas'} a revisar o descatalogar.</>,
    },
  ].filter(Boolean);

  // --- Tooltips ricos (cierran sobre las medias/totales) ---
  const TallaTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const pct = Math.round((d.pct || 0) * 100);
    const vs = avgTalla ? Math.round(((d.unidades - avgTalla) / avgTalla) * 100) : 0;
    return tip(`Talla ${d.talla}`, d.above ? ELECTRIC : MUTED,
      [`${fmtInt(d.unidades)} uds`, `${pct}% del total`, `${vs >= 0 ? '+' : ''}${vs}% vs media`]);
  };
  const ProductoTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const pct = totalIngresos ? Math.round((d.ingresos / totalIngresos) * 100) : 0;
    return tip(d.producto, ELECTRIC, [fmtEur(d.ingresos), `${fmtInt(d.unidades)} uds`, `${pct}% de ingresos`]);
  };
  const ColorTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const pct = totalUnidades ? Math.round((d.unidades / totalUnidades) * 100) : 0;
    return tip(d.color, d.fill, [`${fmtInt(d.unidades)} uds`, `${pct}% del total`]);
  };
  const CategoriaTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const pct = totalUnidades ? Math.round((d.unidades / totalUnidades) * 100) : 0;
    return tip(d.categoria, d.fill, [`${fmtInt(d.unidades)} uds`, `${pct}% del total`]);
  };
  const TimeTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return tip(label, ELECTRIC, [fmtEur(d.ingresos), `${fmtInt(d.unidades)} uds`]);
  };

  // Etiqueta a la derecha de cada barra de producto: ingresos + unidades.
  const renderProductoLabel = (props) => {
    const { x, y, width, height, index } = props;
    const d = productoData[index];
    if (!d) return null;
    return (
      <text x={x + width + 8} y={y + height / 2} dy={4}
        fontSize={10} fill={TXT2} fontFamily="var(--font-jetbrains), monospace">
        {fmtEur(d.ingresos)} · {fmtInt(d.unidades)} uds
      </text>
    );
  };

  return (
    <div
      className="rounded-2xl border border-[#1b1c20] p-4 md:p-6 space-y-4 md:space-y-5"
      style={{ background: 'radial-gradient(120% 80% at 50% 0%, #0E0F12 0%, #0A0A0B 60%)' }}
    >
      {/* 0 · FILTROS — recalculan todo el dashboard al instante */}
      <div
        className="flex flex-wrap items-end gap-4 rounded-xl border border-[#1b1c20] p-4 md:p-5"
        style={{ background: 'linear-gradient(150deg, #131418 0%, #0f1013 100%)' }}
      >
        <FilterSelect
          label="Categoría" value={fCategoria} onChange={setFCategoria}
          options={parsed.categorias} allLabel="Todas"
        />
        <FilterSelect
          label="Producto" value={fProducto} onChange={setFProducto}
          options={parsed.productos} allLabel="Todos"
        />
        {hayFiltros ? (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="h-10 px-4 rounded-lg border border-[#3a3c42] font-mono text-[11px] tracking-[0.12em] uppercase text-[#8A8A8F] hover:text-[#F5F5F7] hover:border-[#5d5e63] transition-colors"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-xl border border-[#232428] p-12 md:p-16 text-center"
          style={{ background: 'linear-gradient(150deg, #16171b 0%, #121316 100%)' }}
        >
          <div className={LABEL} style={{ color: EMBER }}>Sin resultados</div>
          <p className="mt-4 font-serif text-[22px] md:text-[28px] leading-snug" style={{ color: TXT }}>
            No hay ventas con estos filtros.
          </p>
          <p className="mt-3 text-[14px]" style={{ color: TXT2 }}>
            Prueba a quitar algún filtro o pulsa «Limpiar filtros».
          </p>
        </div>
      ) : (
        <>
      {/* 1 · TITULAR — insight destacado, a lo ancho, con glow */}
      {insight ? (
        <div
          className="relative rounded-xl border border-[#243049] p-10 md:p-14 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #11151f 0%, #0c0d12 55%)',
            boxShadow: '0 0 80px -30px rgba(45,107,228,0.55)',
          }}
        >
          <div
            className="absolute -top-24 -right-16 w-[420px] h-[420px] pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(45,107,228,0.22) 0%, transparent 60%)' }}
          />
          <div className={`${LABEL} flex items-center gap-2 relative`} style={{ color: ELECTRIC }}>
            <span className="w-1.5 h-1.5 rounded-full bg-electric live-dot" />
            Insight automático · patrón de tallas
          </div>
          <p className="relative mt-6 font-serif font-light text-[34px] md:text-[60px] leading-[1.08] tracking-[-0.025em] max-w-[24ch]" style={{ color: TXT }}>
            Las tallas <span style={{ color: ELECTRIC }}>{insight.a}</span> y{' '}
            <span style={{ color: ELECTRIC }}>{insight.b}</span> concentran el{' '}
            <span style={{ color: EMBER }}>{insight.topPct}%</span> de las unidades vendidas.
            La <span style={{ color: EMBER }}>{insight.minTalla}</span> apenas rota
            (<span style={{ color: EMBER }}>{insight.minPct}%</span>).
          </p>
        </div>
      ) : null}

      {/* 1b · INSIGHTS DE APOYO — accionables, en rejilla, sin saturar */}
      {insightsApoyo.length ? (
        <div>
          <div className={LABEL} style={{ color: TXT2 }}>Insights accionables</div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {insightsApoyo.map((it) => (
              <div
                key={it.key}
                className="rounded-xl border border-[#1b1c20] p-5 md:p-6"
                style={{ background: 'linear-gradient(150deg, #101114 0%, #0c0d10 100%)' }}
              >
                <div className={`${LABEL} flex items-center gap-2`} style={{ color: it.accent }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: it.accent }} />
                  {it.label}
                </div>
                <p className="mt-3 text-[15px] md:text-[16px] leading-[1.5]" style={{ color: TXT }}>
                  {it.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
        </>
      )}

      {/* 1c · MOTOR DE STOCK — recomienda pedidos. Va FUERA del condicional de
          filtros porque pronostica siempre sobre el dataset completo: filtrar
          la demanda histórica sesgaría los pedidos. */}
      <StockEngine records={parsed.records} hayFiltros={hayFiltros} />

      {filtered.length === 0 ? null : (
        <>
      {/* 2 · SIGNOS VITALES — KPIs con jerarquía (ingresos protagonista) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {kpis.map((k, i) => <Kpi key={i} {...k} />)}
      </div>

      {/* 3 · PROTAGONISTA (talla) + 4 · APOYO (color) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        {tallaData.length ? (
          <ChartCard title="Unidades por talla" subtitle={`media · ${fmtInt(avgTalla)} uds`} className="lg:col-span-8">
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tallaData} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTallaUp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5C8DEE" />
                      <stop offset="100%" stopColor="#2D6BE4" />
                    </linearGradient>
                    <linearGradient id="gradTallaDown" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#52555C" />
                      <stop offset="100%" stopColor="#393B41" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#FFFFFF" strokeOpacity={0.06} />
                  <XAxis dataKey="talla" tick={tickMono} axisLine={false} tickLine={false} />
                  <YAxis tick={tickMono} axisLine={false} tickLine={false} width={40} />
                  <Tooltip cursor={{ fill: 'rgba(45,107,228,0.08)' }} content={<TallaTip />} />
                  <ReferenceLine
                    y={avgTalla} stroke="#F5F5F7" strokeOpacity={0.32} strokeDasharray="4 4"
                    label={{ value: `media ${fmtInt(avgTalla)}`, position: 'right', fontSize: 10, fill: TXT2 }}
                  />
                  <Bar dataKey="unidades" name="Unidades" radius={[6, 6, 0, 0]} maxBarSize={64}>
                    {tallaData.map((d, i) => <Cell key={i} fill={d.above ? 'url(#gradTallaUp)' : 'url(#gradTallaDown)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        ) : null}

        {colorData.length ? (
          <ChartCard title="Ventas por color" subtitle="unidades" className="lg:col-span-4">
            <div className="relative h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ColorTip />} />
                  <Pie data={colorData} dataKey="unidades" nameKey="color" cx="50%" cy="50%"
                    innerRadius={58} outerRadius={92} paddingAngle={2} stroke={SURFACE} strokeWidth={2}>
                    {colorData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="font-serif text-[34px] leading-none tnum" style={{ color: TXT }}>{top3ColorPct}%</div>
                <div className={`${LABEL} mt-1 text-center px-6`} style={{ color: TXT2 }}>Top 3 colores</div>
              </div>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2">
              {colorData.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="flex items-center gap-2 truncate" style={{ color: TXT2 }}>
                    <span className="w-2.5 h-2.5 rounded-sm border border-white/10 flex-shrink-0" style={{ background: d.fill }} />
                    <span className="truncate">{d.color}</span>
                  </span>
                  <span className="tnum flex-shrink-0" style={{ color: '#5d5e63' }}>{fmtInt(d.unidades)}</span>
                </li>
              ))}
            </ul>
          </ChartCard>
        ) : null}

        {/* 4 · APOYO — ingresos por producto + ventas por categoría */}
        {productoData.length ? (
          <ChartCard title="Ingresos por producto" subtitle={`top ${productoData.length}`} className="lg:col-span-8">
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productoData} layout="vertical" margin={{ top: 4, right: 130, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gradProducto" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#234E9E" />
                      <stop offset="100%" stopColor="#3F7BEC" />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="producto" width={132} tick={{ ...tickMono, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ProductoTip />} />
                  <Bar dataKey="ingresos" name="Ingresos" radius={[0, 4, 4, 0]} maxBarSize={26} fill="url(#gradProducto)">
                    <LabelList content={renderProductoLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        ) : null}

        {categoriaData.length ? (
          <ChartCard title="Ventas por categoría" subtitle="unidades" className="lg:col-span-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CategoriaTip />} />
                  <Pie data={categoriaData} dataKey="unidades" nameKey="categoria" cx="50%" cy="50%"
                    outerRadius={92} stroke={SURFACE} strokeWidth={2}>
                    {categoriaData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2">
              {categoriaData.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="flex items-center gap-2 truncate" style={{ color: TXT2 }}>
                    <span className="w-2.5 h-2.5 rounded-sm border border-white/10 flex-shrink-0" style={{ background: d.fill }} />
                    <span className="truncate">{d.categoria}</span>
                  </span>
                  <span className="tnum flex-shrink-0" style={{ color: '#5d5e63' }}>{fmtInt(d.unidades)}</span>
                </li>
              ))}
            </ul>
          </ChartCard>
        ) : null}

        {/* 5 · EVOLUCIÓN TEMPORAL — área estilo Stripe con glow */}
        {timeData.length ? (
          <ChartCard title="Evolución de ingresos" subtitle="por mes" className="lg:col-span-12">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ELECTRIC} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={ELECTRIC} stopOpacity={0} />
                    </linearGradient>
                    <filter id="glowLine" x="-10%" y="-60%" width="120%" height="240%">
                      <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#2D6BE4" floodOpacity="0.45" />
                    </filter>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#FFFFFF" strokeOpacity={0.06} />
                  <XAxis dataKey="label" tick={tickMono} axisLine={false} tickLine={false} />
                  <YAxis tick={tickMono} axisLine={false} tickLine={false} width={48}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                  <Tooltip content={<TimeTip />} />
                  <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke={ELECTRIC} strokeWidth={2.5}
                    fill="url(#gradIngresos)" dot={{ r: 3, fill: ELECTRIC, strokeWidth: 0 }} activeDot={{ r: 5 }}
                    style={{ filter: 'url(#glowLine)' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        ) : null}
      </div>
        </>
      )}
    </div>
  );
}
