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
