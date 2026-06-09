// Motor de stock — ORQUESTADOR (Modo A: reposición).
// Une las piezas en el orden del plan:
//   datos semanales → limpieza (roturas + outliers) → pronóstico EWMA sobre el
//   horizonte (espera del proveedor + 4 semanas de cobertura) → cantidad con
//   colchón según nivel de servicio → curva jerárquica de tallas → redondeo
//   exacto. Devuelve un objeto con TODOS los números y avisos que la interfaz
//   muestra: la pantalla no calcula nada, solo pinta.

import {
  construirAlmacen, perfilDelDataset, configuracionMotor, fmtFecha,
} from './datos.mjs';
import { limpiarProducto } from './limpieza.mjs';
import { ajustarEWMA, Z_NIVEL } from './forecast.mjs';
import {
  curvaJerarquica, aplicarUmbralMinimo, repartoPorMayorResto, restarMapas, K_ENCOGIMIENTO,
} from './curvas.mjs';

// Por debajo de 20 unidades históricas no hay base estadística para recomendar:
// se dice claramente (y ahí es donde entrará la red de Wefty).
export const MIN_UNIDADES_PRODUCTO = 20;
export const SEMANAS_COBERTURA = 4;   // el pedido cubre la espera + este margen
export const LEAD_MIN = 1;
export const LEAD_MAX = 26;

const fmt1 = (x) => (Math.round(x * 10) / 10).toLocaleString('es-ES');

// ---------------------------------------------------------------------------
// prepararMotor(records) — se llama UNA vez por dataset (memoizado en la UI).
// Construye el almacén semanal, el perfil, limpia todo el catálogo (es barato:
// un par de pasadas lineales por producto) y deja listo el panel de
// configuración. Lo caro (pronóstico por producto) se hace bajo demanda.
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

  const configuracion = configuracionMotor(perfil, totales);
  return { almacen, perfil, limpiezas, totales, configuracion };
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

// Confianza global de la recomendación, por volumen y recorrido de los datos.
function calcularConfianza(semanasAjuste, unidades) {
  if (semanasAjuste >= 20 && unidades >= 150) {
    return { nivel: 'ALTA', motivo: `${semanasAjuste} semanas y ${unidades.toLocaleString('es-ES')} uds de histórico` };
  }
  if (semanasAjuste >= 10 && unidades >= 60) {
    return { nivel: 'MEDIA', motivo: `${semanasAjuste} semanas y ${unidades.toLocaleString('es-ES')} uds — suficiente, pero con margen de error` };
  }
  return { nivel: 'BAJA', motivo: `solo ${semanasAjuste} semanas o ${unidades.toLocaleString('es-ES')} uds — tómalo como orientación` };
}

// ---------------------------------------------------------------------------
// recomendarReposicion(motor, { producto, leadSemanas, nivelServicio })
// ---------------------------------------------------------------------------
export function recomendarReposicion(motor, { producto, leadSemanas = 4, nivelServicio = 95 } = {}) {
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
  const z = Z_NIVEL[nivel];

  // 1) Serie limpia, desde la primera venta del producto. La última semana se
  //    descarta del ajuste si está incompleta (los datos acaban a mitad de semana).
  const { serieLimpia, flags } = motor.limpiezas.get(producto);
  let fin = serieLimpia.length;
  const excluyeParcial = Boolean(almacen.semanaParcial) && fin - p.primeraSemana > 1;
  if (excluyeParcial) fin -= 1;
  const serieAjuste = serieLimpia.slice(p.primeraSemana, fin);

  // 2) Ritmo reciente + incertidumbre, escalada al horizonte del pedido.
  const ewma = ajustarEWMA(serieAjuste);
  const horizonte = lead + SEMANAS_COBERTURA;
  const esperado = ewma.tasa * horizonte;
  const sigmaHorizonte = ewma.sigma * Math.sqrt(horizonte);
  const recomendado = Math.max(0, Math.round(esperado + z * sigmaHorizonte));
  const esperadoRed = Math.round(esperado);

  // 3) Curva de tallas jerárquica (categoría y marca SIN este producto).
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
  if (jer) {
    const filtrado = aplicarUmbralMinimo(jer.curva, jer.dominio);
    excluidas = filtrado.excluidas;
    reparto = repartoPorMayorResto(filtrado.curva, filtrado.dominio, recomendado);
    pesosCurva = jer.pesos;
    tallaUnica = jer.dominio.length === 1;
  }

  return {
    ok: true,
    producto, categoria: p.categoria, unidadesHistoricas: p.total,
    horizonte: { lead, cobertura: SEMANAS_COBERTURA, total: horizonte },
    nivelServicio: nivel, z,
    tasaSemanal: ewma.tasa, sigmaSemanal: ewma.sigma,
    esperado: esperadoRed,
    colchon: recomendado - esperadoRed,
    recomendado,
    reparto, excluidas, pesosCurva, tallaUnica, K: K_ENCOGIMIENTO,
    semanasAjuste: serieAjuste.length,
    semanaParcialExcluida: excluyeParcial,
    flags: flagsLegibles(flags, almacen.semanas),
    confianza: calcularConfianza(serieAjuste.length, p.total),
  };
}
