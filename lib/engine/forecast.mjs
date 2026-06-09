// Motor de stock — MÓDULO 2 (versión mínima de la parte 1): EWMA.
// EWMA = media móvil ponderada exponencialmente. Es la forma honesta de decir
// "¿a qué ritmo vende ESTO últimamente?": cada semana nueva pesa más que la
// anterior, y el pasado se va olvidando suavemente.
//
// SEMIVIDA de 8 semanas: una venta de hace 8 semanas pesa exactamente la mitad
// que una de esta semana (y una de hace 16, la cuarta parte). De ahí sale alpha:
// (1 − alpha)^8 = 0,5  →  alpha ≈ 0,083.
//
// En la parte 2 este fichero crecerá hasta ser el "banco de modelos" (seasonal
// naive, Holt amortiguado, Holt-Winters, Croston/SBA) con selección automática
// por backtesting. EWMA quedará como uno más de los competidores.

export const SEMIVIDA_EWMA = 8; // semanas
export const ALPHA_EWMA = 1 - Math.pow(0.5, 1 / SEMIVIDA_EWMA);

// Cuantiles de la normal estándar para los niveles de servicio del selector.
// (En la parte 3 el colchón pasará a calcularse por bootstrap de residuos; la
// aproximación normal es el punto de partida y se declara como tal en el panel.)
export const Z_NIVEL = { 90: 1.2816, 95: 1.6449, 99: 2.3263 };

// ---------------------------------------------------------------------------
// ajustarEWMA(serie) → { tasa, sigma, residuos, nResiduos }
//   tasa  = unidades/semana que el producto vende "ahora mismo"
//   sigma = error típico de predicción a una semana (raíz del error cuadrático
//           medio de los últimos ≤26 errores a un paso). Mide cuánto suele
//           fallar el pronóstico, y de ahí sale el colchón de seguridad.
// ---------------------------------------------------------------------------
export function ajustarEWMA(serie, alpha = ALPHA_EWMA) {
  const n = serie.length;
  if (n === 0) return { tasa: 0, sigma: 0, residuos: [], nResiduos: 0 };

  // Arranque: media de las primeras semanas (hasta 4) para no empezar sesgados.
  const ini = Math.min(4, n);
  let s = 0;
  for (let i = 0; i < ini; i++) s += serie[i];
  s /= ini;

  const residuos = [];
  for (let t = 0; t < n; t++) {
    // Error a un paso: lo que pasó menos lo que el nivel predecía. Las dos
    // primeras semanas se saltan (el arranque las contamina).
    if (t >= 2) residuos.push(serie[t] - s);
    s = alpha * serie[t] + (1 - alpha) * s;
  }

  const usados = residuos.slice(-26);
  const sigma = usados.length
    ? Math.sqrt(usados.reduce((a, e) => a + e * e, 0) / usados.length)
    : 0;

  // Los residuos se devuelven para el bootstrap (módulo 6): remuestrear estos
  // errores reales es lo que da percentiles honestos en vez de campana teórica.
  return { tasa: Math.max(0, s), sigma, residuos: usados, nResiduos: usados.length };
}
