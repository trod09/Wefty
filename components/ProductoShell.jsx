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
import { prepararMotor } from '@/lib/engine/motor.mjs';

const MONO = 'font-mono text-[10px] tracking-[0.18em] uppercase';
const TXT = '#F5F5F7';
const TXT2 = '#8A8A8F';
const TXT3 = '#5d5e63';

// Iconos geométricos mínimos (trazo, 14×14), al estilo de la casa.
function Icono({ id }) {
  const trazos = {
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

const SECCIONES = [
  { id: 'resumen', etiqueta: 'Resumen' },
  { id: 'insights', etiqueta: 'Insights' },
  { id: 'reposicion', etiqueta: 'Reposición' },
  { id: 'lanzamiento', etiqueta: 'Lanzamiento' },
  { id: 'plan', etiqueta: 'Plan de compra' },
  { id: 'datos', etiqueta: 'Datos y ajustes' },
];

// Estado vacío amable para secciones que aún no tienen datos.
function VacioAmable({ irADatos }) {
  return (
    <div
      className="rounded-xl border border-[#1d2330] p-12 md:p-16 text-center"
      style={{ background: 'linear-gradient(150deg, #0c0f16 0%, #090b11 100%)' }}
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
        className="btn-sheen mt-8 h-11 px-6 rounded-lg border border-[#2e3850] font-mono text-[11px] tracking-[0.12em] uppercase text-[#F5F5F7] hover:border-[#5d5e63] transition-colors"
      >
        Ir a Datos y ajustes
      </button>
    </div>
  );
}

export default function ProductoShell({ headers, rows, hayDatos, seccionDatos }) {
  const [seccion, setSeccion] = useState(hayDatos ? 'resumen' : 'datos');
  const [hayFiltros, setHayFiltros] = useState(false);
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

  // Al des-ocultar una sección, recharts debe re-medir su contenedor: el
  // evento resize lo garantiza en todos los navegadores.
  useEffect(() => { window.dispatchEvent(new Event('resize')); }, [seccion]);

  const esDashboard = seccion === 'resumen' || seccion === 'insights';
  const esMotor = seccion === 'reposicion' || seccion === 'lanzamiento' || seccion === 'plan';
  // Última pestaña del motor: al salir y volver, el motor no cambia de modo
  // (y su contenido no se desmonta — el plan generado sigue donde estaba).
  const [pestanaMotor, setPestanaMotor] = useState('reposicion');
  useEffect(() => { if (esMotor) setPestanaMotor(seccion); }, [esMotor, seccion]);
  const irADatos = () => setSeccion('datos');

  const itemCls = (activa) =>
    `w-full flex items-center gap-3 rounded-lg px-3 py-2.5 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors text-left ${
      activa ? 'text-[#F5F5F7]' : 'text-[#8A8A8F] hover:text-[#F5F5F7]'
    }`;

  return (
    <div className="relative flex min-h-screen">
      {/* ——— Sidebar (escritorio) ——— */}
      <aside
        className="hidden md:flex flex-col fixed inset-y-0 left-0 w-[220px] z-40 border-r border-[#161b26]"
        style={{ background: 'linear-gradient(180deg, #0a0d14 0%, #07090e 100%)' }}
      >
        <div className="px-6 pt-7">
          <Link href="/" className="font-display text-[22px] tracking-[-0.02em] text-[#F5F5F7]">
            Wefty
          </Link>
          <div className={`${MONO} mt-1.5`} style={{ color: TXT3 }}>panel de stock</div>
        </div>

        <nav className="mt-8 flex-1 px-3 space-y-1" aria-label="Secciones">
          {SECCIONES.map((sec) => {
            const activa = seccion === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSeccion(sec.id)}
                className={itemCls(activa)}
                style={{
                  background: activa ? 'rgba(240,140,86,0.10)' : 'transparent',
                  boxShadow: activa ? 'inset 2px 0 0 #F08C56' : 'none',
                  color: activa ? '#F5F5F7' : undefined,
                }}
                aria-current={activa ? 'page' : undefined}
              >
                <span style={{ color: activa ? '#F08C56' : 'currentColor' }}><Icono id={sec.id} /></span>
                {sec.etiqueta}
              </button>
            );
          })}
        </nav>

        <div className="px-6 py-5 border-t border-[#161b26]">
          {email ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#6BCB9A' }} />
                <span className="text-[12px] truncate" style={{ color: TXT2 }} title={email}>{email}</span>
              </div>
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className={`${MONO} mt-2.5 transition-colors hover:text-[#F5F5F7]`}
                style={{ color: TXT3 }}
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <a href="/login" className={`${MONO} transition-colors hover:text-[#F5F5F7]`} style={{ color: TXT2 }}>
              Iniciar sesión
            </a>
          )}
        </div>
      </aside>

      {/* ——— Nav móvil (provisional: barra superior; en la parte 4, barra inferior) ——— */}
      <nav
        className="md:hidden fixed top-0 inset-x-0 z-40 flex gap-1 overflow-x-auto px-3 py-2 border-b border-[#161b26]"
        style={{ background: 'rgba(7,9,14,0.94)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        aria-label="Secciones"
      >
        {SECCIONES.map((sec) => {
          const activa = seccion === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSeccion(sec.id)}
              className="flex items-center gap-2 flex-shrink-0 rounded-lg px-3 py-2 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors"
              style={{
                color: activa ? '#F5F5F7' : TXT2,
                background: activa ? 'rgba(240,140,86,0.12)' : 'transparent',
              }}
            >
              <span style={{ color: activa ? '#F08C56' : 'currentColor' }}><Icono id={sec.id} /></span>
              {sec.etiqueta}
            </button>
          );
        })}
      </nav>

      {/* ——— Contenido ——— */}
      <div className="flex-1 min-w-0 md:pl-[220px] pt-14 md:pt-0">
        <div className="max-w-[1280px] mx-auto px-5 md:px-10 py-8 md:py-12">
          {/* Resumen + Insights: UNA instancia del dashboard (los filtros se comparten) */}
          <section className={`seccion-panel ${esDashboard ? '' : 'hidden'}`}>
            {hayDatos ? (
              <SalesDashboard
                headers={headers}
                rows={rows}
                seccion={seccion === 'insights' ? 'insights' : 'resumen'}
                onHayFiltros={setHayFiltros}
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
              />
            ) : (
              <VacioAmable irADatos={irADatos} />
            )}
          </section>

          {/* Datos y ajustes: la subida/guardado vive en la página (los
              manejadores del CSV no se mueven) y entra aquí como contenido */}
          <section className={`seccion-panel ${seccion === 'datos' ? '' : 'hidden'}`}>
            {seccionDatos}
            {hayDatos && motor ? (
              <div className="mt-12 rounded-xl border border-[#1d2330] p-6 md:p-8" style={{ background: 'linear-gradient(150deg, #0c0f16 0%, #090b11 100%)' }}>
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
