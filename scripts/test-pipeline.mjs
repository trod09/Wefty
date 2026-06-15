// Pruebas del PIPELINE de carga de CSV (parseo) — batería 360.
// Lo ejecuta también scripts/test-engine.mjs (resumen combinado), o suelto:
//   node scripts/test-pipeline.mjs
//
// IMPORTANTE: las funciones de parseo de aquí son COPIA VERBATIM del código de
// producción (app/upload/page.jsx y components/SalesDashboard.jsx). Hoy esas
// funciones viven dentro de componentes React (no importables en Node), así que
// se replican aquí. El parser de números YA se importa de lib/csv.mjs (BUG 2);
// el resto (separador, fechas, mapeo) sigue siendo copia verbatim hasta extraerlo.
import { readFileSync } from 'node:fs';
import { prepararMotor, recomendarReposicion, productosOrdenados, demandaProducto } from '../lib/engine/motor.mjs';
import { generarPlanCompra } from '../lib/engine/plan.mjs';
import { parseNumero as parseNumber, unificarNombres } from '../lib/csv.mjs';

// ───── VERBATIM de app/upload/page.jsx ─────
const CANON_FIELDS = [
  { key: 'fecha', dbCol: 'fecha', kind: 'date', label: 'fecha', synonyms: ['fecha', 'date', 'dia', 'day', 'order date', 'fecha de pedido', 'fecha de venta', 'fecha pedido', 'created at', 'created', 'paid at', 'processed at', 'fulfilled at', 'order_date'] },
  { key: 'producto', dbCol: 'producto', kind: 'text', label: 'producto', synonyms: ['producto', 'product', 'item', 'articulo', 'product title', 'product name', 'lineitem name', 'line item', 'nombre', 'nombre producto', 'name', 'title', 'sku'] },
  { key: 'categoria', dbCol: 'categoria', kind: 'text', label: 'categoría', synonyms: ['categoria', 'category', 'product type', 'type', 'tipo', 'familia', 'collection', 'coleccion', 'product category', 'grupo'] },
  { key: 'talla', dbCol: 'talla', kind: 'text', label: 'talla', synonyms: ['talla', 'size', 'variant', 'variante', 'variant title', 'tallas', 'option1 value', 'option value', 'talla size'] },
  { key: 'color', dbCol: 'color', kind: 'text', label: 'color', synonyms: ['color', 'colour', 'colores', 'option2 value', 'color variante'] },
  { key: 'unidades', dbCol: 'unidades_vendidas', kind: 'int', label: 'unidades', synonyms: ['unidades', 'unidades vendidas', 'unidades_vendidas', 'cantidad', 'quantity', 'qty', 'units', 'units sold', 'cant', 'lineitem quantity', 'net items sold', 'items'] },
  { key: 'precio', dbCol: 'precio_unitario', kind: 'num', label: 'precio', synonyms: ['precio', 'precio unitario', 'precio_unitario', 'price', 'unit price', 'lineitem price', 'pvp', 'precio venta', 'sale price', 'variant price'] },
  { key: 'ingresos', dbCol: 'ingresos', kind: 'num', label: 'ingresos', synonyms: ['ingresos', 'revenue', 'importe', 'total', 'total sales', 'ventas', 'sales', 'amount', 'importe total', 'total price', 'gross sales', 'net sales', 'subtotal', 'facturacion', 'facturación'] },
];
function normalizeText(s) { return String(s ?? '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' '); }
function detectMapping(headers) {
  const norm = headers.map(normalizeText); const used = new Array(headers.length).fill(false); const mapping = {};
  for (const f of CANON_FIELDS) { for (let i = 0; i < norm.length; i++) { if (used[i] || !norm[i]) continue; if (f.synonyms.some((s) => normalizeText(s) === norm[i])) { mapping[f.key] = i; used[i] = true; break; } } }
  for (const f of CANON_FIELDS) { if (mapping[f.key] != null) continue; for (let i = 0; i < norm.length; i++) { if (used[i] || !norm[i]) continue; const h = norm[i]; if (f.synonyms.some((s) => { const ns = normalizeText(s); return ns.length >= 3 && (h.includes(ns) || ns.includes(h)); })) { mapping[f.key] = i; used[i] = true; break; } } }
  return mapping;
}
function normalizeDate(raw) {
  const s = String(raw ?? '').trim(); if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ymd = s.match(/^(\d{4})[/](\d{1,2})[/](\d{1,2})/); if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/); if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return s;
}
function detectarSeparador(linea) { let comas = 0, pyc = 0, q = false; for (const ch of linea) { if (ch === '"') q = !q; else if (!q) { if (ch === ',') comas += 1; else if (ch === ';') pyc += 1; } } return pyc > comas ? ';' : ','; }
function parseCsvLine(line, sep = ',') {
  const cells = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === sep) { cells.push(cur); cur = ''; } else cur += ch; }
  cells.push(cur); return cells.map((c) => c.trim());
}
export function procesarCSV(text) {
  const lines = String(text).split(/\r\n|\r|\n/).filter((l) => l.trim() !== '');
  const sep = lines.length ? detectarSeparador(lines[0]) : ',';
  const rawHeaders = lines.length ? parseCsvLine(lines[0], sep) : [];
  const rawRows = lines.slice(1).map((l) => parseCsvLine(l, sep));
  const mapping = detectMapping(rawHeaders);
  const missing = CANON_FIELDS.filter((f) => mapping[f.key] == null);
  if (missing.length > 0) return { ok: false, error: 'No reconocimos la columna para: ' + missing.map((f) => f.label).join(', '), missing: missing.map((f) => f.key) };
  const headers = CANON_FIELDS.map((f) => f.dbCol);
  const rows = rawRows.map((row) => CANON_FIELDS.map((f) => { const cell = row[mapping[f.key]] ?? ''; return f.kind === 'date' ? normalizeDate(cell) : String(cell).trim(); }));
  return { ok: true, headers, rows, sep };
}
// ───── VERBATIM de components/SalesDashboard.jsx ─────
function findCol(headers, ...names) {
  const norm = (s) => String(s).toLowerCase().trim();
  for (const n of names) { const i = headers.findIndex((h) => norm(h) === norm(n)); if (i >= 0) return i; }
  for (const n of names) { const i = headers.findIndex((h) => norm(h).includes(norm(n))); if (i >= 0) return i; }
  return -1;
}
export function parsearVentas(headers, rows) {
  const iFecha = findCol(headers, 'fecha', 'date'); const iProd = findCol(headers, 'producto', 'product');
  const iCat = findCol(headers, 'categoria', 'category'); const iTalla = findCol(headers, 'talla', 'size');
  const iColor = findCol(headers, 'color'); const iUnid = findCol(headers, 'unidades_vendidas', 'unidades', 'cantidad', 'units', 'qty');
  const iPrecio = findCol(headers, 'precio_unitario', 'precio', 'price'); const iIng = findCol(headers, 'ingresos', 'revenue', 'importe', 'total');
  const records = unificarNombres(rows.map((r) => {
    const unidades = parseNumber(r[iUnid]) ?? 0; const precio = parseNumber(r[iPrecio]) ?? 0;
    const ingresos = iIng >= 0 ? (parseNumber(r[iIng]) ?? unidades * precio) : unidades * precio;
    return { fecha: iFecha >= 0 ? String(r[iFecha] ?? '').trim() : '', producto: iProd >= 0 ? String(r[iProd] ?? '').trim() : '', categoria: iCat >= 0 ? String(r[iCat] ?? '').trim() : '', talla: iTalla >= 0 ? String(r[iTalla] ?? '').trim().toUpperCase() : '', color: iColor >= 0 ? String(r[iColor] ?? '').trim() : '', unidades, precio, ingresos };
  }));
  return { records };
}

// ───── arnés de pruebas ─────
export const contador = { verdes: 0, fallos: 0, pendientes: 0 };
function caso(nombre, ok, detalle = '') { if (ok) { contador.verdes += 1; console.log(`  ✓ ${nombre}`); } else { contador.fallos += 1; console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`); } }
// xfail: documenta un bug conocido. okDeseado = el comportamiento CORRECTO que
// queremos tras el arreglo. Si hoy NO se cumple → PENDIENTE (no rompe el verde).
// Cuando el arreglo lo ponga en verde, conviértelo en caso().
function casoPendiente(nombre, okDeseado, detalle = '') {
  if (okDeseado) { contador.fallos += 1; console.log(`  ⚠ XPASS (conviértela en caso()): ${nombre}`); }
  else { contador.pendientes += 1; console.log(`  ⊘ PENDIENTE (bug conocido, falla hoy): ${nombre}${detalle ? ` — ${detalle}` : ''}`); }
}
const recordsDe = (csv) => { const r = procesarCSV(csv); return r.ok ? parsearVentas(r.headers, r.rows).records : null; };

console.log('\n══════ BATERÍA PIPELINE CSV ══════');

console.log('\n— Parseo de números (parseNumber) —');
caso("decimal europeo '129,90' → 129.9", parseNumber('129,90') === 129.9);
caso("miles+decimal europeo '1.234,56' → 1234.56", parseNumber('1.234,56') === 1234.56);
caso("miles+decimal anglo '1,234.56' → 1234.56", parseNumber('1,234.56') === 1234.56);
caso("decimal anglo simple '19.90' → 19.9", parseNumber('19.90') === 19.9);
caso("símbolos '€10' → 10 · '5%' → 5 · '  20 ' → 20", parseNumber('€10') === 10 && parseNumber('5%') === 5 && parseNumber('  20 ') === 20);
caso("multipunto ambiguo '1.234.567' → null (se excluirá con aviso)", parseNumber('1.234.567') === null);
caso('vacío/no numérico → null', parseNumber('') === null && parseNumber('   ') === null && parseNumber('abc') === null);
caso('negativo conservado -5 → -5', parseNumber('-5') === -5);

console.log('\n— Detección de separador y cabeceras —');
caso("separador ';' (Excel europeo) detectado", detectarSeparador('a;b;c;d') === ';');
caso("separador ',' detectado", detectarSeparador('a,b,c,d') === ',');
{
  const enc = 'fecha,producto,categoria,talla,color,unidades_vendidas,precio_unitario,ingresos';
  caso('CSV canónico completo → ok', procesarCSV(enc + '\n2026-01-05,Polo,Camisetas,M,Azul,3,20,60').ok === true);
  const en = 'date,product,category,size,colour,quantity,price,revenue';
  caso('cabeceras en INGLÉS reconocidas', procesarCSV(en + '\n2026-01-05,Polo,Tees,M,Blue,3,20,60').ok === true);
  const shopify = 'Created at,Lineitem name,Product type,Variant title,Option2 value,Lineitem quantity,Lineitem price,Total';
  caso('cabeceras estilo SHOPIFY reconocidas', procesarCSV(shopify + '\n2026-01-05,Polo,Tees,M,Blue,3,20,60').ok === true);
  const faltaColor = 'fecha,producto,categoria,talla,unidades_vendidas,precio_unitario,ingresos';
  const r = procesarCSV(faltaColor + '\n2026-01-05,Polo,Camisetas,M,3,20,60');
  caso('falta una columna (color) → rechazo HONESTO con aviso', r.ok === false && r.missing.includes('color'));
}

console.log('\n— Fechas y robustez de filas —');
{
  const enc = 'fecha,producto,categoria,talla,color,unidades_vendidas,precio_unitario,ingresos';
  const recs = recordsDe(enc + '\n04/03/2026,Polo,Camisetas,M,Azul,3,20,60');
  caso("fecha DD/MM/YYYY '04/03/2026' → ISO '2026-03-04'", recs[0].fecha === '2026-03-04');
  const recs2 = recordsDe(enc + '\n2026-03-04T10:00:00,Polo,Camisetas,M,Azul,3,20,60');
  caso("fecha ISO con hora → '2026-03-04'", recs2[0].fecha === '2026-03-04');
  const recsTalla = recordsDe(enc + '\n2026-01-05,Polo,Camisetas,m,Azul,3,20,60');
  caso("talla en minúscula 'm' se normaliza a 'M'", recsTalla[0].talla === 'M');
  // no peta con celdas vacías / espacios
  let petó = false; try { recordsDe(enc + '\n  2026-01-05 , Polo , , , ,  , , '); } catch { petó = true; }
  caso('fila con celdas vacías/espacios no peta el parseo', petó === false);
}

console.log('\n— BUG 4 (ARREGLADO): unificación de nombres por mayúsculas/espacios —');
{
  const enc = 'fecha,producto,categoria,talla,color,unidades_vendidas,precio_unitario,ingresos';
  const sucio = enc
    + '\n2024-01-08,Camiseta Básica,Camisetas,M,Negro,5,10,50'
    + '\n2024-01-15,CAMISETA BÁSICA,Camisetas,M,negro,3,10,30'
    + '\n2024-01-22,  camiseta básica ,Camisetas,M, Negro ,2,10,20';
  const recs = recordsDe(sucio);
  const prods = [...new Set(recs.map((r) => r.producto))];
  const colores = [...new Set(recs.map((r) => r.color))];
  caso('BUG4 arreglado: 3 grafías de "Camiseta Básica" → 1 solo producto (grafía más frecuente)',
    prods.length === 1 && prods[0] === 'Camiseta Básica', prods.join(' | '));
  caso('BUG4 arreglado: "Negro" / "negro" / " Negro " → 1 solo color', colores.length === 1, colores.join(' | '));
  // No fusiona nombres realmente distintos
  const recs2 = recordsDe(enc + '\n2024-01-08,Camiseta Roja,Camisetas,M,Rojo,1,10,10\n2024-01-15,Camiseta Azul,Camisetas,M,Azul,1,10,10');
  caso('BUG4: NO fusiona productos genuinamente distintos', new Set(recs2.map((r) => r.producto)).size === 2);
}

console.log('\n— BUG 2 (ARREGLADO): punto de miles "N.000" —');
caso("BUG2 arreglado: parseNumber('1.000') → 1000 (miles)", parseNumber('1.000') === 1000, `= ${parseNumber('1.000')}`);
caso("BUG2 arreglado: parseNumber('2.500') → 2500", parseNumber('2.500') === 2500, `= ${parseNumber('2.500')}`);
caso("BUG2: '10.000' → 10000 · '1.234' → 1234", parseNumber('10.000') === 10000 && parseNumber('1.234') === 1234);
{
  // Demostración del impacto (mismo dinero real, ~1000× distinto, sin aviso):
  const enc = 'fecha,producto,categoria,talla,color,unidades_vendidas,precio_unitario,ingresos';
  const mk = (precio) => { let s = enc; for (let w = 0; w < 60; w++) { const d = new Date(Date.UTC(2026, 0, 5) + w * 7 * 86400000).toISOString().slice(0, 10); s += `\n${d},Bonito,Camisetas,M,Negro,5,${precio},`; } return s; };
  const gA = generarPlanCompra(prepararMotor(recordsDe(mk('1000'))), { presupuesto: 50000, horizonte: 12, margenPct: 60 }).gastado;
  const gB = generarPlanCompra(prepararMotor(recordsDe(mk('1.000'))), { presupuesto: 50000, horizonte: 12, margenPct: 60 }).gastado;
  caso('BUG2 arreglado: "1000" vs "1.000" → el plan gasta lo MISMO (no ~1000× distinto)',
    Math.abs(gA - gB) < gA * 0.02, `gasta ${Math.round(gA)}€ vs ${Math.round(gB)}€`);
}

console.log('\n— E2E: ventas_semanales_moda.csv (dataset realista, 15 productos, 2 años) —');
{
  let txt = null;
  try { txt = readFileSync(new URL('../ventas_semanales_moda.csv', import.meta.url), 'utf8'); } catch { /* fixture ausente */ }
  if (!txt) {
    console.log('  · (omitido: ventas_semanales_moda.csv no está en la raíz del repo)');
  } else {
    const pc = procesarCSV(txt);
    caso('e2e: el CSV se reconoce (8 columnas, sin rechazo)', pc.ok === true);
    const m = prepararMotor(parsearVentas(pc.headers, pc.rows).records);
    caso('e2e: 104 semanas · 15 productos · 0 descartes · 0 fechas inverosímiles',
      m.perfil.semanas === 104 && m.perfil.nProductos === 15 && m.perfil.descartadas === 0 && m.perfil.fechasInverosimiles === 0,
      `${m.perfil.semanas}/${m.perfil.nProductos}/${m.perfil.descartadas}/${m.perfil.fechasInverosimiles}`);
    const pl = generarPlanCompra(m, { presupuesto: 20000, horizonte: 12, margenPct: 60 });
    caso('e2e: plan ok, no gasta de más, margen finito',
      pl.ok === true && pl.gastado <= 20000 + 1e-6 && Number.isFinite(pl.margenEsperado));
    // Coherencia: producto descatalogado detectado y excluido (BUG 1)
    const rs = recomendarReposicion(m, { producto: 'Camiseta Estampada Sunset', leadSemanas: 4 });
    const excl = pl.excluidos.some((e) => e.producto === 'Camiseta Estampada Sunset');
    caso('e2e: descatalogado (Camiseta Estampada Sunset) → DESCATALOGADO, recomendado 0, confianza ≠ ALTA, excluido del plan',
      rs.ciclo?.fase === 'DESCATALOGADO' && rs.recomendado === 0 && rs.confianza?.nivel !== 'ALTA' && excl);
    // Superventas con inversión (no queda en 0 oculto)
    const top = productosOrdenados(m)[0].nombre;
    const filaTop = pl.filas.find((f) => f.producto === top);
    caso('e2e: el superventas recibe inversión (no queda en 0)', Boolean(filaTop && filaTop.unidades > 0), `top=${top}`);
    // Declive recibe menos que crecimiento
    const invDecl = pl.filas.find((f) => f.producto === 'Sudadera Retro 90s')?.inversion || 0;
    const invCrec = pl.filas.find((f) => f.producto === 'Abrigo Lana Premium')?.inversion || 0;
    caso('e2e: declive (Sudadera Retro 90s) recibe ≤ que crecimiento (Abrigo Lana Premium)',
      invDecl <= invCrec, `Retro=${Math.round(invDecl)}€ Abrigo=${Math.round(invCrec)}€`);
    // Cruce de demanda Reposición(H12) == Plan/demandaProducto(,12)
    const rep = recomendarReposicion(m, { producto: 'Vaquero Slim Comfort', leadSemanas: 8 });
    const d = demandaProducto(m, 'Vaquero Slim Comfort', 12);
    caso('e2e: demanda P50 coincide entre Reposición(H12) y Plan(,12)', rep.escenarios.esperado === Math.round(d.q(0.5)));
  }
}

console.log('\n— E2E SUCIO: ventas_sucias_estres.csv (estrés del pipeline) —');
{
  let txt = null;
  try { txt = readFileSync(new URL('../ventas_sucias_estres.csv', import.meta.url), 'utf8'); } catch { /* fixture ausente */ }
  if (!txt) {
    console.log('  · (omitido: ventas_sucias_estres.csv no está en la raíz del repo)');
  } else {
    const pc = procesarCSV(txt);
    caso('e2e sucio: cabeceras sucias (inglés/Shopify + columnas basura) reconocidas, NO rechaza', pc.ok === true);
    const m = prepararMotor(parsearVentas(pc.headers, pc.rows).records);
    caso('e2e sucio: degrada con aviso — 13 filas descartadas (1 por fecha inverosímil, 12 por fecha inválida)',
      m.perfil.descartadas === 13 && m.perfil.fechasInverosimiles === 1, `desc=${m.perfil.descartadas}, inv=${m.perfil.fechasInverosimiles}`);
    const prods = productosOrdenados(m).map((p) => p.nombre);
    const claves = prods.map((n) => n.trim().replace(/\s+/g, ' ').toLowerCase());
    caso('e2e sucio: nombres unificados — ningún producto difiere solo en mayúsculas/espacios',
      claves.length === new Set(claves).size, `${prods.length} productos`);
    const pl = generarPlanCompra(m, { presupuesto: 20000, horizonte: 12, margenPct: 60 });
    caso('e2e sucio: plan ok, no gasta de más, margen finito (negativos/duplicados/precios sucios no rompen)',
      pl.ok === true && pl.gastado <= 20000 + 1e-6 && Number.isFinite(pl.margenEsperado));
  }
}

// Resumen propio + salida solo si se ejecuta directamente (no al integrarse).
const esMain = import.meta.url === `file://${process.argv[1]}`;
if (esMain) {
  console.log(`\nPipeline: ${contador.verdes} verdes · ${contador.pendientes} pendientes · ${contador.fallos} fallos\n`);
  process.exit(contador.fallos === 0 ? 0 : 1);
}
