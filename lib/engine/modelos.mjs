// Motor de stock — MÓDULO 2: EL BANCO DE MODELOS.
// Seis pronosticadores deterministas. Todos hablan el mismo idioma:
//   modelo.ajustar(serie, ctx) → { path(h) }  →  array con la previsión de
//   unidades de cada una de las próximas h semanas.
//
// ctx (contexto) lleva lo que algunos modelos necesitan:
//   · indices: índices estacionales de la categoría (o null si no hay 52 semanas)
//   · binAt(i): semana-del-año de la posición i de la serie (también del futuro)
//   · intermitencia: % de semanas a cero de la serie
//
// Umbrales de admisión (del pre-flight, módulo 0):
//   · minTotal: semanas de histórico necesarias para considerar el modelo.
//   · minTrain: semanas mínimas de entrenamiento en cada corte del backtest
//     (si un corte no las tiene, el modelo no compite: nadie compite cojo).

import { ajustarEWMA } from './forecast.mjs';

const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const plano = (v, h) => new Array(h).fill(Math.max(0, v));

// (a) PRONÓSTICO INGENUO — media de las últimas 4 semanas. Es "extrapolar a
// ojo", lo que haría cualquiera sin motor. Nunca se desactiva: es la vara de
// medir. Si ningún modelo lo supera, se dice.
const INGENUO = {
  clave: 'ingenuo', nombre: 'Pronóstico ingenuo (media de las últimas 4 semanas)',
  minTotal: 1, minTrain: 1,
  ajustar(serie) {
    const tasa = media(serie.slice(-4));
    return { path: (h) => plano(tasa, h) };
  },
};

// (b) EWMA — media móvil exponencial con semivida de 8 semanas (ver forecast.mjs).
const EWMA = {
  clave: 'ewma', nombre: 'EWMA (media móvil exponencial)',
  minTotal: 4, minTrain: 4,
  ajustar(serie) {
    const { tasa } = ajustarEWMA(serie);
    return { path: (h) => plano(tasa, h) };
  },
};

// (c) HOLT CON TENDENCIA AMORTIGUADA — doble suavizado: nivel + tendencia.
// phi = 0,9 amortigua la tendencia (cada semana de futuro la tendencia pesa un
// 10% menos: extrapolar una racha eternamente es de novatos), y además la
// contribución total de la tendencia se limita a ±50% del nivel (cap del plan).
function ajustarHoltNucleo(serie) {
  const ALPHA = 0.25, BETA = 0.06, PHI = 0.9;
  const n = serie.length;
  let l = media(serie.slice(0, Math.min(4, n)));
  let b = n >= 8 ? (media(serie.slice(4, 8)) - media(serie.slice(0, 4))) / 4 : 0;
  for (let t = 0; t < n; t++) {
    const lPrev = l;
    l = ALPHA * serie[t] + (1 - ALPHA) * (l + PHI * b);
    b = BETA * (l - lPrev) + (1 - BETA) * PHI * b;
  }
  return {
    nivel: l, tendencia: b,
    path(h) {
      const out = [];
      let suma = 0, fphi = PHI;
      for (let j = 1; j <= h; j++) {
        suma += fphi;
        fphi *= PHI;
        const tend = Math.max(-0.5 * l, Math.min(0.5 * l, b * suma));
        out.push(Math.max(0, l + tend));
      }
      return out;
    },
  };
}

const HOLT = {
  clave: 'holt', nombre: 'Holt con tendencia amortiguada',
  minTotal: 26, minTrain: 12,
  ajustar(serie) { return ajustarHoltNucleo(serie); },
};

// (c2) HOLT-WINTERS — Holt amortiguado sobre la serie DESESTACIONALIZADA y
// re-estacionalización del pronóstico con los índices de la categoría.
const HOLT_WINTERS = {
  clave: 'hw', nombre: 'Holt-Winters (tendencia + estación)',
  minTotal: 52, minTrain: 26, requiereIndices: true,
  ajustar(serie, ctx) {
    const idx = (i) => ctx.indices[ctx.binAt(i)] || 1;
    const desestacionalizada = serie.map((x, i) => x / idx(i));
    const nucleo = ajustarHoltNucleo(desestacionalizada);
    const n = serie.length;
    return {
      ...nucleo,
      path(h) {
        return nucleo.path(h).map((v, j) => Math.max(0, v * idx(n + j)));
      },
    };
  },
};

// (a2) NAIVE ESTACIONAL — repite la misma semana del año pasado, tal cual.
// Solo existe con ≥52 semanas. Cuando está, es EL baseline a batir.
const NAIVE_ESTACIONAL = {
  clave: 'snaive', nombre: 'Naive estacional (misma semana del año pasado)',
  minTotal: 52, minTrain: 52,
  ajustar(serie) {
    const n = serie.length;
    return { path: (h) => Array.from({ length: h }, (_, j) => Math.max(0, serie[n - 52 + (j % 52)])) };
  },
};

// (d) CROSTON/SBA — para demanda INTERMITENTE (muchas semanas a cero, típico
// de variantes de moda). Estima por separado el TAMAÑO de las ventas cuando
// ocurren (z) y CADA CUÁNTO ocurren (p), y pronostica z/p con la corrección
// SBA (1 − α/2) que corrige el sesgo optimista del Croston clásico.
const CROSTON = {
  clave: 'croston', nombre: 'Croston/SBA (demanda intermitente)',
  minTotal: 8, minTrain: 8, soloIntermitente: true,
  ajustar(serie) {
    const A = 0.1;
    let z = null, p = null, gap = 0;
    for (const x of serie) {
      gap += 1;
      if (x > 0) {
        z = z == null ? x : A * x + (1 - A) * z;
        p = p == null ? gap : A * gap + (1 - A) * p;
        gap = 0;
      }
    }
    const tasa = z != null && p > 0 ? (1 - A / 2) * (z / p) : 0;
    return { path: (h) => plano(tasa, h) };
  },
};

export const MODELOS = [INGENUO, EWMA, HOLT, HOLT_WINTERS, NAIVE_ESTACIONAL, CROSTON];
export const MODELO_POR_CLAVE = new Map(MODELOS.map((m) => [m.clave, m]));

// ¿Una serie es intermitente "de manual"? (>40% de semanas a cero y al menos
// 4 semanas con venta, para que Croston tenga algo que estimar)
export function esIntermitente(serie, intermitencia) {
  return intermitencia > 0.4 && serie.filter((x) => x > 0).length >= 4;
}
