// Motor de stock — MÓDULO DE DATOS (parte 1).
// Convierte las ventas fila-a-fila en series SEMANALES por producto, variante
// (talla/color), categoría y total de la marca. Sobre estas series trabaja todo
// el motor. También calcula el "perfil del dataset" (cuánto histórico hay, cuántos
// productos, cuánta intermitencia…) con el que el motor decide qué técnicas puede
// activar honestamente.
//
// Es matemática pura sin React ni navegador: se puede probar desde Node con
// `node scripts/test-engine.mjs`. Por eso la extensión es .mjs (módulo estándar
// de JavaScript que Node puede ejecutar tal cual).

const DIA_MS = 86400000; // milisegundos de un día

// 'AAAA-MM-DD' → milisegundos UTC de ese día, o null si la fecha no es real
// (también rechaza fechas imposibles tipo 2026-02-31).
export function parseDia(fechaISO) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fechaISO ?? '').trim());
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  return t;
}

// Lunes de la semana a la que pertenece un día (las semanas van de lunes a domingo).
export function lunesDe(diaMs) {
  const dow = (new Date(diaMs).getUTCDay() + 6) % 7; // 0 = lunes … 6 = domingo
  return diaMs - dow * DIA_MS;
}

export function fechaISO(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// '2026-03-16' → '16 mar 2026' (para mensajes legibles).
export function fmtFecha(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return String(iso ?? '');
  return `${+m[3]} ${MESES_CORTOS[+m[2] - 1]} ${m[1]}`;
}

function sumar(map, clave, valor) {
  const k = String(clave ?? '').trim();
  if (!k) return;
  map.set(k, (map.get(k) || 0) + valor);
}

// ---------------------------------------------------------------------------
// construirAlmacen(records) — el corazón de los datos.
// records: [{fecha, producto, categoria, talla, color, unidades, precio, ingresos}]
// Devuelve series semanales completas (con ceros en las semanas sin venta, que
// son información, no huecos) en todos los niveles de la jerarquía.
// ---------------------------------------------------------------------------
export function construirAlmacen(records) {
  const filas = [];
  let descartadas = 0;
  for (const r of records || []) {
    const dia = parseDia(r.fecha);
    const producto = String(r.producto ?? '').trim();
    if (dia == null || !producto) { descartadas += 1; continue; }
    filas.push({ ...r, producto, dia });
  }

  if (filas.length === 0) {
    return {
      vacio: true, descartadas, semanas: [],
      productos: new Map(), categorias: new Map(),
      tallasGlobal: new Map(), totalUnidades: 0,
      fechaMin: null, fechaMax: null, semanaParcial: null,
    };
  }

  let diaMin = Infinity, diaMax = -Infinity;
  for (const f of filas) {
    if (f.dia < diaMin) diaMin = f.dia;
    if (f.dia > diaMax) diaMax = f.dia;
  }
  const lunesMin = lunesDe(diaMin);
  const lunesMax = lunesDe(diaMax);
  const nSemanas = Math.round((lunesMax - lunesMin) / (7 * DIA_MS)) + 1;
  const semanas = Array.from({ length: nSemanas }, (_, i) => fechaISO(lunesMin + i * 7 * DIA_MS));

  // Si la última semana del histórico está "a medias" (los datos acaban antes
  // del domingo), conviene no usarla para ajustar: parecería una caída de ventas
  // cuando solo es que el archivo termina ahí.
  const dowMax = (new Date(diaMax).getUTCDay() + 6) % 7; // 0 lunes … 6 domingo
  const semanaParcial = dowMax < 6 ? { dias: dowMax + 1 } : null;

  const serieNueva = () => new Array(nSemanas).fill(0);
  const productos = new Map();
  const categorias = new Map();
  const tallasGlobal = new Map();
  let totalUnidades = 0;

  for (const f of filas) {
    const i = Math.round((lunesDe(f.dia) - lunesMin) / (7 * DIA_MS));
    const uds = Number(f.unidades) || 0;
    totalUnidades += uds;

    // — producto —
    let p = productos.get(f.producto);
    if (!p) {
      p = {
        nombre: f.producto, serie: serieNueva(), total: 0,
        tallas: new Map(), colores: new Map(), variantes: new Map(),
        unidadesPorCategoria: new Map(),
      };
      productos.set(f.producto, p);
    }
    p.serie[i] += uds;
    p.total += uds;
    sumar(p.tallas, f.talla, uds);
    sumar(p.colores, f.color, uds);
    sumar(p.unidadesPorCategoria, f.categoria || '—', uds);

    // — variante (talla / color) dentro del producto —
    const talla = String(f.talla ?? '').trim();
    const color = String(f.color ?? '').trim();
    const claveVar = `${talla || '—'} / ${color || '—'}`;
    let v = p.variantes.get(claveVar);
    if (!v) {
      v = { clave: claveVar, talla, color, serie: serieNueva(), total: 0 };
      p.variantes.set(claveVar, v);
    }
    v.serie[i] += uds;
    v.total += uds;

    // — categoría —
    const cat = String(f.categoria ?? '').trim() || '—';
    let c = categorias.get(cat);
    if (!c) {
      c = { nombre: cat, serie: serieNueva(), total: 0, tallas: new Map() };
      categorias.set(cat, c);
    }
    c.serie[i] += uds;
    c.total += uds;
    sumar(c.tallas, f.talla, uds);

    // — marca completa —
    sumar(tallasGlobal, f.talla, uds);
  }

  // Categoría "oficial" de cada producto (donde más unidades tiene) y primera
  // semana con venta (un producto lanzado a mitad del histórico no tiene
  // demanda cero antes de existir: simplemente no existía).
  for (const p of productos.values()) {
    let mejor = '—', mejorUds = -1;
    for (const [cat, uds] of p.unidadesPorCategoria) {
      if (uds > mejorUds) { mejor = cat; mejorUds = uds; }
    }
    p.categoria = mejor;
    p.primeraSemana = p.serie.findIndex((x) => x > 0);
    for (const v of p.variantes.values()) {
      v.primeraSemana = v.serie.findIndex((x) => x > 0);
    }
  }

  return {
    vacio: false, descartadas, semanas, productos, categorias, tallasGlobal,
    totalUnidades, fechaMin: fechaISO(diaMin), fechaMax: fechaISO(diaMax), semanaParcial,
  };
}

// ---------------------------------------------------------------------------
// perfilDelDataset(almacen) — MÓDULO 0 (pre-flight).
// Mide el dataset para que el motor sepa qué puede y qué no puede hacer.
// ---------------------------------------------------------------------------
export function perfilDelDataset(almacen) {
  if (almacen.vacio) {
    return { vacio: true, semanas: 0, nProductos: 0, nVariantes: 0, totalUnidades: 0, descartadas: almacen.descartadas };
  }

  const nSemanas = almacen.semanas.length;
  let nVariantes = 0;
  let intermitentes = 0;   // variantes con >40% de semanas a cero
  let evaluadas = 0;       // variantes con ventana suficiente para medirlo
  let sumaPctCero = 0;

  for (const p of almacen.productos.values()) {
    nVariantes += p.variantes.size;
    for (const v of p.variantes.values()) {
      if (v.primeraSemana < 0) continue;
      const ventana = nSemanas - v.primeraSemana; // desde su primera venta
      if (ventana < 6) continue;                  // demasiado nueva para medir
      let ceros = 0;
      for (let t = v.primeraSemana; t < nSemanas; t++) if (v.serie[t] === 0) ceros += 1;
      const pct = ceros / ventana;
      sumaPctCero += pct;
      evaluadas += 1;
      if (pct > 0.4) intermitentes += 1;
    }
  }

  return {
    vacio: false,
    semanas: nSemanas,
    fechaMin: almacen.fechaMin,
    fechaMax: almacen.fechaMax,
    nProductos: almacen.productos.size,
    nVariantes,
    totalUnidades: almacen.totalUnidades,
    descartadas: almacen.descartadas,
    semanaParcial: almacen.semanaParcial,
    intermitenciaMedia: evaluadas ? sumaPctCero / evaluadas : 0,
    pctVariantesIntermitentes: evaluadas ? intermitentes / evaluadas : 0,
    variantesEvaluadas: evaluadas,
  };
}

// ---------------------------------------------------------------------------
// configuracionMotor(perfil, totalesLimpieza) — el panel de honestidad.
// Para cada técnica: si está activa, desactivada (y POR QUÉ, con el umbral) o
// llega en una parte posterior del motor. Umbrales del plan:
//   estacionalidad ≥52 semanas · Holt-Winters ≥52 · Holt amortiguado ≥26 ·
//   Croston si intermitencia >40% · backtesting ≥26 semanas y ≥500 unidades.
// ---------------------------------------------------------------------------
export function configuracionMotor(perfil, totales = {}) {
  const s = perfil.semanas || 0;
  const u = perfil.totalUnidades || 0;
  const filas = [];
  const pct = (x) => `${Math.round(x * 100)}%`;

  filas.push({
    nombre: 'Limpieza de picos atípicos (outliers)', estado: 'activa',
    detalle: totales.outliers > 0
      ? `${totales.outliers} semana${totales.outliers === 1 ? '' : 's'} con picos amortiguados en tu catálogo (desviación >3 MAD sobre la mediana móvil)`
      : 'sin picos anómalos detectados en tu catálogo',
  });

  filas.push({
    nombre: 'Corrección de roturas de stock', estado: 'activa',
    detalle: totales.roturas > 0
      ? `${totales.roturas} tramo${totales.roturas === 1 ? '' : 's'} de "cero sostenido con variantes hermanas vendiendo" tratados como falta de stock`
      : 'sin tramos con pinta de rotura de stock detectados',
  });

  filas.push({
    nombre: 'Pronóstico EWMA (media móvil exponencial)', estado: 'activa',
    detalle: 'semivida de 8 semanas: lo reciente pesa más, lo antiguo se olvida poco a poco',
  });

  filas.push({
    nombre: 'Curva de tallas jerárquica', estado: 'activa',
    detalle: 'mezcla producto → categoría → marca con peso n/(n+K), K = 200 unidades',
  });

  filas.push(s >= 26 && u >= 500
    ? { nombre: 'Banco de modelos con backtesting', estado: 'activa',
        detalle: `los modelos compiten en cortes rolling-origin y gana el de menor error (tienes ${s} semanas y ${u.toLocaleString('es-ES')} uds; mínimo 26 y 500)` }
    : { nombre: 'Banco de modelos con backtesting', estado: 'desactivada',
        detalle: `requiere 26 semanas y 500 unidades (tienes ${s} y ${u.toLocaleString('es-ES')}) — mientras tanto: EWMA, o Croston si la serie es intermitente` });

  filas.push(s >= 26
    ? { nombre: 'Holt con tendencia amortiguada', estado: 'activa',
        detalle: 'compite en el banco de modelos (phi 0,9; tendencia limitada a ±50% del nivel)' }
    : { nombre: 'Holt con tendencia amortiguada', estado: 'desactivada',
        detalle: `requiere 26 semanas de histórico y tienes ${s}` });

  filas.push(s >= 52
    ? { nombre: 'Estacionalidad (Holt-Winters y naive estacional)', estado: 'activa',
        detalle: 'índices semanales aprendidos de tu histórico por categoría — el primer año pesan poco; ganan fuerza con 2-3 años' }
    : { nombre: 'Estacionalidad (Holt-Winters y naive estacional)', estado: 'desactivada',
        detalle: `requiere 52 semanas (12 meses) para distinguir estación de ruido y tienes ${s}` });

  filas.push({
    nombre: 'Croston/SBA para series intermitentes', estado: 'activa',
    detalle: `se aplica a series con >40% de semanas a cero — ahora mismo, el ${pct(perfil.pctVariantesIntermitentes || 0)} de tus variantes`,
  });

  filas.push({
    nombre: 'Intervalos por bootstrap y escenarios', estado: 'activa',
    detalle: '500 simulaciones deterministas remuestreando los errores reales del modelo — percentiles empíricos, no campana teórica',
  });

  filas.push({
    nombre: 'Economía del pedido (newsvendor)', estado: 'activa',
    detalle: 'si introduces coste y PVP, el pedido pasa a maximizar tu margen esperado (ratio crítico); sin costes, nivel de servicio manual',
  });

  return filas;
}
