'use client';

// Pantalla de bienvenida (onboarding) para usuarios nuevos de Wefty/Loop.
// Se muestra en /upload SOLO cuando el usuario aún no tiene ventas guardadas y
// todavía no ha subido ningún CSV en esta visita. Su misión: explicar en una
// frase qué hace Wefty y guiar al usuario a subir su primer CSV de ventas.
//
// Reutiliza el mismo manejador de subida (`onFile`) y el mismo mensaje de error
// que la página /upload, así que la subida, la detección de columnas y el
// guardado siguen funcionando exactamente igual. Mismo lenguaje visual "dark
// editorial premium" que el resto de /upload.
import React from 'react';
import { Reveal } from '@/components/hooks';
import { Hairline, UnderlineLink } from '@/components/primitives';
import { CornerCrosshairs, Fn } from '@/components/decor';
import SessionBadge from '@/components/SessionBadge';

const MONO = 'font-mono text-[10px] tracking-[0.18em] uppercase';
const SURFACE_BG = 'linear-gradient(150deg, #16171b 0%, #121316 100%)';

export default function UploadWelcome({ onFile, error }) {
  // Pasos para empezar — en lenguaje claro, con numeración mono al estilo Loop.
  const pasos = [
    { n: '01', body: (
      <>Exporta tu CSV de ventas desde tu plataforma — <span style={{ color: '#F5F5F7' }}>Shopify u otra</span> — en formato CSV.</>
    ) },
    { n: '02', body: (
      <>Súbelo aquí. Detectamos las columnas por ti, vengan en español o inglés.</>
    ) },
    { n: '03', body: (
      <>Verás al instante qué se vende, qué stock pedir y qué casi no rota.</>
    ) },
  ];

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
          <span className={MONO} style={{ color: '#8A8A8F' }}>Loop · bienvenida</span>
        </div>

        <Hairline dark className="mt-6" />

        {/* Section label row */}
        <div className="grid grid-cols-12 gap-6 mt-16 md:mt-20">
          <div className="col-span-12 md:col-span-7 flex items-baseline gap-4">
            <span className="font-mono text-[11px] tracking-[0.18em] tnum" style={{ color: '#5d5e63' }}>[00]</span>
            <span className="font-mono text-[11px] tracking-[0.18em] uppercase" style={{ color: '#8A8A8F' }}>
              Bienvenida — Empieza aquí.
            </span>
          </div>
          <div className="col-span-12 md:col-span-5 md:text-right">
            <span className={MONO} style={{ color: '#8A8A8F' }}>Paso 01 · tu primer CSV</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="mt-8 font-serif font-light leading-[0.94] tracking-[-0.035em] text-[12vw] md:text-[84px] lg:text-[100px] max-w-[14ch]">
          Bienvenido a Wefty.
        </h1>

        {/* Subtitle — qué hace Wefty, en una frase */}
        <Reveal>
          <p className="mt-8 text-[20px] md:text-[24px] leading-[1.4] max-w-[40ch]" style={{ color: '#b9b9be' }}>
            Wefty analiza tus ventas y te muestra qué stock funciona y qué deberías pedir.
          </p>
        </Reveal>

        {/* Pasos + tarjeta de subida */}
        <div className="grid grid-cols-12 gap-6 mt-12 md:mt-16">
          {/* Izquierda: cómo empezar */}
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              <span className={MONO} style={{ color: '#8A8A8F' }}>Cómo empezar</span>
              <ol className="mt-6 space-y-5">
                {pasos.map((p) => (
                  <li key={p.n} className="flex gap-4">
                    <span className="font-mono text-[11px] tracking-[0.18em] tnum pt-1" style={{ color: '#5d5e63' }}>[{p.n}]</span>
                    <p className="text-[16px] md:text-[17px] leading-[1.5]" style={{ color: '#8A8A8F' }}>{p.body}</p>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>

          {/* Derecha: tarjeta de subida destacada (CTA principal) */}
          <div className="col-span-12 md:col-span-6 md:col-start-7">
            <Reveal delay={150}>
              <div
                className="relative rounded-xl border border-[#2a3654] p-8 md:p-10 transition-all duration-300 hover:border-[#3a4d7a]"
                style={{
                  background: SURFACE_BG,
                  boxShadow: '0 0 80px -30px rgba(45,107,228,0.55)',
                }}
              >
                <CornerCrosshairs size={12} inset={10} color="#F5F5F7" opacity={0.35} />
                <span className={MONO} style={{ color: '#9db4ec' }}>Sube tu CSV de ventas</span>

                <p className="mt-4 text-[15px] leading-relaxed" style={{ color: '#b9b9be' }}>
                  Elige tu archivo. La primera fila debe ser el encabezado con los
                  nombres de las columnas.
                </p>

                <div className="mt-7">
                  <label
                    htmlFor="csv-welcome-input"
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
                    id="csv-welcome-input"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={onFile}
                    className="sr-only"
                  />
                </div>

                {/* Nota tranquilizadora — no hace falta un formato exacto */}
                <p className="mt-7 text-[13px] leading-relaxed" style={{ color: '#6f7075' }}>
                  Wefty detecta las columnas automáticamente, así que tu CSV no
                  necesita tener un formato exacto<Fn n={1} />. Admitimos nombres en
                  español o inglés, en cualquier orden y con columnas de más.
                </p>

                {error ? (
                  <p className="mt-6 font-mono text-[12px] tracking-[0.04em]" style={{ color: '#E07A5F' }}>{error}</p>
                ) : null}
              </div>
            </Reveal>
          </div>
        </div>

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
