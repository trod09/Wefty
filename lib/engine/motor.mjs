// Motor de stock — ORQUESTADOR (Modo A: reposición).
// Une las piezas en el orden del plan:
//   datos semanales → limpieza (roturas + outliers) → BANCO DE MODELOS con
//   selección automática por backtest (o reglas de pre-flight si el histórico
//   no da para backtest robusto) → pronóstico semana a semana sobre el
//   horizonte (espera del proveedor + 4 semanas de cobertura) → cantidad con
//   colchón según nivel de servicio → curva jerárquica de tallas → redondeo
//   exacto. Devuelve un objeto con TODOS los números y avisos que la interfaz
//   muestra: la pantalla no calcula nada, solo pinta.

import {
  construirAlmacen, perfilDelDataset, configuracionMotor, fmtFecha,
} from './datos.mjs';
import { limpiarProducto } from './limpieza.mjs';
import { Z_NIVEL } from './forecast.mjs';
import { seleccionarModelo, competirModelos } from './backtest.mjs';
import { indicesEstacionales, crearBinAt } from './estacionalidad.mjs';
import { simularDemanda, riesgosPorTalla } from './bootstrap.mjs';
import { validarCostes, ratioCritico, evaluarPedido } from './economia.mjs';
import { clasificarCiclo, aplicarCiclo } from './ciclo.mjs';
import {
  curvaJerarquica, aplicarUmbralMinimo, repartoPorMayorResto, restarMapas,
  desgloseTallaColor, PESO_MINIMO_TALLA, K_ENCOGIMIENTO,
} from './curvas.mjs';

// Por debajo de 20 unidades históricas no hay base estadística para recomendar:
// se dice claramente (y ahí es donde entrará la red de Wefty).
export const MIN_UNIDADES_PRODUCTO = 20;
export const SEMANAS_COBERTURA = 4;   // el pedido cubre la espera + este margen
export const LEAD_MIN = 1;
export const LEAD_MAX = 26;
// Umbrales de backtest robusto (módulo 0 del plan).
export const MIN_SEMANAS_BACKTEST = 26;
export const MIN_UNIDADES_BACKTEST = 500;

const fmt1 = (x) => (Math.round(x * 10) / 10).toLocaleString('es-ES');
const pctTxt = (x) => `${Math.round(x * 100)}%`;

// ---------------------------------------------------------------------------
// prepararMotor(records) — se llama UNA vez por dataset (memoizado en la UI).
// Construye el almacén semanal, el perfil, limpia todo el catálogo (barato:
// pasadas lineales) y calcula los índices estacionales si hay ≥52 semanas.
// Lo caro (backtest por producto) se hace bajo demanda al seleccionar.
// ---------------------------------------------------------------------------
export function prepararMotor(records) {
  const almacen = construirAlmacen(records);
  const perfil = perfilDelDataset(almacen);

  const limpiezas = new Map();
  const totales = { outliers: 0, roturas: 0, roturasAbiertas: 0 };
  if (!almacen.vacio) {
    for (const [nombre, p] of almacen.productos) {
      const l = limpiarProducto(p, almacen.semanas.length);
      limpiezas.set(nombre, l);
      for (const f of l.flags) {
        if (f.tipo === 'outlier') totales.outliers += 1;
        if (f.tipo === 'rotura') {
          totales.roturas += 1;
          if (f.alFinal) totales.roturasAbiertas += 1;
        }
      }
    }
  }

  // Serie semanal de toda la marca (para la validación global).
  const nSem = almacen.vacio ? 0 : almacen.semanas.length;
  const serieGlobal = new Array(nSem).fill(0);
  for (const c of almacen.categorias.values()) {
    for (let i = 0; i < nSem; i++) serieGlobal[i] += c.serie[i];
  }

  // Estacionalidad por categoría (módulo 4): solo con ≥52 semanas de histórico.
  let estacionalidad = null;
  if (!almacen.vacio && nSem >= 52) {
    const binAt = crearBinAt(almacen.semanas[0]);
    const porCategoria = new Map();
    for (const [nombre, c] of almacen.categorias) {
      const idx = indicesEstacionales(c.serie, binAt);
      if (idx) porCategoria.set(nombre, idx);
    }
    estacionalidad = { porCategoria, global: indicesEstacionales(serieGlobal, binAt) };
  }

  const robusto = !almacen.vacio
    && perfil.semanas >= MIN_SEMANAS_BACKTEST
    && perfil.totalUnidades >= MIN_UNIDADES_BACKTEST;

  const configuracion = configuracionMotor(perfil, totales);
  return {
    almacen, perfil, limpiezas, totales, configuracion, serieGlobal,
    estacionalidad, robusto, cacheValidacion: null,
  };
}

// Lista de productos para el selector, ordenados por unidades (los relevantes
// primero), con su categoría y si superan el mínimo estadístico.
export function productosOrdenados(motor) {
  return [...motor.almacen.productos.values()]
    .sort((a, b) => b.total - a.total)
    .map((p) => ({
      nombre: p.nombre,
      categoria: p.categoria,
      total: p.total,
      suficiente: p.total >= MIN_UNIDADES_PRODUCTO,
    }));
}

// Contexto que necesitan los modelos para una serie que empieza en la semana
// `offset` del almacén: índices estacionales de su categoría y semana-del-año.
function contextoSerie(motor, serie, offset, categoria) {
  const binAtAlmacen = crearBinAt(motor.almacen.semanas[0]);
  const est = motor.estacionalidad;
  const idx = est ? (est.porCategoria.get(categoria) ?? est.global) : null;
  let ceros = 0;
  for (const x of serie) if (x === 0) ceros += 1;
  return {
    indices: idx ? idx.indices : null,
    intermitencia: serie.length ? ceros / serie.length : 0,
    binAt: (i) => binAtAlmacen(offset + i),
  };
}

// Convierte los flags técnicos de la limpieza en frases para el fundador.
function flagsLegibles(flags, semanas) {
  return flags.map((f) => {
    if (f.tipo === 'outlier') {
      return {
        ...f,
        texto: `Semana del ${fmtFecha(semanas[f.idx])}: pico atípico amortiguado ` +
          `(${fmt1(f.original)} → ${fmt1(f.usado)} uds para el cálculo) — ¿campaña o viral?`,
      };
    }
    if (f.tipo === 'rotura') {
      const cuando = `del ${fmtFecha(semanas[f.desde])} al ${fmtFecha(semanas[f.hasta])}`;
      return {
        ...f,
        texto: `Variante ${f.variante}: ${f.semanas} semanas a cero (${cuando}) mientras sus ` +
          `hermanas vendían — tratado como falta de stock, no como demanda cero ` +
          `(≈${fmt1(f.tasa)} uds/sem repuestas para el cálculo).` +
          (f.alFinal ? ' Sigue a cero al final de tus datos: revisa si está agotada ahora mismo.' : ''),
      };
    }
    return { ...f, texto: '' };
  });
}

// Confianza global: volumen y recorrido de los datos + calidad del backtest.
function calcularConfianza(semanasAjuste, unidades, wape) {
  let nivel, motivo;
  if (semanasAjuste >= 20 && unidades >= 150) {
    nivel = 'ALTA';
    motivo = `${semanasAjuste} semanas y ${unidades.toLocaleString('es-ES')} uds de histórico`;
  } else if (semanasAjuste >= 10 && unidades >= 60) {
    nivel = 'MEDIA';
    motivo = `${semanasAjuste} semanas y ${unidades.toLocaleString('es-ES')} uds — suficiente, pero con margen de error`;
  } else {
    nivel = 'BAJA';
    motivo = `solo ${semanasAjuste} semanas o ${unidades.toLocaleString('es-ES')} uds — tómalo como orientación`;
  }
  // Si el backtest dice que hasta el mejor modelo falla mucho, se baja un punto.
  if (wape != null && wape > 0.45 && nivel !== 'BAJA') {
    nivel = nivel === 'ALTA' ? 'MEDIA' : 'BAJA';
    motivo += ` · el mejor modelo aún tiene un error alto (${pctTxt(wape)})`;
  }
  return { nivel, motivo };
}

// Texto en claro de la selección de modelo (la credencial del motor).
function describirSeleccion(sel, motor) {
  const { perfil } = motor;
  if (sel.modo === 'regla') {
    const motivoBT = `el backtesting se activa con ${MIN_SEMANAS_BACKTEST} semanas y ` +
      `${MIN_UNIDADES_BACKTEST} uds — tienes ${perfil.semanas} y ${perfil.totalUnidades.toLocaleString('es-ES')}`;
    if (sel.clave === 'croston') {
      return {
        resumen: `${sel.nombre} — elegido por regla (serie intermitente)`,
        detalle: motivoBT,
      };
    }
    return {
      resumen: `${sel.nombre} — por defecto`,
      detalle: sel.motivoRegla === 'sin-cortes-suficientes'
        ? 'la serie de este producto no da para 3 cortes de backtest'
        : motivoBT,
    };
  }
  const base = sel.baseClave === 'snaive' ? 'repetir el año pasado' : 'la media simple de 4 semanas';
  let detalle = `error ${pctTxt(sel.wape)} en backtest (${sel.cortes} cortes)`;
  if (sel.mejora != null && sel.mejora > 0) detalle += ` · ${pctTxt(sel.mejora)} mejor que ${base}`;
  else if (sel.mejora != null && sel.mejora <= 0) detalle += ` · sin mejora clara sobre ${base}`;
  if (sel.empateCon) detalle += ` · empate técnico con ${sel.empateCon.nombre}: usamos la media de ambos`;
  return { resumen: `${sel.nombre} — ganador del backtest`, detalle };
}

// Escenarios de demanda (módulo 6): qué percentil de las simulaciones se toma
// como demanda de planificación. Cambiar de escenario recalcula todo.
export const ESCENARIOS = { conservador: 0.25, esperado: 0.5, agresivo: 0.75 };

// ---------------------------------------------------------------------------
// recomendarReposicion(motor, opciones)
// opciones: { producto, leadSemanas, nivelServicio, escenario, costes }
//   costes (opcional): { coste, pvp, liquidacionPct } — activa el modo
//   económico: el pedido pasa a ser el que maximiza el margen esperado.
// ---------------------------------------------------------------------------
export function recomendarReposicion(motor, {
  producto, leadSemanas = 4, nivelServicio = 95, escenario = 'esperado', costes = null,
} = {}) {
  const { almacen } = motor;
  if (almacen.vacio) return { ok: false, motivo: 'sin-datos' };

  const p = almacen.productos.get(producto);
  if (!p) return { ok: false, motivo: 'no-encontrado' };
  if (p.total < MIN_UNIDADES_PRODUCTO) {
    return { ok: false, motivo: 'pocos-datos', producto, unidades: p.total, minimo: MIN_UNIDADES_PRODUCTO };
  }

  // Entradas saneadas (validación amable: se ajustan al rango en vez de romper).
  const lead = Math.min(LEAD_MAX, Math.max(LEAD_MIN, Math.round(Number(leadSemanas) || 4)));
  const nivel = Z_NIVEL[nivelServicio] ? Number(nivelServicio) : 95;
  const esc = ESCENARIOS[escenario] != null ? escenario : 'esperado';
  const avisos = [];

  // 1) Serie limpia, desde la primera venta del producto. La última semana se
  //    descarta del ajuste si está incompleta (los datos acaban a mitad de semana).
  const { serieLimpia, flags } = motor.limpiezas.get(producto);
  let fin = serieLimpia.length;
  const excluyeParcial = Boolean(almacen.semanaParcial) && fin - p.primeraSemana > 1;
  if (excluyeParcial) fin -= 1;
  const serieAjuste = serieLimpia.slice(p.primeraSemana, fin);

  // 2) Banco de modelos: competición por backtest si el histórico lo permite;
  //    si no, reglas de pre-flight (Croston si es intermitente, EWMA si no).
  const ctx = contextoSerie(motor, serieAjuste, p.primeraSemana, p.categoria);
  const sel = seleccionarModelo(serieAjuste, ctx, { robusto: motor.robusto });

  // 3) Pronóstico semana a semana. Se calcula hasta 12 semanas aunque el
  //    horizonte sea menor, para proyectar el sell-through a 8 y 12 semanas.
  const horizonte = lead + SEMANAS_COBERTURA;
  let pathLargo = sel.ajuste.path(Math.max(horizonte, 12));

  // 3b) Ciclo de vida (módulo 5): clasificar y, en declive con modelo plano,
  //     proyectar a ritmo decreciente (los modelos con tendencia ya lo hacen).
  const cicloBase = clasificarCiclo(serieAjuste);
  const tieneTendencia = ['holt', 'hw'].includes(sel.clave)
    || Boolean(sel.empateCon && ['holt', 'hw'].includes(sel.empateCon.clave));
  const ajusteCiclo = aplicarCiclo(pathLargo, cicloBase, tieneTendencia);
  pathLargo = ajusteCiclo.path;
  if (ajusteCiclo.ajustado) {
    avisos.push(`Producto en declive: reponer al ritmo histórico generaría sobrestock — ` +
      `recomendación ajustada a la baja un ${Math.round((1 - ajusteCiclo.factorTotal) * 100)}%.`);
  }
  if (cicloBase.fase === 'LANZAMIENTO') {
    avisos.push(`Producto en lanzamiento (${cicloBase.edad} semanas de vida): el pronóstico se apoya en muy poco histórico — revísalo pronto.`);
  }

  const path = pathLargo.slice(0, horizonte);
  const esperadoFino = path.reduce((s, x) => s + x, 0);
  const sigmaSemanal = sel.rmse || 0;

  // 3c) Lectura estacional del horizonte (si hay índices): ¿las próximas
  //     semanas son fuertes o flojas respecto a la media del año?
  let estacionalidad = null;
  if (ctx.indices) {
    const n = serieAjuste.length;
    let suma = 0;
    for (let j = 0; j < horizonte; j++) suma += ctx.indices[ctx.binAt(n + j)] || 1;
    estacionalidad = {
      disponible: true,
      usadaPorModelo: ['hw', 'snaive'].includes(sel.clave)
        || Boolean(sel.empateCon && ['hw', 'snaive'].includes(sel.empateCon.clave)),
      factorHorizonte: suma / horizonte,
    };
  }

  // 4) Bootstrap de residuos (determinista): la demanda del horizonte se simula
  //    500 veces remuestreando los errores reales del modelo. Percentiles
  //    empíricos, no campana teórica.
  const boot = simularDemanda({ path, errores: sel.errores });
  if (boot.nErrores < 8) {
    avisos.push(`La muestra de errores del modelo es pequeña (${boot.nErrores}): el colchón y los riesgos son orientativos.`);
  }

  // 5) Cantidad a pedir.
  //    · CON costes válidos (newsvendor): cuantil del ratio crítico → el pedido
  //      que maximiza el margen esperado. El escenario no cambia el óptimo
  //      (ya pondera todas las simulaciones), solo la lectura de demanda.
  //    · SIN costes: demanda del escenario + margen de seguridad empírico
  //      (distancia entre la mediana y el percentil del nivel de servicio).
  let economia = null;
  let erroresCostes = null;
  let recomendado;
  let demandaPlan;
  let modoCantidad = 'servicio';

  const valCostes = costes ? validarCostes({
    coste: costes.coste, pvp: costes.pvp,
    liquidacionPct: costes.liquidacionPct == null || costes.liquidacionPct === '' ? 30 : costes.liquidacionPct,
  }) : null;

  if (costes && valCostes.ok) {
    const pvpN = Number(costes.pvp);
    const costeN = Number(costes.coste);
    const liqPct = costes.liquidacionPct == null || costes.liquidacionPct === '' ? 30 : Number(costes.liquidacionPct);
    const eco = ratioCritico({ coste: costeN, pvp: pvpN, liquidacionPct: liqPct });
    recomendado = Math.max(0, Math.round(boot.q(eco.cr)));
    demandaPlan = Math.min(boot.q(0.5), recomendado);
    modoCantidad = 'economia';

    const params = { pvp: pvpN, coste: costeN, liqValor: eco.liqValor };
    const evaluacion = evaluarPedido(boot.sims, recomendado, params);
    // La comparación que pide el plan: contra "pedir la media histórica a ojo".
    const pedidoMedia = Math.max(0, Math.round((p.total / Math.max(1, serieAjuste.length)) * horizonte));
    const evaluacionMedia = evaluarPedido(boot.sims, pedidoMedia, params);
    economia = {
      ...eco, liquidacionPct: liqPct,
      evaluacion, pedidoMedia, evaluacionMedia,
      ventajaVsMedia: evaluacion.margenEsperado - evaluacionMedia.margenEsperado,
    };
  } else {
    if (costes && !valCostes.ok) erroresCostes = valCostes.errores;
    demandaPlan = boot.q(ESCENARIOS[esc]);
    const margenSeguridad = Math.max(0, boot.q(nivel / 100) - boot.q(0.5));
    recomendado = Math.max(0, Math.round(demandaPlan + margenSeguridad));
  }

  const esperadoRed = Math.min(Math.round(demandaPlan), recomendado);

  // 6) Curva de tallas jerárquica (categoría y marca SIN este producto).
  const cat = almacen.categorias.get(p.categoria);
  const jer = curvaJerarquica({
    tallasProducto: p.tallas,
    tallasCategoria: restarMapas(cat?.tallas, p.tallas),
    tallasGlobal: restarMapas(almacen.tallasGlobal, p.tallas),
  });

  let reparto = null;
  let excluidas = [];
  let pesosCurva = null;
  let tallaUnica = false;
  let matriz = null;
  if (jer) {
    const filtrado = aplicarUmbralMinimo(jer.curva, jer.dominio);
    excluidas = filtrado.excluidas;
    reparto = repartoPorMayorResto(filtrado.curva, filtrado.dominio, recomendado);
    // Riesgo de rotura y de rebaja por talla, sobre las mismas simulaciones.
    reparto = riesgosPorTalla({ simsTotales: boot.sims, filas: reparto });
    pesosCurva = jer.pesos;
    tallaUnica = jer.dominio.length === 1;

    // Matriz talla × color (IPF) si el producto tiene ≥2 colores con peso ≥2%.
    const coloresValidos = new Map(
      [...p.colores].filter(([c, u]) => c && u > 0 && u / Math.max(1, p.total) >= PESO_MINIMO_TALLA)
    );
    if (coloresValidos.size >= 2) {
      const conjunta = new Map();
      for (const v of p.variantes.values()) {
        if (v.talla && v.color) conjunta.set(`${v.talla}|||${v.color}`, v.total);
      }
      matriz = desgloseTallaColor({ conjunta, repartoTallas: reparto, pesosColores: coloresValidos });
    }
  }

  // 7) Sell-through proyectado: % del pedido vendido a las 8 y 12 semanas si
  //    la demanda sigue el pronóstico central.
  const acumulada = (w) => pathLargo.slice(0, w).reduce((s, x) => s + x, 0);
  const sellThrough = recomendado > 0
    ? { st8: Math.min(1, acumulada(8) / recomendado), st12: Math.min(1, acumulada(12) / recomendado) }
    : null;

  // 8) EXPLICABILIDAD TOTAL (módulo 8): el "porqué" paso a paso, en lenguaje
  //    de fundador. Cada número de aquí es EL MISMO que aparece en el resultado.
  const nRoturas = flags.filter((f) => f.tipo === 'rotura').length;
  const nOutliers = flags.filter((f) => f.tipo === 'outlier').length;
  const seleccion = describirSeleccion(sel, motor);
  const etiquetaEsc = esc === 'conservador' ? 'conservadora (P25)' : esc === 'agresivo' ? 'agresiva (P75)' : 'esperada (P50)';
  const explicacion = [
    {
      titulo: 'Tus datos',
      detalle: `${serieAjuste.length} semanas de ventas de ${producto} (${p.total.toLocaleString('es-ES')} uds) desde el ${fmtFecha(almacen.semanas[p.primeraSemana])}.` +
        (excluyeParcial ? ' La última semana estaba a medias y no se usa para ajustar.' : ''),
    },
    {
      titulo: 'Limpieza',
      detalle: nRoturas || nOutliers
        ? `Antes de calcular: ${nRoturas} tramo${nRoturas === 1 ? '' : 's'} de rotura repuesto${nRoturas === 1 ? '' : 's'} como demanda y ${nOutliers} pico${nOutliers === 1 ? '' : 's'} atípico${nOutliers === 1 ? '' : 's'} amortiguado${nOutliers === 1 ? '' : 's'} (detalle en los avisos).`
        : 'Serie sana: sin roturas aparentes ni picos atípicos que corregir.',
    },
    {
      titulo: 'Modelo',
      detalle: `${seleccion.resumen}. ${seleccion.detalle}. Ritmo previsto: ≈${fmt1(esperadoFino / horizonte)} uds/semana en tu horizonte de ${horizonte} semanas.`,
    },
    {
      titulo: 'Estacionalidad',
      detalle: estacionalidad
        ? `Las próximas ${horizonte} semanas vienen un ${Math.abs(Math.round((estacionalidad.factorHorizonte - 1) * 100))}% ${estacionalidad.factorHorizonte >= 1 ? 'por encima' : 'por debajo'} de la media anual${estacionalidad.usadaPorModelo ? ', y el modelo ganador ya lo incorpora' : ' (informativo: el modelo ganador es plano)'}.`
        : `Sin estacionalidad: hacen falta 52 semanas de histórico y tienes ${motor.perfil.semanas}.`,
    },
    {
      titulo: 'Ciclo de vida',
      detalle: `${cicloBase.fase.charAt(0) + cicloBase.fase.slice(1).toLowerCase()}: ${cicloBase.detalle}.` +
        (ajusteCiclo.ajustado ? ` Por estar en declive, el pronóstico se reduce un ${Math.round((1 - ajusteCiclo.factorTotal) * 100)}%.` : ''),
    },
    {
      titulo: 'Demanda simulada',
      detalle: `${boot.sims.length} simulaciones remuestreando los ${boot.nErrores} errores reales del modelo → P25 ${Math.round(boot.q(0.25)).toLocaleString('es-ES')} · P50 ${Math.round(boot.q(0.5)).toLocaleString('es-ES')} · P75 ${Math.round(boot.q(0.75)).toLocaleString('es-ES')} uds. Planificamos con la demanda ${modoCantidad === 'economia' ? 'mediana' : etiquetaEsc}: ${esperadoRed.toLocaleString('es-ES')} uds.`,
    },
    modoCantidad === 'economia'
      ? {
        titulo: 'Cantidad (economía)',
        detalle: `Ratio crítico = (PVP − coste) / (PVP − liquidación) = ${pctTxt(economia.cr)} → pedimos hasta ese percentil de demanda: ${esperadoRed.toLocaleString('es-ES')} + ${(recomendado - esperadoRed).toLocaleString('es-ES')} = ${recomendado.toLocaleString('es-ES')} uds, el pedido que maximiza tu margen esperado (${Math.round(economia.evaluacion.margenEsperado).toLocaleString('es-ES')} €).`,
      }
      : {
        titulo: 'Cantidad (nivel de servicio)',
        detalle: `Pedido = demanda ${etiquetaEsc} (${esperadoRed.toLocaleString('es-ES')}) + colchón hasta el percentil ${nivel} (${(recomendado - esperadoRed).toLocaleString('es-ES')}) = ${recomendado.toLocaleString('es-ES')} uds.`,
      },
  ];
  if (reparto) {
    explicacion.push({
      titulo: 'Reparto por tallas',
      detalle: `Curva jerárquica: ${pctTxt(pesosCurva.producto)} este producto + ${pctTxt(pesosCurva.categoria)} su categoría + ${pctTxt(pesosCurva.global)} resto de la marca (peso n/(n+${K_ENCOGIMIENTO})). Redondeo por mayor resto: las tallas suman exactamente ${recomendado.toLocaleString('es-ES')}.` +
        (excluidas.length ? ` Fuera por peso <2%: ${excluidas.map((e) => e.talla).join(', ')}.` : '') +
        (matriz ? ' El desglose por color usa ajuste proporcional iterativo (IPF) sobre tus combinaciones reales.' : ''),
    });
  }

  return {
    ok: true,
    producto, categoria: p.categoria, unidadesHistoricas: p.total,
    horizonte: { lead, cobertura: SEMANAS_COBERTURA, total: horizonte },
    nivelServicio: nivel,
    escenario: esc, modoCantidad,
    tasaSemanal: esperadoFino / horizonte, sigmaSemanal,
    esperado: esperadoRed,
    colchon: recomendado - esperadoRed,
    recomendado,
    path,
    intervalo: { p10: Math.round(boot.q(0.1)), p90: Math.round(boot.q(0.9)) },
    escenarios: {
      conservador: Math.round(boot.q(ESCENARIOS.conservador)),
      esperado: Math.round(boot.q(ESCENARIOS.esperado)),
      agresivo: Math.round(boot.q(ESCENARIOS.agresivo)),
    },
    bootstrap: { simulaciones: boot.sims.length, nErrores: boot.nErrores },
    economia, erroresCostes,
    sellThrough,
    modelo: {
      modo: sel.modo, clave: sel.clave, nombre: sel.nombre,
      wape: sel.wape, mejora: sel.mejora, wapeBase: sel.wapeBase, baseClave: sel.baseClave,
      cortes: sel.cortes, ranking: sel.ranking, empateCon: sel.empateCon,
      ...describirSeleccion(sel, motor),
    },
    intermitencia: ctx.intermitencia,
    estacionalidad,
    ciclo: { ...cicloBase, ajustado: ajusteCiclo.ajustado, factorTotal: ajusteCiclo.factorTotal },
    reparto, excluidas, pesosCurva, tallaUnica, matriz, K: K_ENCOGIMIENTO,
    semanasAjuste: serieAjuste.length,
    semanaParcialExcluida: excluyeParcial,
    avisos,
    explicacion,
    flags: flagsLegibles(flags, almacen.semanas),
    confianza: calcularConfianza(serieAjuste.length, p.total, sel.wape),
  };
}

// ---------------------------------------------------------------------------
// validacionGlobal(motor) — MÓDULO 7: la credibilidad.
// Backtest rolling-origin de toda la marca y de cada categoría con volumen
// suficiente. Si los datos no dan para una validación robusta, se dice y no se
// enseñan números débiles. Memoizada en el propio motor (es lo más caro).
// ---------------------------------------------------------------------------
export function validacionGlobal(motor) {
  if (motor.cacheValidacion) return motor.cacheValidacion;
  const { perfil, almacen } = motor;
  const resultado = {
    robusto: motor.robusto,
    semanas: perfil.semanas || 0,
    unidades: perfil.totalUnidades || 0,
    minSemanas: MIN_SEMANAS_BACKTEST,
    minUnidades: MIN_UNIDADES_BACKTEST,
    global: null,
    filas: [],
  };

  if (motor.robusto && !almacen.vacio) {
    const evaluar = (serie, offset, categoria, etiqueta, unidades) => {
      const ctx = contextoSerie(motor, serie, offset, categoria);
      const comp = competirModelos(serie, ctx);
      if (!comp) return null;
      const [g1] = comp.evaluaciones;
      const base = comp.evaluaciones.find((e) => e.clave === 'snaive' && e !== g1)
        ?? comp.evaluaciones.find((e) => e.clave === 'ingenuo')
        ?? g1;
      return {
        etiqueta, unidades,
        modelo: g1.nombre, clave: g1.clave, wape: g1.wape,
        mejora: base.wape > 0 && base.clave !== g1.clave ? (base.wape - g1.wape) / base.wape : null,
        baseClave: base.clave, cortes: comp.cortes,
      };
    };

    resultado.global = evaluar(motor.serieGlobal, 0, null, 'Toda la marca', perfil.totalUnidades);

    for (const [nombre, c] of almacen.categorias) {
      if (c.total < 200) {
        resultado.filas.push({ etiqueta: nombre, unidades: c.total, insuficiente: true });
        continue;
      }
      const primera = Math.max(0, c.serie.findIndex((x) => x > 0));
      const fila = evaluar(c.serie.slice(primera), primera, nombre, nombre, c.total);
      resultado.filas.push(fila ?? { etiqueta: nombre, unidades: c.total, insuficiente: true });
    }
    resultado.filas.sort((a, b) => b.unidades - a.unidades);
  }

  motor.cacheValidacion = resultado;
  return resultado;
}
