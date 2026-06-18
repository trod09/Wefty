// Informes PDF de las secciones del motor (Reposición, Plan de compra,
// Lanzamiento). NO calcula nada: recibe el resultado YA generado por el motor y
// lo maqueta en un documento A4 claro, legible y listo para imprimir/enviar.
// jsPDF + jspdf-autotable. Se importa de forma DIFERIDA (solo al pulsar el
// botón "Exportar a PDF"), así no pesa en la carga normal de la app.
//
// Una sola maquinaria compartida (cabecera, pie, bloques, tablas) alimenta las
// tres secciones — nada de tres implementaciones distintas.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ---- Paleta de IMPRESIÓN (clara, sobre papel; nada de fondos oscuros) -------
const C = {
  tinta: [22, 36, 63],     // azul marino — texto principal
  tinta2: [58, 70, 89],    // secundario
  tinta3: [107, 117, 133], // tenue (pie, etiquetas)
  linea: [212, 219, 230],
  marino: [31, 48, 87],    // cabecera de tabla / acentos
  fondoCab: [241, 244, 249],
  alt: [247, 249, 252],    // filas alternas
  blanco: [255, 255, 255],
};

const MARGEN = 14;   // mm
const ANCHO = 210;   // A4 mm

// ---- Formateadores (idénticos a los de pantalla) ----------------------------
const eur = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const int = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
const pctEntero = (x) => `${Math.round((Number(x) || 0) * 100)} %`;
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : s);

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaLarga = (d) => `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
const fechaISO = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const mesAnio = (iso) => {
  if (!iso || !/^\d{4}-\d{2}/.test(iso)) return iso || '—';
  const [y, m] = iso.split('-');
  return `${MESES[+m - 1]} ${y}`;
};
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'informe';

// Nombre de archivo descriptivo: wefty-plan-compra-2026-06-18.pdf
export function nombreArchivo(tipo, sufijo, fecha = new Date()) {
  return [`wefty`, tipo, sufijo && slug(sufijo), fechaISO(fecha)].filter(Boolean).join('-') + '.pdf';
}

// ---- Piezas compartidas -----------------------------------------------------
function nuevoDoc() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');
  return doc;
}

// Cabecera (solo página 1): marca + subtítulo, fecha a la derecha, título grande.
function cabecera(doc, titulo, fecha) {
  doc.setFillColor(...C.fondoCab);
  doc.rect(0, 0, ANCHO, 26, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...C.marino);
  doc.text('Wefty', MARGEN, 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.tinta3);
  doc.text('predicción de stock', MARGEN, 18.5);
  doc.setFontSize(9); doc.setTextColor(...C.tinta2);
  doc.text(fechaLarga(fecha), ANCHO - MARGEN, 13, { align: 'right' });

  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...C.tinta);
  doc.text(titulo, MARGEN, 40);
  return 49; // y de continuación
}

// Pie en TODAS las páginas (se llama al final, cuando ya se conoce el total).
function pieEnTodas(doc) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...C.linea); doc.setLineWidth(0.2);
    doc.line(MARGEN, h - 16, ANCHO - MARGEN, h - 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.tinta3);
    doc.text('Recomendación estadística basada en tu histórico — ajústala con tu criterio.', MARGEN, h - 11);
    doc.text('Generado con Wefty · wefty.co', MARGEN, h - 6.5);
    doc.text(`Página ${i} de ${total}`, ANCHO - MARGEN, h - 6.5, { align: 'right' });
  }
}

// Si no caben `necesario` mm antes del pie, salta a una página nueva.
function asegurarEspacio(doc, y, necesario = 24) {
  const h = doc.internal.pageSize.getHeight();
  if (y + necesario > h - 20) { doc.addPage(); return 20; }
  return y;
}

// Subtítulo de sección (en mayúsculas, marino). Salta de página si no cabe.
function subtitulo(doc, txt, y) {
  y = asegurarEspacio(doc, y, 26);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.marino);
  doc.text(txt.toUpperCase(), MARGEN, y);
  doc.setDrawColor(...C.linea); doc.setLineWidth(0.2);
  doc.line(MARGEN, y + 1.5, ANCHO - MARGEN, y + 1.5);
  return y + 7;
}

// Línea de información suelta.
function info(doc, txt, y) {
  y = asegurarEspacio(doc, y, 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...C.tinta2);
  doc.text(txt, MARGEN, y);
  return y + 5.5;
}

// Cifra protagonista (p. ej. la cantidad recomendada).
function granCifra(doc, txt, y) {
  y = asegurarEspacio(doc, y, 16);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(...C.tinta);
  doc.text(txt, MARGEN, y + 5);
  return y + 13;
}

// Rejilla de pares etiqueta/valor en dos columnas: [[l1,v1,l2,v2], ...].
function paresEnRejilla(doc, filas, y) {
  doc.setFontSize(9.5);
  const colL = MARGEN, colV = MARGEN + 34, col2L = MARGEN + 92, col2V = MARGEN + 126;
  for (const [l1, v1, l2, v2] of filas) {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.tinta3);
    doc.text(String(l1), colL, y); if (l2) doc.text(String(l2), col2L, y);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.tinta);
    doc.text(String(v1), colV, y); if (l2) doc.text(String(v2), col2V, y);
    y += 5.8;
  }
  return y + 1;
}

// Tabla estándar del informe (cabecera marino, filas alternas, números a la
// derecha, paginación automática que NO corta filas y repite la cabecera).
function tabla(doc, { startY, head, body, foot, alinearDerecha = [] }) {
  const columnStyles = {};
  for (const i of alinearDerecha) columnStyles[i] = { halign: 'right' };
  autoTable(doc, {
    startY,
    margin: { top: 16, bottom: 22, left: MARGEN, right: MARGEN },
    head: [head], body, foot: foot ? [foot] : undefined,
    styles: { font: 'helvetica', fontSize: 9, textColor: C.tinta, lineColor: C.linea, lineWidth: 0.1, cellPadding: 2 },
    headStyles: { fillColor: C.marino, textColor: C.blanco, fontStyle: 'bold', fontSize: 8.5 },
    footStyles: { fillColor: C.fondoCab, textColor: C.tinta, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.alt },
    columnStyles,
  });
  return doc.lastAutoTable.finalY;
}

// =============================================================================
// PLAN DE COMPRA
// =============================================================================
export function construirPlanPDF(plan, ctx = {}, fecha = new Date()) {
  const doc = nuevoDoc();
  let y = cabecera(doc, 'Plan de compra', fecha);

  // Contexto del cálculo
  y = subtitulo(doc, 'Contexto del cálculo', y);
  y = paresEnRejilla(doc, [
    ['Presupuesto', eur(plan.presupuesto), 'Horizonte', `${plan.horizonte} semanas`],
    ['Escenario', cap(plan.escenario), 'Margen', `${plan.margenPct} %`],
  ], y);
  const rango = ctx.fechaMin ? `${mesAnio(ctx.fechaMin)} – ${mesAnio(ctx.fechaMax)}` : '—';
  y = info(doc, `Calculado sobre ${int(plan.filas.length)} productos del plan · histórico ${rango}`, y);
  y = info(doc, `Costes usados: ${plan.costes.reales} reales · ${plan.costes.estimados} estimados`, y);

  // Resumen global
  y += 2;
  y = subtitulo(doc, 'Resumen', y);
  y = info(doc, `Invertido ${eur(plan.gastado)}   ·   Unidades ${int(plan.unidadesTotales)}   ·   Margen esperado ${eur(plan.margenEsperado)}`, y);
  if (plan.baseline) {
    const v = plan.baseline.ventaja;
    y = info(doc, `Ventaja sobre el reparto proporcional al histórico: ${v >= 0 ? '+' : ''}${eur(v)}`, y);
  }

  // Tabla de productos
  y += 2;
  tabla(doc, {
    startY: y,
    head: ['Producto', 'Categoría', 'Uds.', 'Inversión', 'Margen esp.', '% pres.'],
    body: plan.filas.map((f) => [
      f.producto, f.categoria || '—', int(f.unidades), eur(f.inversion), eur(f.margenEsperado), pctEntero(f.pctPresupuesto),
    ]),
    foot: ['TOTAL', '', int(plan.unidadesTotales), eur(plan.gastado), eur(plan.margenEsperado), '100 %'],
    alinearDerecha: [2, 3, 4, 5],
  });

  pieEnTodas(doc);
  return doc;
}

export function descargarPlanPDF(plan, ctx) {
  const fecha = new Date();
  construirPlanPDF(plan, ctx, fecha).save(nombreArchivo('plan-compra', null, fecha));
}

// =============================================================================
// REPOSICIÓN (un producto)
// =============================================================================
export function construirReposicionPDF(r, ctx = {}, fecha = new Date()) {
  const doc = nuevoDoc();
  let y = cabecera(doc, `Reposición — ${r.producto}`, fecha);

  // Contexto
  y = subtitulo(doc, 'Contexto del cálculo', y);
  const criterio = r.modoCantidad === 'economia'
    ? `Máx. margen (~${Math.round((r.economia?.cr || 0) * 100)} % demanda)`
    : `Nivel de servicio ${r.nivelServicio} %`;
  y = paresEnRejilla(doc, [
    ['Producto', r.producto, 'Categoría', r.categoria || '—'],
    ['Espera proveedor', `${r.horizonte.lead} semanas`, 'Horizonte total', `${r.horizonte.total} semanas`],
    ['Criterio', criterio, 'Escenario', cap(r.escenario)],
  ], y);
  const rango = ctx.fechaMin ? `${mesAnio(ctx.fechaMin)} – ${mesAnio(ctx.fechaMax)}` : '—';
  y = info(doc, `Histórico del producto: ${r.semanasAjuste} semanas · ${int(r.unidadesHistoricas)} uds vendidas · datos ${rango}`, y);
  y = info(doc, `Fiabilidad de la recomendación: ${cap(String(r.confianza?.nivel || '').toLowerCase())}`, y);

  // Resumen
  y += 2;
  y = subtitulo(doc, 'Pedido recomendado', y);
  y = granCifra(doc, `${int(r.recomendado)} uds`, y);
  y = info(doc, `${int(r.esperado)} de demanda esperada + ${int(r.colchon)} de colchón · rango probable ${int(r.intervalo.p10)}–${int(r.intervalo.p90)} uds (P10–P90)`, y);

  // Reparto por talla
  if (r.reparto?.length) {
    y += 2;
    y = subtitulo(doc, 'Reparto por talla', y);
    y = tabla(doc, {
      startY: y,
      head: ['Talla', 'Unidades', '% del pedido', 'Riesgo de rotura'],
      body: r.reparto.map((f) => [
        f.talla, int(f.unidades), pctEntero(r.recomendado ? f.unidades / r.recomendado : 0),
        f.riesgoRotura != null ? pctEntero(f.riesgoRotura) : '—',
      ]),
      foot: ['TOTAL', int(r.recomendado), '100 %', ''],
      alinearDerecha: [1, 2, 3],
    });
  }

  // Desglose talla × color (si el producto tiene varios colores)
  if (r.matriz) {
    y += 4;
    y = subtitulo(doc, 'Desglose por talla y color', y);
    tabla(doc, {
      startY: y,
      head: ['Talla', ...r.matriz.colores, 'Total'],
      body: r.matriz.filas.map((f) => [f.talla, ...f.celdas.map((c) => int(c)), int(f.total)]),
      foot: ['Total', ...r.matriz.totalesColor.map((t) => int(t)), int(r.matriz.total)],
      alinearDerecha: r.matriz.colores.map((_, i) => i + 1).concat([r.matriz.colores.length + 1]),
    });
  }

  pieEnTodas(doc);
  return doc;
}

export function descargarReposicionPDF(r, ctx) {
  const fecha = new Date();
  construirReposicionPDF(r, ctx, fecha).save(nombreArchivo('reposicion', r.producto, fecha));
}

// =============================================================================
// LANZAMIENTO (producto nuevo, por categoría)
// =============================================================================
export function construirLanzamientoPDF(r, ctx = {}, fecha = new Date()) {
  const doc = nuevoDoc();
  let y = cabecera(doc, `Lanzamiento — ${r.categoria}`, fecha);

  // Contexto
  y = subtitulo(doc, 'Contexto del cálculo', y);
  const tipo = r.tipo === 'capsula' ? `Cápsula · ${r.semanasVenta} semanas` : 'Permanente · ~12 semanas';
  const pares = [['Categoría', r.categoria, 'Tipo', tipo]];
  if (r.posicionamiento) pares.push(['Posicionamiento', cap(r.posicionamiento), 'Análogos', `${r.analogos.length}`]);
  else pares.push(['Análogos usados', `${r.analogos.length}`, 'Evidencia', `${int(r.unidadesAnalogos)} uds`]);
  y = paresEnRejilla(doc, pares, y);
  if (r.ajusteEstacional) {
    const f = r.ajusteEstacional;
    const signo = f.factorMedio >= 1 ? '+' : '−';
    y = info(doc, `Mes de lanzamiento: ${cap(f.nombreMes)} · demanda inicial ${signo}${Math.abs(Math.round((f.factorMedio - 1) * 100))} % por estacionalidad de ${r.categoria}.`, y);
  } else {
    y = info(doc, 'Sin mes de lanzamiento definido: la curva no se ajusta por estacionalidad.', y);
  }
  const rango = ctx.fechaMin ? `${mesAnio(ctx.fechaMin)} – ${mesAnio(ctx.fechaMax)}` : '—';
  y = info(doc, `Datos del catálogo: ${rango} · fiabilidad ${cap(String(r.confianza?.nivel || '').toLowerCase())} (un lanzamiento siempre es una apuesta)`, y);

  // Resumen
  y += 2;
  y = subtitulo(doc, 'Pedido de lanzamiento', y);
  y = granCifra(doc, `${int(r.total)} uds`, y);
  y = info(doc, r.totalEsSugerido ? 'Sugerido por la curva de análogos.' : `Indicado por ti (la curva sugería ≈${int(r.totalSugerido)} uds).`, y);

  // Análogos con su score
  y += 2;
  y = subtitulo(doc, 'Análogos usados (con su score)', y);
  y = tabla(doc, {
    startY: y,
    head: ['Producto', 'Categoría', 'Uds.', 'Score'],
    body: r.analogos.map((a) => [a.nombre, a.categoria, int(a.unidades), String(a.score)]),
    alinearDerecha: [2, 3],
  });

  // Curva proyectada
  y += 4;
  y = subtitulo(doc, 'Curva proyectada (unidades por semana)', y);
  y = tabla(doc, {
    startY: y,
    head: ['Semana', 'Media', 'P25', 'P75'],
    body: r.curva.map((c) => [String(c.semana), int(c.media), int(c.p25), int(c.p75)]),
    alinearDerecha: [1, 2, 3],
  });

  // Reparto por talla
  if (r.reparto?.length) {
    y += 4;
    y = subtitulo(doc, 'Reparto por talla', y);
    y = tabla(doc, {
      startY: y,
      head: ['Talla', 'Unidades', '% del pedido'],
      body: r.reparto.map((f) => [f.talla, int(f.unidades), pctEntero(r.total ? f.unidades / r.total : 0)]),
      foot: ['TOTAL', int(r.total), '100 %'],
      alinearDerecha: [1, 2],
    });
  }

  // Desglose talla × color (si aplica) o, en su defecto, reparto por color
  if (r.matriz) {
    y += 4;
    y = subtitulo(doc, 'Desglose por talla y color', y);
    tabla(doc, {
      startY: y,
      head: ['Talla', ...r.matriz.colores, 'Total'],
      body: r.matriz.filas.map((f) => [f.talla, ...f.celdas.map((c) => int(c)), int(f.total)]),
      foot: ['Total', ...r.matriz.totalesColor.map((t) => int(t)), int(r.matriz.total)],
      alinearDerecha: r.matriz.colores.map((_, i) => i + 1).concat([r.matriz.colores.length + 1]),
    });
  } else if (r.repartoColores?.length) {
    y += 4;
    y = subtitulo(doc, 'Reparto por color', y);
    tabla(doc, {
      startY: y,
      head: ['Color', 'Unidades'],
      body: r.repartoColores.map((f) => [f.talla, int(f.unidades)]),
      alinearDerecha: [1],
    });
  }

  pieEnTodas(doc);
  return doc;
}

export function descargarLanzamientoPDF(r, ctx) {
  const fecha = new Date();
  construirLanzamientoPDF(r, ctx, fecha).save(nombreArchivo('lanzamiento', r.categoria, fecha));
}
