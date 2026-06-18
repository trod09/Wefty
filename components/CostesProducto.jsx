'use client';

// Panel "Costes de producto": el coste unitario REAL de cada producto, editable
// en línea y guardado en la cuenta del usuario (tabla costes_producto, RLS).
// Los productos sin coste muestran la ESTIMACIÓN por margen global (gris,
// etiqueta "est."); los rellenados son "real". El guardado es explícito
// (botón, no auto-save) y un error de red nunca borra lo escrito.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { productosOrdenados } from '@/lib/engine/motor.mjs';

const VERDE = 'var(--ok)';
const AMBAR = 'var(--warn)';
const TXT = 'var(--txt)';
const TXT2 = 'var(--txt-2)';
const TXT3 = 'var(--txt-3)';
const LABEL = 'font-mono text-[10px] tracking-[0.18em] uppercase';
const INPUT_CLS = 'h-11 md:h-9 rounded-lg border field-bordered px-3 text-[16px] md:text-[13px] text-txt outline-none transition-colors';

const fmtEur2 = (n) => (Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctTxt = (x) => `${Math.round((Number(x) || 0) * 100)}%`;

// Texto del input → número (acepta coma decimal); null si no es un coste válido.
export function parseCoste(txt) {
  const s = String(txt ?? '').trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function CostesProducto({ motor, margenTxt, onMargenTxt, onCostes }) {
  // Lo escrito por producto (texto tal cual; el número se deriva al usarlo).
  const [valores, setValores] = useState({});
  // Qué productos tienen fila en la base de datos (para borrar si se vacían).
  const [enDb, setEnDb] = useState(() => new Set());
  const [avisoCarga, setAvisoCarga] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok'|'error', texto }

  const productos = useMemo(() => productosOrdenados(motor), [motor]);
  const margenPct = Math.min(90, Math.max(20, Number(margenTxt) || 60));

  // Al montar con sesión: leer los costes guardados de ESTE usuario (RLS) y
  // aplicarlos sin pisar nada que ya se hubiera escrito en esta visita.
  useEffect(() => {
    let activo = true;
    supabase
      .from('costes_producto')
      .select('producto,coste_unitario')
      .then(({ data, error }) => {
        if (!activo) return;
        if (error) {
          setAvisoCarga('No se pudieron cargar los costes guardados (¿está creada la tabla costes_producto?). Puedes escribirlos igualmente.');
          return;
        }
        if (!data?.length) return;
        setEnDb(new Set(data.map((r) => r.producto)));
        setValores((prev) => {
          const sig = { ...prev };
          for (const r of data) {
            if (sig[r.producto] == null && r.coste_unitario > 0) sig[r.producto] = String(r.coste_unitario);
          }
          return sig;
        });
      });
    return () => { activo = false; };
  }, []);

  // Cada cambio sube el mapa numérico al motor de la pantalla (plan/reposición).
  useEffect(() => {
    const mapa = new Map();
    for (const [nombre, txt] of Object.entries(valores)) {
      const n = parseCoste(txt);
      if (n != null) mapa.set(nombre, n);
    }
    onCostes(mapa);
  }, [valores, onCostes]);

  const nReales = productos.filter((p) => parseCoste(valores[p.nombre]) != null).length;

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMensaje({ tipo: 'error', texto: 'Tu sesión ha caducado. Inicia sesión de nuevo — lo escrito sigue aquí.' });
        return;
      }
      const filas = [];
      const borrar = [];
      for (const p of productos) {
        const n = parseCoste(valores[p.nombre]);
        if (n != null) {
          filas.push({ user_id: user.id, producto: p.nombre, coste_unitario: n, actualizado_en: new Date().toISOString() });
        } else if (enDb.has(p.nombre)) {
          borrar.push(p.nombre); // estaba guardado y se ha vaciado → se borra
        }
      }
      if (filas.length > 0) {
        const { error } = await supabase
          .from('costes_producto')
          .upsert(filas, { onConflict: 'user_id,producto' });
        if (error) {
          setMensaje({ tipo: 'error', texto: 'No se pudo guardar: ' + error.message + ' — lo escrito no se ha perdido.' });
          return;
        }
      }
      if (borrar.length > 0) {
        const { error } = await supabase
          .from('costes_producto')
          .delete()
          .eq('user_id', user.id)
          .in('producto', borrar);
        if (error) {
          setMensaje({ tipo: 'error', texto: 'Costes guardados, pero no se pudieron borrar los vaciados: ' + error.message });
          return;
        }
      }
      setEnDb(new Set(filas.map((f) => f.producto)));
      setMensaje({
        tipo: 'ok',
        texto: `${filas.length} coste${filas.length === 1 ? '' : 's'} guardado${filas.length === 1 ? '' : 's'}`
          + (borrar.length > 0 ? ` · ${borrar.length} borrado${borrar.length === 1 ? '' : 's'}` : '') + '.',
      });
    } catch {
      setMensaje({ tipo: 'error', texto: 'Sin conexión: no se pudo guardar. Lo escrito sigue aquí — reintenta en un momento.' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <details className="mt-8 group border-t border-hairline pt-5">
      <summary className="flex items-center gap-3 cursor-pointer select-none py-2 md:py-0">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase transition-colors text-txt2 group-hover:text-txt">
          Costes de producto — cuánto te cuesta cada unidad
        </span>
        <span className="font-mono text-[10px] tracking-[0.1em]" style={{ color: nReales > 0 ? VERDE : TXT3 }}>
          {nReales} de {productos.length} reales
        </span>
        <span className="font-mono text-[11px] transition-transform group-open:rotate-90" style={{ color: TXT3 }}>›</span>
      </summary>

      <div className="mt-5 acc-body">
        <p className="text-[13px] leading-relaxed max-w-[640px]" style={{ color: TXT2 }}>
          Con el coste real, el plan de compra prioriza por rentabilidad de verdad (y la
          reposición prellena su modo economía). Donde no lo escribas, se usa la estimación
          por margen global.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-5">
          <div className="flex flex-col gap-1.5">
            <span className={LABEL} style={{ color: TXT2 }}>Margen global por defecto (%)</span>
            <input
              type="number" inputMode="numeric" min="20" max="90" step="1"
              value={margenTxt} onChange={(e) => onMargenTxt(e.target.value)}
              className={`${INPUT_CLS} w-[90px] tnum`}
              style={{ background: 'var(--surface-input)' }}
            />
          </div>
          <span className="pb-2 text-[11px] leading-snug max-w-[330px]" style={{ color: TXT3 }}>
            Es el mismo margen de la pestaña Plan de compra: coste estimado = {100 - margenPct}% del PVP medio.
          </span>
        </div>

        {avisoCarga ? (
          <p className="mt-3 text-[12px] leading-snug" style={{ color: AMBAR }}>{avisoCarga}</p>
        ) : null}

        {/* Tabla de costes */}
        <div className="mt-5 max-w-[760px]">
          <div className="hidden md:grid grid-cols-[1.6fr_90px_130px_170px] gap-3 pb-2 border-b border-hairline">
            {['Producto', 'PVP medio', 'Coste unitario', 'Margen resultante'].map((h, i) => (
              <span key={h} className={`${LABEL} ${i === 1 ? 'text-right' : ''}`} style={{ color: TXT3 }}>{h}</span>
            ))}
          </div>
          <ul>
            {productos.map((p) => {
              const pvp = motor.almacen.productos.get(p.nombre)?.precioMedio || 0;
              const estimado = pvp * (1 - margenPct / 100);
              const real = parseCoste(valores[p.nombre]);
              const coste = real ?? estimado;
              const margen = pvp - coste;
              const margenNegativo = real != null && margen <= 0;
              const celdas = (
                <>
                  <input
                    type="number" inputMode="decimal" min="0" step="0.01"
                    placeholder={estimado > 0 ? fmtEur2(estimado).replace(',', '.') : '—'}
                    value={valores[p.nombre] ?? ''}
                    onChange={(e) => { setMensaje(null); setValores((v) => ({ ...v, [p.nombre]: e.target.value })); }}
                    className={`${INPUT_CLS} w-[110px] tnum`}
                    style={{ background: 'var(--surface-input)' }}
                    aria-label={`Coste unitario de ${p.nombre}`}
                  />
                  <span
                    className={`font-mono text-[12px] tnum ${real == null ? 'italic' : ''}`}
                    style={{ color: margenNegativo ? AMBAR : real == null ? TXT3 : margen > 0 ? VERDE : TXT }}
                  >
                    {fmtEur2(margen)} € ({pvp > 0 ? pctTxt(margen / pvp) : '—'})
                    <span className="not-italic ml-1.5 font-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: real == null ? TXT3 : VERDE }}>
                      {real == null ? 'est.' : 'real'}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={p.nombre} className="border-b border-hairlineSoft">
                  {/* Móvil: tarjeta apilada */}
                  <div className="md:hidden py-3 flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px]" style={{ color: TXT }}>{p.nombre}</span>
                      <span className="font-mono text-[11px] tnum" style={{ color: TXT2 }}>PVP {fmtEur2(pvp)} €</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">{celdas}</div>
                    {margenNegativo ? (
                      <span className="text-[11px]" style={{ color: AMBAR }}>margen negativo — ¿seguro? (se permite: pasa en liquidaciones)</span>
                    ) : null}
                  </div>
                  {/* Escritorio: rejilla */}
                  <div className="hidden md:grid grid-cols-[1.6fr_90px_130px_170px] gap-3 items-center py-2">
                    <span className="text-[13px] truncate" style={{ color: TXT }}>{p.nombre}</span>
                    <span className="font-mono text-[12px] tnum text-right" style={{ color: TXT2 }}>{fmtEur2(pvp)} €</span>
                    {celdas}
                  </div>
                  {margenNegativo ? (
                    <p className="hidden md:block pb-2 -mt-0.5 text-[11px]" style={{ color: AMBAR }}>
                      margen negativo — ¿seguro? (se permite: pasa en liquidaciones)
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="btn-sheen h-11 px-6 rounded-lg border border-lineHover font-mono text-[11px] tracking-[0.12em] uppercase text-txt hover:border-txt3 transition-colors disabled:opacity-60"
            style={{
              background: mensaje?.tipo === 'ok' ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : 'transparent',
              borderColor: mensaje?.tipo === 'ok' ? 'color-mix(in srgb, var(--ok) 40%, transparent)' : undefined,
              color: mensaje?.tipo === 'ok' ? VERDE : undefined,
            }}
          >
            {guardando ? 'Guardando…' : 'Guardar costes'}
          </button>
          {mensaje ? (
            <span className="text-[12px] leading-snug max-w-[420px]" style={{ color: mensaje.tipo === 'ok' ? VERDE : AMBAR }}>
              {mensaje.texto}
            </span>
          ) : (
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: TXT3 }}>
              se guardan en tu cuenta — solo tú los ves
            </span>
          )}
        </div>
      </div>
    </details>
  );
}
