// Motor de stock — MÓDULO 5: CICLO DE VIDA DEL PRODUCTO.
// Una prenda no es eterna: nace (LANZAMIENTO), despega (CRECIMIENTO), se asienta
// (MADURO) y se apaga (DECLIVE). Reponer un producto en declive "al ritmo de
// siempre" fabrica sobrestock con precisión suiza. Clasificamos cada producto
// por su edad y su pendiente reciente, y en declive proyectamos a ritmo
// decreciente — con aviso, como todo en este motor.
//
// Reglas (sobre la serie LIMPIA desde la primera venta):
//  · LANZAMIENTO: menos de 8 semanas de vida.
//  · DECLIVE: pendiente relativa ≤ −3%/semana en las últimas 12 semanas,
//    sostenida (también ≤0 en las últimas 6) y con las últimas 4 semanas
//    vendiendo claramente menos que las 8 anteriores.
//  · CRECIMIENTO: pendiente ≥ +3%/semana y últimas 4 semanas claramente
//    por encima de las anteriores.
//  · MADURO: todo lo demás.

const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// Pendiente de una recta ajustada por mínimos cuadrados, en unidades RELATIVAS
// (% de la media por semana): +0,05 = crece un 5% semanal.
export function pendienteRelativa(valores) {
  const n = valores.length;
  if (n < 4) return 0;
  const tMedio = (n - 1) / 2;
  const xMedio = media(valores);
  let num = 0, den = 0;
  for (let t = 0; t < n; t++) {
    num += (t - tMedio) * (valores[t] - xMedio);
    den += (t - tMedio) * (t - tMedio);
  }
  const pendiente = den > 0 ? num / den : 0;
  return pendiente / Math.max(xMedio, 0.5);
}

// Semanas finales consecutivas a CERO (señal de producto apagado/descatalogado).
export const UMBRAL_SIN_VENTA = 8; // mínimo de semanas sin vender para sospechar
export function semanasSinVentaAlFinal(serie) {
  let g = 0;
  for (let i = serie.length - 1; i >= 0; i--) { if (serie[i] > 0) break; g += 1; }
  return g;
}

export function clasificarCiclo(serie) {
  const edad = serie.length;
  const sinVentaReciente = semanasSinVentaAlFinal(serie);
  if (edad < 8) {
    return {
      fase: 'LANZAMIENTO', edad, pendienteRel: null, sinVentaReciente,
      detalle: `${edad} semana${edad === 1 ? '' : 's'} de vida — todavía sin patrón fiable`,
    };
  }

  const pend = pendienteRelativa(serie.slice(-12));
  const pendCorta = pendienteRelativa(serie.slice(-6));
  const recientes = media(serie.slice(-4));
  const previas = media(serie.slice(-12, -4));
  const pct = (x) => `${Math.abs(Math.round(x * 100))}%`;

  if (pend <= -0.03 && pendCorta <= 0 && previas > 0 && recientes < 0.9 * previas) {
    return {
      fase: 'DECLIVE', edad, pendienteRel: pend, sinVentaReciente,
      detalle: `cayendo ≈${pct(pend)} por semana de forma sostenida (últimas 12 semanas)`,
    };
  }
  if (pend >= 0.03 && previas > 0 && recientes > 1.1 * previas) {
    return {
      fase: 'CRECIMIENTO', edad, pendienteRel: pend, sinVentaReciente,
      detalle: `subiendo ≈${pct(pend)} por semana (últimas 12 semanas)`,
    };
  }
  return {
    fase: 'MADURO', edad, pendienteRel: pend, sinVentaReciente,
    detalle: 'ritmo estable, sin tendencia fuerte reciente',
  };
}

// Marca DESCATALOGADO un producto con un tramo final largo sin ventas. Guarda
// estacional: con estacionalidad activa (≥52 semanas) y temporada alta inminente
// (índice próximo ≥1,1), el cero es fin de temporada, no descatalogación.
export function marcarDescatalogado(ciclo, { horizonte = 12, hayEstacionalidad = false, factorEstacionalProximo = null } = {}) {
  if (!ciclo || ciclo.fase === 'LANZAMIENTO') return ciclo;
  const umbral = Math.max(UMBRAL_SIN_VENTA, horizonte);
  if ((ciclo.sinVentaReciente || 0) < umbral) return ciclo;
  if (hayEstacionalidad && factorEstacionalProximo != null && factorEstacionalProximo >= 1.1) return ciclo;
  return {
    ...ciclo,
    fase: 'DESCATALOGADO',
    detalle: `sin ventas en las últimas ${ciclo.sinVentaReciente} semanas — ¿descatalogado o fin de temporada?`,
  };
}

// ---------------------------------------------------------------------------
// aplicarCiclo(path, ciclo, modeloTieneTendencia) — en DECLIVE, si el modelo
// ganador es "plano" (EWMA, Croston, ingenuo), el pronóstico se proyecta a
// ritmo decreciente: (1 + pendiente)^semana, con pendiente acotada a −15%/sem
// y un suelo del 30% del ritmo (nada cae en línea recta hasta cero).
// Si el ganador ya modela tendencia (Holt/Holt-Winters), NO se ajusta dos veces.
// ---------------------------------------------------------------------------
export function aplicarCiclo(path, ciclo, modeloTieneTendencia) {
  if (ciclo.fase !== 'DECLIVE' || modeloTieneTendencia || ciclo.pendienteRel == null) {
    return { path, ajustado: false, factorTotal: 1 };
  }
  const pend = Math.max(-0.15, ciclo.pendienteRel);
  const ajustada = path.map((v, j) => v * Math.max(0.3, Math.pow(1 + pend, j + 1)));
  const antes = path.reduce((s, x) => s + x, 0);
  const despues = ajustada.reduce((s, x) => s + x, 0);
  return { path: ajustada, ajustado: true, factorTotal: antes > 0 ? despues / antes : 1 };
}
