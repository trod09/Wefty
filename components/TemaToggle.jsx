'use client';

// Interruptor de tema claro/oscuro del producto. El tema se guarda en el
// atributo data-theme del <html> (lo fija sin parpadeo el script del layout) y
// se recuerda en localStorage. La landing no usa este sistema: siempre oscura.
import { useEffect, useState } from 'react';

const CLAVE = 'wefty-tema';

// Hook compartido: lee el tema actual del DOM y permite cambiarlo.
export function useTema() {
  const [tema, setTema] = useState('light');

  useEffect(() => {
    const actual = document.documentElement.getAttribute('data-theme');
    setTema(actual === 'light' ? 'light' : 'dark');
  }, []);

  const cambiar = () => {
    setTema((prev) => {
      const siguiente = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', siguiente);
      try { localStorage.setItem(CLAVE, siguiente); } catch { /* navegador sin almacenamiento */ }
      return siguiente;
    });
  };

  return [tema, cambiar];
}

function IconoSol() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1.2V2.8 M8 13.2V14.8 M1.2 8H2.8 M13.2 8H14.8 M3.2 3.2l1.1 1.1 M11.7 11.7l1.1 1.1 M12.8 3.2l-1.1 1.1 M4.3 11.7l-1.1 1.1" strokeLinecap="round" />
    </svg>
  );
}

function IconoLuna() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
      <path d="M13.4 9.6A5.4 5.4 0 1 1 6.4 2.6a4.2 4.2 0 0 0 7 7Z" strokeLinejoin="round" />
    </svg>
  );
}

// variante: 'sidebar' (fila completa con texto) | 'icono' (botón compacto)
export default function TemaToggle({ variante = 'icono', className = '' }) {
  const [tema, cambiar] = useTema();
  const esOscuro = tema === 'dark';
  const etiqueta = esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  if (variante === 'sidebar') {
    return (
      <button
        type="button"
        onClick={cambiar}
        title={etiqueta}
        aria-label={etiqueta}
        className={`w-full flex items-center justify-center lg:justify-start gap-3 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors ${className}`}
        style={{ color: 'var(--txt-3)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--txt)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--txt-3)')}
      >
        {esOscuro ? <IconoSol /> : <IconoLuna />}
        <span className="hidden lg:inline">{esOscuro ? 'Modo claro' : 'Modo oscuro'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={cambiar}
      title={etiqueta}
      aria-label={etiqueta}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${className}`}
      style={{ color: 'var(--txt-2)', borderColor: 'var(--line)', background: 'var(--surface-input)' }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--txt)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--txt-2)')}
    >
      {esOscuro ? <IconoSol /> : <IconoLuna />}
    </button>
  );
}
