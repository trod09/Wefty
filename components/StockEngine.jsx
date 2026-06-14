'use client';

// Motor de stock — la sección del dashboard donde Wefty recomienda CUÁNTO pedir.
// Esta pantalla NO calcula nada: toda la matemática vive en lib/engine/ y aquí
// solo se eligen las entradas (producto, espera del proveedor, nivel de
// servicio) y se pintan los resultados con sus avisos y su panel de honestidad.
//
// Importante: el motor usa SIEMPRE el dataset completo, aunque el dashboard
// tenga filtros activos — pronosticar sobre datos filtrados daría pedidos
// sesgados. Se indica con una nota sutil cuando hay filtros puestos.
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  prepararMotor, recomendarReposicion, productosOrdenados, validacionGlobal,
  LEAD_MIN, LEAD_MAX,
} from '@/lib/engine/motor.mjs';
import {
  bandasDePrecio, recomendarLanzamiento, posicionamientosDePrecio, MESES_LANZAMIENTO,
} from '@/lib/engine/lanzamiento.mjs';
import { generarPlanCompra } from '@/lib/engine/plan.mjs';
import { fmtFecha } from '@/lib/engine/datos.mjs';

const SIN_COSTES = new Map();

const EMBER = 'var(--bad)';
const VERDE = 'var(--ok)';
const AMBAR = 'var(--warn)';
const CIELO = 'var(--brand-soft)';
const TXT = 'var(--txt)';
const TXT2 = 'var(--txt-2)';
const TXT3 = 'var(--txt-3)';
const LABEL = 'font-mono text-[10px] tracking-[0.18em] uppercase';
const CARD_BG = 'var(--card-grad)';
// Inputs: 16px en móvil (iOS hace zoom forzado con cualquier input menor) y
// 44px de alto táctil; en escritorio, el tamaño compacto de siempre.
const INPUT_CLS = 'h-11 md:h-10 rounded-lg border border-line px-3 text-[16px] md:text-[14px] text-txt outline-none transition-colors focus:border-brand';

const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
const fmt1 = (n) => (Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtEur = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const pct0 = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
const pct1 = (x) => `${((Number(x) || 0) * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })}%`;

// Color de un riesgo (0..1): tranquilo, atención o alerta.
const colorRiesgo = (r) => (r > 0.25 ? 'var(--bad)' : r > 0.1 ? 'var(--warn)' : 'var(--txt-3)');

// Seguridad al copiar a hojas de cálculo: una celda que empieza por = + - @
// podría interpretarse como FÓRMULA al pegarla en Excel/Sheets (inyección CSV).
// Anteponemos un apóstrofo para que siempre sea texto.
const textoSeguro = (s) => (/^[=+\-@]/.test(String(s).trim()) ? `'${s}` : String(s));

function Campo({ etiqueta, children, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL} style={{ color: TXT2 }}>{etiqueta}</span>
      {children}
      {hint ? <span className="text-[11px] leading-snug max-w-[230px]" style={{ color: TXT3 }}>{hint}</span> : null}
    </div>
  );
}

// Control segmentado (escenarios de demanda).
function Segmentos({ valor, onChange, opciones }) {
  return (
    <div className="inline-flex rounded-lg border border-line overflow-hidden">
      {opciones.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`h-11 md:h-10 px-3.5 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors ${
            valor === o.v ? 'text-txt' : 'text-txt2 hover:text-txt'
          }`}
          style={{ background: valor === o.v ? 'rgba(240,140,86,0.22)' : 'var(--surface-input)' }}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

const COLOR_CONFIANZA = { ALTA: VERDE, MEDIA: AMBAR, BAJA: EMBER };

// Badge del ciclo de vida (módulo 5): en qué fase está el producto.
const ESTILO_CICLO = {
  LANZAMIENTO: { color: CIELO, texto: 'Lanzamiento' },
  CRECIMIENTO: { color: VERDE, texto: 'Crecimiento' },
  MADURO: { color: 'var(--txt-2)', texto: 'Maduro' },
  DECLIVE: { color: EMBER, texto: 'Declive' },
};
function BadgeCiclo({ ciclo }) {
  const e = ESTILO_CICLO[ciclo.fase] || ESTILO_CICLO.MADURO;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.14em] uppercase"
      style={{ color: e.color, borderColor: `${e.color}55`, background: `${e.color}14` }}
      title={ciclo.detalle}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: e.color }} />
      {e.texto}
    </span>
  );
}

function BadgeConfianza({ confianza }) {
  const c = COLOR_CONFIANZA[confianza.nivel] || TXT2;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.14em] uppercase"
      style={{ color: c, borderColor: `${c}55`, background: `${c}14` }}
      title={confianza.motivo}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
      Confianza {confianza.nivel}
    </span>
  );
}

// Panel "Configuración del motor": qué técnica está activa, cuál no y POR QUÉ.
export function PanelConfiguracion({ perfil, configuracion }) {
  const ESTADO = {
    activa: { color: VERDE, texto: 'activa' },
    desactivada: { color: TXT3, texto: 'desactivada' },
    proximamente: { color: CIELO, texto: 'próximamente' },
  };
  return (
    <details className="mt-8 group border-t border-hairline pt-5">
      <summary className="flex items-center gap-3 cursor-pointer select-none py-2 md:py-0">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase transition-colors text-txt2 group-hover:text-txt">
          Configuración del motor — qué está activo y por qué
        </span>
        <span className="font-mono text-[11px] transition-transform group-open:rotate-90" style={{ color: TXT3 }}>›</span>
      </summary>
      <div className="mt-5 acc-body">
        <p className="font-mono text-[11px] tracking-[0.04em] leading-relaxed" style={{ color: TXT2 }}>
          {perfil.semanas} semanas de histórico ({fmtFecha(perfil.fechaMin)} — {fmtFecha(perfil.fechaMax)}) ·{' '}
          {perfil.nProductos} productos · {perfil.nVariantes} variantes · {fmtInt(perfil.totalUnidades)} uds
          {perfil.descartadas > 0 ? ` · ${perfil.descartadas} filas sin fecha válida (ignoradas)` : ''}
          {perfil.semanaParcial ? ` · última semana con solo ${perfil.semanaParcial.dias} día${perfil.semanaParcial.dias === 1 ? '' : 's'} de datos (no se usa para ajustar)` : ''}
        </p>
        <ul className="mt-4 space-y-2.5">
          {configuracion.map((f) => {
            const e = ESTADO[f.estado] || ESTADO.desactivada;
            return (
              <li key={f.nombre} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="flex items-center gap-2 min-w-[290px]">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: e.color }} />
                  <span className="text-[13px]" style={{ color: TXT }}>{f.nombre}</span>
                </span>
                <span className="font-mono text-[10px] tracking-[0.14em] uppercase flex-shrink-0" style={{ color: e.color }}>{e.texto}</span>
                <span className="text-[12px] leading-snug" style={{ color: TXT2 }}>— {f.detalle}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}

// Desglose talla × color (IPF): plegable, cuadra con ambas curvas a la vez.
function MatrizTallaColor({ matriz }) {
  if (!matriz) return null;
  const celda = 'font-mono text-[12px] tnum text-right py-1.5 px-2';
  return (
    <details className="mt-4 group">
      <summary className="flex items-center gap-3 cursor-pointer select-none py-2 md:py-0">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase transition-colors text-txt2 group-hover:text-txt">
          Ver desglose talla × color
        </span>
        <span className="font-mono text-[11px] transition-transform group-open:rotate-90" style={{ color: TXT3 }}>›</span>
      </summary>
      <div className="mt-3 acc-body overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse">
          <thead>
            <tr className="border-b border-hairline">
              <th className={`${LABEL} text-left py-1.5 px-2 font-normal`} style={{ color: TXT3 }}>Talla</th>
              {matriz.colores.map((c) => (
                <th key={c} className={`${LABEL} text-right py-1.5 px-2 font-normal`} style={{ color: TXT3 }}>{c}</th>
              ))}
              <th className={`${LABEL} text-right py-1.5 px-2 font-normal`} style={{ color: TXT2 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {matriz.filas.map((f) => (
              <tr key={f.talla} className="border-b border-hairlineSoft">
                <td className="font-mono text-[12px] py-1.5 px-2" style={{ color: TXT }}>{f.talla}</td>
                {f.celdas.map((u, j) => (
                  <td key={j} className={celda} style={{ color: u > 0 ? TXT : TXT3 }}>{u}</td>
                ))}
                <td className={celda} style={{ color: TXT2 }}>{f.total}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className={`${LABEL} py-1.5 px-2`} style={{ color: TXT2 }}>Total</td>
              {matriz.totalesColor.map((t, j) => (
                <td key={j} className={celda} style={{ color: TXT2 }}>{t}</td>
              ))}
              <td className={celda} style={{ color: TXT }}>{matriz.total}</td>
            </tr>
          </tfoot>
        </table>
        <p className="md:hidden mt-1.5 font-mono text-[10px] tracking-[0.1em] uppercase" style={{ color: TXT3 }}>
          ← desliza para ver toda la matriz →
        </p>
        <p className="mt-2 text-[11px] leading-snug" style={{ color: TXT3 }}>
          Cruzamos tus combinaciones reales de talla y color (ajuste proporcional iterativo):
          cada talla cuadra exacta; los colores quedan a ±1 ud de su curva.
        </p>
      </div>
    </details>
  );
}

// "¿Por qué esta recomendación?" — MÓDULO 8: el porqué paso a paso, sin jerga.
function Explicacion({ pasos, titulo = '¿Por qué esta recomendación?' }) {
  if (!pasos?.length) return null;
  return (
    <details className="mt-5 group rounded-xl border border-line p-5 md:p-6" style={{ background: 'var(--panel-grad)' }}>
      <summary className="flex items-center gap-3 cursor-pointer select-none py-2 md:py-0">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase transition-colors text-txt2 group-hover:text-txt">
          {titulo}
        </span>
        <span className="font-mono text-[11px] transition-transform group-open:rotate-90" style={{ color: TXT3 }}>›</span>
      </summary>
      <ol className="mt-4 space-y-3 acc-body">
        {pasos.map((p, i) => (
          <li key={p.titulo} className="flex gap-3.5">
            <span className="font-mono text-[11px] tnum pt-0.5 flex-shrink-0" style={{ color: 'var(--txt-3)' }}>
              [{String(i + 1).padStart(2, '0')}]
            </span>
            <div>
              <span className="font-mono text-[11px] tracking-[0.14em] uppercase" style={{ color: CIELO }}>{p.titulo}</span>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: TXT2 }}>{p.detalle}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

// Panel "Validación del motor" — MÓDULO 7: la credibilidad. Backtest global y
// por categoría contra el propio histórico del usuario. Si los datos no dan
// para una validación robusta, se dice claramente en vez de enseñar números débiles.
export function PanelValidacion({ motor }) {
  const v = useMemo(() => validacionGlobal(motor), [motor]);

  // En móvil la rejilla de 5 columnas no cabe (sus mínimos suman ~560px y el
  // overflow-hidden de la página la cortaría): cada fila pasa a tarjeta apilada.
  const textoMejora = (f) =>
    f.mejora != null ? (f.mejora > 0 ? `−${pct0(f.mejora)} de error` : 'sin mejora') : 'es el baseline';
  const FilaVal = ({ f }) => (
    <li className="border-b border-hairlineSoft">
      {/* Móvil: tarjeta apilada */}
      <div className="md:hidden py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px]" style={{ color: TXT }}>{f.etiqueta}</span>
          {!f.insuficiente ? (
            <span className="font-mono text-[12px] tnum flex-shrink-0" style={{ color: TXT }}>{pct0(f.wape)} error</span>
          ) : null}
        </div>
        {f.insuficiente ? (
          <p className="mt-1 font-mono text-[11px]" style={{ color: TXT3 }}>
            pocos datos para validar ({fmtInt(f.unidades)} uds)
          </p>
        ) : (
          <p className="mt-1 font-mono text-[11px] leading-relaxed" style={{ color: TXT2 }}>
            {f.modelo} ·{' '}
            <span style={{ color: f.mejora != null && f.mejora > 0 ? VERDE : TXT3 }}>{textoMejora(f)}</span>
            {' · '}{f.cortes} cortes
          </p>
        )}
      </div>
      {/* Escritorio: rejilla */}
      <div className="hidden md:grid grid-cols-[minmax(120px,1.4fr)_minmax(150px,2fr)_72px_110px_60px] gap-3 items-baseline py-2">
        <span className="text-[13px] truncate" style={{ color: TXT }}>{f.etiqueta}</span>
        {f.insuficiente ? (
          <span className="col-span-4 font-mono text-[11px]" style={{ color: TXT3 }}>
            pocos datos para validar ({fmtInt(f.unidades)} uds)
          </span>
        ) : (
          <>
            <span className="font-mono text-[11px] truncate" style={{ color: TXT2 }}>{f.modelo}</span>
            <span className="font-mono text-[12px] tnum text-right" style={{ color: TXT }}>{pct0(f.wape)}</span>
            <span className="font-mono text-[11px] tnum text-right" style={{ color: f.mejora != null && f.mejora > 0 ? VERDE : TXT3 }}>
              {textoMejora(f)}
            </span>
            <span className="font-mono text-[11px] tnum text-right" style={{ color: TXT3 }}>{f.cortes} cortes</span>
          </>
        )}
      </div>
    </li>
  );

  return (
    <details className="mt-4 group border-t border-hairline pt-5">
      <summary className="flex items-center gap-3 cursor-pointer select-none py-2 md:py-0">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase transition-colors text-txt2 group-hover:text-txt">
          Validación del motor — error real sobre tu histórico
        </span>
        <span className="font-mono text-[11px] transition-transform group-open:rotate-90" style={{ color: TXT3 }}>›</span>
      </summary>
      <div className="mt-5 acc-body">
        {!v.robusto ? (
          <p className="text-[13px] leading-relaxed max-w-[62ch]" style={{ color: TXT2 }}>
            Tu histórico aún no da para una validación robusta: hacen falta {v.minSemanas} semanas
            y {fmtInt(v.minUnidades)} unidades (tienes {v.semanas} y {fmtInt(v.unidades)}). Antes que
            enseñarte números débiles, preferimos decírtelo — cada semana de ventas que subas afina el motor.
          </p>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed max-w-[68ch]" style={{ color: TXT2 }}>
              El motor viaja a varios puntos de tu pasado, pronostica «a ciegas» las 4 semanas
              siguientes y comprueba cuánto falló. El error se mide como desviación media ponderada (WAPE);
              «−X% de error» = cuánto mejora al pronóstico ingenuo de extrapolar a ojo.
            </p>
            {v.global && !v.global.insuficiente ? (
              <p className="mt-4 text-[14px] leading-relaxed" style={{ color: TXT }}>
                Toda la marca: error del <span style={{ color: CIELO }}>{pct0(v.global.wape)}</span> con{' '}
                {v.global.modelo}
                {v.global.mejora != null && v.global.mejora > 0 ? (
                  <> — un <span style={{ color: VERDE }}>{pct0(v.global.mejora)}</span> mejor que extrapolar a ojo</>
                ) : null}{' '}
                <span style={{ color: TXT3 }}>({v.global.cortes} cortes)</span>.
              </p>
            ) : null}
            {v.filas.length ? (
              <ul className="mt-4">
                <li className="hidden md:grid grid-cols-[minmax(120px,1.4fr)_minmax(150px,2fr)_72px_110px_60px] gap-3 pb-2 border-b border-hairline">
                  {['Categoría', 'Mejor modelo', 'Error', 'vs ingenuo', 'Cortes'].map((h, i) => (
                    <span key={h} className={`${LABEL} ${i >= 2 ? 'text-right' : ''}`} style={{ color: TXT3 }}>{h}</span>
                  ))}
                </li>
                {v.filas.map((f) => <FilaVal key={f.etiqueta} f={f} />)}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </details>
  );
}

// Tabla del reparto por talla: barras proporcionales + riesgo de rotura (que
// falte) y de rebaja (que sobre >30%) por talla, desde las simulaciones.
// En móvil la rejilla completa no cabe (375px): las columnas de riesgo bajan
// a chips bajo cada fila y la barra conserva su sitio.
const GRID_TALLAS = 'grid-cols-[44px_1fr_52px_44px] md:grid-cols-[44px_1fr_52px_44px_56px_56px]';
function TablaTallas({ reparto, recomendado }) {
  const maxPeso = Math.max(...reparto.map((f) => f.peso), 0.0001);
  const conRiesgos = reparto.some((f) => f.riesgoRotura != null);
  return (
    <div>
      <div className={`grid ${GRID_TALLAS} gap-2.5 pb-2 border-b border-hairline`}>
        {['Talla', '', 'Uds', '%'].map((h, i) => (
          <span key={h || i} className={`${LABEL} ${i >= 2 ? 'text-right' : ''}`} style={{ color: TXT3 }}>{h}</span>
        ))}
        <span className={`${LABEL} hidden md:block text-right cursor-help`} style={{ color: TXT3 }}
          title="Probabilidad de quedarte sin esa talla antes de reponer">Rotura</span>
        <span className={`${LABEL} hidden md:block text-right cursor-help`} style={{ color: TXT3 }}
          title="Probabilidad de que sobre más del 30% de esa talla y acabe rebajada">Rebaja</span>
      </div>
      <ul>
        {reparto.map((f) => (
          <li key={f.talla} className="py-2 border-b border-hairlineSoft">
            <div className={`grid ${GRID_TALLAS} gap-2.5 items-center`}>
              <span className="font-mono text-[13px]" style={{ color: TXT }}>{f.talla}</span>
              <span className="h-[18px] rounded-sm relative overflow-hidden" style={{ background: 'var(--hairline-soft)' }}>
                <span
                  className="absolute inset-y-0 left-0 rounded-sm transition-all duration-300"
                  style={{
                    width: `${Math.max((f.peso / maxPeso) * 100, 2)}%`,
                    background: 'linear-gradient(90deg, var(--data) 0%, var(--data-2) 100%)',
                  }}
                />
              </span>
              <span className="font-mono text-[14px] tnum text-right" style={{ color: TXT }}>{fmtInt(f.unidades)}</span>
              <span className="font-mono text-[11px] tnum text-right" style={{ color: TXT2 }}>{pct1(f.peso)}</span>
              <span className="hidden md:block font-mono text-[11px] tnum text-right" style={{ color: colorRiesgo(f.riesgoRotura) }}>
                {f.riesgoRotura != null ? pct0(f.riesgoRotura) : '—'}
              </span>
              <span className="hidden md:block font-mono text-[11px] tnum text-right" style={{ color: colorRiesgo(f.riesgoRebaja) }}>
                {f.riesgoRebaja != null ? pct0(f.riesgoRebaja) : '—'}
              </span>
            </div>
            {conRiesgos && f.riesgoRotura != null ? (
              <div className="md:hidden mt-1.5 flex gap-4 font-mono text-[10px] tracking-[0.1em] uppercase">
                <span style={{ color: colorRiesgo(f.riesgoRotura) }}>rotura {pct0(f.riesgoRotura)}</span>
                <span style={{ color: colorRiesgo(f.riesgoRebaja) }}>rebaja {pct0(f.riesgoRebaja)}</span>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <div className={`grid ${GRID_TALLAS} gap-2.5 items-center pt-2.5`}>
        <span className={LABEL} style={{ color: TXT2 }}>Total</span>
        <span />
        <span className="font-mono text-[14px] tnum text-right" style={{ color: TXT }}>{fmtInt(recomendado)}</span>
        <span className="font-mono text-[11px] tnum text-right" style={{ color: TXT2 }}>100%</span>
        <span className="hidden md:block col-span-2" />
      </div>
    </div>
  );
}

export default function StockEngine({
  records, hayFiltros, pestana: pestanaProp,
  motor: motorProp, costesReales: costesRealesProp, margenTxt, onMargenTxt,
}) {
  // La pestaña puede venir CONTROLADA desde el sidebar del shell (Reposición /
  // Lanzamiento / Plan como secciones); sin prop, manda el estado interno.
  const [pestanaLocal, setPestanaLocal] = useState('reposicion');
  const pestana = pestanaProp ?? pestanaLocal;
  const [prodSel, setProdSel] = useState('');
  const [leadTxt, setLeadTxt] = useState('4');
  const [nivel, setNivel] = useState('95');
  const [escenario, setEscenario] = useState('esperado');
  // Economía del pedido (opcional): con coste y PVP el motor optimiza margen.
  const [costeTxt, setCosteTxt] = useState('');
  const [pvpTxt, setPvpTxt] = useState('');
  const [liqTxt, setLiqTxt] = useState('');
  const [copiado, setCopiado] = useState(false);
  // Modo B — lanzamiento de producto nuevo.
  const [lanCategoria, setLanCategoria] = useState('');
  const [lanBanda, setLanBanda] = useState('0');
  const [lanPos, setLanPos] = useState('');       // '' | basico | medio | premium
  const [lanMes, setLanMes] = useState('');       // '' | '1'..'12'
  const [lanTipo, setLanTipo] = useState('permanente'); // permanente | capsula
  const [lanSemanasTxt, setLanSemanasTxt] = useState('8');
  const [lanTotalTxt, setLanTotalTxt] = useState('');
  const [lanColoresTxt, setLanColoresTxt] = useState('');
  const [copiadoLan, setCopiadoLan] = useState(false);
  // Plan de compra global (open-to-buy): NO reactivo — solo al pulsar Generar
  // (recorre todo el catálogo; la demanda por producto queda memoizada en el motor).
  const [planPresuTxt, setPlanPresuTxt] = useState('');
  const [planHorizTxt, setPlanHorizTxt] = useState('12');
  const [planMargenLocal, setPlanMargenLocal] = useState('60');
  // Compartido con el panel de costes (Datos y ajustes) a través del shell.
  const planMargenTxt = margenTxt ?? planMargenLocal;
  const setPlanMargenTxt = onMargenTxt ?? setPlanMargenLocal;
  const [planEsc, setPlanEsc] = useState('esperado');
  const [plan, setPlan] = useState(null);
  const [calculandoPlan, setCalculandoPlan] = useState(false);
  const [copiadoPlan, setCopiadoPlan] = useState(false);
  const [planParams, setPlanParams] = useState(null);
  // Costes reales por producto: llegan del shell (el panel "Costes de
  // producto" vive en Datos y ajustes); sin shell, mapa vacío estable.
  const costesReales = costesRealesProp ?? SIN_COSTES;
  // Huella estable de los costes: detecta que el plan generado quedó caduco.
  const huellaCostes = useMemo(
    () => [...costesReales].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k}:${v}`).join('|'),
    [costesReales]
  );

  // El motor se prepara UNA vez por dataset (perfil + limpieza de todo el
  // catálogo, operaciones baratas). El pronóstico se calcula solo para el
  // producto seleccionado, al cambiar cualquier entrada.
  const motorLocal = useMemo(() => (motorProp ? null : prepararMotor(records)), [motorProp, records]);
  const motor = motorProp ?? motorLocal;
  const productos = useMemo(() => productosOrdenados(motor), [motor]);

  const producto = motor.almacen.productos.has(prodSel) ? prodSel : (productos[0]?.nombre ?? '');
  const leadNum = Number(leadTxt);
  const leadValido = Number.isFinite(leadNum) && leadNum >= LEAD_MIN && leadNum <= LEAD_MAX;
  const leadEfectivo = leadValido ? leadNum : 4;
  // La economía se intenta cuando hay coste y PVP; el motor valida y, si algo
  // no cuadra, devuelve los errores en claro y sigue en modo nivel de servicio.
  const costesIntentados = costeTxt.trim() !== '' && pvpTxt.trim() !== '';

  // RENDIMIENTO: los inputs se reflejan al instante, pero el recálculo del
  // motor va con valor diferido (useDeferredValue): si el cálculo tardara, la
  // interfaz no se congela y se muestra "calculando…".
  const paramsRepo = useMemo(() => ({
    producto,
    leadSemanas: leadEfectivo,
    nivelServicio: Number(nivel),
    escenario,
    costes: costesIntentados ? { coste: costeTxt, pvp: pvpTxt, liquidacionPct: liqTxt } : null,
  }), [producto, leadEfectivo, nivel, escenario, costesIntentados, costeTxt, pvpTxt, liqTxt]);
  const paramsRepoDif = useDeferredValue(paramsRepo);

  const resultado = useMemo(() => {
    if (!paramsRepoDif.producto) return null;
    return recomendarReposicion(motor, paramsRepoDif);
  }, [motor, paramsRepoDif]);

  const economiaActiva = Boolean(resultado?.ok && resultado.modoCantidad === 'economia');

  // Prellenar el coste del modo economía con el coste real guardado del
  // producto seleccionado. Lo escrito A MANO se respeta hasta cambiar de
  // producto; el prellenado sí se actualiza si cambian los costes del panel.
  const costeGuardado = costesReales.get(producto);
  const ultimoPrefill = useRef({ producto: null, valor: null });
  useEffect(() => {
    const nuevo = costeGuardado != null ? String(costeGuardado) : '';
    setCosteTxt((prev) => {
      const cambioProducto = ultimoPrefill.current.producto !== producto;
      const eraPrefill = prev === ultimoPrefill.current.valor;
      if (cambioProducto || eraPrefill || prev === '') {
        ultimoPrefill.current = { producto, valor: nuevo };
        return nuevo;
      }
      return prev;
    });
  }, [producto, costeGuardado]);

  // — Modo B: lanzamiento. Solo se calcula con la pestaña abierta (bajo demanda). —
  const categoriasLan = useMemo(
    () => [...motor.almacen.categorias.keys()].sort((a, b) => a.localeCompare(b, 'es')),
    [motor]
  );
  const bandas = useMemo(() => bandasDePrecio(motor), [motor]);
  const lanCategoriaEf = categoriasLan.includes(lanCategoria) ? lanCategoria : (categoriasLan[0] ?? '');
  const lanBandaIdx = Math.min(Math.max(0, Number(lanBanda) || 0), Math.max(0, bandas.length - 1));
  // Posicionamiento por terciles de la categoría elegida; null si la categoría
  // no da para terciles (entonces se enseña la banda general, con nota honesta).
  const posiciones = useMemo(
    () => (lanCategoriaEf ? posicionamientosDePrecio(motor, lanCategoriaEf) : null),
    [motor, lanCategoriaEf]
  );

  const paramsLan = useMemo(() => ({
    activa: pestana === 'lanzamiento' && Boolean(lanCategoriaEf),
    categoria: lanCategoriaEf,
    precioCentro: bandas[lanBandaIdx]?.centro ?? 0,
    posicionamiento: posiciones && lanPos ? lanPos : null,
    mesLanzamiento: lanMes === '' ? null : Number(lanMes),
    tipo: lanTipo,
    semanasCapsula: lanSemanasTxt,
    unidadesTotales: lanTotalTxt.trim() === '' ? null : lanTotalTxt,
    nColores: lanColoresTxt.trim() === '' ? null : lanColoresTxt,
  }), [pestana, lanCategoriaEf, bandas, lanBandaIdx, posiciones, lanPos, lanMes, lanTipo, lanSemanasTxt, lanTotalTxt, lanColoresTxt]);
  const paramsLanDif = useDeferredValue(paramsLan);

  const resultadoLan = useMemo(() => {
    if (!paramsLanDif.activa) return null;
    return recomendarLanzamiento(motor, paramsLanDif);
  }, [motor, paramsLanDif]);

  const calculando = paramsRepo !== paramsRepoDif || paramsLan !== paramsLanDif;

  async function copiarLanzamiento() {
    if (!resultadoLan?.ok) return;
    const r = resultadoLan;
    const lineas = [
      `Pedido de lanzamiento — ${textoSeguro(r.categoria)} (nuevo)`,
      `Total: ${r.total} uds${r.totalEsSugerido ? ' (sugerido por la curva de análogos)' : ''}`,
      'Talla\tUnidades',
      ...(r.reparto ? r.reparto.map((f) => `${textoSeguro(f.talla)}\t${f.unidades}`) : []),
      ...(r.repartoColores ? ['', 'Color\tUnidades', ...r.repartoColores.map((f) => `${textoSeguro(f.talla)}\t${f.unidades}`)] : []),
    ];
    try {
      await navigator.clipboard.writeText(lineas.join('\n'));
      setCopiadoLan(true);
      setTimeout(() => setCopiadoLan(false), 2000);
    } catch { /* sin permiso de portapapeles */ }
  }

  if (motor.almacen.vacio) {
    return (
      <div className="rounded-xl border border-line p-8 text-center" style={{ background: CARD_BG }}>
        <div className={LABEL} style={{ color: TXT2 }}>Motor de stock</div>
        <p className="mt-3 text-[15px]" style={{ color: TXT2 }}>
          Para recomendar pedidos necesitamos ventas con fecha válida. Revisa la columna de fechas de tu CSV.
        </p>
      </div>
    );
  }

  async function copiarPedido() {
    if (!resultado?.ok) return;
    const r = resultado;
    const criterio = r.modoCantidad === 'economia'
      ? `punto de máximo margen (cuantil ${Math.round(r.economia.cr * 100)}%)`
      : `nivel de servicio ${r.nivelServicio}% · escenario ${r.escenario}`;
    const lineas = [
      `Pedido recomendado — ${textoSeguro(r.producto)}`,
      `Cubre ${r.horizonte.total} semanas · ${criterio}`,
      'Talla\tUnidades',
      ...(r.reparto ? r.reparto.map((f) => `${textoSeguro(f.talla)}\t${f.unidades}`) : []),
      `Total\t${r.recomendado}`,
    ];
    try {
      await navigator.clipboard.writeText(lineas.join('\n'));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sin permiso de portapapeles: no rompemos nada */
    }
  }

  async function copiarPlan() {
    if (!plan?.ok) return;
    const lineas = [
      `Plan de compra — ${plan.horizonte} semanas · escenario ${plan.escenario} · presupuesto ${Math.round(plan.presupuesto).toLocaleString('es-ES')} €`,
      'Producto\tUnidades\tInversión (€)',
      ...plan.filas.map((f) => `${textoSeguro(f.producto)}\t${f.unidades}\t${f.inversion.toFixed(2)}`),
      `Total\t${plan.unidadesTotales}\t${plan.gastado.toFixed(2)}`,
    ];
    try {
      await navigator.clipboard.writeText(lineas.join('\n'));
      setCopiadoPlan(true);
      setTimeout(() => setCopiadoPlan(false), 2000);
    } catch {
      /* sin permiso de portapapeles: no rompemos nada */
    }
  }

  const refResumenPlan = useRef(null);

  function generarPlan() {
    if (calculandoPlan) return;
    setCalculandoPlan(true);
    // setTimeout: deja pintar "Calculando plan…" antes del cálculo pesado.
    setTimeout(() => {
      const nuevo = generarPlanCompra(motor, {
        presupuesto: Number(planPresuTxt),
        horizonte: Number(planHorizTxt) || 12,
        margenPct: Number(planMargenTxt) || 60,
        escenario: planEsc,
        costesReales,
      });
      setPlan(nuevo);
      setPlanParams({ presu: planPresuTxt, horiz: planHorizTxt, margen: planMargenTxt, esc: planEsc, costes: huellaCostes });
      setCalculandoPlan(false);
      // El resumen puede quedar fuera de pantalla: lo traemos a la vista.
      if (nuevo.ok) {
        requestAnimationFrame(() => {
          refResumenPlan.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }, 30);
  }

  // Pestañas con área táctil ≥44px en móvil (padding extra solo ahí).
  const tabCls = (activa) =>
    `pt-3 pb-3.5 md:pt-0 md:pb-2.5 font-mono text-[11px] tracking-[0.18em] uppercase transition-colors border-b-2 ${
      activa ? 'border-brand text-txt' : 'border-transparent text-txt2 hover:text-txt'
    }`;

  return (
    <div>
      {/* Cabecera de la sección */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {/* Con el sidebar de pestañas, la cabecera de sección ya presenta el
            contexto: aquí solo queda el estado del cálculo. */}
        <div className={`${LABEL} flex items-center gap-2`} style={{ color: TXT2 }}>
          <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: 'var(--brand)' }} />
          {pestanaProp ? 'Motor de stock' : 'Motor de stock · cuánto pedir'}
        </div>
        <span className={LABEL} style={{ color: calculando ? CIELO : TXT3 }}>
          {calculando
            ? 'calculando…'
            : hayFiltros ? 'usa todo tu histórico — ignora los filtros de arriba' : 'calculado sobre todo tu histórico'}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-line p-6 md:p-8" style={{ background: CARD_BG }}>
        {/* Pestañas (ocultas cuando el sidebar hace de pestañas) */}
        {pestanaProp ? null : (
          <div className="flex gap-7 border-b border-hairline">
            <button type="button" className={tabCls(pestana === 'reposicion')} onClick={() => setPestanaLocal('reposicion')}>
              Reposición
            </button>
            <button type="button" className={tabCls(pestana === 'lanzamiento')} onClick={() => setPestanaLocal('lanzamiento')}>
              Lanzamiento
            </button>
            <button type="button" className={tabCls(pestana === 'plan')} onClick={() => setPestanaLocal('plan')}>
              Plan de compra
            </button>
          </div>
        )}

        {pestana === 'plan' ? (
          <>
            {/* ① TU PRESUPUESTO — lo imprescindible, destacado */}
            <div className="mt-6 rounded-xl border border-brandLine p-5 md:p-6" style={{ background: 'linear-gradient(150deg, var(--tint-brand) 0%, var(--surface-2) 75%)' }}>
              <div className={LABEL} style={{ color: 'var(--brand-soft)' }}>Tu presupuesto de compra</div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-baseline gap-2">
                  <input
                    type="number" inputMode="decimal" min="1" step="1" placeholder="20000"
                    value={planPresuTxt} onChange={(e) => setPlanPresuTxt(e.target.value)}
                    className={`${INPUT_CLS} w-[180px] !h-12 !text-[22px] md:!text-[20px] tnum`}
                    style={{ background: 'var(--surface-input)' }}
                  />
                  <span className="font-display text-[20px]" style={{ color: TXT2 }}>€</span>
                </div>
                {!(Number(planPresuTxt) > 0) ? (
                  <button
                    type="button"
                    onClick={() => setPlanPresuTxt('20000')}
                    className="font-mono text-[11px] tracking-[0.08em] uppercase transition-opacity hover:opacity-70 text-left"
                    style={{ color: 'var(--brand-soft)' }}
                  >
                    ¿No sabes por dónde empezar? · usar 20.000 €
                  </button>
                ) : null}
              </div>
              <p className="mt-2.5 text-[12px] leading-snug" style={{ color: TXT3 }}>
                Lo único imprescindible: lo que vas a invertir en stock. El resto ya tiene valores sensatos.
              </p>
            </div>

            {/* ② AJUSTES — opcional, secundario */}
            <div className="mt-4">
              <div className={LABEL} style={{ color: TXT3 }}>Ajustes (opcional)</div>
              <div className="mt-3 flex flex-wrap items-start gap-5">
                <Campo etiqueta="Horizonte (semanas)" hint="Cuántas semanas de venta debe cubrir la compra.">
                  <input
                    type="number" inputMode="numeric" min="4" max="26" step="1"
                    value={planHorizTxt} onChange={(e) => setPlanHorizTxt(e.target.value)}
                    className={`${INPUT_CLS} w-[90px] tnum`}
                    style={{ background: 'var(--surface-input)' }}
                  />
                </Campo>
                <Campo
                  etiqueta="Margen bruto (%)"
                  hint={`Coste estimado = ${Math.max(10, 100 - (Number(planMargenTxt) || 60))}% del PVP medio de cada producto (de tus datos).${costesReales.size > 0 ? ` ${costesReales.size} producto${costesReales.size === 1 ? ' usa' : 's usan'} su coste real y lo ignoran.` : ''}`}
                >
                  <input
                    type="number" inputMode="numeric" min="20" max="90" step="1"
                    value={planMargenTxt} onChange={(e) => setPlanMargenTxt(e.target.value)}
                    className={`${INPUT_CLS} w-[90px] tnum`}
                    style={{ background: 'var(--surface-input)' }}
                  />
                </Campo>
                <Campo etiqueta="Escenario de demanda" hint="Conservador reparte por si la venta viene floja; agresivo, por si viene fuerte (P25/P75).">
                  <Segmentos
                    valor={planEsc}
                    onChange={setPlanEsc}
                    opciones={[
                      { v: 'conservador', t: 'Conserv.' },
                      { v: 'esperado', t: 'Esperado' },
                      { v: 'agresivo', t: 'Agresivo' },
                    ]}
                  />
                </Campo>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-5">
              <button
                type="button"
                onClick={generarPlan}
                disabled={calculandoPlan || !(Number(planPresuTxt) > 0)}
                className="btn-sheen h-11 px-6 rounded-lg border border-brandLine font-mono text-[11px] tracking-[0.12em] uppercase text-txt transition-colors disabled:opacity-60"
                style={{ background: 'var(--tint-brand)' }}
              >
                {calculandoPlan ? 'Calculando plan…' : Number(planPresuTxt) > 0 ? 'Generar plan' : 'Escribe tu presupuesto'}
              </button>
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: TXT3 }}>
                recorre todo el catálogo — se calcula al pulsar, no a cada tecla
              </span>
              {plan && planParams
                && (planParams.presu !== planPresuTxt || planParams.horiz !== planHorizTxt
                  || planParams.margen !== planMargenTxt || planParams.esc !== planEsc
                  || planParams.costes !== huellaCostes) ? (
                <span className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: AMBAR }}>
                  has cambiado los parámetros o los costes — el plan de abajo es el anterior
                </span>
              ) : null}
            </div>

            {/* ③ ESTADO PREVIO — qué obtendrá y sobre qué trabaja (sin hueco muerto) */}
            {!plan ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-brandLine p-6" style={{ background: 'var(--inset-grad)' }}>
                  <div className={LABEL} style={{ color: 'var(--brand-soft)' }}>Lo que hará Wefty</div>
                  <p className="mt-3 text-[15px] leading-relaxed max-w-[60ch]" style={{ color: TXT }}>
                    Repartirá tu presupuesto entre tus{' '}
                    <span style={{ color: 'var(--brand-soft)' }}>{productos.filter((p) => p.suficiente).length}</span>{' '}
                    productos con histórico suficiente, priorizando los de mayor margen y rotación, y te dirá
                    cuántas unidades pedir de cada uno.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11px] tracking-[0.02em]" style={{ color: TXT2 }}>
                    <span><span style={{ color: TXT3 }}>productos · </span>{productos.filter((p) => p.suficiente).length}</span>
                    <span>
                      <span style={{ color: TXT3 }}>costes · </span>
                      <span style={{ color: costesReales.size > 0 ? VERDE : TXT2 }}>{costesReales.size} reales</span>
                      {' · '}{Math.max(0, productos.filter((p) => p.suficiente).length - costesReales.size)} estimados
                    </span>
                    <span><span style={{ color: TXT3 }}>histórico · </span>{motor.perfil.semanas} semanas ({fmtFecha(motor.perfil.fechaMin)} – {fmtFecha(motor.perfil.fechaMax)})</span>
                  </div>
                </div>

                {/* Esqueleto atenuado: la forma de lo que llegará */}
                <div className="rounded-xl border border-line p-5 md:p-6" style={{ background: 'var(--panel-grad)', opacity: 0.45 }} aria-hidden="true">
                  <div className="hidden md:grid grid-cols-[1.8fr_64px_100px_110px_56px_150px] gap-3 pb-2 border-b border-hairline">
                    {['Producto', 'Uds', 'Inversión', 'Margen esp.', '%', 'Riesgo'].map((h) => (
                      <span key={h} className={LABEL} style={{ color: TXT3 }}>{h}</span>
                    ))}
                  </div>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex md:grid md:grid-cols-[1.8fr_64px_100px_110px_56px_150px] gap-3 items-center py-3.5 border-b border-hairlineSoft">
                      <span className="h-3 rounded-full" style={{ background: 'var(--hairline)', width: `${64 - i * 14}%` }} />
                      <span className="hidden md:block h-3 rounded-full" style={{ background: 'var(--hairline)' }} />
                      <span className="hidden md:block h-3 rounded-full" style={{ background: 'var(--hairline)' }} />
                      <span className="hidden md:block h-3 rounded-full" style={{ background: 'var(--hairline)' }} />
                      <span className="hidden md:block h-3 rounded-full" style={{ background: 'var(--hairline)' }} />
                      <span className="hidden md:block h-3 rounded-full" style={{ background: 'var(--hairline)' }} />
                    </div>
                  ))}
                  <p className="mt-3 font-mono text-[10px] tracking-[0.16em] uppercase" style={{ color: TXT3 }}>así se verá tu plan</p>
                </div>
              </div>
            ) : null}

            {/* Errores amables */}
            {plan && !plan.ok ? (
              <div className="mt-6 rounded-xl border border-line p-6" style={{ background: 'var(--inset-grad)' }}>
                <p className="text-[14px] leading-relaxed" style={{ color: TXT2 }}>
                  {plan.motivo === 'presupuesto-invalido'
                    ? 'Escribe un presupuesto válido (un número mayor que 0).'
                    : plan.motivo === 'presupuesto-insuficiente'
                      ? `Con ese presupuesto no llega ni para una unidad: la más barata de tu catálogo cuesta ≈${fmt1(plan.minimo)} €.`
                      : 'Ningún producto de tu catálogo tiene datos suficientes para planificar la compra.'}
                </p>
                {plan.excluidos?.length ? (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed" style={{ color: TXT3 }}>
                    fuera del plan: {plan.excluidos.map((e) => `${e.producto} (${e.motivo})`).join(' · ')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {plan?.ok ? (
              <>
                {/* Resumen global del plan */}
                <div ref={refResumenPlan} className="mt-6 scroll-mt-6 rounded-xl border border-brandLine p-6 md:p-7" style={{ background: 'linear-gradient(150deg, var(--tint-brand) 0%, var(--surface-2) 70%)' }}>
                  <div className={LABEL} style={{ color: 'var(--brand-soft)' }}>Plan de compra · {plan.horizonte} semanas · escenario {plan.escenario}</div>
                  {plan.costes ? (
                    <p className="mt-1.5 font-mono text-[10px] tracking-[0.1em] uppercase" style={{ color: TXT3 }}>
                      calculado con <span style={{ color: plan.costes.reales > 0 ? VERDE : TXT3 }}>{plan.costes.reales} coste{plan.costes.reales === 1 ? '' : 's'} real{plan.costes.reales === 1 ? '' : 'es'}</span> y {plan.costes.estimados} estimado{plan.costes.estimados === 1 ? '' : 's'}
                    </p>
                  ) : null}
                  <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <div className={LABEL} style={{ color: TXT3 }}>Presupuesto asignado</div>
                      <div className="mt-1.5 font-display text-[26px] leading-none tnum" style={{ color: TXT }}>{fmtEur(plan.gastado)}</div>
                      <div className="mt-1 font-mono text-[10px]" style={{ color: TXT3 }}>
                        de {fmtEur(plan.presupuesto)}{plan.sobrante > 0.5 ? ` · sobran ${fmtEur(plan.sobrante)}` : ''}
                      </div>
                    </div>
                    <div>
                      <div className={LABEL} style={{ color: TXT3 }}>Unidades</div>
                      <div className="mt-1.5 font-display text-[26px] leading-none tnum" style={{ color: TXT }}>{fmtInt(plan.unidadesTotales)}</div>
                      <div className="mt-1 font-mono text-[10px]" style={{ color: TXT3 }}>en {plan.filas.length} productos</div>
                    </div>
                    <div>
                      <div className={LABEL} style={{ color: TXT3 }}>Margen esperado</div>
                      <div className="mt-1.5 font-display text-[26px] leading-none tnum" style={{ color: VERDE }}>{fmtEur(plan.margenEsperado)}</div>
                    </div>
                    <div>
                      <div className={LABEL} style={{ color: TXT3 }}>vs repartir como vendiste</div>
                      <div className="mt-1.5 font-display text-[26px] leading-none tnum" style={{ color: plan.baseline.ventaja >= 1 ? VERDE : TXT }}>
                        {plan.baseline.ventaja >= 1 ? `+${fmtEur(plan.baseline.ventaja)}` : '≈ igual'}
                      </div>
                      <div className="mt-1 font-mono text-[10px]" style={{ color: TXT3 }}>
                        proporcional al histórico: {fmtEur(plan.baseline.margen)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabla del plan, ordenada por inversión */}
                <div className="mt-4 rounded-xl border border-line p-5 md:p-6" style={{ background: 'var(--panel-grad)' }}>
                  <div className="hidden md:grid grid-cols-[1.8fr_64px_100px_110px_56px_150px] gap-3 pb-2 border-b border-hairline">
                    {['Producto', 'Uds', 'Inversión', 'Margen esp.', '%', 'Riesgo (rotura · rebaja)'].map((h, i) => (
                      <span
                        key={h}
                        className={`${LABEL} ${i >= 1 && i <= 4 ? 'text-right' : ''} ${i === 5 ? 'cursor-help' : ''}`}
                        style={{ color: TXT3 }}
                        title={i === 5 ? 'Rotura: prob. de quedarte corto · Rebaja: prob. de que sobre más del 30%' : undefined}
                      >{h}</span>
                    ))}
                  </div>
                  <ul>
                    {plan.filas.map((f) => (
                      <li key={f.producto} className="border-b border-hairlineSoft">
                        <details className="group">
                          <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                            {/* Móvil: tarjeta apilada */}
                            <div className="md:hidden py-3">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="text-[13px]" style={{ color: TXT }}>
                                  <span className="font-mono text-[10px] mr-1.5 inline-block transition-transform group-open:rotate-90" style={{ color: TXT3 }}>›</span>
                                  {f.producto}
                                </span>
                                <span className="font-mono text-[12px] tnum flex-shrink-0" style={{ color: TXT }}>{fmtInt(f.unidades)} uds</span>
                              </div>
                              <p className="mt-1 font-mono text-[11px] leading-relaxed" style={{ color: TXT2 }}>
                                {fmtEur(f.inversion)} ({pct0(f.pctPresupuesto)}) · margen {fmtEur(f.margenEsperado)} ·{' '}
                                <span style={{ color: colorRiesgo(f.riesgoRotura) }}>rotura {pct0(f.riesgoRotura)}</span> ·{' '}
                                <span style={{ color: colorRiesgo(f.riesgoRebaja) }}>rebaja {pct0(f.riesgoRebaja)}</span> ·{' '}
                                <span style={{ color: f.origenCoste === 'real' ? VERDE : TXT3 }}>coste {f.origenCoste === 'real' ? 'real' : 'est.'}</span>
                              </p>
                              <div className="mt-1.5"><BadgeCiclo ciclo={f.ciclo} /></div>
                            </div>
                            {/* Escritorio: rejilla */}
                            <div className="hidden md:grid grid-cols-[1.8fr_64px_100px_110px_56px_150px] gap-3 items-center py-2.5">
                              <span className="flex items-center gap-2.5 min-w-0">
                                <span className="font-mono text-[10px] flex-shrink-0 transition-transform group-open:rotate-90" style={{ color: TXT3 }}>›</span>
                                <span
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: f.origenCoste === 'real' ? VERDE : 'var(--line-hover)' }}
                                  title={f.origenCoste === 'real' ? 'coste real (tu panel de costes)' : 'coste estimado por margen global'}
                                />
                                <span className="text-[13px] truncate" style={{ color: TXT }}>{f.producto}</span>
                                <BadgeCiclo ciclo={f.ciclo} />
                              </span>
                              <span className="font-mono text-[13px] tnum text-right" style={{ color: TXT }}>{fmtInt(f.unidades)}</span>
                              <span className="font-mono text-[12px] tnum text-right" style={{ color: TXT }}>{fmtEur(f.inversion)}</span>
                              <span className="font-mono text-[12px] tnum text-right" style={{ color: VERDE }}>{fmtEur(f.margenEsperado)}</span>
                              <span className="font-mono text-[11px] tnum text-right" style={{ color: TXT2 }}>{pct0(f.pctPresupuesto)}</span>
                              <span className="font-mono text-[11px] tnum">
                                <span style={{ color: colorRiesgo(f.riesgoRotura) }}>{pct0(f.riesgoRotura)}</span>
                                <span style={{ color: TXT3 }}> · </span>
                                <span style={{ color: colorRiesgo(f.riesgoRebaja) }}>{pct0(f.riesgoRebaja)}</span>
                              </span>
                            </div>
                          </summary>
                          <div className="acc-body pb-4 pl-0 md:pl-5">
                            <p className="font-mono text-[11px] leading-relaxed" style={{ color: TXT3 }}>
                              PVP medio {fmt1(f.pvp)} € · coste {f.origenCoste === 'real' ? 'real' : 'estimado'} {fmt1(f.coste)} €/ud · modelo: {f.modelo.nombre}
                            </p>
                            {f.tallaUnica ? (
                              <p className="mt-2 text-[12px]" style={{ color: TXT3 }}>Talla única: las {fmtInt(f.unidades)} unidades van a un solo código.</p>
                            ) : f.reparto ? (
                              <div className="mt-3 max-w-[520px]"><TablaTallas reparto={f.reparto} recomendado={f.unidades} /></div>
                            ) : (
                              <p className="mt-2 text-[12px]" style={{ color: TXT3 }}>Sin datos de talla en tu histórico para este producto.</p>
                            )}
                            <MatrizTallaColor matriz={f.matriz} />
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* La frontera: la última unidad que entra y la primera que se queda fuera */}
                {plan.frontera.ultimaComprada ? (
                  <div className="mt-4 rounded-xl border border-line p-5" style={{ background: 'var(--panel-grad)' }}>
                    <div className={LABEL} style={{ color: TXT2 }}>La frontera del presupuesto</div>
                    <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: TXT2 }}>
                      La última unidad comprada (<span style={{ color: TXT }}>{plan.frontera.ultimaComprada.nombre}</span>) rinde{' '}
                      <span style={{ color: VERDE }}>{fmt1(plan.frontera.ultimaComprada.margen)} €</span> de margen esperado
                      ({fmt1(plan.frontera.ultimaComprada.margen / plan.frontera.ultimaComprada.coste)} € por € invertido).{' '}
                      {plan.frontera.primeraDescartada ? (
                        <>La primera descartada (<span style={{ color: TXT }}>{plan.frontera.primeraDescartada.nombre}</span>) rendiría{' '}
                        <span style={{ color: AMBAR }}>{fmt1(plan.frontera.primeraDescartada.margen)} €</span> — ahí se acabó el presupuesto.</>
                      ) : (
                        <>No quedó fuera ninguna unidad rentable: el plan paró solo, antes de destruir margen.</>
                      )}
                    </p>
                  </div>
                ) : null}

                {/* ¿Por qué este reparto? + copiar */}
                <Explicacion pasos={plan.explicacion} titulo="¿Por qué este reparto?" />
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={copiarPlan}
                    className="btn-sheen h-11 px-6 rounded-lg border border-lineHover font-mono text-[11px] tracking-[0.12em] uppercase text-txt hover:border-txt3 transition-colors"
                    style={{ background: copiadoPlan ? 'rgba(107,203,154,0.12)' : 'transparent', borderColor: copiadoPlan ? 'var(--ok)' : undefined, color: copiadoPlan ? VERDE : undefined }}
                  >
                    {copiadoPlan ? 'Copiado ✓' : 'Copiar plan'}
                  </button>
                  <span className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: TXT3 }}>
                    producto · unidades · inversión — listo para pegar en una hoja de cálculo
                  </span>
                </div>

                {/* Excluidos y avisos */}
                {plan.excluidos.length > 0 ? (
                  <p className="mt-4 font-mono text-[11px] leading-relaxed" style={{ color: TXT3 }}>
                    fuera del plan: {plan.excluidos.map((e) => `${e.producto} (${e.motivo})`).join(' · ')}
                  </p>
                ) : null}
                {plan.avisos.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-line p-5" style={{ background: 'var(--panel-grad)' }}>
                    <div className={LABEL} style={{ color: AMBAR }}>Avisos del plan · {plan.avisos.length}</div>
                    <ul className="mt-3 space-y-2">
                      {plan.avisos.map((texto, i) => (
                        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed" style={{ color: TXT2 }}>
                          <span className="mt-[7px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: AMBAR }} />
                          <span>{texto}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : pestana === 'lanzamiento' ? (
          <>
            {/* Entradas del lanzamiento: lo esencial primero, lo opcional aparte */}
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-lineSoft p-4 md:p-5" style={{ background: 'var(--panel-grad)' }}>
                <div className={LABEL} style={{ color: TXT3 }}>Lo básico</div>
                <div className="mt-4 flex flex-wrap items-start gap-5">
              <Campo etiqueta="Categoría del producto nuevo">
                <select
                  value={lanCategoriaEf}
                  onChange={(e) => setLanCategoria(e.target.value)}
                  className={`${INPUT_CLS} min-w-[190px] cursor-pointer`}
                  style={{ background: 'var(--surface-input)' }}
                >
                  {categoriasLan.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Campo>
              <Campo
                etiqueta="Tipo de lanzamiento"
                hint={lanTipo === 'capsula' ? 'Ventana corta sin reposición: el total apunta a agotarse incluso con venta floja.' : 'Producto que se queda en catálogo: curva de 12 semanas.'}
              >
                <Segmentos
                  valor={lanTipo}
                  onChange={setLanTipo}
                  opciones={[{ v: 'permanente', t: 'Permanente' }, { v: 'capsula', t: 'Cápsula' }]}
                />
              </Campo>
              {lanTipo === 'capsula' ? (
                <Campo etiqueta="Semanas de venta" hint="Entre 3 y 12 (hasta donde llega la referencia de tus análogos).">
                  <div className="flex items-center gap-2">
                    <input
                      type="number" inputMode="numeric" min="3" max="12" step="1"
                      value={lanSemanasTxt} onChange={(e) => setLanSemanasTxt(e.target.value)}
                      className={`${INPUT_CLS} w-[90px] tnum`}
                      style={{ background: 'var(--surface-input)' }}
                    />
                    <span className="font-mono text-[11px]" style={{ color: TXT2 }}>semanas</span>
                  </div>
                </Campo>
              ) : null}
              <Campo
                etiqueta="Unidades totales"
                hint={resultadoLan?.ok ? `Vacío = sugerencia del motor (≈${fmtInt(resultadoLan.totalSugerido)} uds para ${resultadoLan.semanasVenta} semanas).` : 'Déjalo vacío y el motor te las sugiere.'}
              >
                <input
                  type="number" inputMode="numeric" min="1" max="1000000" step="1"
                  placeholder={resultadoLan?.ok ? `sugerir (≈${resultadoLan.totalSugerido})` : 'sugiérelas'}
                  value={lanTotalTxt} onChange={(e) => setLanTotalTxt(e.target.value)}
                  className={`${INPUT_CLS} w-[150px] tnum`}
                  style={{ background: 'var(--surface-input)' }}
                />
              </Campo>
                </div>
              </div>
              <div className="rounded-xl border border-lineSoft p-4 md:p-5" style={{ background: 'var(--panel-grad)' }}>
                <div className={LABEL} style={{ color: TXT3 }}>Afinar la referencia (opcional)</div>
                <div className="mt-4 flex flex-wrap items-start gap-5">
              {posiciones ? (
                <Campo
                  etiqueta="Posicionamiento de precio"
                  hint={lanPos ? 'Los análogos de tu misma franja de precio pesan más en la referencia.' : 'Opcional: franjas según los precios reales de esta categoría.'}
                >
                  <select
                    value={lanPos}
                    onChange={(e) => setLanPos(e.target.value)}
                    className={`${INPUT_CLS} min-w-[200px] cursor-pointer`}
                    style={{ background: 'var(--surface-input)' }}
                  >
                    <option value="">Sin preferencia</option>
                    {posiciones.opciones.map((o) => <option key={o.clave} value={o.clave}>{o.etiqueta}</option>)}
                  </select>
                </Campo>
              ) : bandas.length > 1 ? (
                <Campo etiqueta="Banda de precio" hint="Esta categoría no da para terciles (precios escasos o casi idénticos) — banda general del catálogo.">
                  <select
                    value={String(lanBandaIdx)}
                    onChange={(e) => setLanBanda(e.target.value)}
                    className={`${INPUT_CLS} min-w-[170px] cursor-pointer`}
                    style={{ background: 'var(--surface-input)' }}
                  >
                    {bandas.map((b, i) => <option key={i} value={String(i)}>{b.etiqueta}</option>)}
                  </select>
                </Campo>
              ) : null}
              <Campo
                etiqueta="Mes de lanzamiento"
                hint={lanMes === '' ? 'Opcional: cruza con la estacionalidad y afina los análogos.' : 'Los análogos que se lanzaron en tu misma estación pesan más.'}
              >
                <select
                  value={lanMes}
                  onChange={(e) => setLanMes(e.target.value)}
                  className={`${INPUT_CLS} min-w-[160px] cursor-pointer`}
                  style={{ background: 'var(--surface-input)' }}
                >
                  <option value="">Sin definir</option>
                  {MESES_LANZAMIENTO.map((m, i) => (
                    <option key={m} value={String(i + 1)}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Nº de colores (opcional)" hint="Cuántos colores lanzarás; vacío = los que sugieren tus análogos.">
                <input
                  type="number" inputMode="numeric" min="1" step="1" placeholder="todos"
                  value={lanColoresTxt} onChange={(e) => setLanColoresTxt(e.target.value)}
                  className={`${INPUT_CLS} w-[110px] tnum`}
                  style={{ background: 'var(--surface-input)' }}
                />
              </Campo>
                </div>
              </div>
            </div>

            {/* L3: la sugerencia del motor, visible y no escondida en un placeholder */}
            {resultadoLan?.ok && lanTotalTxt.trim() === '' ? (
              <p className="mt-4 font-mono text-[11px] tracking-[0.04em]" style={{ color: TXT2 }}>
                usando la sugerencia del motor: ≈<span style={{ color: TXT }}>{fmtInt(resultadoLan.totalSugerido)}</span> uds
                para {resultadoLan.semanasVenta} semanas — escribe una cifra en «Unidades totales» si quieres forzarla
              </p>
            ) : null}

            {resultadoLan && !resultadoLan.ok ? (
              <div className="mt-8 rounded-xl border border-line p-8 md:p-10" style={{ background: 'var(--inset-grad)' }}>
                <div className={LABEL} style={{ color: EMBER }}>Sin análogos suficientes</div>
                <p className="mt-4 text-[15px] leading-relaxed max-w-[58ch]" style={{ color: TXT2 }}>
                  Ningún producto de tu catálogo tiene aún el histórico mínimo ({resultadoLan.minimo ?? 20} uds y 6 semanas)
                  para servir de referencia. Aquí es donde la red de Wefty (datos agregados de marcas
                  similares) te dará la respuesta — próximamente.
                </p>
              </div>
            ) : null}

            {resultadoLan?.ok ? (
              <>
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Total propuesto */}
                  <div
                    className="lg:col-span-4 relative rounded-xl border border-brandLine p-7 md:p-8 overflow-hidden flex flex-col"
                    style={{
                      background: 'linear-gradient(150deg, rgba(240,140,86,0.12) 0%, rgba(240,140,86,0.03) 40%, var(--surface-2) 100%)',
                      boxShadow: '0 0 60px -26px var(--glow-brand)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={LABEL} style={{ color: CIELO }}>Pedido de lanzamiento</span>
                      {resultadoLan.tipo === 'capsula' ? (
                        <span
                          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.14em] uppercase"
                          style={{ color: AMBAR, borderColor: `${AMBAR}55`, background: `${AMBAR}14` }}
                        >
                          Cápsula · {resultadoLan.semanasVenta} semanas
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-5 font-display text-[58px] md:text-[68px] leading-[0.9] tracking-[-0.025em] tnum" style={{ color: TXT }}>
                      {fmtInt(resultadoLan.total)}
                      <span className="font-mono text-[13px] tracking-[0.1em] uppercase ml-3" style={{ color: TXT2 }}>uds</span>
                    </div>
                    <p className="mt-4 text-[13px] leading-relaxed" style={{ color: TXT2 }}>
                      {resultadoLan.totalEsSugerido
                        ? (resultadoLan.tipo === 'capsula'
                          ? `Sugerido para agotar en ${resultadoLan.semanasVenta} semanas incluso con venta floja (banda conservadora de tus análogos).`
                          : 'Sugerido: lo que vendieron tus análogos en sus primeras 12 semanas, ponderado por parecido.')
                        : `Tus unidades (la curva sugería ≈${fmtInt(resultadoLan.totalSugerido)} para ${resultadoLan.semanasVenta} semanas).`}
                    </p>
                    {resultadoLan.ajusteEstacional ? (
                      <p className="mt-3 font-mono text-[11px] tracking-[0.02em] leading-relaxed" style={{ color: CIELO }}>
                        lanzamiento en {resultadoLan.ajusteEstacional.nombreMes}: demanda inicial{' '}
                        {resultadoLan.ajusteEstacional.factorMedio >= 1 ? '+' : '−'}
                        {Math.abs(Math.round((resultadoLan.ajusteEstacional.factorMedio - 1) * 100))}%{' '}
                        por estacionalidad de {resultadoLan.categoria}
                      </p>
                    ) : null}
                    {resultadoLan.pesosCurva ? (
                      <p className="mt-3 font-mono text-[11px] tracking-[0.02em] leading-relaxed" style={{ color: TXT3 }}>
                        curva de tallas: {pct0(resultadoLan.pesosCurva.producto)} análogos
                        {' + '}{pct0(resultadoLan.pesosCurva.categoria)} categoría
                        {' + '}{pct0(resultadoLan.pesosCurva.global)} marca
                      </p>
                    ) : null}
                    <div className="mt-auto pt-5">
                      <BadgeConfianza confianza={resultadoLan.confianza} />
                      <span className="block mt-2 text-[11px] leading-snug" style={{ color: TXT3 }}>{resultadoLan.confianza.motivo}</span>
                    </div>
                  </div>

                  {/* Curva de lanzamiento con banda P25–P75 */}
                  <div className="lg:col-span-8 rounded-xl border border-line p-6 md:p-7" style={{ background: 'var(--panel-grad)' }}>
                    <div className="flex items-baseline justify-between gap-4 mb-4">
                      <span className={LABEL} style={{ color: TXT2 }}>Curva de lanzamiento esperada</span>
                      <span className={LABEL} style={{ color: TXT3 }}>uds/semana · banda flojo–fuerte</span>
                    </div>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={resultadoLan.curva.map((c) => ({ semana: `S${c.semana}`, media: c.media, rango: [c.p25, c.p75] }))}
                          margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                        >
                          <CartesianGrid vertical={false} stroke="var(--grid-line)" />
                          <XAxis dataKey="semana" tick={{ fontSize: 10, fill: TXT2, fontFamily: 'var(--font-jetbrains), monospace' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: TXT2, fontFamily: 'var(--font-jetbrains), monospace' }} axisLine={false} tickLine={false} width={42} />
                          <Tooltip
                            cursor={{ stroke: 'var(--hairline)' }}
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="rounded-lg border border-line px-3.5 py-2.5" style={{ background: 'var(--tooltip-bg)' }}>
                                  <div className="font-mono text-[11px]" style={{ color: TXT }}>{label}</div>
                                  <div className="font-mono text-[11px] tnum" style={{ color: TXT2 }}>media {fmt1(d.media)} uds · banda {fmt1(d.rango[0])}–{fmt1(d.rango[1])}</div>
                                </div>
                              );
                            }}
                          />
                          <Area dataKey="rango" stroke="none" fill="var(--data)" fillOpacity={0.16} />
                          <Line dataKey="media" stroke="var(--data-2)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--data-2)', strokeWidth: 0 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Análogos con score transparente */}
                  <div className="lg:col-span-6 rounded-xl border border-line p-6 md:p-7" style={{ background: 'var(--panel-grad)' }}>
                    <div className={`${LABEL} mb-4`} style={{ color: TXT2 }}>Basado en tus análogos · score transparente</div>
                    <ul className="space-y-3">
                      {resultadoLan.analogos.map((a) => (
                        <li key={a.nombre} className="flex items-start justify-between gap-4 pb-3 border-b border-hairlineSoft">
                          <div className="min-w-0">
                            <div className="text-[14px] truncate" style={{ color: TXT }}>{a.nombre}</div>
                            <div className="mt-1 font-mono text-[10px] tracking-[0.06em]" style={{ color: TXT3 }}>
                              categoría +{a.puntos.categoria} · precio +{a.puntos.precio} ·{' '}
                              {a.estacionVisible ? `estación +${a.puntos.estacion}` : 'estación n/d'}
                              {' · '}{fmtInt(a.unidades)} uds · {fmt1(a.precioMedio)} €
                            </div>
                          </div>
                          <span
                            className="flex-shrink-0 inline-flex items-center justify-center min-w-[44px] h-8 rounded-lg border font-mono text-[13px] tnum"
                            style={{ color: 'var(--data)', borderColor: 'var(--line-hover)', background: 'rgba(45,107,228,0.10)' }}
                          >
                            {a.score}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Reparto por talla y color */}
                  <div className="lg:col-span-6 rounded-xl border border-line p-6 md:p-7" style={{ background: 'var(--panel-grad)' }}>
                    <div className={`${LABEL} mb-4`} style={{ color: TXT2 }}>Reparto propuesto</div>
                    {!resultadoLan.reparto ? (
                      <p className="text-[14px]" style={{ color: TXT2 }}>Tus análogos no traen tallas: te damos solo el total.</p>
                    ) : (
                      <TablaTallas reparto={resultadoLan.reparto} recomendado={resultadoLan.total} />
                    )}
                    {resultadoLan.excluidas.length > 0 ? (
                      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: AMBAR }}>
                        Sin unidades para {resultadoLan.excluidas.map((e) => `${e.talla} (peso ${pct1(e.peso)})`).join(', ')} — bajo el mínimo del 2%.
                      </p>
                    ) : null}
                    {resultadoLan.repartoColores ? (
                      <div className="mt-5 pt-4 border-t border-hairline">
                        <div className={`${LABEL} mb-2`} style={{ color: TXT3 }}>Por color</div>
                        <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                          {resultadoLan.repartoColores.map((f) => (
                            <li key={f.talla} className="flex items-baseline justify-between gap-3 font-mono text-[12px]">
                              <span className="truncate" style={{ color: TXT2 }}>{f.talla}</span>
                              <span className="tnum" style={{ color: TXT }}>{fmtInt(f.unidades)} <span style={{ color: TXT3 }}>· {pct1(f.peso)}</span></span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <MatrizTallaColor matriz={resultadoLan.matriz} />
                  </div>
                </div>

                {resultadoLan.avisos.length > 0 ? (
                  <div className="mt-5 rounded-xl border border-line p-5 md:p-6" style={{ background: 'var(--panel-grad)' }}>
                    <div className={LABEL} style={{ color: AMBAR }}>Avisos · {resultadoLan.avisos.length}</div>
                    <ul className="mt-3 space-y-2">
                      {resultadoLan.avisos.map((texto, i) => (
                        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed" style={{ color: TXT2 }}>
                          <span className="mt-[7px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: AMBAR }} />
                          <span>{texto}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <Explicacion pasos={resultadoLan.explicacion} />

                <div className="mt-6 flex flex-wrap items-center gap-5">
                  <button
                    type="button"
                    onClick={copiarLanzamiento}
                    className="btn-sheen h-11 px-6 rounded-lg border border-lineHover font-mono text-[11px] tracking-[0.12em] uppercase text-txt hover:border-txt3 transition-colors"
                    style={{ background: copiadoLan ? 'rgba(107,203,154,0.12)' : 'transparent', borderColor: copiadoLan ? 'var(--ok)' : undefined, color: copiadoLan ? VERDE : undefined }}
                  >
                    {copiadoLan ? 'Copiado ✓' : 'Copiar pedido'}
                  </button>
                  <span className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: TXT3 }}>
                    Un lanzamiento siempre es una apuesta — esto es tu mejor referencia interna, no una garantía.
                  </span>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <>
            {/* Entradas: barra de configuración (el resultado es el protagonista) */}
            <div className="mt-6 rounded-xl border border-lineSoft p-4 md:p-5" style={{ background: 'var(--panel-grad)' }}>
            <div className={LABEL} style={{ color: TXT3 }}>Configura tu pedido — el resultado se actualiza solo</div>
            <div className="mt-4 flex flex-wrap items-start gap-5">
              <Campo etiqueta="Producto">
                <select
                  value={producto}
                  onChange={(e) => setProdSel(e.target.value)}
                  className={`${INPUT_CLS} min-w-[230px] cursor-pointer`}
                  style={{ background: 'var(--surface-input)' }}
                >
                  {productos.map((p) => (
                    <option key={p.nombre} value={p.nombre}>
                      {p.nombre} · {fmtInt(p.total)} uds{p.suficiente ? '' : ' · pocos datos'}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo
                etiqueta="Espera del proveedor"
                hint={leadValido ? 'Semanas desde que pides hasta que el stock llega.' : `Entre ${LEAD_MIN} y ${LEAD_MAX} semanas — mientras tanto usamos 4.`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={LEAD_MIN}
                    max={LEAD_MAX}
                    step={1}
                    value={leadTxt}
                    onChange={(e) => setLeadTxt(e.target.value)}
                    className={`${INPUT_CLS} w-[90px] tnum`}
                    style={{ background: 'var(--surface-input)', borderColor: leadValido ? undefined : EMBER }}
                  />
                  <span className="font-mono text-[11px]" style={{ color: TXT2 }}>semanas</span>
                </div>
              </Campo>

              {!economiaActiva ? (
                <Campo
                  etiqueta="Nivel de servicio"
                  hint="Probabilidad de no quedarte sin stock en ese horizonte. Más nivel, más colchón."
                >
                  <select
                    value={nivel}
                    onChange={(e) => setNivel(e.target.value)}
                    className={`${INPUT_CLS} min-w-[200px] cursor-pointer`}
                    style={{ background: 'var(--surface-input)' }}
                  >
                    <option value="90">90% — ajustado</option>
                    <option value="95">95% — equilibrado</option>
                    <option value="99">99% — casi sin roturas</option>
                  </select>
                </Campo>
              ) : null}

              {!economiaActiva ? (
                <Campo
                  etiqueta="Escenario de demanda"
                  hint="Conservador planifica por si la venta viene floja; agresivo, por si viene fuerte (P25/P75 de las simulaciones)."
                >
                  <Segmentos
                    valor={escenario}
                    onChange={setEscenario}
                    opciones={[
                      { v: 'conservador', t: 'Conserv.' },
                      { v: 'esperado', t: 'Esperado' },
                      { v: 'agresivo', t: 'Agresivo' },
                    ]}
                  />
                </Campo>
              ) : null}

              <Campo
                etiqueta="Economía del pedido (opcional)"
                hint={
                  resultado?.erroresCostes?.length
                    ? resultado.erroresCostes[0]
                    : economiaActiva
                      ? `Pedido en el punto de máximo margen (cuantil ${pct0(resultado.economia.cr)}).`
                      : 'Con coste y PVP, el pedido pasa a maximizar tu margen (liquidación: 30% del PVP si no la cambias).'
                }
              >
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[9px] tracking-[0.12em] uppercase" style={{ color: TXT3 }}>coste €/ud</span>
                    <input
                      type="number" inputMode="decimal" min="0" step="0.01" placeholder="p. ej. 12"
                      value={costeTxt} onChange={(e) => setCosteTxt(e.target.value)}
                      className={`${INPUT_CLS} w-[92px] tnum`}
                      style={{ background: 'var(--surface-input)', borderColor: resultado?.erroresCostes?.length ? EMBER : undefined }}
                    />
                    {costeTxt !== '' && costeGuardado != null && String(costeGuardado) === costeTxt ? (
                      <span className="font-mono text-[9px] tracking-[0.08em]" style={{ color: VERDE }}>✓ de tu panel de costes</span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[9px] tracking-[0.12em] uppercase" style={{ color: TXT3 }}>pvp €/ud</span>
                    <input
                      type="number" inputMode="decimal" min="0" step="0.01" placeholder="p. ej. 30"
                      value={pvpTxt} onChange={(e) => setPvpTxt(e.target.value)}
                      className={`${INPUT_CLS} w-[92px] tnum`}
                      style={{ background: 'var(--surface-input)', borderColor: resultado?.erroresCostes?.length ? EMBER : undefined }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[9px] tracking-[0.12em] uppercase" style={{ color: TXT3 }}>liquidación %</span>
                    <input
                      type="number" inputMode="decimal" min="0" max="90" step="1" placeholder="30"
                      value={liqTxt} onChange={(e) => setLiqTxt(e.target.value)}
                      className={`${INPUT_CLS} w-[92px] tnum`}
                      style={{ background: 'var(--surface-input)' }}
                    />
                  </div>
                </div>
              </Campo>
            </div>
            </div>

            {/* Resultado */}
            {resultado && !resultado.ok && resultado.motivo === 'pocos-datos' ? (
              <div className="mt-8 rounded-xl border border-line p-8 md:p-10" style={{ background: 'var(--inset-grad)' }}>
                <div className={LABEL} style={{ color: EMBER }}>Datos insuficientes</div>
                <p className="mt-4 text-[16px] leading-relaxed max-w-[58ch]" style={{ color: TXT }}>
                  <span className="font-medium">{resultado.producto}</span> acumula {fmtInt(resultado.unidades)} unidades
                  vendidas — por debajo del mínimo de {resultado.minimo} que exigimos para que la estadística diga algo serio.
                </p>
                <p className="mt-3 text-[14px] leading-relaxed max-w-[58ch]" style={{ color: TXT2 }}>
                  Aquí es donde la red de Wefty (datos agregados de marcas similares a la tuya) te dará
                  la respuesta — próximamente.
                </p>
              </div>
            ) : null}

            {resultado?.ok ? (
              <>
                <div
                  className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-5 transition-opacity duration-200"
                  style={{ opacity: calculando ? 0.45 : 1 }}
                >
                  {/* Pedido recomendado — tarjeta protagonista */}
                  <div
                    className="lg:col-span-5 relative rounded-xl border border-brandLine p-7 md:p-8 overflow-hidden flex flex-col"
                    style={{
                      background: 'linear-gradient(150deg, rgba(240,140,86,0.12) 0%, rgba(240,140,86,0.03) 40%, var(--surface-2) 100%)',
                      boxShadow: '0 0 60px -26px var(--glow-brand)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={LABEL} style={{ color: CIELO }}>Pedido recomendado</span>
                      <BadgeCiclo ciclo={resultado.ciclo} />
                    </div>
                    <div className="mt-5 font-display text-[64px] md:text-[78px] leading-[0.9] tracking-[-0.025em] tnum" style={{ color: TXT }}>
                      {fmtInt(resultado.recomendado)}
                      <span className="font-mono text-[13px] tracking-[0.1em] uppercase ml-3" style={{ color: TXT2 }}>uds</span>
                    </div>

                    {resultado.recomendado === 0 ? (
                      <p className="mt-5 text-[14px] leading-relaxed" style={{ color: TXT2 }}>
                        El ritmo reciente de este producto es ≈0 uds/semana: con tus datos en la mano,
                        ahora mismo no hace falta reponer.
                      </p>
                    ) : resultado.modoCantidad === 'economia' ? (
                      <p className="mt-5 text-[14px] leading-relaxed" style={{ color: TXT2 }}>
                        ≈ <span style={{ color: TXT }}>{fmtInt(resultado.esperado)}</span> de demanda esperada
                        {' + '}<span style={{ color: TXT }}>{fmtInt(resultado.colchon)}</span> extra hasta el punto
                        donde más margen ganas (cuantil óptimo <span style={{ color: TXT }}>{pct0(resultado.economia.cr)}</span>).
                      </p>
                    ) : (
                      <p className="mt-5 text-[14px] leading-relaxed" style={{ color: TXT2 }}>
                        ≈ <span style={{ color: TXT }}>{fmtInt(resultado.esperado)}</span> de demanda{' '}
                        {resultado.escenario === 'conservador' ? 'prudente — por si viene floja (P25)' : resultado.escenario === 'agresivo' ? 'ambiciosa — por si viene fuerte (P75)' : 'esperada (P50)'}
                        {' + '}<span style={{ color: TXT }}>{fmtInt(resultado.colchon)}</span> de colchón de
                        seguridad (servicio {resultado.nivelServicio}%).
                      </p>
                    )}
                    <p className="mt-2 text-[13px] leading-relaxed" style={{ color: TXT2 }}>
                      Cubre {resultado.horizonte.total} semanas: {resultado.horizonte.lead} de espera del
                      proveedor + {resultado.horizonte.cobertura} de venta.
                    </p>
                    <p className="mt-2 font-mono text-[11px] tracking-[0.02em] leading-relaxed" style={{ color: TXT3 }}>
                      en 8 de cada 10 escenarios venderías {fmtInt(resultado.intervalo.p10)}–{fmtInt(resultado.intervalo.p90)} uds
                      {' · '}floja {fmtInt(resultado.escenarios.conservador)} · esperada {fmtInt(resultado.escenarios.esperado)} · fuerte {fmtInt(resultado.escenarios.agresivo)}
                      {' · '}{resultado.bootstrap.simulaciones} simulaciones
                    </p>

                    <div className="mt-5 font-mono text-[11px] tracking-[0.04em] space-y-1" style={{ color: TXT2 }}>
                      <div>ritmo previsto ≈ <span className="tnum" style={{ color: TXT }}>{fmt1(resultado.tasaSemanal)}</span> uds/semana</div>
                      <div>
                        {resultado.semanasAjuste} semanas analizadas · {fmtInt(resultado.unidadesHistoricas)} uds históricas
                        {resultado.semanaParcialExcluida ? ' · última semana parcial excluida' : ''}
                      </div>
                      <div>
                        ciclo de vida: <span style={{ color: TXT }}>{resultado.ciclo.fase.toLowerCase()}</span> — {resultado.ciclo.detalle}
                      </div>
                      {resultado.estacionalidad ? (
                        <div>
                          estación: próximas {resultado.horizonte.total} semanas ≈{' '}
                          <span style={{ color: TXT }}>
                            {resultado.estacionalidad.factorHorizonte >= 1 ? '+' : '−'}
                            {Math.abs(Math.round((resultado.estacionalidad.factorHorizonte - 1) * 100))}%
                          </span>{' '}
                          vs media anual
                          {resultado.estacionalidad.usadaPorModelo ? ' · ya incluida en el pronóstico' : ' · informativa (el modelo ganador es plano)'}
                        </div>
                      ) : null}
                    </div>

                    {/* La credencial del motor: qué modelo ganó y contra qué se midió */}
                    <div className="mt-4 pt-4 border-t border-hairline">
                      <div className={LABEL} style={{ color: CIELO }}>Motor seleccionado</div>
                      <p className="mt-1.5 text-[13px] leading-snug" style={{ color: TXT }}>{resultado.modelo.resumen}</p>
                      <p className="mt-1 font-mono text-[11px] tracking-[0.02em] leading-relaxed" style={{ color: TXT2 }}>
                        {resultado.modelo.detalle}
                      </p>
                    </div>

                    <div className="mt-auto pt-5">
                      <BadgeConfianza confianza={resultado.confianza} />
                      <span className="block mt-2 text-[11px] leading-snug" style={{ color: TXT3 }}>{resultado.confianza.motivo}</span>
                    </div>
                  </div>

                  {/* Reparto por talla */}
                  <div className="lg:col-span-7 rounded-xl border border-line p-6 md:p-7" style={{ background: 'var(--panel-grad)' }}>
                    <div className="flex items-baseline justify-between gap-4 mb-5">
                      <span className={LABEL} style={{ color: TXT2 }}>Reparto por talla</span>
                      <span className={LABEL} style={{ color: TXT3 }}>{resultado.categoria}</span>
                    </div>

                    {!resultado.reparto ? (
                      <p className="text-[14px] leading-relaxed" style={{ color: TXT2 }}>
                        Tus datos no incluyen talla para este producto, así que te damos solo el total.
                      </p>
                    ) : resultado.tallaUnica ? (
                      <p className="text-[14px] leading-relaxed" style={{ color: TXT2 }}>
                        Producto de talla única ({resultado.reparto[0].talla}): el pedido completo,{' '}
                        <span className="tnum" style={{ color: TXT }}>{fmtInt(resultado.recomendado)}</span> uds, va a esa talla.
                      </p>
                    ) : (
                      <TablaTallas reparto={resultado.reparto} recomendado={resultado.recomendado} />
                    )}

                    {resultado.pesosCurva ? (
                      <p className="mt-4 font-mono text-[11px] tracking-[0.04em] leading-relaxed" style={{ color: TXT3 }}>
                        curva de tallas: {pct0(resultado.pesosCurva.producto)} este producto
                        {' + '}{pct0(resultado.pesosCurva.categoria)} su categoría
                        {' + '}{pct0(resultado.pesosCurva.global)} resto de la marca · K={resultado.K}
                      </p>
                    ) : null}

                    {resultado.excluidas.length > 0 ? (
                      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: AMBAR }}>
                        Sin unidades para {resultado.excluidas.map((e) => `${e.talla} (peso ${pct1(e.peso)})`).join(', ')} —
                        por debajo del mínimo del 2%.
                      </p>
                    ) : null}

                    {resultado.sellThrough ? (
                      <p className="mt-3 pt-3 border-t border-hairline font-mono text-[11px] tracking-[0.02em]" style={{ color: TXT2 }}>
                        sell-through proyectado:{' '}
                        <span style={{ color: TXT }}>{pct0(resultado.sellThrough.st8)}</span> vendido a 8 semanas ·{' '}
                        <span style={{ color: TXT }}>{pct0(resultado.sellThrough.st12)}</span> a 12
                      </p>
                    ) : null}

                    <MatrizTallaColor matriz={resultado.matriz} />
                  </div>
                </div>

                {/* Economía del pedido en euros (cuando hay costes) */}
                {resultado.economia ? (
                  <div className="mt-5 rounded-xl border border-brandLine p-6 md:p-7" style={{ background: 'linear-gradient(150deg, var(--tint-brand) 0%, var(--surface-2) 70%)' }}>
                    <div className={LABEL} style={{ color: CIELO }}>Economía del pedido · en euros</div>
                    <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <div className={LABEL} style={{ color: TXT3 }}>Margen esperado</div>
                        <div className="mt-1.5 font-display text-[26px] leading-none tnum" style={{ color: TXT }}>
                          {fmtEur(resultado.economia.evaluacion.margenEsperado)}
                        </div>
                      </div>
                      <div>
                        <div className={LABEL} style={{ color: TXT3 }}>vs pedir la media ({fmtInt(resultado.economia.pedidoMedia)} uds)</div>
                        <div className="mt-1.5 font-display text-[26px] leading-none tnum" style={{ color: resultado.economia.ventajaVsMedia >= 1 ? VERDE : TXT }}>
                          {resultado.economia.ventajaVsMedia >= 1 ? `+${fmtEur(resultado.economia.ventajaVsMedia)}` : '≈ igual'}
                        </div>
                      </div>
                      <div>
                        <div className={LABEL} style={{ color: TXT3 }}>Pérdida esperada por rebajas</div>
                        <div className="mt-1.5 font-display text-[26px] leading-none tnum" style={{ color: AMBAR }}>
                          {fmtEur(resultado.economia.evaluacion.perdidaRebajas)}
                        </div>
                      </div>
                      <div>
                        <div className={LABEL} style={{ color: TXT3 }}>Venta perdida esperada</div>
                        <div className="mt-1.5 font-display text-[26px] leading-none tnum" style={{ color: AMBAR }}>
                          {fmtEur(resultado.economia.evaluacion.ventaPerdida)}
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 text-[12px] leading-relaxed max-w-[70ch]" style={{ color: TXT2 }}>
                      Ratio crítico = (PVP − coste) / (PVP − liquidación) = {pct0(resultado.economia.cr)}:
                      pedir hasta ese percentil de demanda equilibra el coste de quedarte corto (margen
                      perdido) con el de pasarte (liquidar a {fmtEur(resultado.economia.liqValor)}/ud).
                      Sobrante esperado: {fmt1(resultado.economia.evaluacion.sobranteEsperado)} uds ·
                      faltante esperado: {fmt1(resultado.economia.evaluacion.faltanteEsperado)} uds.
                    </p>
                  </div>
                ) : null}

                {/* Avisos: limpieza estadística + notas del cálculo */}
                {resultado.flags.length > 0 || resultado.avisos.length > 0 ? (
                  <div className="mt-5 rounded-xl border border-line p-5 md:p-6" style={{ background: 'var(--panel-grad)' }}>
                    <div className={LABEL} style={{ color: AMBAR }}>
                      Avisos del motor · {resultado.flags.length + resultado.avisos.length}
                    </div>
                    <ul className="mt-3 space-y-2">
                      {resultado.avisos.map((texto, i) => (
                        <li key={`a${i}`} className="flex gap-2.5 text-[13px] leading-relaxed" style={{ color: TXT2 }}>
                          <span className="mt-[7px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: AMBAR }} />
                          <span>{texto}</span>
                        </li>
                      ))}
                      {resultado.flags.map((f, i) => (
                        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed" style={{ color: TXT2 }}>
                          <span className="mt-[7px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: f.tipo === 'rotura' ? EMBER : AMBAR }} />
                          <span>{f.texto}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <Explicacion pasos={resultado.explicacion} />

                {/* Acciones + descargo */}
                <div className="mt-6 flex flex-wrap items-center gap-5">
                  <button
                    type="button"
                    onClick={copiarPedido}
                    className="btn-sheen h-11 px-6 rounded-lg border border-lineHover font-mono text-[11px] tracking-[0.12em] uppercase text-txt hover:border-txt3 transition-colors"
                    style={{ background: copiado ? 'rgba(107,203,154,0.12)' : 'transparent', borderColor: copiado ? 'var(--ok)' : undefined, color: copiado ? VERDE : undefined }}
                  >
                    {copiado ? 'Copiado ✓' : 'Copiar pedido'}
                  </button>
                  <span className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: TXT3 }}>
                    Recomendación estadística basada en tu histórico — ajústala con tu criterio.
                  </span>
                </div>
              </>
            ) : null}
          </>
        )}


      </div>
    </div>
  );
}
