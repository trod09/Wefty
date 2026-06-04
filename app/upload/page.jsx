'use client';

// Página /upload — Loop, primera funcionalidad.
// El usuario elige un archivo CSV; leemos su contenido en el navegador
// (no se envía a ningún servidor, no se guarda nada todavía) y mostramos
// el nombre del archivo y cuántas filas de datos tiene.
//
// El diseño reutiliza el lenguaje visual de la landing: fondo bone + grid-noise,
// SectionLabel numerada, hairlines, crosshairs en las esquinas y métricas en
// serif con número que cuenta solo (useCountUp).
import React, { useState } from 'react';
import { Reveal, useCountUp } from '@/components/hooks';
import { SectionLabel, MonoLabel, Hairline, UnderlineLink } from '@/components/primitives';
import { CornerCrosshairs, Fn } from '@/components/decor';

// Número grande que cuenta desde 0 hasta el valor — como las métricas del Hero.
function CountMetric({ value, label }) {
  const v = useCountUp(value, { isIn: true, duration: 1100 });
  return (
    <div>
      <div className="font-serif text-[56px] md:text-[72px] leading-none tracking-[-0.02em] tnum">
        {v.toLocaleString()}
      </div>
      <div className="mt-3 font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">
        {label}
      </div>
    </div>
  );
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
      setResult({ name: file.name, dataRows, totalLines });
    } catch {
      setError('No se pudo leer el archivo. Inténtalo de nuevo.');
    }
  }

  return (
    <main className="relative min-h-screen bg-bone text-ink overflow-hidden">
      <div className="absolute inset-0 grid-noise opacity-60 pointer-events-none" />

      <div className="relative max-w-[1440px] mx-auto px-8 md:px-12 pt-24 md:pt-32 pb-24">
        {/* Top bar */}
        <div className="flex items-baseline justify-between">
          <UnderlineLink href="/" className="font-serif text-[22px] tracking-[-0.02em]">
            Weft
          </UnderlineLink>
          <MonoLabel>Loop · subir datos</MonoLabel>
        </div>

        <Hairline className="mt-6" />

        {/* Section label row */}
        <div className="grid grid-cols-12 gap-6 mt-16 md:mt-20">
          <div className="col-span-12 md:col-span-7">
            <SectionLabel index="00" title="Upload — Tus datos de ventas." />
          </div>
          <div className="col-span-12 md:col-span-5 md:text-right">
            <MonoLabel>Paso 01 · sin guardar todavía</MonoLabel>
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
              <p className="text-[18px] md:text-[20px] leading-[1.45] text-ash-600 max-w-[34ch]">
                Elige un archivo CSV con tus datos de ventas. De momento solo te
                mostramos el nombre del archivo y cuántas filas contiene. Nada se
                guarda ni viaja a ningún servidor<Fn n={1} /> — todo pasa dentro de
                tu navegador.
              </p>
            </Reveal>
          </div>

          <div className="col-span-12 md:col-span-6 md:col-start-7">
            <Reveal delay={150}>
              <div className="relative border border-ink/12 bg-cream/40 p-8 md:p-10">
                <CornerCrosshairs size={12} inset={10} />
                <MonoLabel>Archivo CSV</MonoLabel>

                <div className="mt-6">
                  <label
                    htmlFor="csv-input"
                    className="relative inline-flex items-center justify-center gap-3 px-7 h-12 font-medium text-[14px] tracking-[-0.005em] bg-ink text-bone hover:bg-electric transition-colors cursor-pointer select-none"
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

                <p className="mt-6 text-[13px] leading-relaxed text-ash-500">
                  Exporta tu CSV desde Shopify o una hoja de cálculo. La primera
                  fila debe ser el encabezado con los nombres de las columnas.
                </p>

                {error ? (
                  <p className="mt-6 font-mono text-[12px] tracking-[0.04em] text-ember">{error}</p>
                ) : null}
              </div>
            </Reveal>
          </div>
        </div>

        {/* Result */}
        {result ? (
          <div className="mt-20 md:mt-28">
            <Hairline />
            <div className="grid grid-cols-12 gap-6 pt-10">
              <div className="col-span-12 md:col-span-4">
                <MonoLabel>Archivo</MonoLabel>
                <div className="mt-3 font-serif text-[22px] md:text-[28px] leading-tight tracking-[-0.01em] break-all">
                  {result.name}
                </div>
              </div>
              <div className="col-span-6 md:col-span-4 md:border-l md:border-ink/10 md:pl-8">
                <CountMetric value={result.dataRows} label="Filas de datos" />
              </div>
              <div className="col-span-6 md:col-span-4 md:border-l md:border-ink/10 md:pl-8">
                <CountMetric value={result.totalLines} label="Líneas totales · con encabezado" />
              </div>
            </div>
          </div>
        ) : null}

        {/* Footnote */}
        <div className="mt-24 md:mt-32">
          <Hairline />
          <p className="mt-6 font-mono text-[10px] tracking-[0.18em] uppercase text-ash-500">
            <Fn n={1} /> Lectura local · nada sale de tu dispositivo
          </p>
        </div>
      </div>
    </main>
  );
}
