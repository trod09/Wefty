'use client';

// Motor de stock — la sección del dashboard donde Wefty recomienda CUÁNTO pedir.
// Esta pantalla NO calcula nada: toda la matemática vive en lib/engine/ y aquí
// solo se eligen las entradas (producto, espera del proveedor, nivel de
// servicio) y se pintan los resultados con sus avisos y su panel de honestidad.
//
// Importante: el motor usa SIEMPRE el dataset completo, aunque el dashboard
// tenga filtros activos — pronosticar sobre datos filtrados daría pedidos
// sesgados. Se indica con una nota sutil cuando hay filtros puestos.
import React, { useMemo, useState } from 'react';
import {
  prepararMotor, recomendarReposicion, productosOrdenados, validacionGlobal,
  LEAD_MIN, LEAD_MAX,
} from '@/lib/engine/motor.mjs';
import { fmtFecha } from '@/lib/engine/datos.mjs';

const EMBER = '#E07A5F';
const VERDE = '#6BCB9A';
const AMBAR = '#E3C04B';
const CIELO = '#9db4ec';
const TXT = '#F5F5F7';
const TXT2 = '#8A8A8F';
const TXT3 = '#5d5e63';
const LABEL = 'font-mono text-[10px] tracking-[0.18em] uppercase';
const CARD_BG = 'linear-gradient(150deg, #16171b 0%, #121316 100%)';
const INPUT_CLS = 'h-10 rounded-lg border border-[#232428] px-3 text-[14px] text-[#F5F5F7] outline-none transition-colors focus:border-[#3F7BEC]';

const fmtInt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
const fmt1 = (n) => (Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct0 = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
const pct1 = (x) => `${((Number(x) || 0) * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })}%`;

function Campo({ etiqueta, children, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL} style={{ color: TXT2 }}>{etiqueta}</span>
      {children}
      {hint ? <span className="text-[11px] leading-snug max-w-[230px]" style={{ color: TXT3 }}>{hint}</span> : null}
    </div>
  );
}

const COLOR_CONFIANZA = { ALTA: VERDE, MEDIA: AMBAR, BAJA: EMBER };

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
function PanelConfiguracion({ perfil, configuracion }) {
  const ESTADO = {
    activa: { color: VERDE, texto: 'activa' },
    desactivada: { color: TXT3, texto: 'desactivada' },
    proximamente: { color: CIELO, texto: 'próximamente' },
  };
  return (
    <details className="mt-8 group border-t border-white/10 pt-5">
      <summary className="flex items-center gap-3 cursor-pointer select-none">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase transition-colors text-[#8A8A8F] group-hover:text-[#F5F5F7]">
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

// Panel "Validación del motor" — MÓDULO 7: la credibilidad. Backtest global y
// por categoría contra el propio histórico del usuario. Si los datos no dan
// para una validación robusta, se dice claramente en vez de enseñar números débiles.
function PanelValidacion({ motor }) {
  const v = useMemo(() => validacionGlobal(motor), [motor]);

  const FilaVal = ({ f }) => (
    <li className="grid grid-cols-[minmax(120px,1.4fr)_minmax(150px,2fr)_72px_110px_60px] gap-3 items-baseline py-2 border-b border-white/[0.06]">
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
            {f.mejora != null ? (f.mejora > 0 ? `−${pct0(f.mejora)} de error` : 'sin mejora') : 'es el baseline'}
          </span>
          <span className="font-mono text-[11px] tnum text-right" style={{ color: TXT3 }}>{f.cortes} cortes</span>
        </>
      )}
    </li>
  );

  return (
    <details className="mt-4 group border-t border-white/10 pt-5">
      <summary className="flex items-center gap-3 cursor-pointer select-none">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase transition-colors text-[#8A8A8F] group-hover:text-[#F5F5F7]">
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
              siguientes y comprueba cuánto falló. El error es WAPE (desviación media ponderada);
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
                <li className="grid grid-cols-[minmax(120px,1.4fr)_minmax(150px,2fr)_72px_110px_60px] gap-3 pb-2 border-b border-white/10">
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

// Tabla del reparto por talla, con barras proporcionales.
function TablaTallas({ reparto, recomendado }) {
  const maxPeso = Math.max(...reparto.map((f) => f.peso), 0.0001);
  return (
    <div>
      <div className="grid grid-cols-[56px_1fr_64px_52px] gap-3 pb-2 border-b border-white/10">
        {['Talla', '', 'Uds', '%'].map((h, i) => (
          <span key={i} className={`${LABEL} ${i >= 2 ? 'text-right' : ''}`} style={{ color: TXT3 }}>{h}</span>
        ))}
      </div>
      <ul>
        {reparto.map((f) => (
          <li key={f.talla} className="grid grid-cols-[56px_1fr_64px_52px] gap-3 items-center py-2 border-b border-white/[0.06]">
            <span className="font-mono text-[13px]" style={{ color: TXT }}>{f.talla}</span>
            <span className="h-[18px] rounded-sm relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <span
                className="absolute inset-y-0 left-0 rounded-sm transition-all duration-300"
                style={{
                  width: `${Math.max((f.peso / maxPeso) * 100, 2)}%`,
                  background: 'linear-gradient(90deg, #234E9E 0%, #3F7BEC 100%)',
                }}
              />
            </span>
            <span className="font-mono text-[14px] tnum text-right" style={{ color: TXT }}>{fmtInt(f.unidades)}</span>
            <span className="font-mono text-[11px] tnum text-right" style={{ color: TXT2 }}>{pct1(f.peso)}</span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-[56px_1fr_64px_52px] gap-3 items-center pt-2.5">
        <span className={LABEL} style={{ color: TXT2 }}>Total</span>
        <span />
        <span className="font-mono text-[14px] tnum text-right" style={{ color: TXT }}>{fmtInt(recomendado)}</span>
        <span className="font-mono text-[11px] tnum text-right" style={{ color: TXT2 }}>100%</span>
      </div>
    </div>
  );
}

export default function StockEngine({ records, hayFiltros }) {
  const [pestana, setPestana] = useState('reposicion');
  const [prodSel, setProdSel] = useState('');
  const [leadTxt, setLeadTxt] = useState('4');
  const [nivel, setNivel] = useState('95');
  const [copiado, setCopiado] = useState(false);

  // El motor se prepara UNA vez por dataset (perfil + limpieza de todo el
  // catálogo, operaciones baratas). El pronóstico se calcula solo para el
  // producto seleccionado, al cambiar cualquier entrada.
  const motor = useMemo(() => prepararMotor(records), [records]);
  const productos = useMemo(() => productosOrdenados(motor), [motor]);

  const producto = motor.almacen.productos.has(prodSel) ? prodSel : (productos[0]?.nombre ?? '');
  const leadNum = Number(leadTxt);
  const leadValido = Number.isFinite(leadNum) && leadNum >= LEAD_MIN && leadNum <= LEAD_MAX;
  const leadEfectivo = leadValido ? leadNum : 4;

  const resultado = useMemo(() => {
    if (!producto) return null;
    return recomendarReposicion(motor, {
      producto,
      leadSemanas: leadEfectivo,
      nivelServicio: Number(nivel),
    });
  }, [motor, producto, leadEfectivo, nivel]);

  if (motor.almacen.vacio) {
    return (
      <div className="rounded-xl border border-[#232428] p-8 text-center" style={{ background: CARD_BG }}>
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
    const lineas = [
      `Pedido recomendado — ${r.producto}`,
      `Cubre ${r.horizonte.total} semanas · nivel de servicio ${r.nivelServicio}%`,
      'Talla\tUnidades',
      ...(r.reparto ? r.reparto.map((f) => `${f.talla}\t${f.unidades}`) : []),
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

  const tabCls = (activa) =>
    `pb-2.5 font-mono text-[11px] tracking-[0.18em] uppercase transition-colors border-b-2 ${
      activa ? 'border-[#2D6BE4] text-[#F5F5F7]' : 'border-transparent text-[#8A8A8F] hover:text-[#F5F5F7]'
    }`;

  return (
    <div>
      {/* Cabecera de la sección */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className={`${LABEL} flex items-center gap-2`} style={{ color: TXT2 }}>
          <span className="w-1.5 h-1.5 rounded-full bg-electric live-dot" />
          Motor de stock · cuánto pedir
        </div>
        <span className={LABEL} style={{ color: TXT3 }}>
          {hayFiltros ? 'usa todo tu histórico — ignora los filtros de arriba' : 'calculado sobre todo tu histórico'}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-[#232428] p-6 md:p-8" style={{ background: CARD_BG }}>
        {/* Pestañas */}
        <div className="flex gap-7 border-b border-white/10">
          <button type="button" className={tabCls(pestana === 'reposicion')} onClick={() => setPestana('reposicion')}>
            Reposición
          </button>
          <button type="button" className={tabCls(pestana === 'lanzamiento')} onClick={() => setPestana('lanzamiento')}>
            Lanzamiento
          </button>
        </div>

        {pestana === 'lanzamiento' ? (
          <div className="py-12 text-center">
            <div className={LABEL} style={{ color: CIELO }}>Próximamente · parte 5 del motor</div>
            <p className="mt-4 mx-auto max-w-[52ch] text-[15px] leading-relaxed" style={{ color: TXT2 }}>
              Pedido inicial para un producto SIN histórico: el motor buscará tus productos
              análogos (misma categoría, banda de precio parecida), aprenderá de sus primeras
              semanas de vida y te propondrá cantidad total y reparto por talla y color.
            </p>
          </div>
        ) : (
          <>
            {/* Entradas */}
            <div className="mt-6 flex flex-wrap items-start gap-5">
              <Campo etiqueta="Producto">
                <select
                  value={producto}
                  onChange={(e) => setProdSel(e.target.value)}
                  className={`${INPUT_CLS} min-w-[230px] cursor-pointer`}
                  style={{ background: '#0E0F12', colorScheme: 'dark' }}
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
                    min={LEAD_MIN}
                    max={LEAD_MAX}
                    step={1}
                    value={leadTxt}
                    onChange={(e) => setLeadTxt(e.target.value)}
                    className={`${INPUT_CLS} w-[90px] tnum`}
                    style={{ background: '#0E0F12', colorScheme: 'dark', borderColor: leadValido ? undefined : EMBER }}
                  />
                  <span className="font-mono text-[11px]" style={{ color: TXT2 }}>semanas</span>
                </div>
              </Campo>

              <Campo
                etiqueta="Nivel de servicio"
                hint="Probabilidad de no quedarte sin stock en ese horizonte. Más nivel, más colchón."
              >
                <select
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value)}
                  className={`${INPUT_CLS} min-w-[210px] cursor-pointer`}
                  style={{ background: '#0E0F12', colorScheme: 'dark' }}
                >
                  <option value="90">90% — ajustado</option>
                  <option value="95">95% — equilibrado</option>
                  <option value="99">99% — casi sin roturas</option>
                </select>
              </Campo>
            </div>

            {/* Resultado */}
            {resultado && !resultado.ok && resultado.motivo === 'pocos-datos' ? (
              <div className="mt-8 rounded-xl border border-[#232428] p-8 md:p-10" style={{ background: 'linear-gradient(150deg, #101114 0%, #0c0d10 100%)' }}>
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
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Pedido recomendado — tarjeta protagonista */}
                  <div
                    className="lg:col-span-5 relative rounded-xl border border-[#2a3654] p-7 md:p-8 overflow-hidden flex flex-col"
                    style={{
                      background: 'linear-gradient(150deg, rgba(45,107,228,0.16) 0%, rgba(45,107,228,0.04) 40%, #141518 100%)',
                      boxShadow: '0 0 60px -26px rgba(45,107,228,0.7)',
                    }}
                  >
                    <div className={LABEL} style={{ color: CIELO }}>Pedido recomendado</div>
                    <div className="mt-5 font-serif text-[64px] md:text-[78px] leading-[0.9] tracking-[-0.025em] tnum" style={{ color: TXT }}>
                      {fmtInt(resultado.recomendado)}
                      <span className="font-mono text-[13px] tracking-[0.1em] uppercase ml-3" style={{ color: TXT2 }}>uds</span>
                    </div>

                    {resultado.recomendado === 0 ? (
                      <p className="mt-5 text-[14px] leading-relaxed" style={{ color: TXT2 }}>
                        El ritmo reciente de este producto es ≈0 uds/semana: con tus datos en la mano,
                        ahora mismo no hace falta reponer.
                      </p>
                    ) : (
                      <p className="mt-5 text-[14px] leading-relaxed" style={{ color: TXT2 }}>
                        ≈ <span style={{ color: TXT }}>{fmtInt(resultado.esperado)}</span> de demanda esperada
                        {' + '}<span style={{ color: TXT }}>{fmtInt(resultado.colchon)}</span> de colchón de seguridad
                        (servicio {resultado.nivelServicio}%).
                      </p>
                    )}
                    <p className="mt-2 text-[13px] leading-relaxed" style={{ color: TXT2 }}>
                      Cubre {resultado.horizonte.total} semanas: {resultado.horizonte.lead} de espera del
                      proveedor + {resultado.horizonte.cobertura} de venta.
                    </p>

                    <div className="mt-5 font-mono text-[11px] tracking-[0.04em] space-y-1" style={{ color: TXT2 }}>
                      <div>ritmo previsto ≈ <span className="tnum" style={{ color: TXT }}>{fmt1(resultado.tasaSemanal)}</span> uds/semana</div>
                      <div>
                        {resultado.semanasAjuste} semanas analizadas · {fmtInt(resultado.unidadesHistoricas)} uds históricas
                        {resultado.semanaParcialExcluida ? ' · última semana parcial excluida' : ''}
                      </div>
                    </div>

                    {/* La credencial del motor: qué modelo ganó y contra qué se midió */}
                    <div className="mt-4 pt-4 border-t border-white/10">
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
                  <div className="lg:col-span-7 rounded-xl border border-[#232428] p-6 md:p-7" style={{ background: 'linear-gradient(150deg, #131418 0%, #0f1013 100%)' }}>
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
                  </div>
                </div>

                {/* Avisos de la limpieza estadística */}
                {resultado.flags.length > 0 ? (
                  <div className="mt-5 rounded-xl border border-[#232428] p-5 md:p-6" style={{ background: 'linear-gradient(150deg, #131418 0%, #0f1013 100%)' }}>
                    <div className={LABEL} style={{ color: AMBAR }}>
                      Avisos de la limpieza estadística · {resultado.flags.length}
                    </div>
                    <ul className="mt-3 space-y-2">
                      {resultado.flags.map((f, i) => (
                        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed" style={{ color: TXT2 }}>
                          <span className="mt-[7px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: f.tipo === 'rotura' ? EMBER : AMBAR }} />
                          <span>{f.texto}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Acciones + descargo */}
                <div className="mt-6 flex flex-wrap items-center gap-5">
                  <button
                    type="button"
                    onClick={copiarPedido}
                    className="h-11 px-6 rounded-lg border border-[#3a3c42] font-mono text-[11px] tracking-[0.12em] uppercase text-[#F5F5F7] hover:border-[#5d5e63] transition-colors"
                    style={{ background: copiado ? 'rgba(107,203,154,0.12)' : 'transparent', borderColor: copiado ? `${VERDE}66` : undefined, color: copiado ? VERDE : undefined }}
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

        <PanelConfiguracion perfil={motor.perfil} configuracion={motor.configuracion} />
        <PanelValidacion motor={motor} />
      </div>
    </div>
  );
}
