'use client';

// Página /upload — Loop, primera funcionalidad.
// El usuario elige un archivo CSV; lo leemos en el navegador (nada se envía a
// ningún servidor) y mostramos un dashboard de análisis + tabla de datos.
//
// Estética "dark editorial premium": fondo casi-negro con gradiente, textura de
// rejilla oscura, superficies con gradiente sutil y acento eléctrico.
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Reveal } from '@/components/hooks';
import { Hairline, UnderlineLink } from '@/components/primitives';
import { CornerCrosshairs, Fn } from '@/components/decor';
import SalesDashboard from '@/components/SalesDashboard';
import SessionBadge from '@/components/SessionBadge';
import UploadWelcome from '@/components/UploadWelcome';
import { supabase } from '@/lib/supabase';

// Columnas de la tabla "ventas" en Supabase y cómo convertir cada valor.
// 'int'  → número entero, 'num' → número decimal, 'text' → texto tal cual.
const VENTAS_COLUMNS = {
  fecha: 'text',
  producto: 'text',
  categoria: 'text',
  talla: 'text',
  color: 'text',
  unidades_vendidas: 'int',
  precio_unitario: 'num',
  ingresos: 'num',
};

// "Traductor de columnas": los 8 campos que el dashboard necesita, con el
// nombre de su columna en la tabla (dbCol), el tipo de dato y una lista de
// nombres equivalentes (sinónimos) en español e inglés. Sirve para reconocer
// CSVs reales aunque sus cabeceras se llamen distinto o vengan en otro orden.
const CANON_FIELDS = [
  { key: 'fecha', dbCol: 'fecha', kind: 'date', label: 'fecha',
    synonyms: ['fecha', 'date', 'dia', 'day', 'order date', 'fecha de pedido', 'fecha de venta', 'fecha pedido', 'created at', 'created', 'paid at', 'processed at', 'fulfilled at', 'order_date'] },
  { key: 'producto', dbCol: 'producto', kind: 'text', label: 'producto',
    synonyms: ['producto', 'product', 'item', 'articulo', 'product title', 'product name', 'lineitem name', 'line item', 'nombre', 'nombre producto', 'name', 'title', 'sku'] },
  { key: 'categoria', dbCol: 'categoria', kind: 'text', label: 'categoría',
    synonyms: ['categoria', 'category', 'product type', 'type', 'tipo', 'familia', 'collection', 'coleccion', 'product category', 'grupo'] },
  { key: 'talla', dbCol: 'talla', kind: 'text', label: 'talla',
    synonyms: ['talla', 'size', 'variant', 'variante', 'variant title', 'tallas', 'option1 value', 'option value', 'talla size'] },
  { key: 'color', dbCol: 'color', kind: 'text', label: 'color',
    synonyms: ['color', 'colour', 'colores', 'option2 value', 'color variante'] },
  { key: 'unidades', dbCol: 'unidades_vendidas', kind: 'int', label: 'unidades',
    synonyms: ['unidades', 'unidades vendidas', 'unidades_vendidas', 'cantidad', 'quantity', 'qty', 'units', 'units sold', 'cant', 'lineitem quantity', 'net items sold', 'items'] },
  { key: 'precio', dbCol: 'precio_unitario', kind: 'num', label: 'precio',
    synonyms: ['precio', 'precio unitario', 'precio_unitario', 'price', 'unit price', 'lineitem price', 'pvp', 'precio venta', 'sale price', 'variant price'] },
  { key: 'ingresos', dbCol: 'ingresos', kind: 'num', label: 'ingresos',
    synonyms: ['ingresos', 'revenue', 'importe', 'total', 'total sales', 'ventas', 'sales', 'amount', 'importe total', 'total price', 'gross sales', 'net sales', 'subtotal', 'facturacion', 'facturación'] },
];

// Normaliza un texto para comparar cabeceras: minúsculas, sin acentos, y con
// guiones bajos/medios convertidos en espacios y espacios colapsados.
function normalizeText(s) {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

// Mantiene el nombre antiguo (lo usa el guardado) apuntando al normalizador.
function normalizeHeader(h) {
  return normalizeText(h);
}

// Detecta qué columna del CSV corresponde a cada uno de los 8 campos.
// Devuelve un objeto { fecha: índice, producto: índice, ... }. Si no encuentra
// un campo, su índice queda sin definir. Cada columna se asigna a un solo campo.
// Primero busca coincidencias exactas; luego, coincidencias parciales.
function detectMapping(headers) {
  const norm = headers.map(normalizeText);
  const used = new Array(headers.length).fill(false);
  const mapping = {};

  // Paso 1 — coincidencia exacta (la cabecera es igual a un sinónimo).
  for (const f of CANON_FIELDS) {
    for (let i = 0; i < norm.length; i++) {
      if (used[i] || !norm[i]) continue;
      if (f.synonyms.some((s) => normalizeText(s) === norm[i])) {
        mapping[f.key] = i;
        used[i] = true;
        break;
      }
    }
  }

  // Paso 2 — coincidencia parcial (la cabecera contiene un sinónimo o viceversa).
  for (const f of CANON_FIELDS) {
    if (mapping[f.key] != null) continue;
    for (let i = 0; i < norm.length; i++) {
      if (used[i] || !norm[i]) continue;
      const h = norm[i];
      if (f.synonyms.some((s) => {
        const ns = normalizeText(s);
        return ns.length >= 3 && (h.includes(ns) || ns.includes(h));
      })) {
        mapping[f.key] = i;
        used[i] = true;
        break;
      }
    }
  }

  return mapping;
}

// Convierte un número escrito de cualquier forma a un número de verdad.
// Tolera símbolos (€, $, %), espacios y separadores de miles, tanto en formato
// europeo (1.234,56) como anglosajón (1,234.56). Devuelve null si no es válido.
function parseNumberLoose(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[^0-9.,-]/g, '');
  if (s === '') return null;
  const ld = s.lastIndexOf('.');
  const lc = s.lastIndexOf(',');
  if (ld >= 0 && lc >= 0) {
    // Si hay punto y coma, el último que aparece es el separador decimal.
    if (lc > ld) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56 → 1234.56
    else s = s.replace(/,/g, '');                            // 1,234.56 → 1234.56
  } else if (lc >= 0) {
    const p = s.split(',');
    // Una sola coma: decimal (12,5) salvo que parezca separador de miles (1,234).
    if (p.length === 2 && p[1].length !== 3) s = p.join('.');
    else s = p.join('');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Normaliza una fecha al formato AAAA-MM-DD que esperan el dashboard y Supabase.
// Reconoce ISO (2026-06-08, con o sin hora), día/mes/año europeo (08/06/2026) y
// año/mes/día. Si no reconoce el formato, devuelve el texto tal cual.
function normalizeDate(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ymd = s.match(/^(\d{4})[/](\d{1,2})[/](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return s;
}

// Convierte el texto de una celda al tipo que espera la columna.
// Si el número no es válido, devuelve null (Supabase lo guarda vacío).
function castValue(raw, kind) {
  const value = (raw ?? '').trim();
  if (kind === 'text') return value;
  if (value === '') return null;
  const n = parseNumberLoose(value);
  if (n == null) return null;
  return kind === 'int' ? Math.round(n) : n;
}

// Clases de etiqueta mono reutilizadas
const MONO = 'font-mono text-[10px] tracking-[0.18em] uppercase';
const SURFACE_BG = 'linear-gradient(150deg, #16171b 0%, #121316 100%)';

// Detecta el separador del CSV mirando la primera línea: cuenta comas y
// puntos y coma FUERA de comillas y gana el que más aparezca. Así los Excel
// europeos (que exportan con ";" y decimales tipo "129,90") funcionan igual.
function detectarSeparador(linea) {
  let comas = 0;
  let puntoYComas = 0;
  let inQuotes = false;
  for (const ch of linea) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === ',') comas += 1;
      else if (ch === ';') puntoYComas += 1;
    }
  }
  return puntoYComas > comas ? ';' : ',';
}

// Separa una línea de CSV en columnas usando el separador indicado (coma o
// punto y coma), respetando las comillas dobles (un dato "entre comillas"
// puede contener separadores sin que cuenten, y dos comillas seguidas ""
// representan una comilla literal).
function parseCsvLine(line, sep = ',') {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // comilla escapada
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

export default function UploadPage() {
  const [result, setResult] = useState(null); // { name, dataRows, totalLines }
  const [error, setError] = useState('');
  // Estado del guardado en Supabase: 'idle' | 'saving' | 'done' | 'error'
  const [saveState, setSaveState] = useState('idle');
  const [saveMessage, setSaveMessage] = useState('');
  // Guardián de acceso: 'checking' | 'authed' | 'guest'
  const [auth, setAuth] = useState('checking');
  // Estado de la lectura de ventas guardadas del usuario:
  // 'checking' (aún consultando) | 'empty' (no tiene datos → usuario nuevo) |
  // 'loaded' (sí tiene datos). Decide si mostramos la bienvenida o el panel.
  const [savedState, setSavedState] = useState('checking');
  const router = useRouter();

  // Protege la página: solo se ve con sesión iniciada. Si no hay sesión,
  // redirige a /login. También redirige si el usuario cierra sesión aquí.
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setAuth('authed');
      } else {
        setAuth('guest');
        router.replace('/login');
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAuth('authed');
      } else {
        setAuth('guest');
        router.replace('/login');
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  // Al confirmar la sesión, leemos las ventas guardadas de ESTE usuario y, si
  // hay, mostramos el dashboard con ellas. El RLS de Supabase garantiza que
  // cada usuario solo recibe sus propias filas.
  useEffect(() => {
    if (auth !== 'authed') return;
    let mounted = true;
    setSavedState('checking');

    const cols = Object.keys(VENTAS_COLUMNS); // orden fijo de columnas
    supabase
      .from('ventas')
      .select(cols.join(','))
      .order('fecha', { ascending: true })
      .then(({ data, error }) => {
        if (!mounted) return;
        // Sin filas guardadas (o error al leer): es un usuario nuevo → bienvenida.
        if (error || !data || data.length === 0) {
          setSavedState('empty');
          return;
        }

        // Pasamos las filas (objetos) al formato { headers, rows } del dashboard.
        const rows = data.map((r) => cols.map((c) => (r[c] == null ? '' : String(r[c]))));
        // Solo rellenamos si el usuario no ha subido ya un CSV en esta visita.
        setResult((prev) =>
          prev ?? {
            name: 'Tus ventas guardadas',
            source: 'db',
            dataRows: rows.length,
            totalLines: rows.length + 1,
            headers: cols,
            rows,
          }
        );
        setSavedState('loaded');
      });

    return () => {
      mounted = false;
    };
  }, [auth]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setResult(null);
    // Al cargar un archivo nuevo, reseteamos cualquier mensaje de guardado previo.
    setSaveState('idle');
    setSaveMessage('');

    try {
      const text = await file.text();
      // Quitamos las líneas vacías. La primera es el encabezado; el resto, datos.
      const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== '');
      // Separador detectado en el encabezado: coma o punto y coma (Excel europeo).
      const sep = lines.length ? detectarSeparador(lines[0]) : ',';
      const rawHeaders = lines.length ? parseCsvLine(lines[0], sep) : [];
      const rawRows = lines.slice(1).map((line) => parseCsvLine(line, sep));

      // Detectamos qué columna del CSV corresponde a cada campo que necesitamos.
      const mapping = detectMapping(rawHeaders);
      const missing = CANON_FIELDS.filter((f) => mapping[f.key] == null);

      if (missing.length > 0) {
        // Falta algún campo importante: avisamos en claro y no mostramos nada.
        const faltan = missing.map((f) => f.label).join(', ');
        setError(
          `No reconocimos la columna para: ${faltan}. Tu CSV debe incluir esos datos ` +
          `(admitimos nombres en español o inglés, en cualquier orden y con columnas de más). ` +
          `Revisa las cabeceras de tu archivo.`
        );
        return;
      }

      // Reorganizamos el CSV a nuestras 8 columnas estándar, en orden fijo.
      // Así el dashboard y el guardado reciben siempre el mismo formato.
      const headers = CANON_FIELDS.map((f) => f.dbCol);
      const rows = rawRows.map((row) =>
        CANON_FIELDS.map((f) => {
          const cell = row[mapping[f.key]] ?? '';
          return f.kind === 'date' ? normalizeDate(cell) : String(cell).trim();
        })
      );

      // Guardamos qué columna original detectamos para cada campo (transparencia).
      const detected = CANON_FIELDS.map((f) => ({
        label: f.label,
        from: rawHeaders[mapping[f.key]] || '—',
      }));

      setResult({
        name: file.name,
        source: 'csv',
        dataRows: rows.length,
        totalLines: lines.length,
        headers,
        rows,
        detected,
      });
    } catch {
      setError('No se pudo leer el archivo. Inténtalo de nuevo.');
    }
  }

  // Guarda las filas del CSV en la tabla "ventas" de Supabase.
  async function handleSave() {
    if (!result || saveState === 'saving') return;

    setSaveState('saving');
    setSaveMessage('');

    // Emparejamos cada encabezado del CSV con su columna en la tabla.
    // Solo guardamos las columnas que reconocemos (las de VENTAS_COLUMNS).
    const columnByIndex = result.headers.map((h) => {
      const key = normalizeHeader(h);
      return VENTAS_COLUMNS[key] ? key : null;
    });

    if (!columnByIndex.some(Boolean)) {
      setSaveState('error');
      setSaveMessage(
        'No reconocimos ninguna columna. Las cabeceras deben llamarse: ' +
          Object.keys(VENTAS_COLUMNS).join(', ') + '.'
      );
      return;
    }

    // Averiguamos qué usuario tiene la sesión: marcaremos cada fila con su
    // user_id. Las políticas RLS de Supabase exigen que ese id coincida con
    // la sesión, así que cada quien solo guarda (y ve) sus propios datos.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaveState('error');
      setSaveMessage('Tu sesión ha caducado. Inicia sesión de nuevo para guardar.');
      return;
    }

    // Convertimos cada fila del CSV en un objeto { columna: valor } listo para
    // Supabase, añadiendo el user_id del usuario que está guardando.
    const payload = result.rows.map((row) => {
      const record = { user_id: user.id };
      columnByIndex.forEach((col, i) => {
        if (col) record[col] = castValue(row[i], VENTAS_COLUMNS[col]);
      });
      return record;
    });

    try {
      const { error: dbError } = await supabase.from('ventas').insert(payload);
      if (dbError) {
        setSaveState('error');
        setSaveMessage('No se pudo guardar: ' + dbError.message);
        return;
      }
      setSaveState('done');
      setSaveMessage(
        payload.length.toLocaleString('es-ES') + ' filas guardadas en la base de datos.'
      );
    } catch (err) {
      setSaveState('error');
      setSaveMessage('No se pudo guardar: ' + (err?.message || 'error desconocido') + '.');
    }
  }

  // Mientras comprobamos la sesión (o si no hay y estamos redirigiendo),
  // mostramos una pantalla mínima en vez del contenido de la página.
  if (auth !== 'authed') {
    return (
      <main
        className="relative min-h-screen flex items-center justify-center text-[#F5F5F7]"
        style={{ background: 'radial-gradient(135% 90% at 50% 0%, #0F1014 0%, #0A0A0B 55%)' }}
      >
        <div className="absolute inset-0 grid-noise-dark opacity-70 pointer-events-none" />
        <span className="relative font-mono text-[11px] tracking-[0.18em] uppercase" style={{ color: '#8A8A8F' }}>
          Comprobando acceso…
        </span>
      </main>
    );
  }

  // Ya con sesión: mientras leemos si el usuario tiene ventas guardadas,
  // mostramos un "cargando" mínimo para no parpadear entre bienvenida y panel.
  if (savedState === 'checking' && !result) {
    return (
      <main
        className="relative min-h-screen flex items-center justify-center text-[#F5F5F7]"
        style={{ background: 'radial-gradient(135% 90% at 50% 0%, #0F1014 0%, #0A0A0B 55%)' }}
      >
        <div className="absolute inset-0 grid-noise-dark opacity-70 pointer-events-none" />
        <span className="relative font-mono text-[11px] tracking-[0.18em] uppercase" style={{ color: '#8A8A8F' }}>
          Cargando tu panel…
        </span>
      </main>
    );
  }

  // Usuario nuevo: sin datos guardados y sin CSV subido todavía → pantalla de
  // bienvenida que lo guía a subir su primer CSV. Reutiliza el mismo handleFile.
  if (savedState === 'empty' && !result) {
    return <UploadWelcome onFile={handleFile} error={error} />;
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden text-[#F5F5F7]"
      style={{ background: 'radial-gradient(135% 90% at 50% 0%, #0F1014 0%, #0A0A0B 55%)' }}
    >
      <div className="absolute inset-0 grid-noise-dark opacity-70 pointer-events-none" />

      <SessionBadge />

      <div className="relative max-w-[1440px] mx-auto px-8 md:px-12 pt-24 md:pt-32 pb-24">
        {/* Top bar */}
        <div className="flex items-baseline justify-between">
          <UnderlineLink href="/" dark className="font-serif text-[22px] tracking-[-0.02em]">
            Wefty
          </UnderlineLink>
          <span className={MONO} style={{ color: '#8A8A8F' }}>Loop · subir datos</span>
        </div>

        <Hairline dark className="mt-6" />

        {/* Section label row */}
        <div className="grid grid-cols-12 gap-6 mt-16 md:mt-20">
          <div className="col-span-12 md:col-span-7 flex items-baseline gap-4">
            <span className="font-mono text-[11px] tracking-[0.18em] tnum" style={{ color: '#5d5e63' }}>[00]</span>
            <span className="font-mono text-[11px] tracking-[0.18em] uppercase" style={{ color: '#8A8A8F' }}>
              Upload — Tus datos de ventas.
            </span>
          </div>
          <div className="col-span-12 md:col-span-5 md:text-right">
            <span className={MONO} style={{ color: '#8A8A8F' }}>Paso 01 · sin guardar todavía</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="mt-8 font-serif font-light leading-[0.94] tracking-[-0.035em] text-[12vw] md:text-[84px] lg:text-[100px] max-w-[14ch]">
          Sube tu archivo de ventas.
        </h1>

        {/* Description + upload card */}
        <div className="grid grid-cols-12 gap-6 mt-12 md:mt-16">
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              <p className="text-[18px] md:text-[20px] leading-[1.45] max-w-[34ch]" style={{ color: '#8A8A8F' }}>
                Elige un archivo CSV con tus datos de ventas. Lo analizamos al
                instante y nada se guarda ni viaja a ningún servidor<Fn n={1} /> —
                todo pasa dentro de tu navegador.
              </p>
            </Reveal>
          </div>

          <div className="col-span-12 md:col-span-6 md:col-start-7">
            <Reveal delay={150}>
              <div
                className="relative rounded-xl border border-[#232428] p-8 md:p-10 transition-all duration-300 hover:border-[#3a3c42]"
                style={{ background: SURFACE_BG }}
              >
                <CornerCrosshairs size={12} inset={10} color="#F5F5F7" opacity={0.35} />
                <span className={MONO} style={{ color: '#8A8A8F' }}>Archivo CSV</span>

                <div className="mt-6">
                  <label
                    htmlFor="csv-input"
                    className="relative inline-flex items-center justify-center gap-3 px-7 h-12 font-medium text-[14px] tracking-[-0.005em] text-white rounded-lg cursor-pointer select-none transition-all duration-300 hover:brightness-110"
                    style={{
                      background: 'linear-gradient(135deg, #3F7BEC 0%, #2D6BE4 100%)',
                      boxShadow: '0 0 40px -12px rgba(45,107,228,0.85)',
                    }}
                  >
                    <span className="relative z-10">Seleccionar archivo CSV</span>
                    <span className="relative z-10 w-3 h-3 flex items-center justify-center">
                      <svg viewBox="0 0 12 12" className="w-3 h-3">
                        <path d="M2 6 H10 M7 3 L10 6 L7 9" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinecap="square" />
                      </svg>
                    </span>
                  </label>
                  <input
                    id="csv-input"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFile}
                    className="sr-only"
                  />
                </div>

                <p className="mt-6 text-[13px] leading-relaxed" style={{ color: '#6f7075' }}>
                  Exporta tu CSV desde Shopify o una hoja de cálculo. La primera
                  fila debe ser el encabezado con los nombres de las columnas.
                </p>

                {error ? (
                  <p className="mt-6 font-mono text-[12px] tracking-[0.04em]" style={{ color: '#E07A5F' }}>{error}</p>
                ) : null}
              </div>
            </Reveal>
          </div>
        </div>

        {/* Result */}
        {result ? (
          <div className="mt-20 md:mt-28">
            {/* Cabecera compacta del archivo */}
            <Hairline dark />
            <div className="flex flex-wrap items-baseline justify-between gap-4 pt-8">
              <div>
                <span className={MONO} style={{ color: '#8A8A8F' }}>
                  {result.source === 'db' ? 'Datos guardados' : 'Archivo analizado'}
                </span>
                <div className="mt-2 font-serif text-[24px] md:text-[32px] leading-tight tracking-[-0.01em] break-all">
                  {result.name}
                </div>
              </div>
              <span className={MONO} style={{ color: '#8A8A8F' }}>
                {result.dataRows.toLocaleString('es-ES')} filas · {result.headers.length} columnas
              </span>
            </div>

            {/* Guardar en Supabase — solo para un CSV recién subido. Los datos
                que vienen de la base de datos ya están guardados. */}
            {result.headers.length > 0 && result.source === 'csv' ? (
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveState === 'saving'}
                  className="relative inline-flex items-center justify-center gap-3 px-7 h-12 font-medium text-[14px] tracking-[-0.005em] text-white rounded-lg cursor-pointer select-none transition-all duration-300 hover:brightness-110 disabled:opacity-60 disabled:cursor-default"
                  style={{
                    background: 'linear-gradient(135deg, #3F7BEC 0%, #2D6BE4 100%)',
                    boxShadow: '0 0 40px -12px rgba(45,107,228,0.85)',
                  }}
                >
                  <span className="relative z-10">
                    {saveState === 'saving' ? 'Guardando…' : 'Guardar en la base de datos'}
                  </span>
                </button>

                {saveMessage ? (
                  <span
                    className="font-mono text-[12px] tracking-[0.04em]"
                    style={{ color: saveState === 'error' ? '#E07A5F' : '#6BCB9A' }}
                  >
                    {saveMessage}
                  </span>
                ) : null}
              </div>
            ) : result.source === 'db' ? (
              <p className="mt-8 font-mono text-[12px] tracking-[0.04em]" style={{ color: '#6BCB9A' }}>
                Cargado desde tus datos guardados. Sube un CSV nuevo para añadir más.
              </p>
            ) : null}

            {/* Columnas reconocidas automáticamente — para verificar el emparejamiento */}
            {result.detected ? (
              <details className="mt-8 group">
                <summary className="flex items-center gap-3 cursor-pointer select-none">
                  <span className="font-mono text-[11px] tracking-[0.18em] uppercase transition-colors text-[#8A8A8F] group-hover:text-[#F5F5F7]">
                    Columnas reconocidas automáticamente
                  </span>
                  <span className="font-mono text-[11px] transition-transform group-open:rotate-90" style={{ color: '#5d5e63' }}>›</span>
                </summary>
                <div className="mt-4 flex flex-wrap gap-x-10 gap-y-2.5">
                  {result.detected.map((d) => (
                    <div key={d.label} className="flex items-baseline gap-2.5">
                      <span className={MONO} style={{ color: '#8A8A8F' }}>{d.label}</span>
                      <span className="font-mono text-[11px]" style={{ color: '#5d5e63' }}>←</span>
                      <span className="text-[13px]" style={{ color: '#b9b9be' }}>{d.from}</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            {/* Dashboard de análisis */}
            {result.headers.length > 0 ? (
              <div className="mt-10 md:mt-12">
                <SalesDashboard headers={result.headers} rows={result.rows} />
              </div>
            ) : null}

            {/* Tabla de datos en bruto — plegable, al final */}
            {result.headers.length > 0 ? (
              <details className="mt-16 group">
                <summary className="flex items-center gap-3 cursor-pointer select-none py-4 border-t border-white/10">
                  <span className="font-mono text-[11px] tracking-[0.18em] uppercase transition-colors text-[#8A8A8F] group-hover:text-[#F5F5F7]">
                    Ver datos en bruto · tabla
                  </span>
                  <span className="font-mono text-[11px] transition-transform group-open:rotate-90" style={{ color: '#5d5e63' }}>›</span>
                </summary>
                <div className="mt-4 acc-body">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr>
                          {result.headers.map((h, i) => (
                            <th
                              key={i}
                              className="font-mono text-[10px] tracking-[0.18em] uppercase font-normal py-3 pr-8 border-b border-white/10 whitespace-nowrap align-bottom"
                              style={{ color: '#8A8A8F' }}
                            >
                              {h || `Columna ${i + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.slice(0, 20).map((row, r) => (
                          <tr key={r} className="border-b border-white/[0.06]">
                            {result.headers.map((_, c) => (
                              <td
                                key={c}
                                className="text-[14px] py-3 pr-8 align-top whitespace-nowrap"
                                style={{ color: '#b9b9be' }}
                              >
                                {row[c] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.dataRows > 20 ? (
                    <p className="mt-5 font-mono text-[11px] tracking-[0.08em] uppercase" style={{ color: '#8A8A8F' }}>
                      Mostrando 20 de {result.dataRows.toLocaleString('es-ES')} filas
                    </p>
                  ) : null}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}

        {/* Footnote */}
        <div className="mt-24 md:mt-32">
          <Hairline dark />
          <p className="mt-6 font-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: '#8A8A8F' }}>
            <Fn n={1} /> Lectura local · nada sale de tu dispositivo
          </p>
        </div>
      </div>
    </main>
  );
}
