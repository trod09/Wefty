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
import { parseNumero as parseNumber, unificarNombres } from '@/lib/csv.mjs';
import { demandaProducto, productosOrdenados, validacionGlobal, estacionalidadProxima, demandaAgregada } from '@/lib/engine/motor.mjs';

// ---- Paleta ------------------------------------------------------------
const ELECTRIC = 'var(--data)';
const EMBER = 'var(--bad)';        // único acento de apoyo
const MUTED = 'var(--muted)';        // barras "que apenas rotan"
const SURFACE = 'var(--pie-stroke)';      // borde de slices del donut (sutil en oscuro, visible en claro)
const TXT = 'var(--txt)';          // títulos
const TXT2 = 'var(--txt-2)';         // secundario
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

const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
const fmtEur = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

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
    <div className="rounded-lg border border-line px-3.5 py-2.5 shadow-2xl" style={{ background: 'var(--tooltip-bg)' }}>
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
function ChartCard({ title, subtitle, accion, children, className = '' }) {
  return (
    <div
      className={`card-elev group relative rounded-xl border border-line p-6 md:p-7 transition-all duration-300 hover:border-lineHover ${className}`}
      style={{ background: 'var(--card-grad)' }}
    >
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <span className={LABEL} style={{ color: TXT2 }}>{title}</span>
        <div className="flex items-baseline gap-3">
          {subtitle ? <span className={`${LABEL} whitespace-nowrap`} style={{ color: 'var(--txt-3)' }}>{subtitle}</span> : null}
          {accion || null}
        </div>
      </div>
      {children}
    </div>
  );
}

// Interruptor minúsculo "uds | €" para alternar la métrica de un gráfico.
function MetricToggle({ value, onChange }) {
  return (
    <div className="flex items-center rounded-md border border-hairlineSoft overflow-hidden self-center">
      {[['uds', 'uds'], ['eur', '€']].map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className="px-2 py-1 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors"
          style={{
            background: value === v ? 'var(--tint-brand)' : 'transparent',
            color: value === v ? 'var(--brand)' : 'var(--txt-2)',
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Kpi({ label, value, principal = false, hint }) {
  if (principal) {
    return (
      <div
        className="relative rounded-xl p-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-3 overflow-hidden border border-brandLine transition-all duration-300"
        style={{
          background: 'var(--grad-brand-hero)',
          boxShadow: '0 0 60px -26px var(--glow-brand)',
        }}
      >
        <div className={`${LABEL} ${hint ? 'cursor-help' : ''}`} style={{ color: 'var(--brand-soft)' }} title={hint}>{label}</div>
        <div className="font-display text-[52px] md:text-[72px] leading-[0.92] tracking-[-0.025em] tnum break-words" style={{ color: TXT }}>
          {value}
        </div>
      </div>
    );
  }
  return (
    <div
      className="card-elev relative rounded-xl border border-line p-5 md:p-6 transition-all duration-300 hover:border-lineHover"
      style={{ background: 'var(--card-grad)' }}
    >
      <div className={`${LABEL} ${hint ? 'cursor-help' : ''}`} style={{ color: TXT2 }} title={hint}>{label}</div>
      <div className="mt-3 font-display text-[28px] md:text-[36px] leading-none tracking-[-0.02em] tnum break-words" style={{ color: TXT }}>
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
        className="h-11 md:h-10 min-w-[170px] rounded-lg border field-bordered px-3 text-[16px] md:text-[14px] text-txt outline-none transition-colors cursor-pointer"
        style={{ background: 'var(--surface-input)' }}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ---- Componente principal ----------------------------------------------
// Parseo de filas → records + opciones de filtros. Exportado: el shell del
// producto monta el motor de stock fuera de este componente y necesita los
// mismos records.
export function parsearVentas(headers, rows) {
    const iFecha = findCol(headers, 'fecha', 'date');
    const iProd = findCol(headers, 'producto', 'product');
    const iCat = findCol(headers, 'categoria', 'category');
    const iTalla = findCol(headers, 'talla', 'size');
    const iColor = findCol(headers, 'color');
    const iUnid = findCol(headers, 'unidades_vendidas', 'unidades', 'cantidad', 'units', 'qty');
    const iPrecio = findCol(headers, 'precio_unitario', 'precio', 'price');
    const iIng = findCol(headers, 'ingresos', 'revenue', 'importe', 'total');

    const records = unificarNombres(rows.map((r) => {
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
    }));

    // Opciones para los filtros: valores distintos, sin vacíos, ordenados.
    const categorias = [...new Set(records.map((r) => r.categoria).filter(Boolean))].sort();
    const productos = [...new Set(records.map((r) => r.producto).filter(Boolean))].sort();

    return { records, categorias, productos };
}

// seccion: 'resumen' (titular + KPIs + gráficos) o 'insights' (filtros +
// insights accionables). Una sola instancia montada sirve a ambas secciones
// del sidebar: los filtros viven aquí y afectan a las dos, como siempre.
export default function SalesDashboard({ headers, rows, seccion = 'resumen', motor = null, costesReales = null, margenTxt = '60', onHayFiltros, onNavegar }) {
  const parsed = useMemo(() => parsearVentas(headers, rows), [headers, rows]);

  // 2) Estado de los filtros. Valor vacío significa "todos / sin filtrar".
  const [fCategoria, setFCategoria] = useState('');
  const [fProducto, setFProducto] = useState('');
  // Métrica de los donuts de color/categoría: 'uds' (unidades) o 'eur' (euros).
  const [metrica, setMetrica] = useState('uds');

  // Si cambian los datos cargados (otro CSV o el histórico), limpiamos filtros
  // para no esconder datos por un filtro que ya no aplica.
  useEffect(() => {
    setFCategoria('');
    setFProducto('');
  }, [headers, rows]);

  // ¿Pantalla móvil? Recharts no se adapta por CSS: en móvil compactamos el
  // gráfico de productos (eje más corto, sin etiquetas a la derecha).
  const [esMovil, setEsMovil] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const aplicar = () => setEsMovil(mq.matches);
    aplicar();
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, []);

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

  // El shell necesita saberlo: el motor enseña su nota "ignora los filtros".
  useEffect(() => { onHayFiltros?.(hayFiltros); }, [hayFiltros, onHayFiltros]);

  // 4) Todo el análisis (métricas, insights, gráficos) se calcula sobre los
  //    datos YA filtrados, así que reacciona al instante a cada filtro.
  const data = useMemo(() => {
    const records = filtered;

    // Conciencia de filtros: con el filtro de producto, los insights "de
    // catálogo" (estrella, concentración) son tautológicos y se ocultan; con
    // filtros activos, una variante única sería un "100%" trivial.
    const conFiltroProducto = Boolean(fProducto);
    const conFiltros = Boolean(fProducto || fCategoria);

    // Métricas clave
    const totalUnidades = records.reduce((a, r) => a + r.unidades, 0);
    const totalIngresos = records.reduce((a, r) => a + r.ingresos, 0);
    const productosDistintos = new Set(records.map((r) => r.producto).filter(Boolean)).size;

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

    // Apoyo: ventas por color (unidades e ingresos, para el toggle uds/€)
    const colorIng = groupSum(records, (r) => r.color, (r) => r.ingresos);
    const colorData = [...groupSum(records, (r) => r.color, (r) => r.unidades).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([color, unidades], i) => ({ color, unidades, ingresos: colorIng.get(color) || 0, fill: garmentColor(color) || PIE_PALETTE[i % PIE_PALETTE.length] }));
    const totalColorU = colorData.reduce((a, d) => a + d.unidades, 0);
    const top3ColorPct = totalColorU ? Math.round(colorData.slice(0, 3).reduce((a, d) => a + d.unidades, 0) / totalColorU * 100) : 0;

    // Apoyo: ingresos por producto (top 8), con unidades
    const unidProd = groupSum(records, (r) => r.producto, (r) => r.unidades);
    const productoData = [...groupSum(records, (r) => r.producto, (r) => r.ingresos).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([producto, ingresos]) => ({ producto, ingresos, unidades: unidProd.get(producto) || 0 }));

    // Apoyo: ventas por categoría (unidades e ingresos, para el toggle uds/€)
    const categoriaIng = groupSum(records, (r) => r.categoria, (r) => r.ingresos);
    const categoriaData = [...groupSum(records, (r) => r.categoria, (r) => r.unidades).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([categoria, unidades], i) => ({ categoria, unidades, ingresos: categoriaIng.get(categoria) || 0, fill: PIE_PALETTE[i % PIE_PALETTE.length] }));

    // ---- Insights accionables (sobre los datos reales) ------------------
    // 1) Color que no rota: el color con menos unidades y su % del total.
    const coloresReales = colorData.filter((d) => d.color);
    let insightColor = null;
    if (coloresReales.length >= 2 && totalUnidades > 0) {
      const peor = coloresReales[coloresReales.length - 1]; // colorData viene ordenado desc
      insightColor = { color: peor.color, pct: Math.round((peor.unidades / totalUnidades) * 100) };
    }

    // 2) Producto estrella: el que más factura y su % sobre los ingresos.
    //    Con el filtro de producto activo sería "el 100%": se oculta.
    const prodPorIngresos = [...groupSum(records, (r) => r.producto, (r) => r.ingresos).entries()]
      .filter(([p]) => p)
      .sort((a, b) => b[1] - a[1]);
    let insightEstrella = null;
    if (!conFiltroProducto && prodPorIngresos.length > 0 && totalIngresos > 0) {
      const [prod, ing] = prodPorIngresos[0];
      insightEstrella = { producto: prod, pct: Math.round((ing / totalIngresos) * 100) };
    }

    // 3) Concentración de catálogo: mínimo de productos que suman el 80% de
    //    ingresos. Sin catálogo que concentrar (filtro de producto): oculto.
    let insightConcentracion = null;
    if (!conFiltroProducto && prodPorIngresos.length >= 2 && totalIngresos > 0) {
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
    // Con filtros activos, una única variante daría un "100%" trivial: fuera.
    if (varEntries.length >= (conFiltros ? 2 : 1)) {
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

    // Beneficio bruto estimado: ingresos − coste×unidades. Coste real donde lo
    // haya (panel de costes) y, si no, estimado por margen lineal. Si NO hay
    // NINGÚN coste real, ingresos×margen no aporta información nueva: en vez de
    // un número falso, se invita a cargar costes (honestidad).
    const margenFrac = Math.min(0.95, Math.max(0, (Number(margenTxt) || 0) / 100));
    const costesMap = costesReales || new Map();
    let beneficioVal = 0;
    let nReales = 0;
    for (const [prod, ing] of prodPorIngresos) {
      const uds = unidProd.get(prod) || 0;
      const costeReal = costesMap.get(prod);
      if (costeReal != null && costeReal !== '' && Number(costeReal) > 0) {
        beneficioVal += ing - Number(costeReal) * uds;
        nReales += 1;
      } else {
        beneficioVal += ing * margenFrac;
      }
    }
    const beneficio = totalIngresos > 0 && prodPorIngresos.length > 0 ? {
      valor: beneficioVal,
      margenPct: Math.round((beneficioVal / totalIngresos) * 100),
      nReales, nTotal: prodPorIngresos.length,
      soloEstimado: nReales === 0,
    } : null;

    // Clasificación ABC (Pareto) del catálogo por ingresos: A suma el primer 80%,
    // B del 80 al 95%, C el resto. Oculta con filtro de producto (sería trivial).
    let abc = null;
    if (!conFiltroProducto && prodPorIngresos.length >= 2 && totalIngresos > 0) {
      const clases = { A: 0, B: 0, C: 0 };
      let acum = 0;
      for (const [, ing] of prodPorIngresos) {
        const antes = acum / totalIngresos;
        if (antes < 0.8) clases.A += 1;
        else if (antes < 0.95) clases.B += 1;
        else clases.C += 1;
        acum += ing;
      }
      abc = { ...clases, total: prodPorIngresos.length };
    }

    return {
      kpis: [
        { label: 'Ingresos totales', value: fmtEur(totalIngresos), principal: true },
        { label: 'Unidades vendidas', value: fmtInt(totalUnidades) },
        { label: 'Productos distintos', value: fmtInt(productosDistintos) },
        { label: 'Ticket medio', value: fmtEur(totalUnidades ? totalIngresos / totalUnidades : 0), hint: 'Ingresos ÷ unidades vendidas: lo que vale de media cada prenda que vendes.' },
      ],
      totalUnidades, totalIngresos, beneficio, abc,
      insight, avgTalla, tallaData, colorData, top3ColorPct, productoData, categoriaData, timeData,
      insightColor, insightEstrella, insightConcentracion, insightVariante, insightMuertas,
    };
  }, [filtered, fCategoria, fProducto, costesReales, margenTxt]);

  const {
    kpis, totalUnidades, totalIngresos, beneficio, abc, insight, avgTalla,
    tallaData, colorData, top3ColorPct, productoData, categoriaData, timeData,
    insightColor, insightEstrella, insightConcentracion, insightVariante, insightMuertas,
  } = data;

  // Lectura del MOTOR sobre TODO el histórico (ignora los filtros del dashboard,
  // igual que el resto del motor). Las tarjetas que lo usan se marcan "de todo tu
  // histórico" para no confundirlas con los gráficos filtrados. Se calcula una
  // vez por dataset (el trabajo caro queda memoizado en el propio motor).
  const motorResumen = useMemo(() => {
    if (!motor || motor.almacen?.vacio) return null;
    const totales = motor.totales || {};

    // Recuento de salud por fase de ciclo de vida (lee la clasificación del motor).
    const fases = { CRECIMIENTO: 0, MADURO: 0, DECLIVE: 0, DESCATALOGADO: 0, LANZAMIENTO: 0 };
    let sinDatos = 0;
    for (const it of productosOrdenados(motor)) {
      const d = it.suficiente ? demandaProducto(motor, it.nombre, 8) : null;
      const fase = d?.ciclo?.fase;
      if (fase && fases[fase] != null) fases[fase] += 1;
      else sinDatos += 1;
    }

    // Fiabilidad del pronóstico: solo si el motor es robusto (si no, no se enseña).
    const val = validacionGlobal(motor);
    const fiabilidad = val.robusto && val.global ? Math.round(val.global.wape * 100) : null;

    // Estacionalidad de las próximas semanas (null si <52 semanas) y pronóstico
    // agregado del próximo mes (solo si el motor es robusto: honestidad).
    const estacionalidad = estacionalidadProxima(motor, 8);
    const pronostico = motor.robusto ? demandaAgregada(motor, 4) : null;

    return {
      perfil: motor.perfil,
      fases, sinDatos,
      enRiesgo: fases.DECLIVE + fases.DESCATALOGADO,
      roturasAbiertas: totales.roturasAbiertas || 0,
      outliers: totales.outliers || 0,
      roturas: totales.roturas || 0,
      robusto: motor.robusto,
      fiabilidad, estacionalidad, pronostico,
    };
  }, [motor]);

  // Fecha ISO (aaaa-mm-dd) → "mmm aaaa" para la cinta de contexto.
  const fmtMesAnio = (iso) => {
    if (!iso || !/^\d{4}-\d{2}/.test(iso)) return iso || '—';
    const [y, m] = iso.split('-');
    return `${MESES[+m - 1]} ${y}`;
  };

  // Toggle uds/€ de los donuts de color/categoría: la métrica activa.
  const esEur = metrica === 'eur';
  const valMetrica = (d) => (esEur ? d.ingresos : d.unidades);
  const top3Pct = (arr) => {
    const tot = arr.reduce((a, d) => a + valMetrica(d), 0);
    if (!tot) return 0;
    const top3 = [...arr].sort((a, b) => valMetrica(b) - valMetrica(a)).slice(0, 3).reduce((a, d) => a + valMetrica(d), 0);
    return Math.round((top3 / tot) * 100);
  };
  const pctMetrica = (d, arr) => {
    const tot = arr.reduce((a, x) => a + valMetrica(x), 0);
    return tot ? Math.round((valMetrica(d) / tot) * 100) : 0;
  };

  // Lista de insights de apoyo: dato real + qué implica para el inventario.
  // Cada uno solo aparece si hay datos suficientes para calcularlo.
  // Con filtros activos, los textos declaran su ámbito ("de Sudadera Zip",
  // "en Sudaderas") para no leerse como conclusiones de toda la tienda.
  const em = (txt, color) => <span className="font-medium" style={{ color }}>{txt}</span>;
  const ambito = fProducto ? ` de ${fProducto}` : fCategoria ? ` en ${fCategoria}` : '';
  const insightsApoyo = [
    insightColor && {
      key: 'color', label: 'Color que no rota', accent: EMBER,
      body: <>El color {em(insightColor.color, EMBER)} solo representa el {em(`${insightColor.pct}%`, EMBER)} de tus ventas{ambito} — posible exceso de inventario.</>,
      accion: { texto: 'Pide menos de ese color en tu próxima compra.' },
    },
    insightEstrella && {
      key: 'estrella', label: 'Producto estrella', accent: ELECTRIC,
      body: <>{em(insightEstrella.producto, ELECTRIC)} concentra el {em(`${insightEstrella.pct}%`, ELECTRIC)} de tus ingresos{fCategoria ? ` en ${fCategoria}` : ''} — protégelo en stock y campañas.</>,
      accion: { texto: 'Planifica su pedido', seccion: 'reposicion', enlace: 'en Reposición' },
    },
    insightConcentracion && {
      key: 'concentracion', label: 'Concentración de catálogo', accent: ELECTRIC,
      accion: { texto: 'Reparte ahí tu presupuesto', seccion: 'plan', enlace: 'en Plan de compra' },
      body: fCategoria ? (
        <>El {em(`${insightConcentracion.pct}%`, ELECTRIC)} de tus ventas en {fCategoria} viene de solo {em(insightConcentracion.n, ELECTRIC)} de los {insightConcentracion.total} productos de la categoría — el resto pesa poco.</>
      ) : (
        <>El {em(`${insightConcentracion.pct}%`, ELECTRIC)} de tus ventas viene de solo {em(insightConcentracion.n, ELECTRIC)} de tus {insightConcentracion.total} productos — el resto pesa poco.</>
      ),
    },
    insightVariante && {
      key: 'variante', label: 'Variante ganadora', accent: ELECTRIC,
      body: <>Tu variante estrella{ambito} es {em(`${insightVariante.talla}/${insightVariante.color}`, ELECTRIC)} ({em(`${insightVariante.pct}%`, ELECTRIC)}) — asegura su stock.</>,
      accion: { texto: 'Revisa su pedido', seccion: 'reposicion', enlace: 'en Reposición' },
    },
    insightMuertas && {
      key: 'muertas', label: 'Variantes muertas', accent: EMBER,
      body: <>Tienes {em(insightMuertas.n, EMBER)} {insightMuertas.n === 1 ? 'variante' : 'variantes'}{ambito} con ventas mínimas — {insightMuertas.n === 1 ? 'candidata' : 'candidatas'} a revisar o descatalogar.</>,
      accion: { texto: 'Revísalas antes de tu próxima compra.' },
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
    const total = esEur ? totalIngresos : totalUnidades;
    const pct = total ? Math.round((valMetrica(d) / total) * 100) : 0;
    return tip(d.color, d.fill, [esEur ? fmtEur(d.ingresos) : `${fmtInt(d.unidades)} uds`, `${pct}% del total`]);
  };
  const CategoriaTip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const total = esEur ? totalIngresos : totalUnidades;
    const pct = total ? Math.round((valMetrica(d) / total) * 100) : 0;
    return tip(d.categoria, d.fill, [esEur ? fmtEur(d.ingresos) : `${fmtInt(d.unidades)} uds`, `${pct}% del total`]);
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

  // % de cada talla sobre el total, encima de la barra (apagado bajo la media).
  const renderTallaPct = (props) => {
    const { x, y, width, index } = props;
    const d = tallaData[index];
    if (!d) return null;
    const pct = Math.round((d.pct || 0) * 100);
    if (pct < 1) return null;
    return (
      <text x={x + width / 2} y={y - 7} textAnchor="middle"
        fontSize={11} fill={d.above ? TXT2 : 'var(--txt-3)'} fontFamily="var(--font-jetbrains), monospace">
        {pct}%
      </text>
    );
  };

  // Tarjeta "sin resultados con estos filtros" (sale en la sección activa).
  const sinResultados = (
        <div
          className="rounded-xl border border-line p-12 md:p-16 text-center"
          style={{ background: 'var(--card-grad)' }}
        >
          <div className={LABEL} style={{ color: EMBER }}>Sin resultados</div>
          <p className="mt-4 font-display text-[22px] md:text-[28px] leading-snug" style={{ color: TXT }}>
            No hay ventas con estos filtros.
          </p>
          <p className="mt-3 text-[14px]" style={{ color: TXT2 }}>
            Prueba a quitar algún filtro o pulsa «Limpiar filtros».
          </p>
        </div>
  );

  return (
    <div
      className="rounded-2xl border border-lineSoft p-4 md:p-6 space-y-4 md:space-y-5"
      style={{ background: 'var(--dash-grad)' }}
    >
      {seccion === 'insights' ? (<>
      {/* Filtros: barra compacta y secundaria (su porqué a la izquierda); las
          tarjetas de abajo son las protagonistas de la sección. */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-1 border-b border-hairlineSoft">
        <p className="text-[13px] leading-snug max-w-[42ch]" style={{ color: TXT2 }}>
          Lo que el motor detecta en tus ventas. Filtra para investigar una categoría o un producto.
        </p>
        <div className="flex flex-wrap items-end gap-3">
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
              className="btn-sheen h-11 md:h-10 px-4 rounded-lg border border-lineHover font-mono text-[11px] tracking-[0.12em] uppercase text-txt2 hover:text-txt hover:border-txt3 transition-colors"
            >
              Limpiar
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        sinResultados
      ) : insightsApoyo.length ? (
        <div>
          <div className={LABEL} style={{ color: TXT2 }}>Hallazgos accionables · {insightsApoyo.length}</div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {insightsApoyo.map((it) => (
              <div
                key={it.key}
                className="rounded-xl border border-lineSoft p-5 md:p-6 flex flex-col"
                style={{ background: 'var(--inset-grad)' }}
              >
                <div className={`${LABEL} flex items-center gap-2`} style={{ color: it.accent }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: it.accent }} />
                  {it.label}
                </div>
                <p className="mt-3 text-[15px] md:text-[16px] leading-[1.5]" style={{ color: TXT }}>
                  {it.body}
                </p>
                {it.accion ? (
                  <div className="mt-4 pt-3 border-t border-hairlineSoft flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[12px] leading-snug" style={{ color: TXT2 }}>{it.accion.texto}</span>
                    {it.accion.seccion ? (
                      <button
                        type="button"
                        onClick={() => onNavegar?.(it.accion.seccion)}
                        className="font-mono text-[10px] tracking-[0.12em] uppercase transition-opacity hover:opacity-70"
                        style={{ color: it.accent }}
                      >
                        {it.accion.enlace} →
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {!hayFiltros ? (
            <p className="mt-4 text-[12px] leading-snug" style={{ color: 'var(--txt-3)' }}>
              Con filtros encuentras más: prueba a mirar una categoría o un producto concretos.
            </p>
          ) : null}
        </div>
      ) : (
        <div
          className="rounded-xl border border-line p-10 md:p-12 text-center"
          style={{ background: 'var(--card-grad)' }}
        >
          <p className="text-[15px]" style={{ color: TXT2 }}>
            No hay suficientes datos para destacar un patrón con este filtro. Prueba a quitarlo.
          </p>
        </div>
      )}

      </>) : (<>
      {/* RESUMEN — titular + KPIs + gráficos (el motor vive en su sección) */}
      {hayFiltros ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-lineSoft px-4 py-3"
          style={{ background: 'var(--panel-grad)' }}
        >
          <span className={LABEL} style={{ color: TXT2 }}>filtrado:</span>
          <span className="font-mono text-[12px]" style={{ color: TXT }}>
            {[fCategoria, fProducto].filter(Boolean).join(' · ')}
          </span>
          <button
            type="button"
            onClick={limpiarFiltros}
            className="font-mono text-[11px] tracking-[0.1em] uppercase transition-colors text-txt2 hover:text-txt"
          >
            ✕ quitar filtro
          </button>
          {onNavegar ? (
            <button
              type="button"
              onClick={() => onNavegar('insights')}
              className="font-mono text-[10px] tracking-[0.1em] uppercase transition-opacity hover:opacity-70"
              style={{ color: ELECTRIC }}
            >
              Investígalo en Hallazgos →
            </button>
          ) : null}
        </div>
      ) : null}
      {filtered.length === 0 ? (
        sinResultados
      ) : (
        <>
      {/* 1 · TITULAR — insight destacado, a lo ancho, con glow */}
      {insight ? (
        <div
          className="relative rounded-xl border border-brandLine p-10 md:p-14 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 55%)',
            boxShadow: '0 0 80px -30px var(--glow-brand)',
          }}
        >
          <div
            className="absolute -top-24 -right-16 w-[420px] h-[420px] pointer-events-none"
            style={{ background: 'var(--glow-brand-radial)' }}
          />
          <div className={`${LABEL} flex items-center gap-2 relative`} style={{ color: ELECTRIC }}>
            <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: 'var(--brand)' }} />
            Hallazgo automático · patrón de tallas
          </div>
          <p className="relative mt-6 font-display font-light text-[34px] md:text-[60px] leading-[1.08] tracking-[-0.025em] max-w-[24ch]" style={{ color: TXT }}>
            Las tallas <span style={{ color: ELECTRIC }}>{insight.a}</span> y{' '}
            <span style={{ color: ELECTRIC }}>{insight.b}</span> concentran el{' '}
            <span style={{ color: EMBER }}>{insight.topPct}%</span> de las unidades vendidas
            {fProducto ? ` de ${fProducto}` : fCategoria ? ` en ${fCategoria}` : ''}.
            La <span style={{ color: EMBER }}>{insight.minTalla}</span> apenas rota
            (<span style={{ color: EMBER }}>{insight.minPct}%</span>).
          </p>
          {onNavegar ? (
            <button
              type="button"
              onClick={() => onNavegar('reposicion')}
              className="relative mt-7 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] uppercase transition-opacity hover:opacity-70"
              style={{ color: ELECTRIC }}
            >
              Ajusta tu pedido a estas tallas en Reposición →
            </button>
          ) : null}
        </div>
      ) : null}

      {/* 1b · CONTEXTO DEL DATASET — la ficha técnica (de todo tu histórico) */}
      {motorResumen ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
          <span className={LABEL} style={{ color: 'var(--txt-3)' }}>Tus datos</span>
          <span className="font-mono text-[11px] tnum" style={{ color: TXT2 }}>
            {fmtMesAnio(motorResumen.perfil.fechaMin)} – {fmtMesAnio(motorResumen.perfil.fechaMax)}
          </span>
          <span style={{ color: 'var(--txt-3)' }}>·</span>
          <span className="font-mono text-[11px] tnum" style={{ color: TXT2 }}>{fmtInt(motorResumen.perfil.semanas)} semanas</span>
          <span style={{ color: 'var(--txt-3)' }}>·</span>
          <span className="font-mono text-[11px] tnum" style={{ color: TXT2 }}>
            {fmtInt(motorResumen.perfil.nProductos)} productos · {fmtInt(motorResumen.perfil.nVariantes)} variantes
          </span>
          {motorResumen.perfil.semanaParcial ? (
            <>
              <span style={{ color: 'var(--txt-3)' }}>·</span>
              <span className="font-mono text-[11px]" style={{ color: 'var(--warn)' }}>la última semana está incompleta</span>
            </>
          ) : null}
        </div>
      ) : null}

      {/* 1c · ALERTA — posibles agotados (roturas abiertas; de todo tu histórico) */}
      {motorResumen && motorResumen.roturasAbiertas > 0 ? (
        <div className="rounded-xl border p-5 md:p-6" style={{ borderColor: 'var(--warn)', background: 'var(--panel-grad)' }}>
          <div className={`${LABEL} flex items-center gap-2`} style={{ color: 'var(--warn)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--warn)' }} />
            Posibles agotados · de todo tu histórico
          </div>
          <p className="mt-3 text-[15px] md:text-[16px] leading-[1.5]" style={{ color: TXT }}>
            Detectamos {em(`${motorResumen.roturasAbiertas} ${motorResumen.roturasAbiertas === 1 ? 'variante' : 'variantes'}`, 'var(--warn)')} que llevan
            semanas sin vender teniendo hermanas activas: puede que estés agotado. Conviene revisarlo antes de tu próxima compra.
          </p>
          {onNavegar ? (
            <button
              type="button"
              onClick={() => onNavegar('reposicion')}
              className="mt-4 font-mono text-[11px] tracking-[0.12em] uppercase transition-opacity hover:opacity-70"
              style={{ color: 'var(--warn)' }}
            >
              Revísalo en Reposición →
            </button>
          ) : null}
        </div>
      ) : null}

      {/* 1d · ESTACIONALIDAD — temporada alta/baja inminente (de todo tu histórico) */}
      {motorResumen && motorResumen.estacionalidad && motorResumen.estacionalidad.estado !== 'normal' ? (
        (() => {
          const e = motorResumen.estacionalidad;
          const alta = e.estado === 'alta';
          const col = alta ? 'var(--ok)' : 'var(--warn)';
          return (
            <div className="rounded-xl border border-lineSoft p-5 flex flex-wrap items-center gap-x-3 gap-y-1.5" style={{ background: 'var(--inset-grad)' }}>
              <span className={`${LABEL} flex items-center gap-2`} style={{ color: col }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: col }} />
                Estacionalidad · de todo tu histórico
              </span>
              <span className="text-[14px] leading-snug" style={{ color: TXT }}>
                Las próximas semanas entran en {em(`temporada ${e.estado}`, col)} ({e.pct >= 0 ? '+' : ''}{e.pct}% sobre la media del año){alta ? ' — conviene pedir con antelación.' : ' — ajusta tus compras a la baja.'}
              </span>
            </div>
          );
        })()
      ) : null}

      {/* 2 · SIGNOS VITALES — una cifra protagonista (ingresos) + tres de apoyo */}
      <div className="space-y-4 md:space-y-5">
        <Kpi {...kpis[0]} />
        {beneficio ? (
          beneficio.soloEstimado ? (
            <div className="rounded-xl border border-lineSoft p-5 md:p-6 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ background: 'var(--inset-grad)' }}>
              <span className={LABEL} style={{ color: TXT2 }}>Beneficio bruto</span>
              <span className="text-[14px] leading-snug" style={{ color: TXT2 }}>
                Añade tus costes reales para ver cuánto <span style={{ color: TXT }}>ganas</span>, no solo cuánto vendes.
              </span>
              {onNavegar ? (
                <button type="button" onClick={() => onNavegar('ajustes')} className="font-mono text-[11px] tracking-[0.12em] uppercase transition-opacity hover:opacity-70" style={{ color: ELECTRIC }}>
                  Añadir costes →
                </button>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-lineSoft p-6 md:p-7 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3" style={{ background: 'var(--inset-grad)' }}>
              <div>
                <div className={LABEL} style={{ color: TXT2 }}>Beneficio bruto estimado</div>
                <div className="mt-2 font-display text-[36px] md:text-[44px] leading-none tnum" style={{ color: TXT }}>{fmtEur(beneficio.valor)}</div>
              </div>
              <div className="font-mono text-[11px] leading-relaxed sm:text-right" style={{ color: TXT2 }}>
                <div>margen {beneficio.margenPct}%</div>
                <div style={{ color: 'var(--txt-3)' }}>coste real en {beneficio.nReales} de {beneficio.nTotal} productos</div>
              </div>
            </div>
          )
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
          {kpis.slice(1).map((k, i) => <Kpi key={i} {...k} />)}
        </div>
      </div>

      {/* 2b · SALUD DEL CATÁLOGO (ciclo de vida) + FIABILIDAD — de todo tu histórico */}
      {motorResumen ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
          <ChartCard title="Salud del catálogo" subtitle="de todo tu histórico · por fase" className="lg:col-span-8">
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              {[
                { key: 'CRECIMIENTO', label: 'Crecimiento', color: 'var(--ok)' },
                { key: 'MADURO', label: 'Maduros', color: TXT2 },
                { key: 'DECLIVE', label: 'En declive', color: 'var(--warn)' },
                { key: 'DESCATALOGADO', label: 'Descatalogados', color: EMBER },
                { key: 'LANZAMIENTO', label: 'Lanzamiento', color: ELECTRIC },
              ].map((f) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <span className="font-display text-[28px] md:text-[32px] leading-none tnum" style={{ color: motorResumen.fases[f.key] > 0 ? f.color : 'var(--txt-3)' }}>
                    {fmtInt(motorResumen.fases[f.key])}
                  </span>
                  <span className={LABEL} style={{ color: TXT2 }}>{f.label}</span>
                </div>
              ))}
              {motorResumen.sinDatos > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="font-display text-[28px] md:text-[32px] leading-none tnum" style={{ color: 'var(--txt-3)' }}>{fmtInt(motorResumen.sinDatos)}</span>
                  <span className={LABEL} style={{ color: 'var(--txt-3)' }}>Sin datos</span>
                </div>
              ) : null}
            </div>
            {motorResumen.enRiesgo > 0 ? (
              <p className="mt-5 pt-4 border-t border-hairlineSoft text-[13px] leading-snug" style={{ color: TXT2 }}>
                {em(`${motorResumen.enRiesgo} ${motorResumen.enRiesgo === 1 ? 'producto' : 'productos'}`, 'var(--warn)')} en declive o descatalogados — conviene revisarlos antes de reponer.
                {onNavegar ? (
                  <button type="button" onClick={() => onNavegar('reposicion')} className="ml-2 font-mono text-[10px] tracking-[0.12em] uppercase transition-opacity hover:opacity-70" style={{ color: 'var(--warn)' }}>
                    en Reposición →
                  </button>
                ) : null}
              </p>
            ) : null}
          </ChartCard>

          <ChartCard title="Fiabilidad del motor" subtitle="de todo tu histórico" className="lg:col-span-4">
            {motorResumen.fiabilidad != null ? (
              <>
                <div className="font-display text-[44px] md:text-[52px] leading-none tnum" style={{ color: TXT }}>{motorResumen.fiabilidad}%</div>
                <p className="mt-3 text-[13px] leading-snug" style={{ color: TXT2 }}>
                  Error medio del pronóstico en validación (cuanto más bajo, mejor): el motor se fía de tus datos para predecir.
                </p>
              </>
            ) : (
              <p className="text-[13px] leading-snug" style={{ color: TXT2 }}>
                Pocos datos para pronosticar con garantías: por ahora el Resumen es descriptivo. Con ~6 meses de histórico el motor empieza a predecir.
              </p>
            )}
          </ChartCard>
        </div>
      ) : null}

      {/* 2b2 · QUÉ VIENE — pronóstico agregado del próximo mes (solo si robusto) */}
      {motorResumen && motorResumen.pronostico ? (
        <ChartCard title="Qué viene · próximas 4 semanas" subtitle="de todo tu histórico · pronóstico">
          <div className="flex flex-col md:flex-row md:items-end gap-5 md:gap-10">
            <div>
              <div className="font-display text-[44px] md:text-[56px] leading-none tnum" style={{ color: TXT }}>
                ~{fmtInt(motorResumen.pronostico.esperado)} <span className="text-[20px] md:text-[24px]" style={{ color: TXT2 }}>uds</span>
              </div>
              <div className="mt-2 font-mono text-[12px]" style={{ color: TXT2 }}>
                rango probable {fmtInt(motorResumen.pronostico.p10)}–{fmtInt(motorResumen.pronostico.p90)} uds (P10–P90)
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className={LABEL} style={{ color: TXT2 }}>Más demanda esperada</div>
              <ul className="mt-2.5 space-y-1.5">
                {motorResumen.pronostico.top.map((t) => (
                  <li key={t.nombre} className="flex items-center justify-between gap-3 font-mono text-[12px]">
                    <span className="truncate" style={{ color: TXT }}>{t.nombre}</span>
                    <span className="tnum flex-shrink-0" style={{ color: TXT2 }}>~{fmtInt(t.esperado)} uds</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {onNavegar ? (
            <button type="button" onClick={() => onNavegar('reposicion')} className="mt-5 font-mono text-[11px] tracking-[0.12em] uppercase transition-opacity hover:opacity-70" style={{ color: ELECTRIC }}>
              Cuánto pedir de cada uno → Reposición
            </button>
          ) : null}
        </ChartCard>
      ) : null}

      {/* 2c · CONCENTRACIÓN ABC del catálogo (oculta con filtro de producto) */}
      {abc ? (
        <ChartCard title="Concentración del catálogo (ABC)" subtitle={`${abc.total} productos`}>
          <p className="text-[15px] md:text-[16px] leading-[1.5] mb-5" style={{ color: TXT }}>
            {em(`${abc.A} ${abc.A === 1 ? 'producto' : 'productos'}`, ELECTRIC)} ({Math.round((abc.A / abc.total) * 100)}% del catálogo) generan el grueso de tus ingresos — concentra ahí tu presupuesto de compra.
          </p>
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {[
              { k: 'A', label: 'Hasta el 80% de ingresos', color: ELECTRIC },
              { k: 'B', label: 'Del 80 al 95%', color: TXT2 },
              { k: 'C', label: 'El 5% restante', color: 'var(--txt-3)' },
            ].map((c) => (
              <div key={c.k} className="rounded-lg border border-hairlineSoft p-4" style={{ background: 'var(--inset-grad)' }}>
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[22px] md:text-[24px] leading-none" style={{ color: c.color }}>{c.k}</span>
                  <span className="font-display text-[22px] md:text-[24px] leading-none tnum" style={{ color: TXT }}>{fmtInt(abc[c.k])}</span>
                </div>
                <div className={`${LABEL} mt-2`} style={{ color: TXT2 }}>{c.label}</div>
              </div>
            ))}
          </div>
          {onNavegar ? (
            <button type="button" onClick={() => onNavegar('plan')} className="mt-5 font-mono text-[11px] tracking-[0.12em] uppercase transition-opacity hover:opacity-70" style={{ color: ELECTRIC }}>
              Reparte tu presupuesto en Plan de compra →
            </button>
          ) : null}
        </ChartCard>
      ) : null}

      {/* Separador editorial: arriba la decisión, debajo el detalle gráfico */}
      <div className="flex items-center gap-3 pt-3">
        <span className={LABEL} style={{ color: 'var(--txt-3)' }}>El detalle de tus ventas</span>
        <span className="flex-1 h-px" style={{ background: 'var(--hairline)' }} />
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
                      <stop offset="0%" stopColor="var(--data-2)" />
                      <stop offset="100%" stopColor="var(--data)" />
                    </linearGradient>
                    <linearGradient id="gradTallaDown" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--muted)" />
                      <stop offset="100%" stopColor="var(--muted)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--grid-line)" />
                  <XAxis dataKey="talla" tick={tickMono} axisLine={false} tickLine={false} />
                  <YAxis tick={tickMono} axisLine={false} tickLine={false} width={40} />
                  <Tooltip cursor={{ fill: 'var(--fill-chart-cursor)' }} content={<TallaTip />} />
                  <ReferenceLine
                    y={avgTalla} stroke="var(--txt)" strokeOpacity={0.32} strokeDasharray="4 4"
                    label={{ value: `media ${fmtInt(avgTalla)}`, position: 'right', fontSize: 10, fill: TXT2 }}
                  />
                  <Bar dataKey="unidades" name="Unidades" radius={[6, 6, 0, 0]} maxBarSize={64}>
                    {tallaData.map((d, i) => <Cell key={i} fill={d.above ? 'url(#gradTallaUp)' : 'url(#gradTallaDown)'} />)}
                    <LabelList content={renderTallaPct} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        ) : null}

        {colorData.length ? (
          <ChartCard title="Ventas por color" subtitle={esEur ? 'euros' : 'unidades'} accion={<MetricToggle value={metrica} onChange={setMetrica} />} className="lg:col-span-4">
            <div className="relative h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ColorTip />} />
                  <Pie data={colorData} dataKey={esEur ? 'ingresos' : 'unidades'} nameKey="color" cx="50%" cy="50%"
                    innerRadius={58} outerRadius={92} paddingAngle={2} stroke={SURFACE} strokeWidth={2}>
                    {colorData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="font-display text-[34px] leading-none tnum" style={{ color: TXT }}>{top3Pct(colorData)}%</div>
                <div className={`${LABEL} mt-1 text-center px-6`} style={{ color: TXT2 }}>Top 3 colores</div>
              </div>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2">
              {colorData.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="flex items-center gap-2 truncate" style={{ color: TXT2 }}>
                    <span className="w-2.5 h-2.5 rounded-sm border border-hairline flex-shrink-0" style={{ background: d.fill }} />
                    <span className="truncate">{d.color}</span>
                  </span>
                  <span className="tnum flex-shrink-0" style={{ color: 'var(--txt-3)' }}>{esEur ? fmtEur(d.ingresos) : fmtInt(d.unidades)} · {pctMetrica(d, colorData)}%</span>
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
                <BarChart data={productoData} layout="vertical" margin={{ top: 4, right: esMovil ? 12 : 130, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gradProducto" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--data)" />
                      <stop offset="100%" stopColor="var(--data-2)" />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="producto" width={esMovil ? 92 : 132} tick={{ ...tickMono, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'var(--hairline-soft)' }} content={<ProductoTip />} />
                  <Bar dataKey="ingresos" name="Ingresos" radius={[0, 4, 4, 0]} maxBarSize={26} fill="url(#gradProducto)">
                    {esMovil ? null : <LabelList content={renderProductoLabel} />}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        ) : null}

        {categoriaData.length ? (
          <ChartCard title="Ventas por categoría" subtitle={esEur ? 'euros' : 'unidades'} accion={<MetricToggle value={metrica} onChange={setMetrica} />} className="lg:col-span-4">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CategoriaTip />} />
                  <Pie data={categoriaData} dataKey={esEur ? 'ingresos' : 'unidades'} nameKey="categoria" cx="50%" cy="50%"
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
                    <span className="w-2.5 h-2.5 rounded-sm border border-hairline flex-shrink-0" style={{ background: d.fill }} />
                    <span className="truncate">{d.categoria}</span>
                  </span>
                  <span className="tnum flex-shrink-0" style={{ color: 'var(--txt-3)' }}>{esEur ? fmtEur(d.ingresos) : fmtInt(d.unidades)} · {pctMetrica(d, categoriaData)}%</span>
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
                      <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="var(--data)" floodOpacity="0.45" />
                    </filter>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--grid-line)" />
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
      </>)}
    </div>
  );
}
