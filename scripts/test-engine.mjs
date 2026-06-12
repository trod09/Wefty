// Pruebas del motor de stock — se ejecutan con:  node scripts/test-engine.mjs
// Sin librerías: cada "caso" comprueba la matemática del motor contra un
// resultado calculado a mano. Si todo está bien verás ✓ en verde y "TODO OK".
// Al final hay una prueba de extremo a extremo con ventas_ejemplo_loop.csv que
// imprime la recomendación real (los mismos números que debe enseñar la web).

import fs from 'node:fs';
import {
  parseDia, lunesDe, fechaISO, construirAlmacen, perfilDelDataset,
} from '../lib/engine/datos.mjs';
import { amortiguarOutliers, limpiarProducto } from '../lib/engine/limpieza.mjs';
import { ajustarEWMA } from '../lib/engine/forecast.mjs';
import {
  curvaJerarquica, aplicarUmbralMinimo, repartoPorMayorResto, desgloseTallaColor,
} from '../lib/engine/curvas.mjs';
import { prepararMotor, recomendarReposicion, validacionGlobal } from '../lib/engine/motor.mjs';
import { planCortes, competirModelos, seleccionarModelo } from '../lib/engine/backtest.mjs';
import { indicesEstacionales } from '../lib/engine/estacionalidad.mjs';
import { mulberry32, cuantil, simularDemanda } from '../lib/engine/bootstrap.mjs';
import { validarCostes, ratioCritico, evaluarPedido } from '../lib/engine/economia.mjs';
import { clasificarCiclo, aplicarCiclo, pendienteRelativa } from '../lib/engine/ciclo.mjs';
import {
  bandasDePrecio, buscarAnalogos, recomendarLanzamiento, posicionamientosDePrecio,
} from '../lib/engine/lanzamiento.mjs';
import {
  supervivencia, margenMarginal, asignarPresupuesto, margenDePedido, generarPlanCompra,
  repartoProporcional,
} from '../lib/engine/plan.mjs';

let fallos = 0;
function caso(nombre, ok, detalle = '') {
  if (ok) console.log(`  ✓ ${nombre}`);
  else { fallos += 1; console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`); }
}
const cerca = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// Genera filas de venta semanales: un registro por semana (lunes consecutivos).
const LUNES_0 = parseDia('2026-01-05'); // lunes real
const fechaSemana = (i) => fechaISO(LUNES_0 + i * 7 * 86400000);
const fila = (i, producto, talla, uds, categoria = 'Test', color = 'Azul') => ({
  fecha: fechaSemana(i), producto, categoria, talla, color, unidades: uds, precio: 10, ingresos: uds * 10,
});

console.log('\n— Fechas y semanas —');
{
  caso('2026-01-01 (jueves) pertenece a la semana del lunes 2025-12-29',
    fechaISO(lunesDe(parseDia('2026-01-01'))) === '2025-12-29');
  caso('2026-06-08 ya es lunes: su semana empieza ese mismo día',
    fechaISO(lunesDe(parseDia('2026-06-08'))) === '2026-06-08');
  caso('una fecha imposible (2026-02-31) se rechaza', parseDia('2026-02-31') === null);
  caso('una fecha sin normalizar (31/05/2026) se rechaza', parseDia('31/05/2026') === null);
}

console.log('\n— EWMA (ritmo reciente) —');
{
  const plana = ajustarEWMA(new Array(16).fill(10));
  caso('serie constante de 10/sem → tasa exacta 10', cerca(plana.tasa, 10));
  caso('serie constante → sigma 0 (sin incertidumbre)', cerca(plana.sigma, 0));

  // Semivida: tras 8 semanas vendiendo 20 (viniendo de 10), el nivel debe estar
  // justo a mitad de camino: 15. Es la definición de "semivida 8 semanas".
  const salto = ajustarEWMA([...new Array(8).fill(10), ...new Array(8).fill(20)]);
  caso('semivida 8: tras 8 semanas a 20 (desde 10), la tasa es exactamente 15',
    cerca(salto.tasa, 15), `tasa=${salto.tasa}`);
}

console.log('\n— Limpieza: picos atípicos —');
{
  const serie = new Array(12).fill(10); serie[6] = 100;
  const { limpia, flags } = amortiguarOutliers(serie);
  caso('en 10,10,…,100,…,10 se detecta exactamente 1 pico', flags.length === 1,
    `flags=${flags.length}`);
  caso('el pico de 100 se amortigua al umbral 13 (mediana 10 + 3×suelo 1)',
    flags.length === 1 && flags[0].original === 100 && cerca(limpia[6], 13));

  const normal = amortiguarOutliers([8, 12, 9, 11, 10, 13, 9, 12, 8, 11]);
  caso('una serie con vaivén normal no genera ningún aviso', normal.flags.length === 0);
}

console.log('\n— Limpieza: roturas de stock —');
{
  // Variante S vende 5/sem 10 semanas y cae a cero 4 semanas; la M sigue a 3/sem.
  const records = [];
  for (let i = 0; i < 14; i++) {
    if (i < 10) records.push(fila(i, 'Camiseta', 'S', 5));
    records.push(fila(i, 'Camiseta', 'M', 3));
  }
  const alm = construirAlmacen(records);
  const p = alm.productos.get('Camiseta');
  const { serieLimpia, flags } = limpiarProducto(p, alm.semanas.length);
  const rot = flags.filter((f) => f.tipo === 'rotura');
  caso('se detecta 1 tramo de rotura (4 semanas a cero con la hermana vendiendo)',
    rot.length === 1 && rot[0].semanas === 4, JSON.stringify(rot));
  caso('el ritmo repuesto es el previo de la variante: 5 uds/sem',
    rot.length === 1 && cerca(rot[0].tasa, 5));
  caso('la rotura llega al final del histórico → se marca "abierta ahora"',
    rot.length === 1 && rot[0].alFinal === true);
  caso('la semana 11 del producto pasa de 3 (solo M) a 8 uds para el cálculo (3 + 5 repuestas)',
    cerca(serieLimpia[11], 8));
  caso('las semanas sin rotura no se tocan: semana 0 sigue en 8 uds (5 + 3)',
    cerca(serieLimpia[0], 8));
}

console.log('\n— Curva jerárquica (shrinkage n/(n+K), K=200) —');
{
  const jer = curvaJerarquica({
    tallasProducto: new Map([['S', 100], ['M', 100]]),       // n=200 → peso 0,5 exacto
    tallasCategoria: new Map([['S', 300], ['M', 100]]),      // n=400 → 2/3 dentro de su tramo
    tallasGlobal: new Map([['S', 100], ['M', 300]]),
  });
  caso('con 200 uds propias el producto pesa exactamente el 50%', cerca(jer.pesos.producto, 0.5));
  caso('la categoría se queda el 33,3% y la marca el 16,7% restantes',
    cerca(jer.pesos.categoria, 1 / 3, 1e-9) && cerca(jer.pesos.global, 1 / 6, 1e-9));
  caso('curva final: S = 54,17% (0,5·50% + 0,333·75% + 0,167·25%)',
    cerca(jer.curva.get('S'), 0.5416666666666666, 1e-9), `S=${jer.curva.get('S')}`);
  caso('los pesos de la mezcla suman 1',
    cerca(jer.pesos.producto + jer.pesos.categoria + jer.pesos.global, 1));
}

console.log('\n— Umbral del 2% y redondeo por mayor resto —');
{
  const dominio = ['XS', 'M', 'L'];
  const curva = new Map([['XS', 0.01], ['M', 0.59], ['L', 0.40]]);
  const filtrado = aplicarUmbralMinimo(curva, dominio);
  caso('una talla con peso 1% queda excluida con aviso',
    filtrado.excluidas.length === 1 && filtrado.excluidas[0].talla === 'XS');
  caso('el resto se renormaliza: M pasa de 59% a 59,6%',
    cerca(filtrado.curva.get('M'), 0.59 / 0.99, 1e-9));

  const reparto = repartoPorMayorResto(
    new Map([['A', 0.55], ['B', 0.27], ['C', 0.18]]), ['A', 'B', 'C'], 10
  );
  const uds = Object.fromEntries(reparto.map((r) => [r.talla, r.unidades]));
  caso('10 uds al 55/27/18% → 5, 3 y 2 (los restos .7 y .8 ganan la unidad extra)',
    uds.A === 5 && uds.B === 3 && uds.C === 2, JSON.stringify(uds));
  caso('la suma cuadra exacta con el total', reparto.reduce((s, r) => s + r.unidades, 0) === 10);
}

console.log('\n— Casos límite —');
{
  // Histórico que acaba en miércoles → la última semana está a medias y no se usa.
  const recs = [];
  for (let i = 0; i < 9; i++) recs.push(fila(i, 'Gorro', 'U', 6));
  recs.push({ ...fila(9, 'Gorro', 'U', 2), fecha: fechaISO(parseDia(fechaSemana(9)) + 2 * 86400000) }); // miércoles
  const alm = construirAlmacen(recs);
  caso('datos que acaban en miércoles → semana final marcada como parcial (3 días)',
    alm.semanaParcial && alm.semanaParcial.dias === 3);
  const motorG = prepararMotor(recs);
  const rG = recomendarReposicion(motorG, { producto: 'Gorro' });
  caso('esa semana parcial queda fuera del ajuste (9 semanas usadas de 10)',
    rG.ok && rG.semanaParcialExcluida === true && rG.semanasAjuste === 9);

  const motorMini = prepararMotor([fila(0, 'Bufanda', 'U', 5), fila(1, 'Bufanda', 'U', 6)]);
  const rMini = recomendarReposicion(motorMini, { producto: 'Bufanda' });
  caso('un producto con 11 uds históricas se bloquea (mínimo 20) con motivo claro',
    rMini.ok === false && rMini.motivo === 'pocos-datos' && rMini.unidades === 11);

  const rNada = recomendarReposicion(motorMini, { producto: 'No Existe' });
  caso('un producto inexistente devuelve error amable', rNada.ok === false && rNada.motivo === 'no-encontrado');

  const motorVacio = prepararMotor([]);
  caso('sin datos: el motor lo dice y no calcula nada',
    motorVacio.almacen.vacio === true && recomendarReposicion(motorVacio, { producto: 'X' }).motivo === 'sin-datos');
}

console.log('\n— Banco de modelos: backtest rolling-origin y selección (parte 2) —');
{
  const ctxBase = { intermitencia: 0, indices: null, binAt: (i) => i % 52 };

  caso('planCortes(19) → 3 cortes en las semanas [9, 12, 15]',
    JSON.stringify(planCortes(19)) === '[9,12,15]');
  caso('con 12 semanas no caben 3 cortes → no hay competición (honestidad)',
    competirModelos(new Array(12).fill(10), ctxBase) === null);

  // Serie plana: acertar es trivial; el ganador debe tener error 0.
  const selPlana = seleccionarModelo(new Array(30).fill(10), ctxBase, { robusto: true });
  caso('serie plana: ganador del backtest con WAPE 0', selPlana.modo === 'backtest' && cerca(selPlana.wape, 0));
  caso('serie plana: empate técnico (±2%) → mini-ensemble de los dos mejores',
    selPlana.empateCon != null && cerca(selPlana.ajuste.path(4)[0], 10, 0.2));

  // Tendencia clara: Holt amortiguado debe ganar a los modelos planos.
  const selTend = seleccionarModelo(Array.from({ length: 60 }, (_, t) => 10 + t), ctxBase, { robusto: true });
  const wapeEwmaT = selTend.ranking.find((r) => r.clave === 'ewma')?.wape;
  caso('serie con tendencia (+1/semana): gana Holt amortiguado', selTend.clave === 'holt', `ganó ${selTend.clave}`);
  caso('…con menos error que EWMA en el backtest', wapeEwmaT != null && selTend.wape < wapeEwmaT,
    `holt=${selTend.wape?.toFixed(3)} ewma=${wapeEwmaT?.toFixed(3)}`);

  // Estacionalidad perfecta de periodo 52: el naive estacional clava el backtest.
  const estacional = Array.from({ length: 110 }, (_, t) => 20 * (1 + 0.5 * Math.sin((2 * Math.PI * t) / 52)));
  const selEst = seleccionarModelo(estacional, ctxBase, { robusto: true });
  caso('serie estacional (110 semanas): gana el naive estacional con error ≈0',
    selEst.clave === 'snaive' && selEst.wape < 0.02, `ganó ${selEst.clave} (wape ${selEst.wape?.toFixed(3)})`);
  caso('…y mejora >50% sobre el pronóstico ingenuo', selEst.mejora != null && selEst.mejora > 0.5,
    `mejora=${selEst.mejora}`);

  // Intermitencia sin backtest robusto → Croston/SBA por regla de pre-flight.
  const intermitente = Array.from({ length: 40 }, (_, t) => (t % 5 === 4 ? 5 : 0));
  const selInt = seleccionarModelo(intermitente, { ...ctxBase, intermitencia: 0.8 }, { robusto: false });
  caso('serie intermitente sin backtest robusto → Croston/SBA por regla',
    selInt.modo === 'regla' && selInt.clave === 'croston');
  caso('Croston/SBA: 5 uds cada 5 semanas → tasa ≈0,95/sem (corrección 1−α/2)',
    cerca(selInt.ajuste.path(1)[0], 0.95, 0.05), `tasa=${selInt.ajuste.path(1)[0]}`);
}

console.log('\n— Estacionalidad: índices semanales (≥52 semanas) —');
{
  const serie = Array.from({ length: 110 }, (_, t) => 20 * (1 + 0.5 * Math.sin((2 * Math.PI * t) / 52)));
  const r = indicesEstacionales(serie, (i) => i % 52);
  const mediaIdx = r ? [...r.indices].reduce((s, x) => s + x, 0) / 52 : 0;
  caso('con ≥52 semanas hay índices y su media es exactamente 1', r != null && cerca(mediaIdx, 1, 1e-9));
  caso('la semana pico del año recibe índice claramente >1 (semana 13)',
    r.indices[13] > 1.1, `idx=${r.indices[13]?.toFixed(3)}`);
  caso('la semana valle recibe índice claramente <1 (semana 39)',
    r.indices[39] < 0.9, `idx=${r.indices[39]?.toFixed(3)}`);
  caso('con menos de 52 semanas devuelve null (no se inventa estación)',
    indicesEstacionales(serie.slice(0, 40), (i) => i % 52) === null);
}

console.log('\n— Bootstrap determinista (parte 3) —');
{
  const r1 = mulberry32(42), r2 = mulberry32(42);
  caso('misma semilla → misma secuencia (determinismo total)',
    r1() === r2() && r1() === r2() && r1() === r2());

  const orden = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
  caso('cuantiles empíricos: P0=1, P50=50,5, P100=100',
    cuantil(orden, 0) === 1 && cerca(cuantil(orden, 0.5), 50.5) && cuantil(orden, 1) === 100);

  const sinError = simularDemanda({ path: new Array(8).fill(10), errores: [] });
  caso('sin errores que remuestrear → todas las simulaciones = 80 exacto (degenerado y avisable)',
    cerca(sinError.q(0.05), 80) && cerca(sinError.q(0.95), 80) && sinError.nErrores === 0);

  const conError = simularDemanda({ path: new Array(8).fill(10), errores: [-3, -1, 0, 1, 3] });
  caso('con errores simétricos: la mediana queda cerca de 80 y los percentiles se abren',
    Math.abs(conError.q(0.5) - 80) < 3 && conError.q(0.9) > conError.q(0.5) && conError.q(0.1) < conError.q(0.5),
    `P10=${conError.q(0.1).toFixed(1)} P50=${conError.q(0.5).toFixed(1)} P90=${conError.q(0.9).toFixed(1)}`);
  const repe = simularDemanda({ path: new Array(8).fill(10), errores: [-3, -1, 0, 1, 3] });
  caso('mismas entradas → mismas 500 simulaciones (reproducible)',
    conError.q(0.25) === repe.q(0.25) && conError.q(0.75) === repe.q(0.75));
}

console.log('\n— Economía del pedido: newsvendor (parte 3) —');
{
  const rc = ratioCritico({ coste: 40, pvp: 100, liquidacionPct: 30 });
  caso('PVP 100€, coste 40€, liquidación 30% → ratio crítico 6/7 ≈ 85,7%',
    cerca(rc.cr, 60 / 70, 1e-9) && cerca(rc.liqValor, 30, 1e-9));

  const ev = evaluarPedido([10, 20], 15, { pvp: 100, coste: 40, liqValor: 30 });
  caso('a mano: demanda {10,20}, pido 15 → vendo 12,5, sobran 2,5, faltan 2,5',
    cerca(ev.ventasEsperadas, 12.5) && cerca(ev.sobranteEsperado, 2.5) && cerca(ev.faltanteEsperado, 2.5));
  caso('…margen esperado = 100·12,5 + 30·2,5 − 40·15 = 725€',
    cerca(ev.margenEsperado, 725));
  caso('…pérdida por rebajas 2,5·10 = 25€ y venta perdida 2,5·60 = 150€',
    cerca(ev.perdidaRebajas, 25) && cerca(ev.ventaPerdida, 150));

  // El cuantil del ratio crítico debe ganar a pedir poco y a pedir demasiado.
  const sims = Array.from({ length: 500 }, (_, i) => i + 1); // demanda uniforme 1..500
  const eco = { pvp: 100, coste: 40, liqValor: 30 };
  const Qopt = Math.round(cuantil(sims, 60 / 70));
  const mOpt = evaluarPedido(sims, Qopt, eco).margenEsperado;
  caso('newsvendor: pedir el cuantil crítico da más margen que pedir la mediana o pasarse',
    mOpt > evaluarPedido(sims, 250, eco).margenEsperado && mOpt > evaluarPedido(sims, 495, eco).margenEsperado,
    `Qopt=${Qopt}`);

  const malos = validarCostes({ coste: 50, pvp: 40, liquidacionPct: 30 });
  caso('validación amable: coste ≥ PVP se rechaza con explicación',
    !malos.ok && malos.errores.length === 1);
}

console.log('\n— Dataset sintético robusto (60 semanas, 600 uds): backtest de verdad —');
{
  const records = [];
  for (let i = 0; i < 60; i++) {
    records.push(fila(i, 'Polo Piqué', 'M', 6, 'Polos'));
    records.push(fila(i, 'Polo Piqué', 'L', 4, 'Polos'));
  }
  const motor = prepararMotor(records);
  caso('60 semanas y 600 uds → backtesting robusto ACTIVO', motor.robusto === true);
  const r = recomendarReposicion(motor, { producto: 'Polo Piqué' });
  caso('la recomendación sale de la competición (modo backtest, con WAPE medido)',
    r.ok && r.modelo.modo === 'backtest' && r.modelo.wape != null && r.modelo.cortes >= 3,
    JSON.stringify(r.modelo));
  caso('serie estable de 10/sem → pedido ≈ 80 uds para 8 semanas (error≈0 → colchón≈0)',
    r.ok && Math.abs(r.recomendado - 80) <= 4, `recomendado=${r.recomendado}`);
  const v = validacionGlobal(motor);
  caso('validación global: fila de toda la marca con sus cortes',
    v.robusto && v.global && v.global.cortes >= 3 && v.global.wape != null);
  caso('validación por categoría: Polos validado (600 uds ≥ 200)',
    v.filas.length === 1 && v.filas[0].etiqueta === 'Polos' && !v.filas[0].insuficiente);

  // — Parte 3 integrada: escenarios, riesgos, sell-through, economía —
  const rCons = recomendarReposicion(motor, { producto: 'Polo Piqué', escenario: 'conservador' });
  const rAgr = recomendarReposicion(motor, { producto: 'Polo Piqué', escenario: 'agresivo' });
  caso('escenarios: pedido conservador ≤ esperado ≤ agresivo',
    rCons.recomendado <= r.recomendado && r.recomendado <= rAgr.recomendado,
    `${rCons.recomendado} / ${r.recomendado} / ${rAgr.recomendado}`);
  caso('sell-through: vendiendo 10/sem con pedido ≈80 → ~100% vendido a las 8 semanas',
    r.sellThrough && r.sellThrough.st8 > 0.95);
  caso('riesgos por talla: presentes y acotados entre 0 y 1',
    r.reparto.every((f) => f.riesgoRotura >= 0 && f.riesgoRotura <= 1 && f.riesgoRebaja >= 0 && f.riesgoRebaja <= 1));
  caso('la banda de incertidumbre es coherente: P10 ≤ P50 ≤ P90',
    r.intervalo.p10 <= r.escenarios.esperado && r.escenarios.esperado <= r.intervalo.p90);

  const rEco = recomendarReposicion(motor, { producto: 'Polo Piqué', costes: { coste: 12, pvp: 30, liquidacionPct: 30 } });
  caso('con costes válidos entra el modo economía: cuantil crítico (30−12)/(30−9) ≈ 85,7%',
    rEco.modoCantidad === 'economia' && cerca(rEco.economia.cr, 18 / 21, 1e-9));
  caso('newsvendor integrado: el óptimo nunca da menos margen que pedir la media histórica',
    rEco.economia.ventajaVsMedia >= -0.01, `ventaja=${rEco.economia.ventajaVsMedia.toFixed(2)}€`);
  caso('costes inválidos (coste>PVP) → se ignoran con explicación y sigue el modo servicio',
    (() => {
      const rMal = recomendarReposicion(motor, { producto: 'Polo Piqué', costes: { coste: 50, pvp: 30 } });
      return rMal.modoCantidad === 'servicio' && rMal.erroresCostes?.length === 1;
    })());

  const rRepe = recomendarReposicion(motor, { producto: 'Polo Piqué' });
  caso('determinismo: dos llamadas idénticas → exactamente el mismo pedido y reparto',
    rRepe.recomendado === r.recomendado && JSON.stringify(rRepe.reparto) === JSON.stringify(r.reparto));
}

console.log('\n— Ciclo de vida del producto (parte 4) —');
{
  caso('pendiente relativa: serie 10,11,…,21 sube ≈+6,5%/semana',
    cerca(pendienteRelativa(Array.from({ length: 12 }, (_, t) => 10 + t)), 1 / 15.5, 1e-9));

  caso('5 semanas de vida → LANZAMIENTO', clasificarCiclo([3, 5, 6, 7, 8]).fase === 'LANZAMIENTO');
  caso('20 semanas estables → MADURO', clasificarCiclo(new Array(20).fill(10)).fase === 'MADURO');

  const declive = [...new Array(12).fill(20), ...Array.from({ length: 12 }, (_, t) => 20 - 1.5 * t)];
  caso('caída sostenida (20 → 3,5 en 12 semanas) → DECLIVE',
    clasificarCiclo(declive).fase === 'DECLIVE', `fase=${clasificarCiclo(declive).fase}`);

  const crecimiento = [...new Array(12).fill(5), ...Array.from({ length: 12 }, (_, t) => 5 + 1.2 * t)];
  caso('subida sostenida (5 → 18 en 12 semanas) → CRECIMIENTO',
    clasificarCiclo(crecimiento).fase === 'CRECIMIENTO', `fase=${clasificarCiclo(crecimiento).fase}`);

  const ciclo = { fase: 'DECLIVE', pendienteRel: -0.05, edad: 24 };
  const aj = aplicarCiclo(new Array(8).fill(10), ciclo, false);
  caso('declive con modelo plano: la 1ª semana baja a 9,5 y la 8ª a ≈6,6 (−5% compuesto)',
    aj.ajustado && cerca(aj.path[0], 9.5, 1e-9) && cerca(aj.path[7], 10 * Math.pow(0.95, 8), 1e-9));
  caso('…pero con Holt (que ya modela tendencia) NO se ajusta dos veces',
    aplicarCiclo(new Array(8).fill(10), ciclo, true).ajustado === false);
  caso('el suelo del 30% impide proyectar a cero: semana 40 ≥ 3 uds',
    aplicarCiclo(new Array(40).fill(10), ciclo, false).path[39] >= 3);
}

console.log('\n— Integración del ciclo y la estación en la recomendación —');
{
  // Producto en declive con histórico corto (modo regla → EWMA plano → ajusta).
  const recsDeclive = [];
  for (let i = 0; i < 20; i++) {
    const uds = i < 10 ? 18 : Math.max(2, 18 - 2 * (i - 9));
    recsDeclive.push(fila(i, 'Chaqueta Vieja', 'M', Math.round(uds * 0.6), 'Chaquetas'));
    recsDeclive.push(fila(i, 'Chaqueta Vieja', 'L', Math.round(uds * 0.4), 'Chaquetas'));
  }
  const motorD = prepararMotor(recsDeclive);
  const rD = recomendarReposicion(motorD, { producto: 'Chaqueta Vieja' });
  caso('producto cayendo → badge DECLIVE y recomendación ajustada a la baja',
    rD.ok && rD.ciclo.fase === 'DECLIVE' && rD.ciclo.ajustado === true && rD.ciclo.factorTotal < 1,
    JSON.stringify({ fase: rD.ciclo.fase, ajustado: rD.ciclo.ajustado }));
  caso('…con su aviso en claro ("generaría sobrestock")',
    rD.avisos.some((a) => a.includes('sobrestock')));

  // Producto con 5 semanas de vida → LANZAMIENTO con aviso.
  const recsNuevo = [];
  for (let i = 0; i < 5; i++) recsNuevo.push(fila(i, 'Top Nuevo', 'M', 8));
  const rN = recomendarReposicion(prepararMotor(recsNuevo), { producto: 'Top Nuevo' });
  caso('producto con 5 semanas → LANZAMIENTO con aviso de histórico corto',
    rN.ok && rN.ciclo.fase === 'LANZAMIENTO' && rN.avisos.some((a) => a.includes('lanzamiento')));

  // Producto estacional con 110 semanas: el modelo estacional gana y la
  // recomendación declara que la estación va incluida.
  const recsEst = [];
  for (let i = 0; i < 110; i++) {
    const uds = Math.max(0, Math.round(20 * (1 + 0.5 * Math.sin((2 * Math.PI * i) / 52))));
    recsEst.push(fila(i, 'Bikini Olas', 'M', uds, 'Baño'));
    recsEst.push(fila(i, 'Bikini Olas', 'L', Math.max(0, Math.round(uds * 0.5)), 'Baño'));
  }
  const motorE = prepararMotor(recsEst);
  const rE = recomendarReposicion(motorE, { producto: 'Bikini Olas' });
  caso('110 semanas estacionales → gana un modelo estacional (snaive o HW)',
    rE.ok && rE.modelo.modo === 'backtest' && ['snaive', 'hw'].includes(rE.modelo.clave),
    `ganó ${rE.modelo.clave}`);
  caso('…y la lectura estacional existe y va incluida en el pronóstico',
    rE.estacionalidad != null && rE.estacionalidad.usadaPorModelo === true
    && rE.estacionalidad.factorHorizonte > 0);
}

console.log('\n— Modo B: lanzamiento con análogos (parte 5) —');
{
  // Catálogo sintético: 2 camisetas consolidadas (30 €), 1 abrigo caro (150 €)
  // y 1 camiseta nueva lanzada a mitad del histórico.
  const recs = [];
  for (let i = 0; i < 30; i++) {
    recs.push({ ...fila(i, 'Camiseta Logo', 'M', 6, 'Camisetas', 'Negro'), precio: 30 });
    recs.push({ ...fila(i, 'Camiseta Logo', 'L', 4, 'Camisetas', 'Blanco'), precio: 30 });
    recs.push({ ...fila(i, 'Camiseta Rayas', 'M', 5, 'Camisetas', 'Azul'), precio: 32 });
    recs.push({ ...fila(i, 'Abrigo Pesado', 'M', 3, 'Abrigos', 'Negro'), precio: 150 });
  }
  for (let i = 20; i < 30; i++) recs.push({ ...fila(i, 'Camiseta Nueva', 'S', 4, 'Camisetas', 'Rosa'), precio: 28 });
  const motor = prepararMotor(recs);

  const bandas = bandasDePrecio(motor);
  caso('las bandas de precio salen de TU catálogo (terciles, 3 bandas)', bandas.length === 3,
    JSON.stringify(bandas.map((b) => b.etiqueta)));

  const analogos = buscarAnalogos(motor, { categoria: 'Camisetas', precioCentro: 30 });
  caso('los análogos de una camiseta de 30 € son las camisetas, no el abrigo',
    analogos.length >= 3 && analogos[0].categoria === 'Camisetas'
    && analogos[analogos.length - 1].nombre === 'Abrigo Pesado',
    JSON.stringify(analogos.map((a) => `${a.nombre}:${a.score}`)));
  caso('el score se desglosa en abierto (categoría 50 + precio + estación)',
    analogos[0].puntos.categoria === 50 && analogos[0].score >= 50);
  caso('un análogo nacido DENTRO del histórico puntúa estación; uno que ya vendía el día 1, no',
    analogos.some((a) => a.estacionVisible) && analogos.some((a) => !a.estacionVisible));

  const rLan = recomendarLanzamiento(motor, { categoria: 'Camisetas', precioCentro: 30 });
  caso('el lanzamiento propone curva de 12 semanas con banda P25–P75 coherente',
    rLan.ok && rLan.curva.length === 12 && rLan.curva.every((c) => c.p25 <= c.media + 1e-9 && c.media <= c.p75 + 1e-9));
  caso('total sugerido = suma de la curva media (12 semanas)',
    rLan.totalEsSugerido && Math.abs(rLan.totalSugerido - rLan.curva.reduce((s, c) => s + c.media, 0)) < 1);
  caso('el reparto por talla del lanzamiento suma EXACTO el total',
    rLan.reparto && rLan.reparto.reduce((s, f) => s + f.unidades, 0) === rLan.total);
  caso('reparto por color disponible y suma exacta',
    rLan.repartoColores && rLan.repartoColores.reduce((s, f) => s + f.unidades, 0) === rLan.total);

  const rLan500 = recomendarLanzamiento(motor, { categoria: 'Camisetas', precioCentro: 30, unidadesTotales: '500', nColores: '2' });
  caso('con 500 uds y 2 colores: reparte 500 exactas entre los 2 colores top',
    rLan500.ok && !rLan500.totalEsSugerido && rLan500.total === 500
    && rLan500.repartoColores.length === 2
    && rLan500.repartoColores.reduce((s, f) => s + f.unidades, 0) === 500);

  const rLanTope = recomendarLanzamiento(motor, { categoria: 'Camisetas', precioCentro: 30, unidadesTotales: '99999999999' });
  caso('una cifra absurda de unidades se ajusta al tope de 1.000.000 con aviso',
    rLanTope.ok && rLanTope.total === 1000000 && rLanTope.avisos.some((a) => a.includes('tope')));

  const rLanAbr = recomendarLanzamiento(motor, { categoria: 'Vestidos', precioCentro: 30 });
  caso('categoría sin análogos → aviso claro y se usan los más parecidos del catálogo',
    rLanAbr.ok && rLanAbr.avisos.some((a) => a.includes('Vestidos')));

  const rSin = recomendarLanzamiento(prepararMotor([fila(0, 'Solo', 'M', 3)]), { categoria: 'X', precioCentro: 0 });
  caso('catálogo sin productos con histórico mínimo → mensaje de la red de Wefty',
    rSin.ok === false && rSin.motivo === 'sin-analogos');

  caso('la confianza de un lanzamiento nunca pasa de MEDIA (es una apuesta)',
    ['MEDIA', 'BAJA'].includes(rLan.confianza.nivel));
}

console.log('\n— Modo B afinado: mes de lanzamiento y posicionamiento de precio —');
{
  // Catálogo con 3 camisetas a 20/30/40 € y nacimientos en meses distintos.
  // LUNES_0 es 2026-01-05: la semana 0 cae en enero (invierno).
  const recs = [];
  for (let i = 0; i < 30; i++) recs.push({ ...fila(i, 'Tee Base', 'M', 4, 'Camisetas', 'Negro'), precio: 20 });
  for (let i = 4; i < 30; i++) recs.push({ ...fila(i, 'Tee Media', 'M', 4, 'Camisetas', 'Blanco'), precio: 30 }); // nace en feb (invierno)
  for (let i = 14; i < 30; i++) recs.push({ ...fila(i, 'Tee Cara', 'M', 5, 'Camisetas', 'Azul'), precio: 40 });  // nace en abr (primavera)
  const motor = prepararMotor(recs);

  const pos = posicionamientosDePrecio(motor, 'Camisetas');
  caso('terciles de la categoría: Básico ≤20 €, Medio 20–30 €, Premium >30 €',
    pos != null && cerca(pos.limites.t1, 20) && cerca(pos.limites.t2, 30)
    && pos.opciones.map((o) => o.clave).join(',') === 'basico,medio,premium');

  const anaPremium = buscarAnalogos(motor, { categoria: 'Camisetas', posicionamiento: { objetivo: 2, limites: pos.limites } });
  const ptsPorNombre = Object.fromEntries(anaPremium.map((a) => [a.nombre, a.puntos.precio]));
  caso('posicionamiento Premium: mismo tercil +30, vecino +15, lejano 0',
    ptsPorNombre['Tee Cara'] === 30 && ptsPorNombre['Tee Media'] === 15 && ptsPorNombre['Tee Base'] === 0,
    JSON.stringify(ptsPorNombre));

  caso('una categoría con precios casi idénticos no da terciles (fallback honesto)',
    posicionamientosDePrecio(prepararMotor([
      ...Array.from({ length: 25 }, (_, i) => ({ ...fila(i, 'A', 'M', 2, 'Polos'), precio: 30 })),
      ...Array.from({ length: 25 }, (_, i) => ({ ...fila(i, 'B', 'M', 2, 'Polos'), precio: 30 })),
      ...Array.from({ length: 25 }, (_, i) => ({ ...fila(i, 'C', 'M', 2, 'Polos'), precio: 30.4 })),
    ]), 'Polos') === null);

  // Mes de lanzamiento → estaciones: feb (invierno) vs abr (primavera).
  const anaEnero = buscarAnalogos(motor, { categoria: 'Camisetas', mesLanzamiento: 1 }); // enero = invierno
  const estPorNombre = Object.fromEntries(anaEnero.map((a) => [a.nombre, a.puntos.estacion]));
  caso('mes objetivo enero: análogo nacido en invierno +20, en primavera (vecina) +10, sin nacimiento visible 0',
    estPorNombre['Tee Media'] === 20 && estPorNombre['Tee Cara'] === 10 && estPorNombre['Tee Base'] === 0,
    JSON.stringify(estPorNombre));
  const anaJulio = buscarAnalogos(motor, { categoria: 'Camisetas', mesLanzamiento: 7 }); // verano: opuesta a invierno
  caso('mes objetivo julio: el análogo de invierno puntúa 0 (estación opuesta)',
    anaJulio.find((a) => a.nombre === 'Tee Media').puntos.estacion === 0);

  // Sin estacionalidad activa (<52 semanas), el mes avisa y NO toca la curva.
  const sinMes = recomendarLanzamiento(motor, { categoria: 'Camisetas' });
  const conMes = recomendarLanzamiento(motor, { categoria: 'Camisetas', mesLanzamiento: 10 });
  caso('con 30 semanas: el mes solo afina análogos — aviso honesto y curva intacta',
    conMes.ok && conMes.ajusteEstacional === null
    && conMes.avisos.some((a) => a.includes('52'))
    && conMes.totalSugerido === sinMes.totalSugerido);

  // Con 110 semanas estacionales: lanzar en el pico pide más que en el valle.
  // Pico de la senoidal en la semana 13 desde el 5 ene → ~abril; valle ~octubre.
  const recsEst = [];
  for (let i = 0; i < 110; i++) {
    const uds = Math.max(0, Math.round(20 * (1 + 0.5 * Math.sin((2 * Math.PI * i) / 52))));
    recsEst.push(fila(i, 'Bikini Olas', 'M', uds, 'Baño'));
    recsEst.push(fila(i, 'Bikini Sol', 'L', Math.max(0, Math.round(uds * 0.6)), 'Baño'));
  }
  const motorE = prepararMotor(recsEst);
  const enPico = recomendarLanzamiento(motorE, { categoria: 'Baño', mesLanzamiento: 4 });
  const enValle = recomendarLanzamiento(motorE, { categoria: 'Baño', mesLanzamiento: 10 });
  caso('con estacionalidad activa: lanzar en el mes pico sugiere más unidades que en el valle',
    enPico.ok && enValle.ok && enPico.totalSugerido > enValle.totalSugerido,
    `pico=${enPico.totalSugerido} valle=${enValle.totalSugerido}`);
  caso('…y el efecto se declara con su factor (pico >1, valle <1)',
    enPico.ajusteEstacional.factorMedio > 1 && enValle.ajusteEstacional.factorMedio < 1,
    `factores: ${enPico.ajusteEstacional.factorMedio.toFixed(2)} / ${enValle.ajusteEstacional.factorMedio.toFixed(2)}`);
  caso('…y la explicación menciona la estacionalidad del mes elegido',
    enPico.explicacion.some((e) => e.detalle.includes('abril') && e.detalle.includes('estacionalidad')));

  // Sin tocar los inputs nuevos, el resultado es el de siempre (sin avisos nuevos).
  caso('sin mes ni posicionamiento: ni ajuste estacional ni avisos nuevos',
    sinMes.ok && sinMes.ajusteEstacional === null && sinMes.posicionamiento === null);
}

console.log('\n— Modo B: lanzamiento tipo cápsula —');
{
  const recs = [];
  for (let i = 0; i < 30; i++) {
    recs.push({ ...fila(i, 'Camiseta Logo', 'M', 6, 'Camisetas', 'Negro'), precio: 30 });
    recs.push({ ...fila(i, 'Camiseta Rayas', 'L', 4, 'Camisetas', 'Azul'), precio: 32 });
    recs.push({ ...fila(i, 'Camiseta Lisa', 'S', 5, 'Camisetas', 'Blanco'), precio: 28 });
  }
  const motor = prepararMotor(recs);

  const permanente = recomendarLanzamiento(motor, { categoria: 'Camisetas' });
  const capsula = recomendarLanzamiento(motor, { categoria: 'Camisetas', tipo: 'capsula' });
  caso('permanente por defecto: 12 semanas de curva, como siempre',
    permanente.tipo === 'permanente' && permanente.semanasVenta === 12 && permanente.curva.length === 12);
  caso('cápsula por defecto: 8 semanas de curva y aviso de "agotar"',
    capsula.tipo === 'capsula' && capsula.semanasVenta === 8 && capsula.curva.length === 8
    && capsula.avisos.some((a) => a.includes('agotar')), JSON.stringify(capsula.avisos));
  caso('el total de la cápsula es la banda conservadora: suma de P25 de su curva',
    capsula.totalEsSugerido
    && capsula.totalSugerido === Math.max(1, Math.round(capsula.curva.reduce((s, c) => s + c.p25, 0))));
  caso('cápsula (8 sem, P25) sugiere menos unidades que permanente (12 sem, media)',
    capsula.totalSugerido < permanente.totalSugerido,
    `capsula=${capsula.totalSugerido} permanente=${permanente.totalSugerido}`);
  caso('el reparto por tallas de la cápsula sigue sumando exacto',
    capsula.reparto && capsula.reparto.reduce((s, f) => s + f.unidades, 0) === capsula.total);

  const corta = recomendarLanzamiento(motor, { categoria: 'Camisetas', tipo: 'capsula', semanasCapsula: '1' });
  caso('cápsula de 1 semana → se ajusta al mínimo de 3 con aviso',
    corta.semanasVenta === 3 && corta.curva.length === 3 && corta.avisos.some((a) => a.includes('mínimo')));
  const larga = recomendarLanzamiento(motor, { categoria: 'Camisetas', tipo: 'capsula', semanasCapsula: 20 });
  caso('cápsula de 20 semanas → se ajusta al máximo de 12 con aviso',
    larga.semanasVenta === 12 && larga.avisos.some((a) => a.includes('máximo') || a.includes('12')));

  const capsulaUds = recomendarLanzamiento(motor, { categoria: 'Camisetas', tipo: 'capsula', unidadesTotales: '300' });
  caso('cápsula con unidades del usuario: manda tu cifra (300) y se mantiene el encuadre de agotar',
    !capsulaUds.totalEsSugerido && capsulaUds.total === 300 && capsulaUds.avisos.some((a) => a.includes('agotar')));
  caso('la explicación de la cápsula declara la banda P25 y las semanas',
    capsula.explicacion.some((e) => e.titulo === 'Cantidad' && e.detalle.includes('P25') && e.detalle.includes('8 semanas')));
}

console.log('\n— Matriz talla × color con IPF (parte 6) —');
{
  // Semilla con estructura clara: la S se vende en rojo, la M en azul.
  const m = desgloseTallaColor({
    conjunta: new Map([['S|||Rojo', 10], ['S|||Azul', 1], ['M|||Rojo', 1], ['M|||Azul', 10]]),
    repartoTallas: [{ talla: 'S', unidades: 6 }, { talla: 'M', unidades: 4 }],
    pesosColores: new Map([['Rojo', 0.5], ['Azul', 0.5]]),
  });
  caso('IPF: cada talla cuadra EXACTA con su total (6 y 4)',
    m != null && m.filas[0].total === 6 && m.filas[1].total === 4
    && m.filas.every((f) => f.celdas.reduce((s, x) => s + x, 0) === f.total));
  caso('IPF: los colores quedan a ±1 de su objetivo (5 y 5) y el total cuadra',
    m.totalesColor.every((t) => Math.abs(t - 5) <= 1)
    && m.totalesColor.reduce((s, x) => s + x, 0) === 10);
  const iR = m.colores.indexOf('Rojo'), iA = m.colores.indexOf('Azul');
  caso('IPF respeta tus combinaciones reales: la S sale mayormente roja y la M azul',
    m.filas[0].celdas[iR] > m.filas[0].celdas[iA] && m.filas[1].celdas[iA] > m.filas[1].celdas[iR],
    JSON.stringify(m.filas));
  caso('con un solo color no hay matriz (no aporta nada)',
    desgloseTallaColor({
      conjunta: new Map(), repartoTallas: [{ talla: 'S', unidades: 5 }],
      pesosColores: new Map([['Rojo', 1]]),
    }) === null);
}

console.log('\n— Plan de compra: asignación greedy verificada a mano (parte 1) —');
{
  // Tres productos de juguete con demanda conocida:
  //  A: vende 10 SEGURO   · coste 40 € · margen 60 € · pérdida 10 €
  //  B: vende 5 seguro y 10 la mitad de las veces · coste 20 € · margen 30 € · pérdida 5 €
  //  C: vende 2 SEGURO    · coste 80 € · margen 120 € · pérdida 20 €
  const mk = (ordenadas, margen, perdida) => (n) => margenMarginal(supervivencia(ordenadas, n), margen, perdida);
  const A = { nombre: 'A', coste: 40, marginal: mk([10], 60, 10) };
  const B = { nombre: 'B', coste: 20, marginal: mk([5, 10], 30, 5) };
  const C = { nombre: 'C', coste: 80, marginal: mk([2], 120, 20) };

  caso('supervivencia: P(D≥6) con sims {5,10} es exactamente 0,5', cerca(supervivencia([5, 10], 6), 0.5));
  caso('marginal de B en la unidad 6: 0,5·30 − 0,5·5 = 12,5 €', cerca(B.marginal(6), 12.5));
  caso('marginal de A en la unidad 11 (ya no se vende): −10 €', cerca(A.marginal(11), -10));

  // A MANO con 700 €: las unidades seguras de los tres rinden igual por euro
  // (1,5 €/€) y cuestan 400+100+160 = 660 €; con los 40 € restantes entran las
  // unidades 6 y 7 de B (12,5 € cada una, 0,625 €/€) → A=10 · B=7 · C=2,
  // gastado 700 €, margen esperado 600+150+240+25 = 1.015 €.
  const r700 = asignarPresupuesto([A, B, C], 700);
  caso('greedy con 700 €: compra A=10, B=7, C=2',
    r700.unidades.get('A') === 10 && r700.unidades.get('B') === 7 && r700.unidades.get('C') === 2,
    JSON.stringify([...r700.unidades]));
  caso('…gastando los 700 € exactos', cerca(r700.gastado, 700));
  caso('…con margen esperado de 1.015 € clavado a mano', cerca(r700.margenTotal, 1015));
  caso('…última comprada: unidad incierta de B a 12,5 € de margen',
    r700.ultimaComprada.nombre === 'B' && cerca(r700.ultimaComprada.margen, 12.5));
  caso('…primera descartada: la siguiente de B (12,5 €) que ya no cabía',
    r700.primeraDescartada && r700.primeraDescartada.nombre === 'B' && cerca(r700.primeraDescartada.margen, 12.5));

  // Con 2.000 €: compra todo lo rentable (A=10, B=10, C=2 → 760 €) y PARA —
  // ninguna unidad más tiene margen positivo. Sobran 1.240 € a propósito.
  const r2000 = asignarPresupuesto([A, B, C], 2000);
  caso('con 2.000 €: para en A=10, B=10, C=2 (760 €) — comprar más destruiría margen',
    r2000.unidades.get('B') === 10 && cerca(r2000.gastado, 760) && r2000.primeraDescartada === null);
  caso('…margen esperado 1.052,5 € (incluye las 5 uds inciertas de B a 12,5 €)',
    cerca(r2000.margenTotal, 1052.5));

  caso('con 15 € (menos que la unidad más barata) no se compra nada',
    asignarPresupuesto([A, B, C], 15).gastado === 0);
  caso('margenDePedido(B, 7) = 5×30 + 2×12,5 = 175 €', cerca(margenDePedido(B.marginal, 7), 175));
}

console.log('\n— Plan de compra: reparto proporcional por niveles (arreglo del empate) —');
{
  const mk = (ordenadas, margen, perdida) => (n) => margenMarginal(supervivencia(ordenadas, n), margen, perdida);
  // Tres productos cuyas unidades "casi seguras" rinden EXACTAMENTE 1,5 €/€:
  //  P1: 30 uds seguras a coste 10 · P2: 10 a coste 20 · P3: 20 a coste 5.
  //  El nivel entero cuesta 600 €.
  const productos = [
    { nombre: 'P1', coste: 10, marginal: mk([30], 15, 2.5) },
    { nombre: 'P2', coste: 20, marginal: mk([10], 30, 5) },
    { nombre: 'P3', coste: 5,  marginal: mk([20], 7.5, 1.25) },
  ];
  // 300 € = la mitad justa del nivel → cada producto recibe la mitad de sus
  // seguras: P1 15, P2 5, P3 10 (150+100+50 = 300 € exactos).
  const r1 = asignarPresupuesto(productos, 300);
  caso('racionamiento a mano (300 € sobre un nivel de 600 €): P1=15, P2=5, P3=10',
    r1.unidades.get('P1') === 15 && r1.unidades.get('P2') === 5 && r1.unidades.get('P3') === 10,
    JSON.stringify([...r1.unidades]));
  caso('…gasta los 300 € exactos con margen 450 € (1,5 € por euro, clavado)',
    cerca(r1.gastado, 300) && cerca(r1.margenTotal, 450));
  // 290 €: bases 14/4/9 (265 €); los 25 € restantes van por mayor resto a
  // P2 (resto 0,83 → 20 €) y P3 (0,67 → 5 €); P1 (0,50) ya no cabe.
  const r2 = asignarPresupuesto(productos, 290);
  caso('mayor resto con tope de presupuesto (290 €): P1=14, P2=5, P3=10 y 290 € exactos',
    r2.unidades.get('P1') === 14 && r2.unidades.get('P2') === 5 && r2.unidades.get('P3') === 10 && cerca(r2.gastado, 290),
    JSON.stringify([...r2.unidades]) + ` gastado=${r2.gastado}`);
  caso('…margen 435 € (sigue siendo 1,5 € por euro)', cerca(r2.margenTotal, 435));
  // El polvo de coma flotante y el orden de la lista ya no deciden nada.
  const r3 = asignarPresupuesto([...productos].reverse(), 300);
  caso('reparto idéntico con los productos en orden inverso',
    ['P1', 'P2', 'P3'].every((p) => r3.unidades.get(p) === r1.unidades.get(p)));
  // Densidades que solo difieren en polvo flotante (~2e-16) son EL MISMO nivel.
  const dust = [
    { nombre: 'D1', coste: 26.92, marginal: mk([100], 40.379999999999995, 6.73) },
    { nombre: 'D2', coste: 22.00, marginal: mk([100], 33.00, 5.5) },
  ];
  const r4 = asignarPresupuesto(dust, 2446); // nivel completo: 100×26,92 + 100×22 = 4.892 → la mitad
  caso('la tolerancia 1e-9 funde el polvo flotante en un solo nivel: 50 y 50 uds',
    r4.unidades.get('D1') === 50 && r4.unidades.get('D2') === 50,
    JSON.stringify([...r4.unidades]));
}

console.log('\n— Plan de compra: baseline proporcional verificado a mano (parte 2) —');
{
  // Mismos juguetes A/B/C + ventas históricas 200/100/100 (Σ400). Con 700 €:
  //  A: cuota 350 € → 8 uds (margen 480 €) · B: 175 € → 8 uds (5×30 + 3×12,5
  //  = 187,5 €) · C: 175 € → 2 uds (240 €). Baseline = 907,5 € de margen.
  //  El greedy daba 1.015 € → ventaja = 107,5 € exactos.
  const mk = (ordenadas, margen, perdida) => (n) => margenMarginal(supervivencia(ordenadas, n), margen, perdida);
  const productos = [
    { nombre: 'A', coste: 40, marginal: mk([10], 60, 10), historicas: 200 },
    { nombre: 'B', coste: 20, marginal: mk([5, 10], 30, 5), historicas: 100 },
    { nombre: 'C', coste: 80, marginal: mk([2], 120, 20), historicas: 100 },
  ];
  const base = repartoProporcional(productos, 700);
  caso('baseline proporcional: A=8, B=8, C=2 unidades',
    base.unidades.get('A') === 8 && base.unidades.get('B') === 8 && base.unidades.get('C') === 2,
    JSON.stringify([...base.unidades]));
  caso('…con margen esperado 907,5 € clavado a mano', cerca(base.margen, 907.5));
  const greedy = asignarPresupuesto(productos, 700);
  caso('ventaja del plan sobre el baseline: 1.015 − 907,5 = 107,5 €',
    cerca(greedy.margenTotal - base.margen, 107.5));
}

console.log('\n— Plan de compra: integración con el pipeline real —');
{
  const records = [];
  for (let i = 0; i < 60; i++) {
    records.push({ ...fila(i, 'Polo Estable', 'M', 6, 'Polos'), precio: 30 });
    records.push({ ...fila(i, 'Polo Estable', 'L', 4, 'Polos'), precio: 30 });
    records.push({ ...fila(i, 'Gorra Basica', 'U', 5, 'Gorras'), precio: 20 });
  }
  for (let i = 0; i < 5; i++) records.push({ ...fila(i, 'Mini Serie', 'M', 3, 'Polos'), precio: 50 });
  const motor = prepararMotor(records);

  const plan = generarPlanCompra(motor, { presupuesto: 2000, horizonte: 12 });
  caso('el plan se genera sobre el catálogo real', plan.ok === true, JSON.stringify(plan.motivo));
  caso('no gasta más del presupuesto y las inversiones suman lo gastado',
    plan.gastado <= 2000 + 1e-6
    && cerca(plan.filas.reduce((s, f) => s + f.inversion, 0), plan.gastado, 0.01));
  caso('las unidades del plan cuadran con el total',
    plan.filas.reduce((s, f) => s + f.unidades, 0) === plan.unidadesTotales && plan.unidadesTotales > 0);
  caso('la tabla viene ordenada por inversión descendente',
    plan.filas.every((f, i) => i === 0 || f.inversion <= plan.filas[i - 1].inversion));
  caso('margen esperado positivo y riesgos acotados 0..1',
    plan.margenEsperado > 0
    && plan.filas.every((f) => f.riesgoRotura >= 0 && f.riesgoRotura <= 1 && f.riesgoRebaja >= 0 && f.riesgoRebaja <= 1));
  caso('Mini Serie (15 uds) queda FUERA del plan con su motivo',
    plan.excluidos.some((e) => e.producto === 'Mini Serie' && e.motivo.includes('mínimo')));
  caso('la demanda por producto queda memoizada (2 productos cacheados)',
    motor.cacheDemanda.size === 2);
  const plan2 = generarPlanCompra(motor, { presupuesto: 500, horizonte: 12 });
  caso('regenerar con otro presupuesto reutiliza la caché (sigue en 2)',
    plan2.ok && motor.cacheDemanda.size === 2);
  caso('con presupuesto de 1 € no llega ni para una unidad → aviso amable',
    generarPlanCompra(motor, { presupuesto: 1 }).motivo === 'presupuesto-insuficiente');
  caso('presupuesto inválido → error amable', generarPlanCompra(motor, { presupuesto: 'abc' }).motivo === 'presupuesto-invalido');
  caso('el plan trae su baseline y nunca rinde menos que repartir "como vendiste"',
    plan.baseline && plan.margenEsperado >= plan.baseline.margen - 1e-6,
    `plan=${plan.margenEsperado?.toFixed(0)} base=${plan.baseline?.margen?.toFixed(0)}`);
  caso('la frontera existe: última comprada con su margen por unidad',
    plan.frontera.ultimaComprada && plan.frontera.ultimaComprada.margen > 0);

  // — Parte 3: desglose por tallas y explicación —
  const polo = plan.filas.find((f) => f.producto === 'Polo Estable');
  caso('cada fila trae su reparto por tallas y suma exacto',
    plan.filas.every((f) => f.tallaUnica || (f.reparto && f.reparto.reduce((s, x) => s + x.unidades, 0) === f.unidades)));
  // Curva jerárquica A MANO: Polo vende M:L 6:4 (peso producto 600/800=0,75)
  // y el residuo de categoría/marca en su dominio es solo M (Mini Serie) →
  // curva M = 0,75×0,6 + 0,25×1,0 = 0,70. El mismo encogimiento que Reposición.
  const m = polo.reparto?.find((x) => x.talla === 'M');
  caso('Polo Estable reparte el 70% a la M (jerárquica a mano: 0,75×0,6+0,25×1)',
    m && Math.abs(m.unidades - 0.7 * polo.unidades) <= 1,
    `M=${m?.unidades} de ${polo.unidades}`);
  const gorra = plan.filas.find((f) => f.producto === 'Gorra Basica');
  caso('Gorra Basica (solo talla U) queda marcada como talla única',
    !gorra || gorra.tallaUnica === true);
  caso('el plan trae su explicación paso a paso (7 pasos, frontera con números)',
    plan.explicacion.length === 7
    && plan.explicacion.some((p) => p.titulo === 'Dónde se corta' && /\d/.test(p.detalle)));

  // — Arreglo del empate: invarianza al orden del CSV y honestidad —
  const motorR = prepararMotor([...records].reverse());
  const planR = generarPlanCompra(motorR, { presupuesto: 2000, horizonte: 12 });
  caso('el plan es INVARIANTE al orden de las filas del CSV (mismas uds y margen)',
    planR.ok && planR.filas.length === plan.filas.length
    && plan.filas.every((f) => planR.filas.find((g) => g.producto === f.producto)?.unidades === f.unidades)
    && cerca(planR.margenEsperado, plan.margenEsperado, 0.01),
    JSON.stringify(planR.filas?.map((f) => [f.producto, f.unidades])));
  caso('presupuesto menor que el tramo seguro → aviso de reparto proporcional',
    plan2.avisos.some((a) => a.includes('casi seguro') && a.includes('proporcionalmente')));
  caso('presupuesto que cubre el tramo seguro → sin ese aviso',
    !plan.avisos.some((a) => a.includes('casi seguro')));
}

console.log('\n— Plan de compra: la lista de sin-inversión va completa (sin recortar) —');
{
  const records = [];
  for (let i = 0; i < 60; i++) {
    records.push({ ...fila(i, 'Basico Uno', 'M', 5, 'Camisetas'), precio: 25 });
    records.push({ ...fila(i, 'Caro Uno', 'M', 1, 'Abrigos'), precio: 3000 });
    records.push({ ...fila(i, 'Caro Dos', 'M', 1, 'Abrigos'), precio: 2500 });
  }
  const m = prepararMotor(records);
  // 200 €: una unidad de los caros cuesta 1.200 € y 1.000 € → 0 uds para ambos.
  const p = generarPlanCompra(m, { presupuesto: 200, horizonte: 12 });
  caso('los productos sin presupuesto se listan TODOS en el aviso, sin "…"',
    p.ok && p.avisos.some((a) => a.includes('Caro Uno') && a.includes('Caro Dos') && !a.includes('…')),
    JSON.stringify(p.avisos));
}

console.log('\n— Extremo a extremo con ventas_ejemplo_loop.csv —');
{
  const txt = fs.readFileSync(new URL('../ventas_ejemplo_loop.csv', import.meta.url), 'utf8');
  const lineas = txt.trim().split(/\r?\n/);
  const records = lineas.slice(1).map((l) => {
    const c = l.split(',');
    return {
      fecha: c[0], producto: c[1], categoria: c[2], talla: c[3], color: c[4],
      unidades: Number(c[5]), precio: Number(c[6]), ingresos: Number(c[7]),
    };
  });

  const motor = prepararMotor(records);
  const perfil = perfilDelDataset(motor.almacen);
  caso('perfil: 22 semanas de histórico (1 ene → 31 may 2026)', perfil.semanas === 22,
    `semanas=${perfil.semanas}`);
  caso('perfil: 1.690 unidades y 8 productos', perfil.totalUnidades === 1690 && perfil.nProductos === 8);
  caso('la última semana acaba en domingo → completa, no se excluye nada', perfil.semanaParcial === null);

  const cfg = Object.fromEntries(motor.configuracion.map((f) => [f.nombre, f.estado]));
  caso('configuración honesta: estacionalidad DESACTIVADA (22 < 52 semanas)',
    cfg['Estacionalidad (Holt-Winters y naive estacional)'] === 'desactivada');
  caso('configuración honesta: backtesting DESACTIVADO (22 < 26 semanas)',
    cfg['Banco de modelos con backtesting'] === 'desactivada');
  caso('EWMA y curva de tallas: ACTIVAS', cfg['Pronóstico EWMA (media móvil exponencial)'] === 'activa'
    && cfg['Curva de tallas jerárquica'] === 'activa');

  const r = recomendarReposicion(motor, { producto: 'Vaquero Slim', leadSemanas: 4, nivelServicio: 95 });
  caso('Vaquero Slim (270 uds): la recomendación se calcula', r.ok === true);
  caso('el reparto por tallas suma EXACTO el total recomendado',
    r.ok && r.reparto && r.reparto.reduce((s, f) => s + f.unidades, 0) === r.recomendado);
  caso('los pesos de la mezcla de la curva suman 1',
    r.ok && cerca(r.pesosCurva.producto + r.pesosCurva.categoria + r.pesosCurva.global, 1));
  caso('recomendado = esperado + colchón (las cuentas del desglose cuadran)',
    r.ok && r.esperado + r.colchon === r.recomendado);
  caso('con 22 semanas el modelo va por regla de pre-flight: EWMA por defecto',
    r.modelo.modo === 'regla' && r.modelo.clave === 'ewma', JSON.stringify({ modo: r.modelo.modo, clave: r.modelo.clave }));
  const val = validacionGlobal(motor);
  caso('validación global honesta: no enseña números con 22 semanas (<26)',
    val.robusto === false && val.global === null);
  caso('matriz talla×color del Vaquero: cada talla cuadra exacta y el total es el pedido',
    r.matriz != null && r.matriz.total === r.recomendado
    && r.matriz.filas.every((f) => f.celdas.reduce((s, x) => s + x, 0) === f.total));
  caso('explicabilidad total: ≥7 pasos y el pedido final aparece tal cual en el desglose',
    r.explicacion.length >= 7 && r.explicacion.some((e) => e.detalle.includes(r.recomendado.toLocaleString('es-ES'))),
    `pasos=${r.explicacion.length}`);
  const catCsv = [...motor.almacen.categorias.keys()][0];
  const rLanCsv = recomendarLanzamiento(motor, { categoria: catCsv, precioCentro: 60 });
  caso('lanzamiento sobre tu CSV: análogos, matriz y explicación presentes',
    rLanCsv.ok && rLanCsv.analogos.length >= 3 && rLanCsv.matriz != null && rLanCsv.explicacion.length >= 4);

  if (r.ok) {
    console.log('\n  Recomendación real (compárala con la web):');
    console.log(`    · producto: ${r.producto} (${r.unidadesHistoricas} uds en ${r.semanasAjuste} semanas)`);
    console.log(`    · ritmo reciente: ${r.tasaSemanal.toFixed(2)} uds/semana · sigma ${r.sigmaSemanal.toFixed(2)}`);
    console.log(`    · horizonte: ${r.horizonte.total} semanas (${r.horizonte.lead} espera + ${r.horizonte.cobertura} cobertura)`);
    console.log(`    · esperado ${r.esperado} + colchón ${r.colchon} = PEDIDO ${r.recomendado} uds (servicio ${r.nivelServicio}%)`);
    console.log(`    · curva: ${Math.round(r.pesosCurva.producto * 100)}% producto + ${Math.round(r.pesosCurva.categoria * 100)}% categoría + ${Math.round(r.pesosCurva.global * 100)}% marca`);
    console.log(`    · reparto: ${r.reparto.map((f) => `${f.talla}=${f.unidades}`).join('  ')}`);
    console.log(`    · confianza ${r.confianza.nivel} (${r.confianza.motivo}) · avisos de limpieza: ${r.flags.length}`);
  }

  // Las 3 combinaciones del selector de servicio: a más servicio, más colchón.
  const r90 = recomendarReposicion(motor, { producto: 'Vaquero Slim', nivelServicio: 90 });
  const r99 = recomendarReposicion(motor, { producto: 'Vaquero Slim', nivelServicio: 99 });
  caso('subir el nivel de servicio nunca baja el pedido (90% ≤ 95% ≤ 99%)',
    r90.recomendado <= r.recomendado && r.recomendado <= r99.recomendado,
    `${r90.recomendado} / ${r.recomendado} / ${r99.recomendado}`);

  // Y un lead mayor pide más (8 semanas de espera > 4).
  const rLargo = recomendarReposicion(motor, { producto: 'Vaquero Slim', leadSemanas: 8 });
  caso('más semanas de espera del proveedor → pedido mayor', rLargo.recomendado > r.recomendado,
    `lead8=${rLargo.recomendado} vs lead4=${r.recomendado}`);
}

console.log(fallos === 0 ? '\nTODO OK — la matemática del motor cuadra.\n' : `\n${fallos} CASO(S) FALLARON.\n`);
process.exit(fallos === 0 ? 0 : 1);
