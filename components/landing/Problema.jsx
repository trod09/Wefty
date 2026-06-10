'use client';

// [02] EL PROBLEMA — «los dos destinos del que adivina».
// Escenario partido en dos mitades enfrentadas: FABRICAS DE MÁS (ámbar, un
// almacén llenándose de sobrante tachado, con la cifra −33% contando al
// entrar) contra FABRICAS DE MENOS (azul frío, huecos punteados parpadeando
// y la palabra «Agotado.» como etiqueta de tienda). Las mitades convergen
// hacia el centro según el progreso real del scroll, separadas por una
// divisoria con degradado rojo→azul. Remate centrado con el puente hacia el
// diferenciador de Wefty.
//
// Técnica: solo CSS + IntersectionObserver + un listener de scroll pasivo con
// rAF que escribe una variable CSS (--conv); todo transform/opacity. Con
// prefers-reduced-motion: estático con las cifras finales visibles.
import { useEffect, useRef, useState } from 'react';
import RevelarLp from './RevelarLp';

const MONO = 'font-mono text-[11px] tracking-[0.18em] uppercase';
const CONT = 'max-w-[1440px] mx-auto px-6 md:px-12';
const TXT2 = '#8A8A8F';
const TXT3 = '#5d5e63';
const EMBER = '#E07A5F';
const CIELO = '#9db4ec';

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Pseudoaleatorio determinista por índice (estable entre servidor y cliente:
// nada de Math.random en el render, o React acusaría el desajuste).
const azar = (i, sal) => {
  const x = Math.sin(i * 127.1 + sal * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Titular «del caos al golpe» — se dispara UNA vez al entrar en viewport:
// "Adivinar" llega tembloroso (letras dispersas con rotación y blur ligero
// que se recolocan), el centro se ensambla por palabras, y "dos facturas."
// cae con peso, sacude la línea y recibe su trazo rojo (eco del tachado del
// hero). Sin JS o con movimiento reducido: frase asentada, visible al
// instante (los estados iniciales solo existen bajo .lp-tit-listo).
// Accesibilidad: la frase real va entera en el aria-label del h2.
function TitularCaos() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.classList.add('lp-tit-listo'); // aún está fuera de pantalla: sin flash
    const observador = new IntersectionObserver(([entrada]) => {
      if (entrada.isIntersecting) {
        el.classList.add('lp-tit-anim');
        observador.disconnect(); // una sola vez: no se repite al re-scrollear
      }
    }, { threshold: 0.5 });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const LETRAS = 'Adivinar'.split('');
  const MEDIO = ['siempre', 'acaba', 'en', 'una', 'de', 'estas'];

  return (
    <h2
      ref={ref}
      aria-label="Adivinar siempre acaba en una de estas dos facturas."
      className="mt-9 font-serif font-light text-[clamp(34px,5.6vw,76px)] leading-[1.06] tracking-[-0.03em] max-w-[16ch]"
    >
      <span aria-hidden="true">
        <span className="lp-tit-adivinar inline-block whitespace-nowrap">
          {LETRAS.map((letra, i) => (
            <span
              key={i}
              className="lp-tit-letra inline-block"
              style={{
                '--dx': `${((azar(i, 1) - 0.5) * 1.1).toFixed(2)}em`,
                '--dy': `${((azar(i, 2) - 0.5) * 0.8).toFixed(2)}em`,
                '--rot': `${((azar(i, 3) - 0.5) * 24).toFixed(1)}deg`,
                '--d': `${(i * 0.04).toFixed(2)}s`,
              }}
            >
              {letra}
            </span>
          ))}
        </span>{' '}
        {MEDIO.map((palabra, i) => (
          <span key={`${palabra}-${i}`}>
            <span
              className="lp-tit-palabra inline-block"
              style={{ '--d': `${(0.35 + i * 0.055).toFixed(2)}s` }}
            >
              {palabra}
            </span>{' '}
          </span>
        ))}
        <span className="lp-tit-golpe inline-block whitespace-nowrap">dos facturas.</span>
      </span>
    </h2>
  );
}

// Contador que anima UNA sola vez al entrar en viewport (con movimiento
// reducido, salta directamente a la cifra final).
function ContadorLp({ hasta, prefijo = '', sufijo = '', duracion = 1.6 }) {
  const ref = useRef(null);
  const [valor, setValor] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValor(hasta);
      return;
    }
    let raf = 0;
    const observador = new IntersectionObserver(([entrada]) => {
      if (!entrada.isIntersecting) return;
      observador.disconnect();
      const inicio = performance.now();
      const paso = (ahora) => {
        const x = clamp01((ahora - inicio) / (duracion * 1000));
        setValor(Math.round(hasta * (1 - Math.pow(1 - x, 3)))); // ease-out
        if (x < 1) raf = requestAnimationFrame(paso);
      };
      raf = requestAnimationFrame(paso);
    }, { threshold: 0.6 });
    observador.observe(el);
    return () => {
      observador.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [hasta, duracion]);

  return (
    <span ref={ref} className="tnum">
      {prefijo}{valor}{sufijo}
    </span>
  );
}

// Convergencia ligada al progreso de scroll: escribe --conv (0 lejos → 1
// centrado) en el contenedor; las mitades lo usan en sus transforms.
function Convergencia({ children, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--conv', '1');
      return;
    }
    let raf = 0;
    const leer = () => {
      const rect = el.getBoundingClientRect();
      const p = clamp01((window.innerHeight - rect.top) / (window.innerHeight * 0.75));
      el.style.setProperty('--conv', p.toFixed(3));
    };
    const alScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; leer(); });
    };
    leer();
    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('resize', alScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', alScroll);
      window.removeEventListener('resize', alScroll);
    };
  }, []);

  return (
    <div ref={ref} style={{ '--conv': 0 }} className={className}>
      {children}
    </div>
  );
}

// Retícula del almacén: 6×5 cajitas. En el lado del exceso, las dos filas de
// arriba van en ámbar tachado (el sobrante); en el de la falta, todo son
// huecos punteados que parpadean salvo la fila de abajo (lo poco que había).
const COLS = 6;
const FILAS = 5;

function Almacen({ tipo }) {
  const celdas = [];
  for (let fila = 0; fila < FILAS; fila++) {
    for (let col = 0; col < COLS; col++) {
      // El almacén se llena desde abajo: el retardo crece de abajo arriba.
      const orden = (FILAS - 1 - fila) * COLS + col;
      const esExceso = tipo === 'exceso' && fila < 2;
      const esFantasma = tipo === 'falta' && fila < FILAS - 1;
      celdas.push(
        <span
          key={`${fila}-${col}`}
          className={
            esExceso ? 'lp-caja lp-caja-exceso' : esFantasma ? 'lp-caja lp-fantasma' : 'lp-caja'
          }
          style={{ '--i': orden }}
        />
      );
    }
  }
  return (
    <div
      className="grid gap-1.5 md:gap-2 w-fit"
      style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {celdas}
    </div>
  );
}

export function Problema() {
  return (
    <section className="border-t border-white/[0.07] overflow-hidden">
      {/* Titular — separación intencional con el hero, sin desierto */}
      <div className={`${CONT} pt-14 md:pt-20 pb-12 md:pb-16`}>
        <RevelarLp>
          <div className="flex items-baseline gap-4">
            <span className={`${MONO} tnum`} style={{ color: TXT3 }}>[02]</span>
            <span className={MONO} style={{ color: TXT2 }}>El problema</span>
          </div>
        </RevelarLp>
        <TitularCaos />
      </div>

      {/* El escenario dividido: dos destinos enfrentados */}
      <Convergencia className="relative lp-convergencia">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1px_1fr]">
          {/* IZQUIERDA — FABRICAS DE MÁS */}
          <div
            className="relative flex items-center lg:min-h-[68vh] py-16 md:py-20"
            style={{
              background: 'radial-gradient(110% 90% at 30% 50%, rgba(224,122,95,0.07) 0%, transparent 65%)',
              transform: 'translateX(calc((1 - var(--conv)) * -1 * var(--dist, 64px)))',
              opacity: 'calc(0.3 + var(--conv) * 0.7)',
            }}
          >
            <div className="w-full max-w-[560px] mx-auto px-6 md:px-12">
              <span className={MONO} style={{ color: EMBER }}>Fabricas de más</span>
              <div className="mt-6 font-serif font-light leading-[0.9] tracking-[-0.03em] text-[clamp(72px,9vw,150px)]" style={{ color: '#F5F5F7' }}>
                <ContadorLp hasta={33} prefijo="−" sufijo="%" />
              </div>
              <p className="mt-4 text-[15px] md:text-[16px] leading-[1.5] max-w-[30ch]" style={{ color: TXT2 }}>
                hasta un tercio del stock acaba
                <span className="text-[#F5F5F7]"> liquidado en rebajas</span>
              </p>
              <div className="mt-10">
                <Almacen tipo="exceso" />
              </div>
              <p className="mt-10 font-serif text-[22px] md:text-[26px] tracking-[-0.015em]" style={{ color: EMBER }}>
                Dinero muerto en el almacén.
              </p>
            </div>
          </div>

          {/* Divisoria: rojo → azul (vertical en escritorio, horizontal en móvil) */}
          <div
            className="hidden lg:block w-px"
            style={{ background: 'linear-gradient(180deg, rgba(224,122,95,0.55) 0%, rgba(63,123,236,0.55) 100%)' }}
          />
          <div
            className="lg:hidden h-px mx-6"
            style={{ background: 'linear-gradient(90deg, rgba(224,122,95,0.55) 0%, rgba(63,123,236,0.55) 100%)' }}
          />

          {/* DERECHA — FABRICAS DE MENOS */}
          <div
            className="relative flex items-center lg:min-h-[68vh] py-16 md:py-20"
            style={{
              background: 'radial-gradient(110% 90% at 70% 50%, rgba(63,123,236,0.07) 0%, transparent 65%)',
              transform: 'translateX(calc((1 - var(--conv)) * var(--dist, 64px)))',
              opacity: 'calc(0.3 + var(--conv) * 0.7)',
            }}
          >
            <div className="w-full max-w-[560px] mx-auto px-6 md:px-12">
              <span className={MONO} style={{ color: CIELO }}>Fabricas de menos</span>
              <div className="mt-6 font-serif font-light leading-[0.9] tracking-[-0.03em] text-[clamp(58px,7.5vw,120px)] lp-agotado" style={{ color: '#F5F5F7' }}>
                Agotado.
              </div>
              <p className="mt-4 text-[15px] md:text-[16px] leading-[1.5] max-w-[30ch]" style={{ color: TXT2 }}>
                la venta perdida
                <span className="text-[#F5F5F7]"> no vuelve</span>
              </p>
              <div className="mt-10">
                <Almacen tipo="falta" />
              </div>
              <p className="mt-10 font-serif text-[22px] md:text-[26px] tracking-[-0.015em]" style={{ color: '#7da3f0' }}>
                Clientes que no vuelven.
              </p>
            </div>
          </div>
        </div>
      </Convergencia>

      {/* El remate: puente a la solución */}
      <div className={`${CONT} pt-16 md:pt-24 pb-24 md:pb-32 text-center`}>
        <RevelarLp>
          <p className="font-serif font-light text-[clamp(26px,3.6vw,46px)] leading-[1.1] tracking-[-0.02em]" style={{ color: '#F5F5F7' }}>
            Dos caras del mismo error: pedir a ojo.
          </p>
        </RevelarLp>
        <RevelarLp retardo={0.3}>
          <p className="mt-5 font-serif font-light italic text-[clamp(20px,2.6vw,32px)] leading-[1.2] tracking-[-0.015em]" style={{ color: '#7da3f0' }}>
            Y la decisión más difícil es la del producto que aún no has lanzado.
          </p>
        </RevelarLp>
      </div>
    </section>
  );
}
