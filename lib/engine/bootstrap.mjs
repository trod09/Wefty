// Motor de stock — MÓDULO 6: INCERTIDUMBRE HONESTA (bootstrap de residuos).
// En vez de suponer que los errores siguen una campana perfecta, usamos los
// ERRORES REALES que el modelo cometió en el backtest: se remuestrean con
// reemplazo ("¿y si las próximas semanas fallan como fallaron aquellas?") y se
// simula la demanda del horizonte cientos de veces. De ahí salen percentiles
// EMPÍRICOS: el P90 es "en 9 de cada 10 simulaciones la demanda quedó por debajo".
//
// DETERMINISTA: usamos un generador con semilla fija (mulberry32). Mismos datos
// → mismas simulaciones → misma recomendación, siempre. Sin sorpresas.

export const N_SIMULACIONES = 500;
const SEMILLA = 20260101; // fija: la reproducibilidad es parte del producto

// Generador pseudoaleatorio clásico de 32 bits con semilla (mulberry32).
export function mulberry32(semilla) {
  let a = semilla >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Normal estándar determinista (Box-Muller) a partir del generador uniforme.
export function normal01(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Cuantil empírico con interpolación lineal sobre un array YA ordenado.
export function cuantil(ordenado, p) {
  const n = ordenado.length;
  if (n === 0) return 0;
  if (p <= 0) return ordenado[0];
  if (p >= 1) return ordenado[n - 1];
  const pos = p * (n - 1);
  const i = Math.floor(pos);
  const frac = pos - i;
  return ordenado[i] + frac * (ordenado[i + 1] - ordenado[i]);
}

// ---------------------------------------------------------------------------
// simularDemanda({ path, errores, sims, seed }) → { sims, ordenadas, q }
// Cada simulación recorre el horizonte semana a semana: demanda prevista de la
// semana + un error real remuestreado (sin bajar de 0), y suma el total.
// Si no hay errores que remuestrear (serie cortísima), las simulaciones son
// degeneradas (todas iguales al pronóstico) y quien llama debe avisarlo.
// ---------------------------------------------------------------------------
export function simularDemanda({ path, errores = [], sims = N_SIMULACIONES, seed = SEMILLA }) {
  const rng = mulberry32(seed);
  const nE = errores.length;
  const resultados = new Float64Array(sims);
  for (let s = 0; s < sims; s++) {
    let total = 0;
    for (let w = 0; w < path.length; w++) {
      const e = nE > 0 ? errores[Math.floor(rng() * nE)] : 0;
      total += Math.max(0, path[w] + e);
    }
    resultados[s] = total;
  }
  const ordenadas = Float64Array.from(resultados).sort();
  return {
    sims: resultados,
    ordenadas,
    q: (p) => cuantil(ordenadas, p),
    nErrores: nE,
  };
}

// ---------------------------------------------------------------------------
// riesgosPorTalla({ simsTotales, filas, seed }) — para cada talla del reparto:
//  · riesgo de ROTURA: % de simulaciones donde su demanda supera lo pedido.
//  · riesgo de REBAJA: % de simulaciones donde se queda con >30% sin vender.
// La demanda de cada talla en una simulación = total simulado × su peso, con
// ruido multinomial aproximado (no todas las semanas reparten exactamente igual).
// ---------------------------------------------------------------------------
export function riesgosPorTalla({ simsTotales, filas, seed = SEMILLA + 7 }) {
  const rng = mulberry32(seed);
  const n = simsTotales.length;
  return filas.map((f) => {
    if (f.unidades <= 0 || f.peso <= 0) return { ...f, riesgoRotura: 0, riesgoRebaja: f.peso > 0 ? 1 : 0 };
    let roturas = 0, rebajas = 0;
    for (let s = 0; s < n; s++) {
      const total = simsTotales[s];
      const media = total * f.peso;
      const sd = Math.sqrt(Math.max(0, total * f.peso * (1 - f.peso)));
      const demanda = Math.max(0, media + sd * normal01(rng));
      if (demanda > f.unidades) roturas += 1;
      else if (demanda < 0.7 * f.unidades) rebajas += 1;
    }
    return { ...f, riesgoRotura: roturas / n, riesgoRebaja: rebajas / n };
  });
}
