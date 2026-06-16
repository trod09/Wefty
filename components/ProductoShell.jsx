'use client';

// Estructura del producto: NAVEGACIÓN LATERAL por secciones. Cada sección
// responde una pregunta del usuario. Clave anti-riesgo: todo queda SIEMPRE
// montado (las secciones inactivas se ocultan con CSS), así los filtros, el
// plan generado y los costes sobreviven al navegar — igual que en la página
// infinita anterior, solo que enseñando un trozo cada vez.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import SalesDashboard, { parsearVentas } from '@/components/SalesDashboard';
import StockEngine, { PanelConfiguracion, PanelValidacion } from '@/components/StockEngine';
import CostesProducto from '@/components/CostesProducto';
import InicioOnboarding from '@/components/InicioOnboarding';
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
    datos: <><ellipse cx="7" cy="3.4" rx="4.6" ry="1.9" /><path d="M2.4 3.4 V10.6 A4.6 1.9 0 0 0 11.6 10.6 V3.4" /><path d="M2.4 7 A4.6 1.9 0 0 0 11.6 7" /></>,
  };
  return (
    <svg viewBox="0 0 14 14" className="w-[14px] h-[14px] flex-shrink-0" fill="none"
      stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
      {trazos[id]}
    </svg>
  );
}

// Cada sección se presenta en UNA línea de negocio: qué pregunta responde.
const SECCIONES = [
  { id: 'inicio', etiqueta: 'Inicio', corta: 'Inicio', linea: 'Tus primeros pasos con Wefty.' },
  { id: 'resumen', etiqueta: 'Resumen', corta: 'Resumen', linea: 'Cómo va tu negocio, de un vistazo.' },
  { id: 'insights', etiqueta: 'Insights', corta: 'Insights', linea: 'Qué está pasando en tus ventas — explóralo con filtros.' },
  { id: 'reposicion', etiqueta: 'Reposición', corta: 'Repos.', linea: 'Cuánto pedir de los productos que ya vendes.' },
  { id: 'lanzamiento', etiqueta: 'Lanzamiento', corta: 'Lanz.', linea: 'Cuánto fabricar de un producto nuevo, sin histórico.' },
  { id: 'plan', etiqueta: 'Plan de compra', corta: 'Plan', linea: 'Reparte tu presupuesto entre todo el catálogo para maximizar margen.' },
  { id: 'datos', etiqueta: 'Datos y ajustes', corta: 'Datos', linea: 'Tus datos, tus costes y la maquinaria del motor.' },
];

// Estado vacío amable para secciones que aún no tienen datos.
function VacioAmable({ irADatos }) {
  return (
    <div
      className="rounded-xl border border-line p-12 md:p-16 text-center"
      style={{ background: 'var(--card-grad)' }}
    >
      <p className="font-display text-[22px] md:text-[28px] leading-snug" style={{ color: TXT }}>
        Sube tus ventas para ver esto.
      </p>
      <p className="mt-3 text-[14px]" style={{ color: TXT2 }}>
        Esta sección se llena sola con tu CSV de ventas.
      </p>
      <button
        type="button"
        onClick={irADatos}
        className="btn-sheen mt-8 h-11 px-6 rounded-lg border border-lineHover font-mono text-[11px] tracking-[0.12em] uppercase text-txt hover:border-txt3 transition-colors"
      >
        Ir a Datos y ajustes
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

  // EL motor: una sola instancia por dataset (una sola caché de demanda),
  // compartida por las secciones del motor y los paneles de Datos y ajustes.
  const motor = useMemo(() => (parsed ? prepararMotor(parsed.records) : null), [parsed]);

  // Costes reales y margen global por defecto: el panel vive en Datos y
  // ajustes; el plan de compra y Reposición los consumen en sus secciones.
  const [costesReales, setCostesReales] = useState(() => new Map());
  const onCostes = useCallback((mapa) => setCostesReales(mapa), []);
  const [margenTxt, setMargenTxt] = useState('60');

  // Sesión para el pie del sidebar (sustituye al antiguo SessionBadge).
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

  // Al des-ocultar una sección: recharts re-mide su contenedor (el resize lo
  // garantiza) y la vista vuelve arriba (cada sección empieza por su titular).
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
    window.scrollTo(0, 0);
    setVisitadas((v) => (v.has(seccion) ? v : new Set(v).add(seccion)));
  }, [seccion]);

  const esDashboard = seccion === 'resumen' || seccion === 'insights';
  const esMotor = seccion === 'reposicion' || seccion === 'lanzamiento' || seccion === 'plan';
  // Última pestaña del motor: al salir y volver, el motor no cambia de modo
  // (y su contenido no se desmonta — el plan generado sigue donde estaba).
  const [pestanaMotor, setPestanaMotor] = useState('reposicion');
  useEffect(() => { if (esMotor) setPestanaMotor(seccion); }, [esMotor, seccion]);
  const irADatos = () => setSeccion('datos');

  // Hay un CSV procesado sin guardar: puntito ámbar en "Datos" como recordatorio.
  const pendienteGuardar = Boolean(estadoDatos?.filas && !estadoDatos.guardado);

  // Pasos del onboarding — el estado de cada uno SALE del estado real del
  // usuario (datos, guardado, costes, secciones visitadas). No es decorativo.
  const imprescindibles = [
    { id: 'subir', titulo: 'Sube tus ventas', desc: 'Importa tu CSV de ventas para que Wefty lo analice.', hecho: hayDatos, destino: 'datos', cta: 'Subir ventas' },
    { id: 'guardar', titulo: 'Guarda tus datos', desc: 'Guárdalas en tu cuenta para no subirlas cada vez.', hecho: Boolean(estadoDatos?.guardado), destino: 'datos', cta: 'Ir a guardar' },
    { id: 'recom', titulo: 'Pide tu primera recomendación', desc: 'Cuánto pedir de cada producto, talla y color.', hecho: visitadas.has('reposicion') || visitadas.has('plan'), destino: 'reposicion', cta: 'Ver recomendación' },
  ];
  const recomendados = [
    { id: 'costes', titulo: 'Añade tus costes reales', desc: 'El coste real de cada producto afina el plan de compra.', hecho: costesReales.size > 0, destino: 'datos', cta: 'Añadir costes' },
    { id: 'insights', titulo: 'Explora tus insights', desc: 'Patrones de tus ventas y qué hacer con ellos.', hecho: visitadas.has('insights'), destino: 'insights', cta: 'Ver insights' },
    { id: 'lanz', titulo: 'Simula un lanzamiento', desc: 'Cuánto fabricar de un producto nuevo, sin histórico.', hecho: visitadas.has('lanzamiento'), destino: 'lanzamiento', cta: 'Simular lanzamiento' },
  ];
  const completadosImpr = imprescindibles.filter((p) => p.hecho).length;
  const progresoInicio = Math.round((completadosImpr / imprescindibles.length) * 100);

  const itemCls = (activa) =>
    `relative w-full flex items-center justify-center lg:justify-start gap-3 rounded-lg px-3 py-2.5 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors text-left ${
      activa ? 'text-txt' : 'text-txt2 hover:text-txt'
    }`;

  return (
    <div className="relative flex min-h-screen">
      {/* ——— Sidebar (escritorio) ——— */}
      <aside
        className="hidden md:flex flex-col fixed inset-y-0 left-0 md:w-16 lg:w-[220px] z-40 border-r border-lineSoft"
        style={{ background: 'var(--sidebar-grad)' }}
      >
        <div className="px-0 lg:px-6 pt-7 text-center lg:text-left">
          <Link href="/" className="font-display text-[22px] tracking-[-0.02em] text-txt">
            <span className="lg:hidden" aria-hidden="true">W</span>
            <span className="hidden lg:inline">Wefty</span>
          </Link>
          <div className={`${MONO} mt-1.5 hidden lg:block`} style={{ color: TXT3 }}>panel de stock</div>
        </div>

        <nav className="mt-8 flex-1 px-2 lg:px-3 space-y-1" aria-label="Secciones">
          {SECCIONES.map((sec) => {
            const activa = seccion === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSeccion(sec.id)}
                className={itemCls(activa)}
                style={{
                  background: activa ? 'var(--tint-brand)' : 'transparent',
                  boxShadow: activa ? 'inset 2px 0 0 var(--brand)' : 'none',
                  color: activa ? 'var(--txt)' : undefined,
                }}
                aria-current={activa ? 'page' : undefined}
                title={sec.id === 'datos' && pendienteGuardar ? `${sec.etiqueta} — datos sin guardar` : sec.etiqueta}
              >
                <span style={{ color: activa ? 'var(--brand)' : 'currentColor' }}><Icono id={sec.id} /></span>
                <span className="hidden lg:inline">{sec.etiqueta}</span>
                {sec.id === 'datos' && pendienteGuardar ? (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--warn)' }} />
                ) : null}
              </button>
            );
          })}
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

      {/* ——— Nav móvil: barra inferior fija (área táctil generosa) ——— */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-7 border-t border-lineSoft"
        style={{
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        aria-label="Secciones"
      >
        {SECCIONES.map((sec) => {
          const activa = seccion === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSeccion(sec.id)}
              className="relative flex flex-col items-center gap-1 pt-2.5 pb-2 transition-colors"
              style={{ color: activa ? 'var(--txt)' : TXT2 }}
              aria-current={activa ? 'page' : undefined}
            >
              <span style={{ color: activa ? 'var(--brand)' : 'currentColor' }}><Icono id={sec.id} /></span>
              <span className="font-mono text-[8.5px] tracking-[0.04em] uppercase">{sec.corta}</span>
              {sec.id === 'datos' && pendienteGuardar ? (
                <span className="absolute top-1.5 right-[22%] w-1.5 h-1.5 rounded-full" style={{ background: 'var(--warn)' }} />
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
      <div className="flex-1 min-w-0 md:pl-16 lg:pl-[220px] pb-24 md:pb-0">
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 py-8 md:py-12">
          {/* Cabecera de la sección activa (Inicio trae su propia cabecera rica) */}
          {seccion !== 'inicio' ? (
          <header key={seccion} className="seccion-panel mb-6 md:mb-8 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display font-bold text-[28px] md:text-[36px] tracking-[-0.02em] leading-none" style={{ color: TXT }}>
                {SECCIONES.find((x) => x.id === seccion)?.etiqueta}
              </h1>
              <p className="mt-2.5 text-[14px] md:text-[15px] leading-relaxed" style={{ color: TXT2 }}>
                {SECCIONES.find((x) => x.id === seccion)?.linea}
              </p>
            </div>
            {estadoDatos ? (
              <button
                type="button"
                onClick={() => setSeccion('datos')}
                title="De dónde salen los datos que ves. Pulsa para ir a Datos y ajustes."
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

          {/* Inicio: onboarding por pasos (estado real del usuario) */}
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

          {/* Resumen + Insights: UNA instancia del dashboard (los filtros se comparten) */}
          <section className={`seccion-panel ${esDashboard ? '' : 'hidden'}`}>
            {hayDatos ? (
              <SalesDashboard
                headers={headers}
                rows={rows}
                seccion={seccion === 'insights' ? 'insights' : 'resumen'}
                onHayFiltros={setHayFiltros}
                onNavegar={setSeccion}
              />
            ) : (
              <VacioAmable irADatos={irADatos} />
            )}
          </section>

          {/* Motor de stock: una instancia para las tres secciones (parte 2: el
              sidebar controlará la pestaña activa) */}
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
              <VacioAmable irADatos={irADatos} />
            )}
          </section>

          {/* Datos y ajustes: la subida/guardado vive en la página (los
              manejadores del CSV no se mueven) y entra aquí como contenido */}
          <section className={`seccion-panel ${seccion === 'datos' ? '' : 'hidden'}`}>
            {estadoDatos?.filas ? (
              <div
                className="mb-8 rounded-xl border p-4 md:p-5 flex flex-wrap items-center gap-x-5 gap-y-3"
                style={{
                  borderColor: estadoDatos.guardado ? 'rgba(107,203,154,0.35)' : 'rgba(227,192,75,0.35)',
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
            {hayDatos && motor ? (
              <div className="mt-12 rounded-xl border border-line p-6 md:p-8" style={{ background: 'var(--card-grad)' }}>
                <div className={`${MONO}`} style={{ color: TXT2 }}>Ajustes del motor</div>
                <CostesProducto
                  motor={motor}
                  margenTxt={margenTxt}
                  onMargenTxt={setMargenTxt}
                  onCostes={onCostes}
                />
                <PanelConfiguracion perfil={motor.perfil} configuracion={motor.configuracion} />
                <PanelValidacion motor={motor} />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
