// Motor de stock — MÓDULO 4: ECONOMÍA DEL PEDIDO (modelo "newsvendor").
// Si conocemos el coste unitario, el PVP y a cuánto se liquida lo que sobra
// (default: 30% del PVP en rebajas), el nivel de servicio deja de ser un gusto
// personal y pasa a ser una CUENTA:
//
//   RATIO CRÍTICO = (PVP − coste) / (PVP − liquidación)
//
// Léelo así: quedarse corto cuesta el margen perdido (PVP − coste); pasarse
// cuesta la pérdida de liquidar (coste − liquidación). El ratio equilibra ambos
// dolores: es el percentil de demanda hasta el que conviene pedir para
// MAXIMIZAR el margen esperado. Margen alto y liquidación decente → pide alto
// (quedarse corto es carísimo). Margen fino → pide justo.
//
// Todo se evalúa sobre las simulaciones del bootstrap (demanda real posible),
// y los riesgos se traducen a EUROS: pérdida esperada por rebajas y venta
// perdida esperada.

// Validación amable de los inputs económicos. Devuelve { ok, errores[] }.
export function validarCostes({ coste, pvp, liquidacionPct }) {
  const errores = [];
  const c = Number(coste), p = Number(pvp), l = Number(liquidacionPct);
  if (!Number.isFinite(c) || c <= 0) errores.push('El coste unitario debe ser un número mayor que 0.');
  if (!Number.isFinite(p) || p <= 0) errores.push('El PVP debe ser un número mayor que 0.');
  if (!Number.isFinite(l) || l < 0 || l > 90) errores.push('El % de liquidación debe estar entre 0 y 90.');
  if (errores.length === 0 && c >= p) errores.push('El coste no puede ser mayor o igual que el PVP (no habría margen).');
  if (errores.length === 0 && (p * l) / 100 >= c) {
    errores.push('Liquidar por encima del coste no es una rebaja: baja el % de liquidación.');
  }
  return { ok: errores.length === 0, errores };
}

// Ratio crítico y valor de liquidación. El cuantil se acota a [0,50 — 0,995]:
// nunca pedimos por debajo de la mediana de demanda (el producto está vivo) ni
// perseguimos percentiles extremos que el bootstrap no puede estimar bien.
export function ratioCritico({ coste, pvp, liquidacionPct = 30 }) {
  const liqValor = (pvp * liquidacionPct) / 100;
  const crudo = (pvp - coste) / (pvp - liqValor);
  return {
    cr: Math.min(0.995, Math.max(0.5, crudo)),
    crSinAcotar: crudo,
    liqValor,
    margenUnitario: pvp - coste,
    perdidaUnitaria: coste - liqValor,
  };
}

// ---------------------------------------------------------------------------
// evaluarPedido(simsTotales, Q, { pvp, coste, liqValor }) — qué pasa, en media
// sobre todas las simulaciones de demanda, si pides Q unidades.
// ---------------------------------------------------------------------------
export function evaluarPedido(simsTotales, Q, { pvp, coste, liqValor }) {
  const n = simsTotales.length;
  if (n === 0 || Q < 0) return null;
  let ventas = 0, sobrante = 0, faltante = 0;
  for (let s = 0; s < n; s++) {
    const d = simsTotales[s];
    ventas += Math.min(d, Q);
    sobrante += Math.max(Q - d, 0);
    faltante += Math.max(d - Q, 0);
  }
  ventas /= n; sobrante /= n; faltante /= n;
  return {
    Q,
    ventasEsperadas: ventas,
    sobranteEsperado: sobrante,
    faltanteEsperado: faltante,
    perdidaRebajas: sobrante * Math.max(0, coste - liqValor),   // lo que pierdes liquidando
    ventaPerdida: faltante * Math.max(0, pvp - coste),          // margen que se escapa
    margenEsperado: pvp * ventas + liqValor * sobrante - coste * Q,
  };
}
