// Motor de stock — MÓDULO 2: BACKTEST ROLLING-ORIGIN + SELECCIÓN AUTOMÁTICA.
// La única forma honesta de elegir modelo es preguntarle al pasado: nos
// situamos en varios puntos del histórico ("cortes"), entrenamos cada modelo
// solo con lo anterior, le pedimos pronosticar las 4 semanas siguientes (que
// conocemos pero él no) y medimos cuánto falla.
//
// Métrica: WAPE = Σ|previsto − real| / Σreal, agregado sobre todos los cortes.
// Es el "% de error medio ponderado": un WAPE de 0,14 = se desvía un 14%.
//
// Reglas del plan:
//  · mínimo 3 cortes (si no caben, no hay competición fiable);
//  · gana el menor WAPE; empate a ±2 puntos → media de ambos (mini-ensemble);
//  · siempre se compara contra el baseline ingenuo (o el naive estacional si
//    hay ≥52 semanas): la mejora sobre el baseline es la credencial del motor;
//  · sin backtest robusto (≥26 semanas y ≥500 uds en el dataset), no se compite:
//    reglas de pre-flight (Croston si la serie es intermitente, EWMA si no).

import { MODELOS, MODELO_POR_CLAVE, esIntermitente } from './modelos.mjs';
import { ajustarEWMA } from './forecast.mjs';

// Cortes del backtest: prueba de 4 semanas, retrocediendo de 3 en 3, con al
// menos 8 semanas de entrenamiento y máximo 6 cortes. Ej.: 19 semanas → [9,12,15].
export function planCortes(n, { test = 4, paso = 3, minTrain = 8, maxCortes = 6 } = {}) {
  const cortes = [];
  for (let o = n - test; o >= minTrain && cortes.length < maxCortes; o -= paso) cortes.push(o);
  return cortes.sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// competirModelos(serie, ctx) → { cortes, evaluaciones } o null si <3 cortes.
// evaluaciones: [{ clave, nombre, wape, rmse, errores[] }] ordenadas por WAPE.
// ---------------------------------------------------------------------------
export function competirModelos(serie, ctx) {
  const n = serie.length;
  const cortes = planCortes(n);
  if (cortes.length < 3) return null;
  const minOrigen = Math.min(...cortes);

  const candidatos = MODELOS.filter((m) =>
    n >= (m.minTotal || 1) &&
    minOrigen >= (m.minTrain || 1) &&
    (!m.requiereIndices || ctx.indices) &&
    (!m.soloIntermitente || esIntermitente(serie, ctx.intermitencia ?? 0))
  );

  const evaluaciones = [];
  for (const m of candidatos) {
    let sumaAbs = 0, sumaReal = 0, sumaCuad = 0, nErr = 0;
    const errores = [];
    for (const o of cortes) {
      const horizonte = Math.min(4, n - o);
      const path = m.ajustar(serie.slice(0, o), ctx).path(horizonte);
      for (let j = 0; j < horizonte; j++) {
        const e = path[j] - serie[o + j];
        errores.push(e);
        sumaAbs += Math.abs(e);
        sumaCuad += e * e;
        sumaReal += serie[o + j];
        nErr += 1;
      }
    }
    if (sumaReal > 0 && nErr > 0) {
      evaluaciones.push({
        clave: m.clave, nombre: m.nombre,
        wape: sumaAbs / sumaReal,
        rmse: Math.sqrt(sumaCuad / nErr),
        errores,
      });
    }
  }
  if (evaluaciones.length === 0) return null;
  evaluaciones.sort((a, b) => a.wape - b.wape);
  return { cortes: cortes.length, evaluaciones };
}

// ---------------------------------------------------------------------------
// seleccionarModelo(serie, ctx, { robusto }) → el ganador listo para usar:
// { modo, clave, nombre, ajuste, wape, rmse, errores, mejora, wapeBase,
//   baseClave, cortes, ranking, empateCon, motivoRegla }
// ---------------------------------------------------------------------------
export function seleccionarModelo(serie, ctx, { robusto } = {}) {
  // Reglas de pre-flight cuando el backtest no es fiable.
  const porRegla = (motivoRegla) => {
    const clave = esIntermitente(serie, ctx.intermitencia ?? 0) ? 'croston' : 'ewma';
    const m = MODELO_POR_CLAVE.get(clave);
    const { sigma, residuos } = ajustarEWMA(serie);
    return {
      modo: 'regla', clave, nombre: m.nombre, ajuste: m.ajustar(serie, ctx),
      wape: null, rmse: sigma, errores: residuos, mejora: null, wapeBase: null,
      baseClave: null, cortes: 0, ranking: [], empateCon: null, motivoRegla,
    };
  };

  if (!robusto) return porRegla('backtesting-no-robusto');
  const comp = competirModelos(serie, ctx);
  if (!comp) return porRegla('sin-cortes-suficientes');

  const [g1, g2] = comp.evaluaciones;
  // El baseline a batir: naive estacional si compitió; si no, el ingenuo.
  const base = comp.evaluaciones.find((e) => e.clave === 'snaive' && e !== g1)
    ?? comp.evaluaciones.find((e) => e.clave === 'ingenuo')
    ?? g1;

  let ganador;
  let empateCon = null;
  if (g2 && Math.abs(g1.wape - g2.wape) <= 0.02) {
    // Empate técnico: mini-ensemble (media de los dos pronósticos).
    const a1 = MODELO_POR_CLAVE.get(g1.clave).ajustar(serie, ctx);
    const a2 = MODELO_POR_CLAVE.get(g2.clave).ajustar(serie, ctx);
    empateCon = { clave: g2.clave, nombre: g2.nombre, wape: g2.wape };
    ganador = {
      clave: g1.clave, nombre: g1.nombre,
      ajuste: {
        path(h) {
          const p1 = a1.path(h), p2 = a2.path(h);
          return p1.map((v, i) => (v + p2[i]) / 2);
        },
      },
    };
  } else {
    ganador = { clave: g1.clave, nombre: g1.nombre, ajuste: MODELO_POR_CLAVE.get(g1.clave).ajustar(serie, ctx) };
  }

  const mejora = base.wape > 0 && base.clave !== g1.clave ? (base.wape - g1.wape) / base.wape : null;
  return {
    modo: 'backtest', ...ganador,
    wape: g1.wape, rmse: g1.rmse, errores: g1.errores,
    mejora, wapeBase: base.clave !== g1.clave ? base.wape : null, baseClave: base.clave,
    cortes: comp.cortes,
    ranking: comp.evaluaciones.map(({ clave, nombre, wape }) => ({ clave, nombre, wape })),
    empateCon, motivoRegla: null,
  };
}
