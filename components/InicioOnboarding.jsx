'use client';

// Pantalla de Inicio (onboarding por pasos) del producto. Presentador PURO: el
// estado real de cada paso (¿hay datos?, ¿guardó?, ¿pidió recomendación?…) lo
// calcula el shell a partir de su estado existente y lo pasa aquí. Los checks
// no son decorativos: reflejan lo que el usuario ha hecho de verdad.
import React from 'react';

const TXT = 'var(--txt)';
const TXT2 = 'var(--txt-2)';
const TXT3 = 'var(--txt-3)';
const OK = 'var(--ok)';
const LABEL = 'font-mono text-[10px] tracking-[0.18em] uppercase';

function IconoCheck() {
  return (
    <span className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0" style={{ background: 'rgba(107,203,154,0.16)' }}>
      <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke={OK} strokeWidth="1.6" aria-hidden="true">
        <path d="M3 7.5 L6 10.5 L11 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function IconoVacio() {
  return (
    <span className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 border" style={{ borderColor: 'var(--line-hover)' }} aria-hidden="true" />
  );
}

function Tarjeta({ paso, onIr }) {
  return (
    <div
      className="rounded-xl border p-5 md:p-6 flex flex-col transition-all duration-300"
      style={{
        borderColor: paso.hecho ? 'rgba(107,203,154,0.3)' : 'var(--brand-line)',
        background: 'var(--card-grad)',
        opacity: paso.hecho ? 0.72 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        {paso.hecho ? <IconoCheck /> : <IconoVacio />}
        <div className="min-w-0">
          <div className="text-[15px] leading-snug" style={{ color: TXT }}>{paso.titulo}</div>
          <p className="mt-1 text-[13px] leading-snug" style={{ color: TXT2 }}>{paso.desc}</p>
        </div>
      </div>
      <div className="mt-4">
        {paso.hecho ? (
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: OK }}>Hecho ✓</span>
        ) : (
          <button
            type="button"
            onClick={() => onIr(paso.destino)}
            className="btn-sheen h-10 px-4 rounded-lg border border-brandLine font-mono text-[11px] tracking-[0.1em] uppercase text-txt transition-colors"
            style={{ background: 'var(--tint-brand)' }}
          >
            {paso.cta} →
          </button>
        )}
      </div>
    </div>
  );
}

export default function InicioOnboarding({ progreso, completados, total, imprescindibles, recomendados, onIr }) {
  const todoListo = completados >= total;
  const motivador = progreso === 0
    ? 'Empieza por subir tus ventas.'
    : progreso < 67
      ? 'Buen comienzo, sigue así.'
      : progreso < 100
        ? 'Casi lo tienes.'
        : '¡Listo! Wefty ya trabaja con tus datos.';

  return (
    <div className="space-y-8">
      {/* Cabecera + barra de progreso */}
      <div className="rounded-2xl border border-brandLine p-6 md:p-8" style={{ background: 'linear-gradient(150deg, var(--tint-brand) 0%, var(--surface-2) 70%)' }}>
        <div className={LABEL} style={{ color: 'var(--brand-soft)' }}>
          {todoListo ? 'Todo en marcha' : 'Bienvenido a Wefty'}
        </div>
        <h2 className="mt-2 font-display font-bold text-[24px] md:text-[32px] leading-[1.1] tracking-[-0.02em] max-w-[24ch]" style={{ color: TXT }}>
          {todoListo
            ? 'Wefty ya trabaja con tus datos.'
            : 'Predice cuánto stock pedir de cada producto, talla y color.'}
        </h2>

        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="font-mono text-[12px] tracking-[0.1em] uppercase tnum" style={{ color: TXT }}>{progreso}% completado</span>
            <span className="font-mono text-[11px] tracking-[0.04em]" style={{ color: TXT2 }}>{motivador}</span>
          </div>
          <div className="mt-2.5 h-2 rounded-full overflow-hidden" style={{ background: 'var(--hairline)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progreso}%`, background: 'linear-gradient(90deg, var(--brand), var(--brand-soft))' }} />
          </div>
        </div>

        {todoListo ? (
          <button
            type="button"
            onClick={() => onIr('resumen')}
            className="btn-sheen mt-6 h-11 px-6 rounded-lg border border-brandLine font-mono text-[11px] tracking-[0.12em] uppercase text-txt transition-colors"
            style={{ background: 'var(--tint-brand)' }}
          >
            Ir a mi Resumen →
          </button>
        ) : null}
      </div>

      {/* Para empezar — completo si falta algo; colapsado si ya está todo */}
      <div>
        <div className={LABEL} style={{ color: TXT2 }}>Para empezar</div>
        {todoListo ? (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {imprescindibles.map((p) => (
              <span key={p.id} className="flex items-center gap-2 text-[13px]" style={{ color: TXT2 }}>
                <svg viewBox="0 0 14 14" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke={OK} strokeWidth="1.6" aria-hidden="true">
                  <path d="M3 7.5 L6 10.5 L11 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {p.titulo}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            {imprescindibles.map((p) => <Tarjeta key={p.id} paso={p} onIr={onIr} />)}
          </div>
        )}
      </div>

      {/* Saca más partido */}
      <div>
        <div className={LABEL} style={{ color: TXT2 }}>Saca más partido</div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          {recomendados.map((p) => <Tarjeta key={p.id} paso={p} onIr={onIr} />)}
        </div>
      </div>

      {/* Ayuda discreta */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-hairlineSoft mt-2" style={{ paddingTop: '1.25rem' }}>
        <span className="text-[13px]" style={{ color: TXT2 }}>¿Dudas sobre cómo empezar?</span>
        <a href="mailto:hola@wefty.co" className="font-mono text-[11px] tracking-[0.1em] uppercase transition-opacity hover:opacity-70" style={{ color: 'var(--brand-soft)' }}>
          Escríbenos →
        </a>
      </div>
    </div>
  );
}
