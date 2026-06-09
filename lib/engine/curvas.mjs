// Motor de stock — MÓDULO 3 (parte 1): CURVA DE TALLAS JERÁRQUICA + REDONDEO.
//
// ¿Qué % del pedido va a cada talla? Con muchas ventas, el propio producto lo
// dice; con pocas, su historial es ruido y conviene apoyarse en la categoría o
// en toda la marca. El SHRINKAGE encadenado mezcla los tres niveles con peso
//        w = n / (n + K)
// donde n son las unidades observadas en ese nivel y K = 200: el nivel gana el
// 50% del peso cuando acumula 200 unidades (con 600, el 75%; con 50, el 20%).
// Producto → categoría → marca: pocos datos abajo → manda el nivel de arriba.
//
// Detalles honestos:
//  · La categoría y la marca se calculan SIN el propio producto (si no, un
//    producto grande "se apoyaría en sí mismo" y la mezcla mentiría).
//  · Solo se reparten las tallas que el producto ha vendido alguna vez (no
//    sabemos su tallaje real de catálogo; inventar tallas sería peor).
//  · Tallas con peso final <2% → 0 unidades, con aviso explícito.
//  · El redondeo por MAYOR RESTO garantiza que la suma cuadre exacta.

export const K_ENCOGIMIENTO = 200; // unidades con las que un nivel gana el 50% del peso
export const PESO_MINIMO_TALLA = 0.02;

const ORDEN_TALLAS = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL'];

// Ordena tallas con sentido: letras (XS<S<M<L…), números (36<38<40), resto alfabético.
export function ordenarTallas(tallas) {
  const rango = (t) => {
    const txt = String(t).toUpperCase().trim();
    const i = ORDEN_TALLAS.indexOf(txt);
    if (i >= 0) return [0, i];
    const n = parseFloat(txt.replace(',', '.'));
    if (Number.isFinite(n)) return [1, n];
    return [2, 0];
  };
  return [...tallas].sort((a, b) => {
    const ra = rango(a), rb = rango(b);
    return ra[0] - rb[0] || ra[1] - rb[1] || String(a).localeCompare(String(b), 'es');
  });
}

// Resta dos mapas talla→unidades sin bajar de cero (para quitar el propio
// producto de su categoría y de la marca).
export function restarMapas(total, propio) {
  const r = new Map();
  for (const [k, v] of total || []) {
    const queda = v - (propio?.get(k) || 0);
    if (queda > 0) r.set(k, queda);
  }
  return r;
}

function sumaEnDominio(map, dominio) {
  let s = 0;
  for (const t of dominio) s += map?.get(t) || 0;
  return s;
}

function normalizaEnDominio(map, dominio) {
  const n = sumaEnDominio(map, dominio);
  const r = new Map();
  for (const t of dominio) r.set(t, n > 0 ? (map?.get(t) || 0) / n : 1 / dominio.length);
  return r;
}

function combina(w, a, b, dominio) {
  const r = new Map();
  for (const t of dominio) r.set(t, w * a.get(t) + (1 - w) * b.get(t));
  return r;
}

// ---------------------------------------------------------------------------
// curvaJerarquica({tallasProducto, tallasCategoria, tallasGlobal, K})
// Las tallas de categoría/marca deben venir YA sin el producto (restarMapas).
// Devuelve { dominio, curva, pesos, n } o null si el producto no tiene tallas.
// ---------------------------------------------------------------------------
export function curvaJerarquica({ tallasProducto, tallasCategoria, tallasGlobal, K = K_ENCOGIMIENTO }) {
  const dominio = ordenarTallas(
    [...(tallasProducto || [])].filter(([, uds]) => uds > 0).map(([t]) => t)
  );
  if (dominio.length === 0) return null;

  const nP = sumaEnDominio(tallasProducto, dominio);
  const nC = sumaEnDominio(tallasCategoria, dominio);
  const nG = sumaEnDominio(tallasGlobal, dominio);

  // Nivel marca (o reparto uniforme si no hay nada con qué comparar).
  let mezcla = normalizaEnDominio(tallasGlobal, dominio);

  // Nivel categoría sobre la marca.
  let wC = 0;
  if (nC > 0) {
    wC = nC / (nC + K);
    mezcla = combina(wC, normalizaEnDominio(tallasCategoria, dominio), mezcla, dominio);
  }

  // Nivel producto sobre todo lo anterior.
  const wP = nP / (nP + K);
  const curva = combina(wP, normalizaEnDominio(tallasProducto, dominio), mezcla, dominio);

  return {
    dominio,
    curva,
    // Peso efectivo de cada nivel en la mezcla final (suman 1).
    pesos: {
      producto: wP,
      categoria: (1 - wP) * wC,
      global: (1 - wP) * (1 - wC),
    },
    n: { producto: nP, categoria: nC, global: nG },
  };
}

// ---------------------------------------------------------------------------
// aplicarUmbralMinimo(curva, dominio) — tallas con peso <2% salen del reparto
// (0 unidades) con aviso, y el resto se renormaliza. Si todas quedaran fuera
// (no pasa en la práctica), no se excluye ninguna.
// ---------------------------------------------------------------------------
export function aplicarUmbralMinimo(curva, dominio, minimo = PESO_MINIMO_TALLA) {
  const dentro = dominio.filter((t) => curva.get(t) >= minimo);
  if (dentro.length === 0 || dentro.length === dominio.length) {
    return { dominio, curva, excluidas: [] };
  }
  const excluidas = dominio
    .filter((t) => curva.get(t) < minimo)
    .map((t) => ({ talla: t, peso: curva.get(t) }));
  const suma = dentro.reduce((s, t) => s + curva.get(t), 0);
  const curvaFiltrada = new Map(dentro.map((t) => [t, curva.get(t) / suma]));
  return { dominio: dentro, curva: curvaFiltrada, excluidas };
}

// ---------------------------------------------------------------------------
// desgloseTallaColor — MATRIZ TALLA × COLOR con ajuste proporcional iterativo
// (IPF/raking). El problema: el reparto debe cuadrar A LA VEZ con la curva de
// tallas y con la de colores. El IPF parte de la estructura real observada
// (qué combinaciones se venden juntas) y la reescala alternando filas y
// columnas hasta que ambas curvas cuadran.
//
//  · conjunta: Map `talla|||color` → uds observadas (la semilla de estructura;
//    se suma 0,01 a cada celda para que ninguna combinación sea imposible).
//  · repartoTallas: [{talla, unidades}] — enteros ya redondeados (mandan).
//  · pesosColores: Map color → peso relativo.
//
// Redondeo final por mayor resto FILA a FILA: cada talla cuadra EXACTA con su
// total; los colores quedan a ±1 ud de su objetivo (se muestran los reales).
// ---------------------------------------------------------------------------
export function desgloseTallaColor({ conjunta, repartoTallas, pesosColores, iteraciones = 60 }) {
  const filasNoCero = (repartoTallas || []).filter((f) => f.unidades > 0);
  const colores = [...(pesosColores || [])].filter(([c, w]) => c && w > 0).map(([c]) => c);
  if (filasNoCero.length === 0 || colores.length < 2) return null;

  const tallas = filasNoCero.map((f) => f.talla);
  const objetivoFila = filasNoCero.map((f) => f.unidades);
  const total = objetivoFila.reduce((s, x) => s + x, 0);
  const sumaPesos = colores.reduce((s, c) => s + pesosColores.get(c), 0);
  const objetivoCol = colores.map((c) => (pesosColores.get(c) / sumaPesos) * total);

  // Semilla: lo observado + 0,01 (sin celdas imposibles).
  let M = tallas.map((t) => colores.map((c) => (conjunta?.get(`${t}|||${c}`) || 0) + 0.01));

  for (let it = 0; it < iteraciones; it++) {
    for (let i = 0; i < tallas.length; i++) {
      const s = M[i].reduce((a, x) => a + x, 0);
      if (s > 0) M[i] = M[i].map((x) => (x * objetivoFila[i]) / s);
    }
    for (let j = 0; j < colores.length; j++) {
      let s = 0;
      for (let i = 0; i < tallas.length; i++) s += M[i][j];
      if (s > 0) for (let i = 0; i < tallas.length; i++) M[i][j] = (M[i][j] * objetivoCol[j]) / s;
    }
  }

  // Redondeo por mayor resto dentro de cada fila → cada talla suma exacto.
  const filas = tallas.map((talla, i) => {
    const exactos = M[i];
    const enteros = exactos.map((x) => Math.floor(x));
    let faltan = objetivoFila[i] - enteros.reduce((s, x) => s + x, 0);
    const orden = exactos
      .map((x, j) => ({ j, resto: x - Math.floor(x) }))
      .sort((a, b) => b.resto - a.resto);
    for (let k = 0; faltan > 0; k = (k + 1) % orden.length) {
      enteros[orden[k].j] += 1;
      faltan -= 1;
    }
    return { talla, celdas: enteros, total: objetivoFila[i] };
  });

  const totalesColor = colores.map((_, j) => filas.reduce((s, f) => s + f.celdas[j], 0));
  return { tallas, colores, filas, totalesColor, total };
}

// ---------------------------------------------------------------------------
// repartoPorMayorResto(curva, dominio, total) — enteros que suman EXACTO total.
// Cada talla recibe la parte entera de (peso × total); las unidades que faltan
// se reparten una a una a las fracciones más grandes.
// ---------------------------------------------------------------------------
export function repartoPorMayorResto(curva, dominio, total) {
  const filas = dominio.map((talla) => {
    const exacto = (curva.get(talla) || 0) * total;
    return { talla, peso: curva.get(talla) || 0, exacto, unidades: Math.floor(exacto) };
  });
  let faltan = total - filas.reduce((s, f) => s + f.unidades, 0);
  const porResto = [...filas].sort(
    (a, b) => (b.exacto - b.unidades) - (a.exacto - a.unidades) || b.exacto - a.exacto
  );
  for (let i = 0; faltan > 0; i = (i + 1) % porResto.length) {
    porResto[i].unidades += 1;
    faltan -= 1;
  }
  return filas.map(({ talla, peso, unidades }) => ({ talla, peso, unidades }));
}
