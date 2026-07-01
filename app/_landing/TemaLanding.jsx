"use client";

// Interruptor de tema SOLO para la landing. Es independiente del producto:
// la landing abre en OSCURO (las variables base de .wefty-root) y este botón
// añade/quita la clase 'lz-claro' en el <html> para el modo claro. Se recuerda
// en su propia clave de localStorage ('wefty-tema-landing'); el script del
// layout la aplica antes de pintar para que no haya parpadeo.
import { useEffect, useState } from "react";

const CLAVE = "wefty-tema-landing";

const IconoSol = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <circle cx="8" cy="8" r="3.1" />
    <path d="M8 1.2V2.8 M8 13.2V14.8 M1.2 8H2.8 M13.2 8H14.8 M3.2 3.2l1.1 1.1 M11.7 11.7l1.1 1.1 M12.8 3.2l-1.1 1.1 M4.3 11.7l-1.1 1.1" strokeLinecap="round" />
  </svg>
);

const IconoLuna = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <path d="M13.4 9.6A5.4 5.4 0 1 1 6.4 2.6a4.2 4.2 0 0 0 7 7Z" strokeLinejoin="round" />
  </svg>
);

export default function TemaLanding() {
  const [claro, setClaro] = useState(false);

  useEffect(() => {
    setClaro(document.documentElement.classList.contains("lz-claro"));
  }, []);

  const cambiar = () => {
    setClaro((prev) => {
      const sig = !prev;
      document.documentElement.classList.toggle("lz-claro", sig);
      try {
        localStorage.setItem(CLAVE, sig ? "claro" : "oscuro");
      } catch {
        /* navegador sin almacenamiento */
      }
      return sig;
    });
  };

  return (
    <button
      type="button"
      onClick={cambiar}
      className="tema-landing-btn"
      aria-label={claro ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      title={claro ? "Modo oscuro" : "Modo claro"}
    >
      {claro ? IconoLuna : IconoSol}
    </button>
  );
}
