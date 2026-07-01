'use client';

// Estructura del producto: NAVEGACIÓN LATERAL agrupada (Analiza · Decide ·
// Configura). Cada sección responde UNA pregunta. Clave anti-riesgo: todo queda
// SIEMPRE montado (las secciones inactivas se ocultan con CSS), así filtros,
// plan generado y costes sobreviven al navegar.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import SalesDashboard, { parsearVentas } from '@/components/SalesDashboard';
import StockEngine, { CabeceraMotor, PanelConfiguracion, PanelValidacion } from '@/components/StockEngine';
import CostesProducto from '@/components/CostesProducto';
import InicioOnboarding from '@/components/InicioOnboarding';
import AjustesCuenta from '@/components/AjustesCuenta';
import TemaToggle from '@/components/TemaToggle';
import { prepararMotor } from '@/lib/engine/motor.mjs';

const MONO = 'font-mono text-[10px] tracking-[0.18em] uppercase';
const TXT = 'var(--txt)';
const TXT2 = 'var(--txt-2)';
const TXT3 = 'var(--txt-3)';

// Iconos geométricos mínimos (trazo, 14×14), al estilo de la casa.
function Icono({ id }) {
  const trazos = {
    inicio: <path d="M7 1 L8.3 5.7 L13 7 L8.3 8.3 L7 13 L5.7 8.3 L1 7 L5.7 5.7 Z" strokeLinejoin="round" />,
    resumen: <><rect x="1.5" y="1.5" width="4.6" height="4.6" /><rect x="7.9" y="1.5" width="4.6" height="4.6" /><rect x="1.5" y="7.9" width="4.6" height="4.6" /><rect x="7.9" y="7.9" width="4.6" height="4.6" /></>,
    insights: <><path d="M7 1 V13" /><path d="M1.8 4 L12.2 10" /><path d="M12.2 4 L1.8 10" /></>,
    reposicion: <><rect x="2" y="6" width="10" height="6.5" /><path d="M7 1 V4.8 M4.8 3 L7 5.2 L9.2 3" /></>,
    lanzamiento: <><path d="M2 12 L11.5 2.5" /><path d="M6 2.5 H11.5 V8" /></>,
    plan: <><path d="M11 3.2 A4.8 4.8 0 1 0 11 10.8" /><path d="M1.5 5.6 H8 M1.5 8.4 H8" /></>,
    cargar: <><path d="M7 1.5 V8.5 M4.2 4.3 L7 1.5 L9.8 4.3" /><path d="M2 9 V12.5 H12 V9" /></>,
    ajustes: <><path d="M1.5 4 H12.5 M1.5 10 H12.5" /><circle cx="5" cy="4" r="1.7" /><circle cx="9" cy="10" r="1.7" /></>,
    cuenta: <><circle cx="7" cy="4.3" r="2.6" /><path d="M2.2 12.6 C2.2 9.7 4.4 8.2 7 8.2 C9.6 8.2 11.8 9.7 11.8 12.6" strokeLinecap="round" /></>,
  };
  return (
    <svg viewBox="0 0 14 14" className="w-[14px] h-[14px] flex-shrink-0" fill="none"
      stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
      {trazos[id]}
    </svg>
  );
}

// Secciones agrupadas. grupo=null → fuera de grupo (arriba del todo).
const SECCIONES = [
  { id: 'inicio', grupo: null, etiqueta: 'Inicio', corta: 'Inicio', linea: 'Tus primeros pasos con Wefty.' },
  { id: 'resumen', grupo: 'Analiza', etiqueta: 'Resumen', corta: 'Resumen', linea: 'Cómo va tu negocio, de un vistazo.' },
  { id: 'insights', grupo: 'Analiza', etiqueta: 'Hallazgos', corta: 'Hallazgos', linea: 'Qué está pasando en tus ventas — explóralo con filtros.' },
  { id: 'reposicion', grupo: 'Decide stock', etiqueta: 'Reposición', corta: 'Repos.', linea: 'Cuánto pedir de los productos que ya vendes.' },
  { id: 'lanzamiento', grupo: 'Decide stock', etiqueta: 'Lanzamiento', corta: 'Lanz.', linea: 'Cuánto fabricar de un producto nuevo, sin histórico.' },
  { id: 'plan', grupo: 'Decide stock', etiqueta: 'Plan de compra', corta: 'Plan', linea: 'Reparte tu presupuesto entre todo el catálogo para maximizar margen.' },
  { id: 'cargar', grupo: 'Configura', etiqueta: 'Cargar datos', corta: 'Datos', linea: 'Sube o actualiza tu CSV de ventas y guárdalo en tu cuenta.' },
  { id: 'ajustes', grupo: 'Configura', etiqueta: 'Ajustes del motor', corta: 'Motor', linea: 'Tus costes reales y la maquinaria del motor (configuración y validación).' },
  { id: 'cuenta', grupo: 'Cuenta', etiqueta: 'Cuenta', corta: 'Cuenta', linea: 'Tu cuenta de Wefty: email, contraseña y tus datos.' },
];
const sec = (id) => SECCIONES.find((x) => x.id === id);

// Estado vacío amable para secciones que aún no tienen datos.
function VacioAmable({ irACargar }) {
  return (
    <div
      className="rounded-xl border border-line p-12 md:p-16 text-center"
      style={{ background: 'var(--card-grad)' }}
    >
      <p className="font-serif text-[22px] md:text-[28px] leading-snug" style={{ color: TXT }}>
        Sube tus ventas para ver esto.
      </p>
      <p className="mt-3 text-[14px]" style={{ color: TXT2 }}>
        Esta sección se llena sola con tu CSV de ventas.
      </p>
      <button
        type="button"
        onClick={irACargar}
        className="btn-sheen mt-8 h-11 px-6 rounded-lg border border-lineHover font-mono text-[11px] tracking-[0.12em] uppercase text-txt hover:border-txt3 transition-colors"
      >
        Ir a cargar datos
      </button>
    </div>
  );
}

export default function ProductoShell({ headers, rows, hayDatos, seccionDatos, estadoDatos }) {
  const [seccion, setSeccion] = useState(hayDatos && estadoDatos?.guardado ? 'resumen' : 'inicio');
  const [hayFiltros, setHayFiltros] = useState(false);
  const [visitadas, setVisitadas] = useState(() => new Set());
  const [email, setEmail] = useState(null);

  const parsed = useMemo(
    () => (hayDatos ? parsearVentas(headers, rows) : null),
    [hayDatos, headers, rows]
  );

  // EL motor: una sola instancia por dataset (una sola caché de demanda).
  const motor = useMemo(() => (parsed ? prepararMotor(parsed.records) : null), [parsed]);

  // Costes reales y margen global por defecto: el panel vive en Ajustes; el plan
  // de compra y Reposición los consumen en sus secciones.
  const [costesReales, setCostesReales] = useState(() => new Map());
  const onCostes = useCallback((mapa) => setCostesReales(mapa), []);
  const [margenTxt, setMargenTxt] = useState('60');

  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (activo) setEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sesion) => {
      setEmail(sesion?.user?.email ?? null);
    });
    return () => { activo = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
    window.scrollTo(0, 0);
    setVisitadas((v) => (v.has(seccion) ? v : new Set(v).add(seccion)));
  }, [seccion]);

  const esDashboard = seccion === 'resumen' || seccion === 'insights';
  const esMotor = seccion === 'reposicion' || seccion === 'lanzamiento' || seccion === 'plan';
  const [pestanaMotor, setPestanaMotor] = useState('reposicion');
  useEffect(() => { if (esMotor) setPestanaMotor(seccion); }, [esMotor, seccion]);
  const irACargar = () => setSeccion('cargar');

  // CSV procesado sin guardar → puntito ámbar en "Cargar datos".
  const pendienteGuardar = Boolean(estadoDatos?.filas && !estadoDatos.guardado);

  // Pasos del onboarding (estado real del usuario).
  const imprescindibles = [
    { id: 'subir', titulo: 'Sube tus ventas', desc: 'Importa tu CSV de ventas para que Wefty lo analice.', ejemplo: 'Vale un Excel guardado como CSV: una fila por venta con fecha, producto, talla, color y unidades.', hecho: hayDatos, hechoDetalle: hayDatos && estadoDatos?.filas ? `${estadoDatos.filas.toLocaleString('es-ES')} ventas cargadas` : null, destino: 'cargar', cta: 'Subir ventas' },
    { id: 'guardar', titulo: 'Guarda tus datos', desc: 'Guárdalas en tu cuenta para no subirlas cada vez.', hecho: Boolean(estadoDatos?.guardado), destino: 'cargar', cta: 'Ir a guardar' },
    { id: 'recom', titulo: 'Pide tu primera recomendación', desc: 'Cuánto pedir de cada producto, talla y color.', ejemplo: 'Te diremos las unidades por talla y color, y el porqué de cada número.', hecho: visitadas.has('reposicion') || visitadas.has('plan'), destino: 'reposicion', cta: 'Ver recomendación' },
  ];
  const recomendados = [
    { id: 'costes', titulo: 'Añade tus costes reales', desc: 'El coste real de cada producto afina el plan de compra.', hecho: costesReales.size > 0, destino: 'ajustes', cta: 'Añadir costes' },
    { id: 'insights', titulo: 'Explora tus hallazgos', desc: 'Patrones de tus ventas y qué hacer con ellos.', hecho: visitadas.has('insights'), destino: 'insights', cta: 'Ver hallazgos' },
    { id: 'lanz', titulo: 'Simula un lanzamiento', desc: 'Cuánto fabricar de un producto nuevo, sin histórico.', hecho: visitadas.has('lanzamiento'), destino: 'lanzamiento', cta: 'Simular lanzamiento' },
  ];
  const completadosImpr = imprescindibles.filter((p) => p.hecho).length;
  const progresoInicio = Math.round((completadosImpr / imprescindibles.length) * 100);

  // Botón de sección del sidebar (escritorio).
  const ItemNav = ({ s }) => {
    const activa = seccion === s.id;
    const dot = s.id === 'cargar' && pendienteGuardar;
    return (
      <button
        type="button"
        onClick={() => setSeccion(s.id)}
        className={`relative w-full flex items-center justify-center lg:justify-start gap-3 rounded-lg px-3 py-2 font-mono font-semibold text-[12px] tracking-[0.12em] uppercase transition-colors text-left ${activa ? 'text-txt' : 'text-txt hover:bg-hairlineSoft'}`}
        style={{
          background: activa ? 'var(--tint-brand)' : undefined,
          boxShadow: activa ? 'inset 2px 0 0 var(--brand)' : 'none',
        }}
        aria-current={activa ? 'page' : undefined}
        title={dot ? `${s.etiqueta} — datos sin guardar` : s.etiqueta}
      >
        <span style={{ color: activa ? 'var(--brand)' : 'currentColor' }}><Icono id={s.id} /></span>
        <span className="hidden lg:inline">{s.etiqueta}</span>
        {dot ? <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--warn)' }} /> : null}
      </button>
    );
  };

  // Sidebar agrupado: cabecera de grupo (solo lg) cuando cambia el grupo.
  const sidebarItems = [];
  let grupoPrev = '__';
  for (const s of SECCIONES) {
    if (s.grupo && s.grupo !== grupoPrev) {
      sidebarItems.push(
        <div key={`g-${s.grupo}`} className="hidden lg:block px-3 pt-4 pb-1 font-mono text-[9px] tracking-[0.2em] uppercase" style={{ color: TXT3 }}>
          {s.grupo}
        </div>
      );
    }
    if (!s.grupo && grupoPrev !== '__') {
      sidebarItems.push(<div key={`sep-${s.id}`} className="my-2 mx-3 border-t border-hairlineSoft" />);
    }
    grupoPrev = s.grupo || grupoPrev;
    sidebarItems.push(<ItemNav key={s.id} s={s} />);
  }

  return (
    <div className="relative flex min-h-screen">
      {/* ——— Sidebar (escritorio) ——— */}
      <aside
        className="nav-navy hidden md:flex flex-col fixed inset-y-0 left-0 md:w-16 lg:w-[230px] z-40 border-r border-lineSoft"
        style={{ background: 'var(--sidebar-grad)' }}
      >
        <div className="px-0 lg:px-6 pt-7 text-center lg:text-left">
          <Link href="/" className="font-display text-[22px] tracking-[-0.02em] text-txt">
            <span className="lg:hidden" aria-hidden="true">W</span>
            <span className="hidden lg:inline">Wefty</span>
          </Link>
          <div className={`${MONO} mt-1.5 hidden lg:block`} style={{ color: TXT3 }}>panel de stock</div>
        </div>

        <nav className="mt-6 flex-1 px-2 lg:px-3 space-y-0.5 overflow-y-auto" aria-label="Secciones">
          {sidebarItems}
        </nav>

        <div className="px-3 lg:px-6 py-5 border-t border-lineSoft space-y-3">
          <TemaToggle variante="sidebar" />
          {email ? (
            <>
              <div className="hidden lg:flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--ok)' }} />
                <span className="text-[12px] truncate" style={{ color: TXT2 }} title={email}>{email}</span>
              </div>
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className={`${MONO} lg:mt-2.5 w-full flex items-center justify-center lg:justify-start transition-colors hover:text-txt`}
                style={{ color: TXT3 }}
                title={`Cerrar sesión (${email})`}
              >
                <svg viewBox="0 0 14 14" className="w-4 h-4 lg:hidden" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
                  <path d="M5.5 2 H2 V12 H5.5 M9.5 4.5 L12 7 L9.5 9.5 M12 7 H5" />
                </svg>
                <span className="hidden lg:inline">Cerrar sesión</span>
              </button>
            </>
          ) : (
            <a href="/login" className={`${MONO} transition-colors hover:text-txt`} style={{ color: TXT2 }}>
              Iniciar sesión
            </a>
          )}
        </div>
      </aside>

      {/* ——— Nav móvil: barra inferior deslizable (todas las secciones visibles al deslizar) ——— */}
      <nav
        className="nav-navy md:hidden fixed bottom-0 inset-x-0 z-40 flex overflow-x-auto border-t border-lineSoft"
        style={{
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        aria-label="Secciones"
      >
        {SECCIONES.map((s) => {
          const activa = seccion === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeccion(s.id)}
              className="relative flex flex-col items-center gap-1 pt-2.5 pb-2 flex-shrink-0 min-w-[64px] transition-colors"
              style={{ color: activa ? 'var(--txt)' : TXT2 }}
              aria-current={activa ? 'page' : undefined}
            >
              <span style={{ color: activa ? 'var(--brand)' : 'currentColor' }}><Icono id={s.id} /></span>
              <span className="font-mono text-[9px] tracking-[0.04em] uppercase">{s.corta}</span>
              {s.id === 'cargar' && pendienteGuardar ? (
                <span className="absolute top-1.5 right-3 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--warn)' }} />
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Interruptor de tema en móvil (en escritorio vive en el sidebar) */}
      <div className="md:hidden fixed top-3 right-3 z-40">
        <TemaToggle variante="icono" />
      </div>

      {/* ——— Contenido ——— */}
      <div className="flex-1 min-w-0 md:pl-16 lg:pl-[230px] pb-24 md:pb-0">
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 py-8 md:py-12">
          {/* Cabecera de la sección activa (Inicio trae su propia cabecera rica) */}
          {seccion !== 'inicio' ? (
            <header key={seccion} className="seccion-panel mb-6 md:mb-8 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display font-bold text-[28px] md:text-[36px] tracking-[-0.02em] leading-none" style={{ color: TXT }}>
                  {sec(seccion)?.etiqueta}
                </h1>
                <p className="mt-2.5 text-[14px] md:text-[15px] leading-relaxed" style={{ color: TXT2 }}>
                  {sec(seccion)?.linea}
                </p>
              </div>
              {estadoDatos ? (
                <button
                  type="button"
                  onClick={() => setSeccion('cargar')}
                  title="De dónde salen los datos que ves. Pulsa para ir a Cargar datos."
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors hover:border-lineHover"
                  style={{ borderColor: 'var(--line)', background: 'var(--surface-input)', color: TXT2 }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: estadoDatos.guardado ? 'var(--ok)' : 'var(--warn)' }} />
                  <span style={{ color: TXT3 }}>Fuente:</span>
                  <span style={{ color: TXT }} className="normal-case tracking-normal max-w-[220px] truncate">
                    {estadoDatos.fuente === 'db' ? 'datos guardados' : estadoDatos.nombre}
                  </span>
                  <span style={{ color: TXT3 }}>
                    · {estadoDatos.filas.toLocaleString('es-ES')} filas{estadoDatos.fuente === 'csv' && !estadoDatos.guardado ? ' · sin guardar' : ''}
                  </span>
                </button>
              ) : null}
            </header>
          ) : null}

          {/* Inicio: onboarding por pasos */}
          <section className={`seccion-panel ${seccion === 'inicio' ? '' : 'hidden'}`}>
            <InicioOnboarding
              progreso={progresoInicio}
              completados={completadosImpr}
              total={imprescindibles.length}
              imprescindibles={imprescindibles}
              recomendados={hayDatos ? recomendados : []}
              onIr={setSeccion}
            />
          </section>

          {/* Resumen + Insights: UNA instancia del dashboard (filtros compartidos) */}
          <section className={`seccion-panel ${esDashboard ? '' : 'hidden'}`}>
            {hayDatos ? (
              <SalesDashboard
                headers={headers}
                rows={rows}
                seccion={seccion === 'insights' ? 'insights' : 'resumen'}
                motor={motor}
                costesReales={costesReales}
                margenTxt={margenTxt}
                onHayFiltros={setHayFiltros}
                onNavegar={setSeccion}
              />
            ) : (
              <VacioAmable irACargar={irACargar} />
            )}
          </section>

          {/* Motor de stock: una instancia para Reposición/Lanzamiento/Plan */}
          <section className={`seccion-panel ${esMotor ? '' : 'hidden'}`}>
            {hayDatos ? (
              <StockEngine
                records={parsed.records}
                motor={motor}
                hayFiltros={hayFiltros}
                pestana={esMotor ? seccion : pestanaMotor}
                costesReales={costesReales}
                margenTxt={margenTxt}
                onMargenTxt={setMargenTxt}
                onNavegar={setSeccion}
              />
            ) : (
              <VacioAmable irACargar={irACargar} />
            )}
          </section>

          {/* Cargar datos: subida/guardado/tabla (slot de la página) + banner */}
          <section className={`seccion-panel ${seccion === 'cargar' ? '' : 'hidden'}`}>
            {estadoDatos?.filas ? (
              <div
                className="mb-8 rounded-xl border p-4 md:p-5 flex flex-wrap items-center gap-x-5 gap-y-3"
                style={{
                  borderColor: estadoDatos.guardado ? 'rgba(44,138,85,0.4)' : 'rgba(143,108,15,0.4)',
                  background: 'var(--panel-grad)',
                }}
              >
                <span className="flex items-center gap-2.5 text-[13px]" style={{ color: TXT }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: estadoDatos.guardado ? 'var(--ok)' : 'var(--warn)' }} />
                  {estadoDatos.guardado
                    ? `${estadoDatos.filas.toLocaleString('es-ES')} filas de ventas guardadas en tu cuenta.`
                    : `Listo: ${estadoDatos.filas.toLocaleString('es-ES')} filas reconocidas — guárdalas abajo para no subirlas cada vez.`}
                </span>
                <button
                  type="button"
                  onClick={() => setSeccion('resumen')}
                  className="btn-sheen h-10 px-5 rounded-lg border border-lineHover font-mono text-[11px] tracking-[0.12em] uppercase text-txt hover:border-txt3 transition-colors"
                >
                  Ver mi Resumen →
                </button>
              </div>
            ) : null}
            {seccionDatos}
          </section>

          {/* Ajustes del motor: costes + configuración + validación */}
          <section className={`seccion-panel ${seccion === 'ajustes' ? '' : 'hidden'}`}>
            {hayDatos && motor ? (
              <div className="space-y-6">
                {/* Cabecera — estado del motor de un vistazo (mosaicos) */}
                <CabeceraMotor motor={motor} />
                {/* Tarjeta 1 — tu acción: los costes reales */}
                <div className="rounded-xl border border-line p-6 md:p-8" style={{ background: 'var(--card-grad)' }}>
                  <CostesProducto
                    motor={motor}
                    margenTxt={margenTxt}
                    onMargenTxt={setMargenTxt}
                    onCostes={onCostes}
                    primero
                  />
                </div>
                {/* Tarjeta 2 — la maquinaria del motor: cómo trabaja y cómo de fiable es */}
                <div className="rounded-xl border border-line p-6 md:p-8" style={{ background: 'var(--card-grad)' }}>
                  <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-txt2">
                    La maquinaria del motor
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed max-w-[640px] text-txt3">
                    Cómo trabaja por dentro y cómo de fiable es sobre tu propio histórico.
                  </p>
                  <PanelConfiguracion perfil={motor.perfil} configuracion={motor.configuracion} primero />
                  <PanelValidacion motor={motor} />
                </div>
              </div>
            ) : (
              <VacioAmable irACargar={irACargar} />
            )}
          </section>

          {/* Cuenta: gestión de la cuenta del usuario (auth), no del motor */}
          <section className={`seccion-panel ${seccion === 'cuenta' ? '' : 'hidden'}`}>
            <AjustesCuenta email={email} />
          </section>
        </div>
      </div>
    </div>
  );
}
