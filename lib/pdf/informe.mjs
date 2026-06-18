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

// Subtítulo de sección (en mayúsculas, marino).
function subtitulo(doc, txt, y) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C.marino);
  doc.text(txt.toUpperCase(), MARGEN, y);
  doc.setDrawColor(...C.linea); doc.setLineWidth(0.2);
  doc.line(MARGEN, y + 1.5, ANCHO - MARGEN, y + 1.5);
  return y + 7;
}

// Línea de información suelta.
function info(doc, txt, y) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...C.tinta2);
  doc.text(txt, MARGEN, y);
  return y + 5.5;
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

// Descarga directa (navegador): construye y dispara el guardado del archivo.
export function descargarPlanPDF(plan, ctx) {
  const fecha = new Date();
  construirPlanPDF(plan, ctx, fecha).save(nombreArchivo('plan-compra', null, fecha));
}
