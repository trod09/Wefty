// Motor de stock — MÓDULO 1: LIMPIEZA ESTADÍSTICA.
// Antes de ajustar ningún modelo, la serie de ventas se "cura" de dos males:
//
//  1) PICOS ATÍPICOS (outliers): una semana viral o una campaña dispara las
//     ventas una vez. Si el modelo se la cree, recomendará stock para un mundo
//     que no se repite. Se detectan comparando cada semana con la MEDIANA MÓVIL
//     de su entorno: si se desvía más de 3 MAD, se amortigua (winsorizar = se
//     recorta justo al umbral) y se deja constancia con un aviso.
//
//  2) ROTURAS DE STOCK (demanda censurada): si una variante que venía vendiendo
//     cae a cero ≥3 semanas seguidas MIENTRAS sus variantes hermanas del mismo
//     producto siguen vendiendo, lo más probable no es que nadie la quisiera,
//     sino que NO HABÍA. Esas semanas se rellenan con su ritmo previo para el
//     cálculo (la demanda existía aunque la venta no), con aviso visible.
//
// Todo devuelve "flags": avisos estructurados y en lenguaje claro que la
// interfaz muestra tal cual. La transparencia es parte del producto.

function mediana(valores) {
  const s = [...valores].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ---------------------------------------------------------------------------
// amortiguarOutliers(serie) — picos >3 MAD sobre la mediana móvil (±6 semanas).
// Solo se amortiguan picos hacia ARRIBA: las caídas sostenidas las explica la
// detección de roturas, y una semana floja aislada es información válida.
// ---------------------------------------------------------------------------
export function amortiguarOutliers(serie, { ventana = 6, umbral = 3 } = {}) {
  const n = serie.length;
  const limpia = serie.slice();
  const flags = [];

  for (let t = 0; t < n; t++) {
    const a = Math.max(0, t - ventana);
    const b = Math.min(n, t + ventana + 1);
    const win = serie.slice(a, b);
    if (win.length < 5) continue; // sin contexto suficiente no se juzga a nadie

    const med = mediana(win);
    const mad = mediana(win.map((x) => Math.abs(x - med)));
    // 1.4826·MAD ≈ desviación típica robusta. El suelo (≥1 ud, ≥5% de la
    // mediana) evita declarar "atípica" cualquier variación en series casi
    // constantes, donde MAD puede ser 0.
    const sigmaRobusta = Math.max(1.4826 * mad, 1, 0.05 * med);
    const limite = med + umbral * sigmaRobusta;

    if (serie[t] > limite && serie[t] >= 5) {
      limpia[t] = Math.round(limite * 10) / 10;
      flags.push({ tipo: 'outlier', idx: t, original: serie[t], usado: limpia[t] });
    }
  }

  return { limpia, flags };
}

// ---------------------------------------------------------------------------
// detectarRoturas(producto, nSemanas) — heurística de demanda censurada.
// Para cada variante con ritmo establecido (≥0,5 uds/semana de media en las
// 4–8 semanas previas), busca tramos de ≥3 semanas a cero en los que las
// hermanas del producto SÍ vendieron (en al menos 2/3 del tramo). Devuelve
// cuántas unidades/semana hay que reponer en la serie del producto ("extra")
// y los avisos correspondientes. Si el tramo llega al final del histórico,
// puede que la rotura siga abierta AHORA: se marca aparte.
// ---------------------------------------------------------------------------
export function detectarRoturas(producto, nSemanas) {
  const extra = new Array(nSemanas).fill(0);
  const flags = [];
  if (!producto.variantes || producto.variantes.size < 2) return { extra, flags };

  for (const v of producto.variantes.values()) {
    const primera = v.primeraSemana;
    if (primera < 0) continue;

    let t = primera;
    while (t < nSemanas) {
      if (v.serie[t] !== 0) { t += 1; continue; }
      let fin = t;
      while (fin + 1 < nSemanas && v.serie[fin + 1] === 0) fin += 1;
      const largo = fin - t + 1;

      if (largo >= 3 && t > primera) {
        const desde = Math.max(primera, t - 8);
        const previas = v.serie.slice(desde, t);
        const tasa = previas.reduce((s, x) => s + x, 0) / previas.length;

        if (previas.length >= 4 && tasa >= 0.5) {
          let semanasConHermanas = 0;
          for (let w = t; w <= fin; w++) {
            if (producto.serie[w] - v.serie[w] > 0) semanasConHermanas += 1;
          }
          if (semanasConHermanas >= Math.ceil((largo * 2) / 3)) {
            for (let w = t; w <= fin; w++) extra[w] += tasa;
            flags.push({
              tipo: 'rotura', variante: v.clave,
              desde: t, hasta: fin, semanas: largo,
              tasa: Math.round(tasa * 10) / 10,
              alFinal: fin === nSemanas - 1,
            });
          }
        }
      }
      t = fin + 1;
    }
  }

  return { extra, flags };
}

// ---------------------------------------------------------------------------
// limpiarProducto(producto, nSemanas) — la limpieza completa, en orden:
// primero se reponen las roturas (suman demanda que faltaba) y después se
// amortiguan los picos sobre la serie ya repuesta.
// ---------------------------------------------------------------------------
export function limpiarProducto(producto, nSemanas) {
  const { extra, flags: flagsRotura } = detectarRoturas(producto, nSemanas);
  const conRoturas = producto.serie.map((x, i) => x + extra[i]);
  const { limpia, flags: flagsOutlier } = amortiguarOutliers(conRoturas);
  return { serieLimpia: limpia, flags: [...flagsRotura, ...flagsOutlier] };
}
