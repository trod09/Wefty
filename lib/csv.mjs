// Parseo de números de CSV — módulo compartido por el pipeline de carga
// (app/upload/page.jsx), el dashboard (components/SalesDashboard.jsx) y las
// pruebas (scripts/test-pipeline.mjs). Antes estas funciones estaban duplicadas
// dentro de cada componente; extraerlas aquí evita que diverjan.

// Resuelve separadores de miles y decimales en una cadena YA limpia de símbolos.
// Convención: el ÚLTIMO separador que aparece es el decimal cuando hay de los dos;
// un único separador con exactamente 3 dígitos detrás es de MILES (1.000 → 1000,
// igual que 1,234 → 1234), y con otro número de dígitos es decimal (19,90 / 19.90).
// Multipunto/multicoma ambiguo (1.234.567) se deja tal cual → Number lo rechaza.
function resolverSeparadores(s) {
  const ld = s.lastIndexOf('.');
  const lc = s.lastIndexOf(',');
  if (ld >= 0 && lc >= 0) {
    if (lc > ld) return s.replace(/\./g, '').replace(',', '.'); // 1.234,56 → 1234.56
    return s.replace(/,/g, '');                                 // 1,234.56 → 1234.56
  }
  if (lc >= 0) {
    const p = s.split(',');
    if (p.length === 2 && p[1].length !== 3) return p.join('.'); // 12,5 → 12.5 (decimal)
    return p.join('');                                           // 1,234 → 1234 (miles)
  }
  if (ld >= 0) {
    const p = s.split('.');
    if (p.length === 2 && p[1].length === 3) return p.join('');  // 1.000 → 1000 (miles)
    // resto: 19.90 / 1.5 decimal · 1.234.567 → queda y Number lo rechaza
  }
  return s;
}

// parseNumero — versión del dashboard: tolera símbolos €/$/£/% y espacios.
export function parseNumero(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/[€$£%\s]/g, '');
  if (s === '') return null;
  const n = Number(resolverSeparadores(s));
  return Number.isFinite(n) ? n : null;
}

// parseNumeroLaxo — versión del guardado: descarta TODO lo que no sea dígito,
// punto, coma o signo antes de interpretar (admite cualquier símbolo extraño).
export function parseNumeroLaxo(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/[^0-9.,-]/g, '');
  if (s === '') return null;
  const n = Number(resolverSeparadores(s));
  return Number.isFinite(n) ? n : null;
}
