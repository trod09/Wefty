'use client';

// Página /upload — Loop, primera funcionalidad.
// El usuario elige un archivo CSV; lo leemos en el navegador (nada se envía a
// ningún servidor) y mostramos un dashboard de análisis + tabla de datos.
//
// Estética "dark editorial premium": fondo casi-negro con gradiente, textura de
// rejilla oscura, superficies con gradiente sutil y acento eléctrico.
import React, { useState } from 'react';
import { Reveal } from '@/components/hooks';
import { Hairline, UnderlineLink } from '@/components/primitives';
import { CornerCrosshairs, Fn } from '@/components/decor';
import SalesDashboard from '@/components/SalesDashboard';

// Clases de etiqueta mono reutilizadas
const MONO = 'font-mono text-[10px] tracking-[0.18em] uppercase';
const SURFACE_BG = 'linear-gradient(150deg, #16171b 0%, #121316 100%)';

// Separa una línea de CSV en columnas, respetando las comillas dobles
// (un dato "entre comillas" puede contener comas sin que cuenten como
// separador, y dos comillas seguidas "" representan una comilla literal).
function parseCsvLine(line) {
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
    } else if (ch === ',') {
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

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setResult(null);

    try {
      const text = await file.text();
      // Contamos las líneas no vacías. Asumimos que la primera es el
      // encabezado (los títulos de las columnas), así que las filas de
      // datos son el total de líneas menos esa primera.
      const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== '');
      const totalLines = lines.length;
      const dataRows = Math.max(totalLines - 1, 0);
      // La primera línea son las cabeceras; el resto, filas de datos.
      const headers = lines.length ? parseCsvLine(lines[0]) : [];
      const rows = lines.slice(1).map(parseCsvLine);
      setResult({ name: file.name, dataRows, totalLines, headers, rows });
    } catch {
      setError('No se pudo leer el archivo. Inténtalo de nuevo.');
    }
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden text-[#F5F5F7]"
      style={{ background: 'radial-gradient(135% 90% at 50% 0%, #0F1014 0%, #0A0A0B 55%)' }}
    >
      <div className="absolute inset-0 grid-noise-dark opacity-70 pointer-events-none" />

      <div className="relative max-w-[1440px] mx-auto px-8 md:px-12 pt-24 md:pt-32 pb-24">
        {/* Top bar */}
        <div className="flex items-baseline justify-between">
          <UnderlineLink href="/" dark className="font-serif text-[22px] tracking-[-0.02em]">
            Weft
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
                <span className={MONO} style={{ color: '#8A8A8F' }}>Archivo analizado</span>
                <div className="mt-2 font-serif text-[24px] md:text-[32px] leading-tight tracking-[-0.01em] break-all">
                  {result.name}
                </div>
              </div>
              <span className={MONO} style={{ color: '#8A8A8F' }}>
                {result.dataRows.toLocaleString('es-ES')} filas · {result.headers.length} columnas
              </span>
            </div>

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
