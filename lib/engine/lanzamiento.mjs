// Motor de stock — MODO B: LANZAMIENTO (producto nuevo, sin histórico).
// Un producto que aún no existe no tiene serie de ventas, pero TU CATÁLOGO sí
// tiene memoria: productos parecidos que ya nacieron una vez. La receta:
//
//  1) ANÁLOGOS con score transparente (se enseñan, no se esconden):
//       · misma categoría ............ +50
//       · cercanía de precio ......... +30 (proporcional a la distancia)
//       · estación de lanzamiento .... +20 (si su nacimiento es visible en tus
//         datos y cae cerca del mes actual; lanzar un bikini se parece a lanzar
//         un bikini, no a lanzar un abrigo)
//     Solo cuentan productos con ≥20 uds y ≥6 semanas de vida. Top 5.
//
//  2) CURVA DE LANZAMIENTO: cómo vendieron esos análogos sus primeras 12
//     semanas (series LIMPIAS), promediadas con su score como peso, con banda
//     P25–P75 ponderada. Si pides "sugiéremelas", el total = la suma de esa
//     curva media.
//
//  3) REPARTO por talla (curva jerárquica construida desde los análogos:
//     análogos → categoría → marca) y por color (top colores de los análogos).

import { parseDia } from './datos.mjs';
import { crearBinAt } from './estacionalidad.mjs';
import {
  curvaJerarquica, aplicarUmbralMinimo, repartoPorMayorResto, restarMapas,
  desgloseTallaColor,
} from './curvas.mjs';

export const SEMANAS_CURVA = 12;
export const MIN_UDS_ANALOGO = 20;
export const MIN_SEMANAS_ANALOGO = 6;
export const MAX_ANALOGOS = 5;
// Tope de cordura para las unidades del lanzamiento (validación amable).
export const MAX_UNIDADES_LANZAMIENTO = 1000000;

const redondea = (x) => Math.round(x * 10) / 10;

// ---------------------------------------------------------------------------
// bandasDePrecio(motor) — bandas derivadas de TUS precios (terciles del
// catálogo), no inventadas. Cada banda lleva su "centro" para medir cercanía.
// ---------------------------------------------------------------------------
export function bandasDePrecio(motor) {
  const precios = [...motor.almacen.productos.values()]
    .filter((p) => p.precioMedio > 0 && p.total > 0)
    .map((p) => p.precioMedio)
    .sort((a, b) => a - b);
  if (precios.length === 0) return [];

  const mediana = (a) => (a.length ? a[Math.floor(a.length / 2)] : 0);
  if (precios.length < 3) {
    return [{ etiqueta: `≈ ${Math.round(mediana(precios))} € (como tu catálogo)`, centro: mediana(precios) }];
  }
  const t1 = precios[Math.floor((precios.length - 1) / 3)];
  const t2 = precios[Math.floor((2 * (precios.length - 1)) / 3)];
  if (t2 - t1 < 1) {
    return [{ etiqueta: `≈ ${Math.round(mediana(precios))} € (como tu catálogo)`, centro: mediana(precios) }];
  }
  const tramo = (lo, hi) => precios.filter((x) => x >= lo && x <= hi);
  return [
    { etiqueta: `hasta ${Math.round(t1)} €`, centro: mediana(tramo(0, t1)) },
    { etiqueta: `${Math.round(t1)}–${Math.round(t2)} €`, centro: mediana(tramo(t1, t2)) },
    { etiqueta: `más de ${Math.round(t2)} €`, centro: mediana(tramo(t2, Infinity)) },
  ];
}

function distanciaMesCircular(m1, m2) {
  const d = Math.abs(m1 - m2);
  return Math.min(d, 12 - d);
}

// Estación del año de un mes (0-11): 0 invierno (dic-feb), 1 primavera,
// 2 verano, 3 otoño. Con mes de lanzamiento elegido, el score de estación se
// vuelve categórico: misma estación +20, estación vecina +10, opuesta 0.
const estacionDe = (mes0a11) => Math.floor(((mes0a11 + 1) % 12) / 3);
function puntosEstacion(mesAnalogo, mesObjetivo) {
  const d = Math.abs(estacionDe(mesAnalogo) - estacionDe(mesObjetivo));
  const dist = Math.min(d, 4 - d);
  return dist === 0 ? 20 : dist === 1 ? 10 : 0;
}

// Día del año en que empieza cada mes (año no bisiesto) → cubo semanal (0-51)
// de la semana j de un lanzamiento previsto para ese mes.
const DOY_MES = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const binDeLanzamiento = (mes1a12, j) => (Math.floor(DOY_MES[mes1a12 - 1] / 7) + j) % 52;

export const MESES_LANZAMIENTO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// ---------------------------------------------------------------------------
// posicionamientosDePrecio(motor, categoria) — Básico / Medio / Premium como
// TERCILES de los precios reales de esa categoría, con sus rangos a la vista.
// Devuelve null si la categoría no da para terciles (pocos precios o casi
// idénticos): en ese caso la UI vuelve a la banda de precio general, con aviso.
// ---------------------------------------------------------------------------
export function posicionamientosDePrecio(motor, categoria) {
  const precios = [...motor.almacen.productos.values()]
    .filter((p) => p.categoria === categoria && p.precioMedio > 0 && p.total > 0)
    .map((p) => p.precioMedio)
    .sort((a, b) => a - b);
  if (precios.length < 3) return null;
  const t1 = precios[Math.floor((precios.length - 1) / 3)];
  const t2 = precios[Math.floor((2 * (precios.length - 1)) / 3)];
  if (t2 - t1 < 1) return null;
  const f = (x) => Math.round(x);
  return {
    limites: { t1, t2 },
    opciones: [
      { clave: 'basico', etiqueta: `Básico · hasta ${f(t1)} €` },
      { clave: 'medio', etiqueta: `Medio · ${f(t1)}–${f(t2)} €` },
      { clave: 'premium', etiqueta: `Premium · más de ${f(t2)} €` },
    ],
  };
}

const TERCIL_INDICE = { basico: 0, medio: 1, premium: 2 };
const tercilDe = (precio, { t1, t2 }) => (precio <= t1 ? 0 : precio <= t2 ? 1 : 2);

// ---------------------------------------------------------------------------
// buscarAnalogos(motor, opciones) → top 5 con score abierto.
// opciones: { categoria, precioCentro, posicionamiento, mesLanzamiento }
//  · posicionamiento (opcional): { objetivo: 0|1|2, limites } → score por
//    tercil (mismo +30, vecino +15); sin él, la cercanía continua de siempre.
//  · mesLanzamiento (opcional, 1-12): score de estación categórico (misma +20,
//    vecina +10); sin él, la fórmula de siempre contra el mes de tus datos.
// ---------------------------------------------------------------------------
export function buscarAnalogos(motor, { categoria, precioCentro, posicionamiento = null, mesLanzamiento = null }) {
  const { almacen } = motor;
  const mesActual = new Date(parseDia(almacen.fechaMax)).getUTCMonth();
  const mesObjetivo = mesLanzamiento != null ? mesLanzamiento - 1 : null; // a 0-11

  const elegibles = [...almacen.productos.values()].filter((p) =>
    p.total >= MIN_UDS_ANALOGO && almacen.semanas.length - p.primeraSemana >= MIN_SEMANAS_ANALOGO);
  if (elegibles.length === 0) return [];

  const precios = elegibles.map((p) => p.precioMedio).filter((x) => x > 0);
  const rangoPrecio = Math.max(1, Math.max(...precios, 0) - Math.min(...precios, 0));

  const puntuados = elegibles.map((p) => {
    const ptsCategoria = p.categoria === categoria ? 50 : 0;
    let ptsPrecio = 0;
    if (posicionamiento && p.precioMedio > 0) {
      const distTercil = Math.abs(tercilDe(p.precioMedio, posicionamiento.limites) - posicionamiento.objetivo);
      ptsPrecio = distTercil === 0 ? 30 : distTercil === 1 ? 15 : 0;
    } else if (precioCentro > 0 && p.precioMedio > 0) {
      ptsPrecio = 30 * Math.max(0, 1 - Math.abs(p.precioMedio - precioCentro) / rangoPrecio);
    }
    // La estación solo puntúa si el nacimiento del análogo es visible en los
    // datos (si ya vendía en la primera semana del histórico, no sabemos
    // cuándo se lanzó de verdad).
    let ptsEstacion = 0;
    let estacionVisible = false;
    if (p.primeraSemana > 0) {
      estacionVisible = true;
      const mesNacimiento = new Date(parseDia(almacen.semanas[p.primeraSemana])).getUTCMonth();
      ptsEstacion = mesObjetivo != null
        ? puntosEstacion(mesNacimiento, mesObjetivo)
        : 20 * Math.max(0, 1 - distanciaMesCircular(mesNacimiento, mesActual) / 3);
    }
    return {
      nombre: p.nombre,
      categoria: p.categoria,
      unidades: p.total,
      precioMedio: p.precioMedio,
      semanasVida: almacen.semanas.length - p.primeraSemana,
      estacionVisible,
      puntos: {
        categoria: Math.round(ptsCategoria),
        precio: Math.round(ptsPrecio),
        estacion: Math.round(ptsEstacion),
      },
      score: Math.round(ptsCategoria + ptsPrecio + ptsEstacion),
    };
  });

  return puntuados.sort((a, b) => b.score - a.score).slice(0, MAX_ANALOGOS);
}

// Cuantil ponderado: ordena por valor y avanza acumulando pesos.
function cuantilPonderado(pares, q) {
  if (pares.length === 0) return 0;
  const orden = [...pares].sort((a, b) => a.v - b.v);
  const W = orden.reduce((s, x) => s + x.w, 0);
  let acumulado = 0;
  for (const { v, w } of orden) {
    acumulado += w;
    if (acumulado >= q * W) return v;
  }
  return orden[orden.length - 1].v;
}

// ---------------------------------------------------------------------------
// recomendarLanzamiento(motor, opciones)
// opciones: { categoria, precioCentro, unidadesTotales (null → sugerir),
//             nColores (null → todos los relevantes),
//             posicionamiento ('basico'|'medio'|'premium'|null),
//             mesLanzamiento (1-12|null) }
// Los inputs nuevos son opcionales: sin ellos, el cálculo es el de siempre.
// ---------------------------------------------------------------------------
export function recomendarLanzamiento(motor, {
  categoria, precioCentro = 0, unidadesTotales = null, nColores = null,
  posicionamiento = null, mesLanzamiento = null,
} = {}) {
  const { almacen } = motor;
  if (almacen.vacio) return { ok: false, motivo: 'sin-datos' };

  const avisos = [];

  // — Posicionamiento de precio por terciles de la categoría (si procede) —
  let posUsado = null;
  if (posicionamiento && TERCIL_INDICE[posicionamiento] != null) {
    const pos = posicionamientosDePrecio(motor, categoria);
    if (pos) {
      posUsado = { objetivo: TERCIL_INDICE[posicionamiento], limites: pos.limites, clave: posicionamiento };
    } else {
      avisos.push(`Los precios de «${categoria}» son demasiado parecidos o escasos para terciles — usamos la banda de precio general.`);
    }
  }

  // — Mes de lanzamiento (1-12) y estacionalidad de la categoría —
  const mesNum = Number(mesLanzamiento);
  const mesValido = mesLanzamiento != null && Number.isFinite(mesNum) && mesNum >= 1 && mesNum <= 12
    ? Math.round(mesNum) : null;
  const est = motor.estacionalidad;
  const idxCat = est ? (est.porCategoria.get(categoria) ?? est.global) : null;
  if (mesValido && !idxCat) {
    avisos.push(`Mes de lanzamiento: con ${motor.perfil.semanas} semanas de histórico (<52) no hay estacionalidad que aplicar a la curva — el mes solo afina la elección de análogos.`);
  }

  let analogos = buscarAnalogos(motor, { categoria, precioCentro, posicionamiento: posUsado, mesLanzamiento: mesValido });
  if (analogos.length === 0) return { ok: false, motivo: 'sin-analogos', minimo: MIN_UDS_ANALOGO };
  if (!analogos.some((a) => a.categoria === categoria)) {
    avisos.push(`No hay análogos con suficiente histórico en «${categoria}»: usamos los productos más parecidos del resto de tu catálogo.`);
  }

  // — Curva de lanzamiento: primeras 12 semanas de cada análogo (limpias),
  //   media y banda P25–P75 ponderadas por score.
  //   Con mes elegido Y estacionalidad activa: a cada análogo se le QUITA la
  //   estación de las semanas en que él vivió (desestacionalizar) y la curva
  //   combinada se re-estacionaliza con los índices del MES PREVISTO. Así un
  //   análogo nacido en rebajas no contamina un lanzamiento de octubre. —
  const ajustaEstacion = Boolean(mesValido && idxCat);
  const binAtAlmacen = ajustaEstacion ? crearBinAt(almacen.semanas[0]) : null;

  const seriesIniciales = analogos.map((a) => {
    const p = almacen.productos.get(a.nombre);
    const limpia = motor.limpiezas.get(a.nombre).serieLimpia;
    const tramo = limpia.slice(p.primeraSemana, p.primeraSemana + SEMANAS_CURVA);
    if (!ajustaEstacion) return tramo;
    return tramo.map((v, w) => v / (idxCat.indices[binAtAlmacen(p.primeraSemana + w)] || 1));
  });

  const curva = [];
  let sumaIdxObjetivo = 0;
  for (let w = 0; w < SEMANAS_CURVA; w++) {
    const pares = [];
    for (let i = 0; i < analogos.length; i++) {
      if (w < seriesIniciales[i].length) pares.push({ v: seriesIniciales[i][w], w: Math.max(1, analogos[i].score) });
    }
    if (pares.length === 0) break;
    const W = pares.reduce((s, x) => s + x.w, 0);
    const media = pares.reduce((s, x) => s + x.v * x.w, 0) / W;
    const factor = ajustaEstacion ? (idxCat.indices[binDeLanzamiento(mesValido, w)] || 1) : 1;
    sumaIdxObjetivo += factor;
    curva.push({
      semana: w + 1,
      media: redondea(media * factor),
      p25: redondea(cuantilPonderado(pares, 0.25) * factor),
      p75: redondea(cuantilPonderado(pares, 0.75) * factor),
      analogosConDato: pares.length,
    });
  }

  // Efecto medio de la estación sobre el horizonte (para mostrarlo en claro).
  const ajusteEstacional = ajustaEstacion && curva.length
    ? { mes: mesValido, nombreMes: MESES_LANZAMIENTO[mesValido - 1], factorMedio: sumaIdxObjetivo / curva.length }
    : null;

  const totalSugerido = Math.max(1, Math.round(curva.reduce((s, c) => s + c.media, 0)));

  // Total: el del usuario si es válido; si no, el sugerido por la curva.
  let total = totalSugerido;
  let totalEsSugerido = true;
  const totalUsuario = Number(unidadesTotales);
  if (unidadesTotales != null && unidadesTotales !== '' && Number.isFinite(totalUsuario) && totalUsuario >= 1) {
    total = Math.round(totalUsuario);
    totalEsSugerido = false;
    if (total > MAX_UNIDADES_LANZAMIENTO) {
      total = MAX_UNIDADES_LANZAMIENTO;
      avisos.push(`El tope razonable es ${MAX_UNIDADES_LANZAMIENTO.toLocaleString('es-ES')} unidades — hemos ajustado tu cifra a ese máximo.`);
    }
  } else if (unidadesTotales != null && unidadesTotales !== '') {
    avisos.push('Las unidades totales deben ser un número mayor que 0 — mientras tanto usamos la sugerencia de la curva.');
  }

  // — Reparto por talla: curva jerárquica construida DESDE los análogos —
  const tallasAnalogos = new Map();
  const coloresAnalogos = new Map();
  let unidadesAnalogos = 0;
  for (const a of analogos) {
    const p = almacen.productos.get(a.nombre);
    unidadesAnalogos += p.total;
    for (const [t, u] of p.tallas) tallasAnalogos.set(t, (tallasAnalogos.get(t) || 0) + u);
    for (const [c, u] of p.colores) coloresAnalogos.set(c, (coloresAnalogos.get(c) || 0) + u);
  }

  const cat = almacen.categorias.get(categoria);
  const jer = curvaJerarquica({
    tallasProducto: tallasAnalogos,
    tallasCategoria: restarMapas(cat?.tallas, tallasAnalogos),
    tallasGlobal: restarMapas(almacen.tallasGlobal, tallasAnalogos),
  });

  let reparto = null;
  let excluidas = [];
  let pesosCurva = null;
  if (jer) {
    const filtrado = aplicarUmbralMinimo(jer.curva, jer.dominio);
    excluidas = filtrado.excluidas;
    reparto = repartoPorMayorResto(filtrado.curva, filtrado.dominio, total);
    pesosCurva = jer.pesos;
  }

  // — Reparto por color: top colores de los análogos —
  let repartoColores = null;
  let matriz = null;
  const coloresOrdenados = [...coloresAnalogos.entries()]
    .filter(([c, u]) => c && u > 0)
    .sort((a, b) => b[1] - a[1]);
  if (coloresOrdenados.length > 0) {
    let usados = coloresOrdenados;
    const k = Number(nColores);
    if (nColores != null && nColores !== '' && Number.isFinite(k) && k >= 1) {
      if (k < coloresOrdenados.length) usados = coloresOrdenados.slice(0, Math.round(k));
      else if (k > coloresOrdenados.length) {
        avisos.push(`Pides ${Math.round(k)} colores pero tus análogos solo aportan referencia de ${coloresOrdenados.length} — repartimos entre esos.`);
      }
    }
    const suma = usados.reduce((s, [, u]) => s + u, 0);
    const curvaColor = new Map(usados.map(([c, u]) => [c, u / suma]));
    repartoColores = repartoPorMayorResto(curvaColor, usados.map(([c]) => c), total);

    // Matriz talla × color (IPF) sembrada con las combinaciones reales de los análogos.
    if (reparto && usados.length >= 2) {
      const conjunta = new Map();
      for (const a of analogos) {
        const p = almacen.productos.get(a.nombre);
        for (const v of p.variantes.values()) {
          if (v.talla && v.color) {
            const clave = `${v.talla}|||${v.color}`;
            conjunta.set(clave, (conjunta.get(clave) || 0) + v.total);
          }
        }
      }
      matriz = desgloseTallaColor({ conjunta, repartoTallas: reparto, pesosColores: curvaColor });
    }
  }

  // Confianza: un lanzamiento es siempre una apuesta → como mucho MEDIA.
  const confianza = analogos.length >= 3 && unidadesAnalogos >= 300
    ? { nivel: 'MEDIA', motivo: `${analogos.length} análogos con ${unidadesAnalogos.toLocaleString('es-ES')} uds de evidencia — un lanzamiento siempre es una apuesta` }
    : { nivel: 'BAJA', motivo: `solo ${analogos.length} análogo${analogos.length === 1 ? '' : 's'} con ${unidadesAnalogos.toLocaleString('es-ES')} uds — referencia orientativa` };

  // Explicabilidad total (módulo 8): el porqué, con los mismos números del resultado.
  const pctTxt = (x) => `${Math.round((x || 0) * 100)}%`;
  const reglaPrecio = posUsado
    ? `posicionamiento ${posUsado.clave} por terciles de la categoría (mismo tercil +30, vecino +15)`
    : 'cercanía de precio (+30 máx.)';
  const reglaEstacion = mesValido
    ? `estación de lanzamiento (misma +20, vecina +10; objetivo: ${MESES_LANZAMIENTO[mesValido - 1]})`
    : 'estación de lanzamiento similar (+20 máx.)';
  const explicacion = [
    {
      titulo: 'Análogos',
      detalle: `Buscamos en tu catálogo productos parecidos al que vas a lanzar: ${analogos.map((a) => `${a.nombre} (${a.score})`).join(', ')}. El score suma misma categoría (+50), ${reglaPrecio} y ${reglaEstacion} — la estación solo puntúa si el nacimiento del análogo es visible en tus datos.`,
    },
    {
      titulo: 'Curva de lanzamiento',
      detalle: `Tomamos las primeras ${curva.length} semanas de vida de cada análogo (ya limpias de roturas y picos), ponderadas por score → la curva media suma ${totalSugerido.toLocaleString('es-ES')} uds, con banda P25–P75 según lo dispares que fueron entre sí.` +
        (ajusteEstacional
          ? ` Lanzamiento en ${ajusteEstacional.nombreMes}: a los análogos se les quita la estación de SUS semanas y la curva se reproyecta al mes previsto — demanda inicial ${ajusteEstacional.factorMedio >= 1 ? '+' : '−'}${Math.abs(Math.round((ajusteEstacional.factorMedio - 1) * 100))}% por estacionalidad de ${categoria}.`
          : ''),
    },
    {
      titulo: 'Cantidad',
      detalle: totalEsSugerido
        ? `Sin unidades indicadas, proponemos el total de la curva: ${total.toLocaleString('es-ES')} uds para ~12 semanas.`
        : `Usamos tus ${total.toLocaleString('es-ES')} uds (la curva sugería ≈${totalSugerido.toLocaleString('es-ES')}).`,
    },
  ];
  if (reparto && pesosCurva) {
    explicacion.push({
      titulo: 'Reparto por tallas',
      detalle: `Curva jerárquica construida desde los análogos: ${pctTxt(pesosCurva.producto)} análogos + ${pctTxt(pesosCurva.categoria)} categoría + ${pctTxt(pesosCurva.global)} marca. Mayor resto: las tallas suman exactamente ${total.toLocaleString('es-ES')}.` +
        (excluidas.length ? ` Fuera por peso <2%: ${excluidas.map((e) => e.talla).join(', ')}.` : ''),
    });
  }
  if (repartoColores) {
    explicacion.push({
      titulo: 'Reparto por color',
      detalle: `Colores según lo que funcionó en tus análogos (${repartoColores.map((f) => f.talla).join(', ')})` +
        (matriz ? ', y el cruce talla × color se cuadra con ajuste proporcional iterativo (IPF) sobre sus combinaciones reales.' : '.'),
    });
  }

  return {
    ok: true,
    categoria,
    analogos,
    curva,
    totalSugerido,
    total,
    totalEsSugerido,
    reparto, excluidas, pesosCurva,
    repartoColores,
    matriz,
    unidadesAnalogos,
    posicionamiento: posUsado ? posUsado.clave : null,
    ajusteEstacional,
    avisos,
    explicacion,
    confianza,
  };
}
