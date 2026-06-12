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
import {
  curvaJerarquica, aplicarUmbralMinimo, repartoPorMayorResto, restarMapas,
  desgloseTallaColor, PESO_MINIMO_TALLA,
} from './curvas.mjs';

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
// asignarPresupuesto(productos, presupuesto) — el corazón del plan.
// productos: [{ nombre, coste, marginal(n) }] con marginal decreciente en n.
//
// Compra POR NIVELES de rentabilidad (margen esperado POR EURO invertido):
//  · Con un margen % único, las unidades "casi seguras" de TODOS los productos
//    rinden exactamente lo mismo por euro: empate masivo. Elegir entre ellas
//    unidad a unidad acabaría decidido por el polvo de coma flotante del
//    precio medio y el orden del CSV — es decir, por el azar.
//  · Por eso: las unidades se agrupan por nivel de densidad (empate = misma
//    densidad con tolerancia EPS). Si el nivel cabe en el presupuesto, se
//    compra entero. Si NO cabe, se RACIONA proporcionalmente a las unidades
//    de cada producto en el nivel (mayor resto, sin pasarse del presupuesto):
//    mismo margen esperado total, riesgo diversificado y resultado estable
//    ante el orden de las filas del archivo.
// ---------------------------------------------------------------------------
const EPS_DENSIDAD = 1e-9;

export function asignarPresupuesto(productos, presupuesto) {
  const estado = productos.map((p) => ({ p, n: 0, sig: p.marginal(1) }));
  let gastado = 0;
  let margenTotal = 0;
  let ultimaComprada = null;

  const comprar = (e, uds) => {
    for (let i = 0; i < uds; i++) {
      e.n += 1;
      gastado += e.p.coste;
      margenTotal += e.sig;
      ultimaComprada = { nombre: e.p.nombre, margen: e.sig, coste: e.p.coste };
      e.sig = e.p.marginal(e.n + 1);
    }
  };

  for (;;) {
    const restante = presupuesto - gastado;

    // 1) La mejor densidad alcanzable con lo que queda.
    let dMax = 0;
    for (const e of estado) {
      if (e.sig <= 0 || e.p.coste > restante) continue;
      const d = e.sig / e.p.coste;
      if (d > dMax) dMax = d;
    }
    if (dMax <= 0) break;

    // 2) El NIVEL: las unidades consecutivas de cada producto asequible que
    //    empatan con esa densidad (dentro de la tolerancia).
    const nivel = [];
    for (const e of estado) {
      if (e.sig <= 0 || e.p.coste > restante) continue;
      if (e.sig / e.p.coste < dMax - EPS_DENSIDAD) continue;
      let uds = 0;
      let m = e.sig;
      while (m > 0 && m / e.p.coste >= dMax - EPS_DENSIDAD) {
        uds += 1;
        m = e.p.marginal(e.n + uds + 1);
      }
      nivel.push({ e, uds });
    }
    // Orden estable por nombre: el orden del CSV no decide nada.
    nivel.sort((a, b) => (a.e.p.nombre < b.e.p.nombre ? -1 : 1));

    const costeNivel = nivel.reduce((sum, x) => sum + x.uds * x.e.p.coste, 0);
    if (costeNivel <= restante) {
      for (const x of nivel) comprar(x.e, x.uds);
      continue; // al siguiente nivel de rentabilidad
    }

    // 3) El nivel no cabe: racionamiento proporcional con mayor resto.
    const f = restante / costeNivel;
    for (const x of nivel) {
      x.base = Math.floor(x.uds * f);
      x.resto = x.uds * f - x.base;
    }
    for (const x of nivel) comprar(x.e, x.base);
    const porResto = [...nivel].sort(
      (a, b) => b.resto - a.resto || (a.e.p.nombre < b.e.p.nombre ? -1 : 1)
    );
    for (const x of porResto) {
      if (x.base >= x.uds) continue;
      if (x.e.p.coste <= presupuesto - gastado) comprar(x.e, 1);
    }
    // Lo que aún sobre no paga este nivel: la siguiente vuelta lo baja a
    // unidades más baratas de niveles inferiores (si las hay rentables).
  }

  // La primera descartada: la unidad rentable mejor pagada que quedó fuera
  // (empates dentro de la tolerancia → orden alfabético, determinista).
  let primeraDescartada = null;
  let mejorD = 0;
  for (const e of estado) {
    if (e.sig <= 0) continue;
    const d = e.sig / e.p.coste;
    if (!primeraDescartada || d > mejorD + EPS_DENSIDAD) {
      mejorD = Math.max(mejorD, d);
      primeraDescartada = { nombre: e.p.nombre, margen: e.sig, coste: e.p.coste };
    } else if (d >= mejorD - EPS_DENSIDAD && e.p.nombre < primeraDescartada.nombre) {
      primeraDescartada = { nombre: e.p.nombre, margen: e.sig, coste: e.p.coste };
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
// repartoProporcional(productos, presupuesto) — el BASELINE ingenuo contra el
// que se mide el plan: repartir el presupuesto proporcionalmente a las ventas
// históricas de cada producto ("compro según lo que vendí"). Su margen
// esperado se evalúa con las MISMAS curvas marginales: comparación justa.
// productos: [{ nombre, coste, marginal(n), historicas }]
// ---------------------------------------------------------------------------
export function repartoProporcional(productos, presupuesto) {
  const totalHistoricas = productos.reduce((s, p) => s + (p.historicas || 0), 0);
  let gastado = 0;
  let margen = 0;
  let unidadesTotales = 0;
  const unidades = new Map();
  for (const p of productos) {
    const cuota = totalHistoricas > 0 ? presupuesto * ((p.historicas || 0) / totalHistoricas) : 0;
    const n = Math.max(0, Math.floor(cuota / p.coste));
    unidades.set(p.nombre, n);
    gastado += n * p.coste;
    margen += margenDePedido(p.marginal, n);
    unidadesTotales += n;
  }
  return { unidades, unidadesTotales, gastado, margen };
}

// Desglose por talla (y talla × color) de las unidades que el plan asigna a
// un producto — exactamente el mismo método que la recomendación individual:
// curva jerárquica con encogimiento → umbral del 2% → mayor resto → IPF.
function desglosarFila(almacen, p, unidades) {
  const cat = almacen.categorias.get(p.categoria);
  const jer = curvaJerarquica({
    tallasProducto: p.tallas,
    tallasCategoria: restarMapas(cat?.tallas, p.tallas),
    tallasGlobal: restarMapas(almacen.tallasGlobal, p.tallas),
  });
  if (!jer) return { reparto: null, matriz: null, tallaUnica: false };
  const filtrado = aplicarUmbralMinimo(jer.curva, jer.dominio);
  const reparto = repartoPorMayorResto(filtrado.curva, filtrado.dominio, unidades);
  let matriz = null;
  const coloresValidos = new Map(
    [...p.colores].filter(([c, u]) => c && u > 0 && u / Math.max(1, p.total) >= PESO_MINIMO_TALLA)
  );
  if (coloresValidos.size >= 2) {
    const conjunta = new Map();
    for (const v of p.variantes.values()) {
      if (v.talla && v.color) conjunta.set(`${v.talla}|||${v.color}`, v.total);
    }
    matriz = desgloseTallaColor({ conjunta, repartoTallas: reparto, pesosColores: coloresValidos });
  }
  return { reparto, matriz, tallaUnica: jer.dominio.length === 1 };
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
  const eur = (x) => `${Math.round(x).toLocaleString('es-ES')} €`;

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
      _p: p,
    });
  }

  if (candidatos.length === 0) {
    return { ok: false, motivo: 'sin-productos', excluidos };
  }
  if (candidatos.length < 3) {
    avisos.push(`Solo ${candidatos.length} producto${candidatos.length === 1 ? '' : 's'} con datos suficientes: con tan poco catálogo, el plan aporta poco frente a ir producto a producto.`);
  }

  // — Tramo "casi seguro" del catálogo: unidades con P(venta) = 1 (hasta la
  //   simulación mínima de cada producto). Si el presupuesto no lo cubre,
  //   el plan es esencialmente un reparto proporcional y se dice claro. —
  const costeSeguro = candidatos.reduce(
    (sum, c) => sum + Math.floor(c.ordenadas[0]) * c.coste, 0
  );

  // — Asignación por niveles de rentabilidad —
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
    const desglose = desglosarFila(almacen, c._p, n);
    filas.push({
      producto: c.nombre,
      categoria: c.categoria,
      unidades: n,
      reparto: desglose.reparto,
      matriz: desglose.matriz,
      tallaUnica: desglose.tallaUnica,
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
    avisos.push(`${sinInversion.length} producto${sinInversion.length === 1 ? '' : 's'} con datos válidos no recibe${sinInversion.length === 1 ? '' : 'n'} presupuesto: ${nombres.join(', ')}.`);
  }
  if (costeSeguro > 0 && presu < costeSeguro) {
    avisos.push(`Tu presupuesto cubre el ${Math.round((presu / costeSeguro) * 100)}% del tramo "casi seguro" del catálogo (≈${eur(costeSeguro)}): esas unidades rinden lo mismo por euro, así que se reparten proporcionalmente a la demanda de cada producto para no concentrar el riesgo.`);
  }

  // — Baseline ingenuo para la comparación que demuestra el valor —
  const baseline = repartoProporcional(candidatos, presu);

  // — EXPLICABILIDAD: el porqué del reparto, paso a paso y con estos números —
  const u = asignacion.ultimaComprada;
  const pd = asignacion.primeraDescartada;
  const explicacion = [
    {
      titulo: 'Tu presupuesto y los costes',
      detalle: `Partimos de ${eur(presu)} y de un margen bruto del ${mPct}%: cada unidad cuesta el ${100 - mPct}% del PVP medio que ese producto tiene en TUS datos. Lo que no se venda se valora a liquidación (30% del PVP) — esa pérdida también cuenta.`,
    },
    {
      titulo: 'La demanda de cada producto',
      detalle: `Para los ${candidatos.length} productos con datos suficientes calculamos la demanda de las próximas ${H} semanas con el mismo motor de la pestaña Reposición: serie limpia, mejor modelo según el backtest, ajuste por ciclo de vida y simulación de cientos de escenarios.${esc !== 'esperado' ? ` El escenario ${esc} reescala esa demanda al percentil ${esc === 'conservador' ? '25 (flojo)' : '75 (fuerte)'}.` : ''}`,
    },
    {
      titulo: 'Cuánto rinde cada unidad',
      detalle: 'No todas las unidades valen lo mismo: la primera de un producto que vende seguro deja casi el margen completo; la vigésima quizá tenga un 40% de probabilidad de acabar en rebajas. A cada unidad posible le ponemos su margen esperado: probabilidad de venderla × margen, menos probabilidad de que sobre × pérdida de liquidación.',
    },
    {
      titulo: 'El reparto, por niveles de rentabilidad',
      detalle: `El presupuesto va siempre primero a las unidades que más margen esperado rinden POR EURO invertido. Cuando varias unidades de productos distintos rinden lo mismo por euro — pasa con las unidades "casi seguras" de los que venden cada semana — el presupuesto se reparte proporcionalmente entre ellas, sin favoritismos por el orden del archivo.${costeSeguro > 0 && presu < costeSeguro ? ` En tu caso, el tramo casi seguro del catálogo cuesta ≈${eur(costeSeguro)} y tu presupuesto es ${eur(presu)}: casi todo el plan es ese reparto proporcional.` : ' Por eso un producto en declive puede recibir poco aunque siga vendiendo: hay destinos donde cada euro renta más.'}`,
    },
    {
      titulo: 'Dónde se corta',
      detalle: u
        ? `La última unidad comprada (${u.nombre}) rinde ${u.margen.toFixed(1)} € de margen esperado.${pd ? ` La primera descartada (${pd.nombre}) rendiría ${pd.margen.toFixed(1)} €: ahí se acabó el presupuesto.` : ' No quedó fuera ninguna unidad rentable: el plan paró solo antes de comprar unidades que destruyen margen.'}`
        : 'No se compró ninguna unidad.',
    },
    {
      titulo: 'La comparación honesta',
      detalle: `Repartir esos mismos ${eur(presu)} proporcionalmente a lo que vendiste daría ${eur(baseline.margen)} de margen esperado; este plan da ${eur(asignacion.margenTotal)}. La diferencia (${eur(asignacion.margenTotal - baseline.margen)}) sale solo de mirar el riesgo unidad a unidad, no de vender más.`,
    },
    {
      titulo: 'El desglose por tallas y colores',
      detalle: 'Las unidades de cada producto se reparten con su curva de tallas jerárquica (producto + categoría + marca, con tallas residuales filtradas al 2%) y, si hay varios colores, con ajuste proporcional iterativo sobre tus combinaciones reales — el mismo método que la pestaña Reposición.',
    },
  ];

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
    tramoSeguro: {
      coste: costeSeguro,
      cobertura: costeSeguro > 0 ? Math.min(1, presu / costeSeguro) : 1,
    },
    baseline: {
      margen: baseline.margen,
      gastado: baseline.gastado,
      unidades: baseline.unidadesTotales,
      ventaja: asignacion.margenTotal - baseline.margen,
    },
    frontera: {
      ultimaComprada: asignacion.ultimaComprada,
      primeraDescartada: asignacion.primeraDescartada,
    },
    filas,
    excluidos,
    avisos,
    explicacion,
  };
}
