// Motor de stock — PLAN DE COMPRA GLOBAL (open-to-buy ligero).
// La pregunta real de una marca antes de temporada: «tengo X € de presupuesto
// de compra — ¿cómo los reparto entre TODO mi catálogo para maximizar margen?».
//
// La idea, en tres piezas:
//  1) DEMANDA por producto: el mismo pipeline de la recomendación individual
//     (serie limpia → mejor modelo → ciclo de vida → bootstrap), memoizado.
//  2) CURVA DE VALOR MARGINAL: el margen esperado de la unidad n-ésima =
//     P(venderla) × margen − P(que sobre) × pérdida de liquidación (newsvendor).
//     Las primeras unidades de un producto que vende seguro rinden casi el
//     margen pleno; las últimas tienen alto riesgo de acabar en rebajas.
//  3) ASIGNACIÓN GREEDY POR EURO: el presupuesto se gasta unidad a unidad
//     comprando siempre la que más margen esperado rinde POR EURO invertido
//     (con costes distintos por producto, esa es la renta que importa). Como
//     cada curva marginal es decreciente, el reparto resultante es el óptimo
//     del problema relajado: el dinero fluye solo hacia donde renta.
//
// Costes (vía a del plan): coste unitario = (100 − margen%) del PVP medio de
// cada producto, derivado de SUS datos; liquidación al 30% del PVP (la misma
// convención que el módulo de economía).

import { demandaProducto, MIN_UNIDADES_PRODUCTO } from './motor.mjs';

export const HORIZONTE_PLAN_DEF = 12;
export const MARGEN_PLAN_DEF = 60;     // % de margen bruto sobre PVP
export const LIQUIDACION_PLAN = 0.30;  // valor de liquidación: 30% del PVP
export const ESCENARIOS_PLAN = { conservador: 0.25, esperado: 0.5, agresivo: 0.75 };

// P(D ≥ n) sobre las simulaciones ORDENADAS (búsqueda binaria).
export function supervivencia(ordenadas, n) {
  let lo = 0;
  let hi = ordenadas.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ordenadas[mid] < n) lo = mid + 1;
    else hi = mid;
  }
  return (ordenadas.length - lo) / ordenadas.length;
}

// Margen esperado de la unidad n-ésima (marginal newsvendor).
export const margenMarginal = (S, margen, perdida) => S * margen - (1 - S) * perdida;

// ---------------------------------------------------------------------------
// asignarPresupuesto(productos, presupuesto) — el corazón greedy.
// productos: [{ nombre, coste, marginal(n) }] con marginal decreciente en n.
// Compra unidad a unidad la de mayor margen/€ hasta agotar presupuesto o
// hasta que ninguna unidad rentable (marginal > 0) sea asequible.
// ---------------------------------------------------------------------------
export function asignarPresupuesto(productos, presupuesto) {
  const estado = productos.map((p) => ({ p, n: 0, sig: p.marginal(1) }));
  let gastado = 0;
  let margenTotal = 0;
  let ultimaComprada = null;

  for (;;) {
    let mejor = null;
    let mejorDensidad = 0;
    for (const e of estado) {
      if (e.sig <= 0) continue;
      if (e.p.coste > presupuesto - gastado) continue;
      const densidad = e.sig / e.p.coste;
      if (densidad > mejorDensidad) {
        mejorDensidad = densidad;
        mejor = e;
      }
    }
    if (!mejor) break;
    mejor.n += 1;
    gastado += mejor.p.coste;
    margenTotal += mejor.sig;
    ultimaComprada = { nombre: mejor.p.nombre, margen: mejor.sig, coste: mejor.p.coste };
    mejor.sig = mejor.p.marginal(mejor.n + 1);
  }

  // La primera descartada: la unidad rentable mejor pagada que quedó fuera.
  let primeraDescartada = null;
  for (const e of estado) {
    if (e.sig > 0) {
      if (!primeraDescartada || e.sig / e.p.coste > primeraDescartada.margen / primeraDescartada.coste) {
        primeraDescartada = { nombre: e.p.nombre, margen: e.sig, coste: e.p.coste };
      }
    }
  }

  return {
    unidades: new Map(estado.map((e) => [e.p.nombre, e.n])),
    gastado,
    margenTotal,
    ultimaComprada,
    primeraDescartada,
  };
}

// Margen esperado de comprar n unidades de un producto (suma de marginales).
export function margenDePedido(marginal, n) {
  let total = 0;
  for (let k = 1; k <= n; k++) total += marginal(k);
  return total;
}

// ---------------------------------------------------------------------------
// generarPlanCompra(motor, { presupuesto, horizonte, margenPct, escenario })
// ---------------------------------------------------------------------------
export function generarPlanCompra(motor, {
  presupuesto, horizonte = HORIZONTE_PLAN_DEF, margenPct = MARGEN_PLAN_DEF, escenario = 'esperado',
} = {}) {
  const { almacen } = motor;
  if (almacen.vacio) return { ok: false, motivo: 'sin-datos' };

  const presu = Number(presupuesto);
  if (!Number.isFinite(presu) || presu <= 0) return { ok: false, motivo: 'presupuesto-invalido' };
  const H = Math.min(26, Math.max(4, Math.round(Number(horizonte) || HORIZONTE_PLAN_DEF)));
  const mPct = Math.min(90, Math.max(20, Number(margenPct) || MARGEN_PLAN_DEF));
  const esc = ESCENARIOS_PLAN[escenario] != null ? escenario : 'esperado';
  const avisos = [];

  // — Candidatos: todo el catálogo con datos suficientes; el resto, fuera con motivo —
  const excluidos = [];
  const candidatos = [];
  for (const p of almacen.productos.values()) {
    if (p.total < MIN_UNIDADES_PRODUCTO) {
      excluidos.push({ producto: p.nombre, motivo: `solo ${p.total} uds históricas (mínimo ${MIN_UNIDADES_PRODUCTO})` });
      continue;
    }
    if (!(p.precioMedio > 0)) {
      excluidos.push({ producto: p.nombre, motivo: 'sin precio en tus datos' });
      continue;
    }
    const d = demandaProducto(motor, p.nombre, H);
    if (!d) {
      excluidos.push({ producto: p.nombre, motivo: 'datos insuficientes para pronosticar' });
      continue;
    }

    // Escenario global: escala la demanda simulada al percentil elegido
    // (conservador planifica contra demanda floja; agresivo, contra fuerte).
    const q50 = d.q(0.5);
    const factor = esc === 'esperado' || q50 <= 0 ? 1 : d.q(ESCENARIOS_PLAN[esc]) / q50;
    const ordenadas = factor === 1 ? d.ordenadas : Float64Array.from(d.ordenadas, (x) => x * factor);

    const pvp = p.precioMedio;
    const coste = pvp * (1 - mPct / 100);
    const margen = pvp - coste;
    const perdida = Math.max(0, coste - pvp * LIQUIDACION_PLAN);
    const marginal = (n) => margenMarginal(supervivencia(ordenadas, n), margen, perdida);

    candidatos.push({
      nombre: p.nombre,
      categoria: p.categoria,
      pvp, coste, margen, perdida,
      marginal,
      ordenadas,
      ciclo: d.ciclo,
      modelo: d.modelo,
      historicas: p.total,
    });
  }

  if (candidatos.length === 0) {
    return { ok: false, motivo: 'sin-productos', excluidos };
  }
  if (candidatos.length < 3) {
    avisos.push(`Solo ${candidatos.length} producto${candidatos.length === 1 ? '' : 's'} con datos suficientes: con tan poco catálogo, el plan aporta poco frente a ir producto a producto.`);
  }

  // — Asignación greedy —
  const asignacion = asignarPresupuesto(candidatos, presu);
  if (asignacion.gastado === 0) {
    const minimo = Math.min(...candidatos.map((c) => c.coste));
    return {
      ok: false, motivo: 'presupuesto-insuficiente',
      minimo, excluidos,
    };
  }

  // — Filas del plan (solo productos con inversión), ordenadas por inversión —
  const filas = [];
  const sinInversion = [];
  for (const c of candidatos) {
    const n = asignacion.unidades.get(c.nombre) || 0;
    if (n === 0) {
      sinInversion.push(c);
      if (c.ciclo.fase === 'DECLIVE') {
        avisos.push(`El plan no invierte en ${c.nombre}: está en declive y hay destinos que rinden más.`);
      }
      continue;
    }
    filas.push({
      producto: c.nombre,
      categoria: c.categoria,
      unidades: n,
      inversion: n * c.coste,
      margenEsperado: margenDePedido(c.marginal, n),
      pctPresupuesto: (n * c.coste) / presu,
      coste: c.coste,
      pvp: c.pvp,
      ciclo: c.ciclo,
      modelo: c.modelo,
      // Riesgos al nivel comprado: que falte (D > n) o que sobre >30% (D < 0,7n).
      riesgoRotura: supervivencia(c.ordenadas, n + 1e-9),
      riesgoRebaja: 1 - supervivencia(c.ordenadas, 0.7 * n),
    });
  }
  filas.sort((a, b) => b.inversion - a.inversion);

  const sobrante = presu - asignacion.gastado;
  // Si paró por falta de unidades rentables (no por presupuesto), se dice claro.
  const sobranteVoluntario = sobrante > 0.005 * presu && asignacion.primeraDescartada === null;
  if (sobranteVoluntario) {
    avisos.push(`Presupuesto no agotado: comprar más unidades sería destruir margen — sobran ${Math.round(sobrante).toLocaleString('es-ES')} €.`);
  }
  if (sinInversion.length > 0) {
    const nombres = sinInversion.map((c) => c.nombre);
    avisos.push(`${sinInversion.length} producto${sinInversion.length === 1 ? '' : 's'} con datos válidos no recibe${sinInversion.length === 1 ? '' : 'n'} presupuesto: ${nombres.slice(0, 4).join(', ')}${nombres.length > 4 ? '…' : ''}.`);
  }

  return {
    ok: true,
    presupuesto: presu,
    horizonte: H,
    margenPct: mPct,
    escenario: esc,
    gastado: asignacion.gastado,
    sobrante,
    sobranteVoluntario,
    unidadesTotales: filas.reduce((s, f) => s + f.unidades, 0),
    margenEsperado: asignacion.margenTotal,
    frontera: {
      ultimaComprada: asignacion.ultimaComprada,
      primeraDescartada: asignacion.primeraDescartada,
    },
    filas,
    excluidos,
    avisos,
  };
}
