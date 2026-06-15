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


// Unifica nombres que solo difieren en mayúsculas/espacios (típico de exports
// reales: "Camiseta Básica" vs "CAMISETA BÁSICA" vs "  camiseta básica "). Agrupa
// por clave normalizada (trim + espacios colapsados + minúsculas) y reescribe cada
// registro con la grafía MÁS FRECUENTE del grupo. Aplica a producto, categoría y
// color (la talla ya se normaliza a mayúsculas en el parseo). No fusiona nombres
// realmente distintos: solo variantes de capitalización/espacios.
const claveNombre = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
export function unificarNombres(records, campos = ['producto', 'categoria', 'color']) {
  const canon = {};
  for (const campo of campos) {
    const cuentas = new Map(); // clave → Map(grafía → nº de filas)
    for (const r of records) {
      const k = claveNombre(r[campo]);
      if (!k) continue;
      const grafia = String(r[campo]).trim().replace(/\s+/g, ' ');
      const m = cuentas.get(k) || new Map();
      m.set(grafia, (m.get(grafia) || 0) + 1);
      cuentas.set(k, m);
    }
    const elegida = new Map();
    for (const [k, m] of cuentas) {
      let mejor = null, mejorN = -1;
      for (const [grafia, n] of m) if (n > mejorN) { mejorN = n; mejor = grafia; }
      elegida.set(k, mejor);
    }
    canon[campo] = elegida;
  }
  return records.map((r) => {
    const out = { ...r };
    for (const campo of campos) {
      const k = claveNombre(r[campo]);
      if (k && canon[campo].has(k)) out[campo] = canon[campo].get(k);
    }
    return out;
  });
}
