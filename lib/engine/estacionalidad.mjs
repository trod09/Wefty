// Motor de stock — ESTACIONALIDAD (se activa solo con ≥52 semanas de histórico).
// Calcula ÍNDICES SEMANALES multiplicativos: "la semana 23 del año vende un 30%
// más que una semana normal" → índice 1,30. Método clásico de descomposición:
//
//  1) El "nivel" de cada semana = media centrada de ~52 semanas (un año entero:
//     así la media contiene TODAS las estaciones y al dividir se aísla la
//     estacional; en los bordes la ventana se recorta a lo disponible).
//  2) ratio = ventas reales / nivel. Un ratio de 1,3 = semana fuerte.
//  3) Los ratios se agrupan por semana-del-año (52 cubos), se suavizan en
//     círculo (±2 semanas) y se ENCOGEN hacia 1 según cuántos años de evidencia
//     hay: con 1 solo año no se puede distinguir estación de casualidad (el
//     índice se queda casi en 1); con 2-3 años el patrón gana fuerza. Honesto.
//
// Los índices se calculan a nivel CATEGORÍA (más datos = más señal) y, si no,
// con toda la marca. Cada producto usa los de su categoría.

import { parseDia } from './datos.mjs';

const DIA_MS = 86400000;

// Cubo de semana-del-año (0..51) para un día dado: día del año / 7.
export function binSemanaAno(diaMs) {
  const d = new Date(diaMs);
  const inicioAno = Date.UTC(d.getUTCFullYear(), 0, 1);
  const doy = Math.floor((diaMs - inicioAno) / DIA_MS);
  return Math.min(51, Math.floor(doy / 7));
}

// Para una serie alineada con las semanas del almacén: bin de la posición i
// (sirve también para posiciones futuras, i ≥ n.º de semanas).
export function crearBinAt(primeraSemanaISO) {
  const base = parseDia(primeraSemanaISO);
  return (i) => binSemanaAno(base + i * 7 * DIA_MS);
}

// ---------------------------------------------------------------------------
// indicesEstacionales(serie, binAt) → Float64Array(52) con media 1, o null si
// no hay al menos 52 semanas de serie.
// ---------------------------------------------------------------------------
export function indicesEstacionales(serie, binAt) {
  const n = serie.length;
  if (n < 52) return null;

  // 1) nivel: media centrada de hasta ±26 semanas (ventana anual, recortada en
  //    los bordes) — 2) ratios por cubo del año
  const ratios = Array.from({ length: 52 }, () => []);
  for (let t = 0; t < n; t++) {
    const a = Math.max(0, t - 26);
    const b = Math.min(n, t + 27);
    let suma = 0;
    for (let k = a; k < b; k++) suma += serie[k];
    const nivel = suma / (b - a);
    if (nivel > 0.5) ratios[binAt(t)].push(serie[t] / nivel);
  }

  const crudo = ratios.map((r) => (r.length ? r.reduce((s, x) => s + x, 0) / r.length : 1));
  const nObs = ratios.map((r) => r.length);

  // 3) suavizado circular ±2 (pesos 1-2-3-2-1) + encogimiento hacia 1
  const indices = new Float64Array(52);
  const PESOS = [1, 2, 3, 2, 1];
  for (let b = 0; b < 52; b++) {
    let s = 0;
    for (let k = -2; k <= 2; k++) s += PESOS[k + 2] * crudo[(b + k + 52) % 52];
    const suave = s / 9;
    // 1 año de evidencia → efecto 0 · 2 años → 50% · 3+ años → efecto completo
    const fuerza = Math.min(1, Math.max(0, (nObs[b] - 1) / 2));
    indices[b] = 1 + (suave - 1) * fuerza;
  }

  // Normalizar para que la media sea exactamente 1 (los índices reparten, no inflan).
  const m = indices.reduce((s, x) => s + x, 0) / 52;
  for (let b = 0; b < 52; b++) indices[b] = indices[b] / m;

  const aniosMedio = nObs.reduce((s, x) => s + x, 0) / 52;
  return { indices, aniosMedio };
}
