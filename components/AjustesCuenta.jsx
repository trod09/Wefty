'use client';

// Ajustes de cuenta — gestión de la cuenta del usuario (auth de Supabase),
// NO configuración del motor (eso vive en «Ajustes del motor»). Aquí: ver el
// email de la sesión, cambiar la contraseña, cerrar sesión y eliminar la cuenta.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const MONO = 'font-mono text-[10px] tracking-[0.18em] uppercase';
const TXT = 'var(--txt)';
const TXT2 = 'var(--txt-2)';
const TXT3 = 'var(--txt-3)';

// Longitud mínima de contraseña (por defecto de Supabase). El servidor valida
// la política real y devuelve error si no se cumple; esto es solo ayuda previa.
const MIN_PASS = 6;
// Palabra exacta que el usuario debe escribir para confirmar el borrado.
const PALABRA_BORRAR = 'ELIMINAR';

function colorMensaje(tipo) {
  return tipo === 'error' ? 'var(--bad)' : tipo === 'ok' ? 'var(--ok)' : TXT2;
}

const INPUT_CLS =
  'w-full h-12 px-4 rounded-lg bg-surfaceInput border field-bordered text-[16px] md:text-[15px] text-txt placeholder-txt3 outline-none transition-colors';

export default function AjustesCuenta({ email }) {
  const router = useRouter();

  // ——— Cambiar contraseña ———
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [mostrarPass, setMostrarPass] = useState(false);
  const [guardandoPass, setGuardandoPass] = useState(false);
  const [msgPass, setMsgPass] = useState(null); // { tipo, texto }

  // ——— Cerrar sesión ———
  const [cerrando, setCerrando] = useState(false);

  // ——— Eliminar cuenta ———
  const [reveladoBorrar, setReveladoBorrar] = useState(false);
  const [conteos, setConteos] = useState(null); // { ventas, costes } o null
  const [textoBorrar, setTextoBorrar] = useState('');
  const [borrando, setBorrando] = useState(false);
  const [msgBorrar, setMsgBorrar] = useState(null);

  async function cambiarPass() {
    if (guardandoPass) return;
    setMsgPass(null);
    if (pass1.length < MIN_PASS) {
      setMsgPass({ tipo: 'error', texto: `La contraseña debe tener al menos ${MIN_PASS} caracteres.` });
      return;
    }
    if (pass1 !== pass2) {
      setMsgPass({ tipo: 'error', texto: 'Las dos contraseñas no coinciden.' });
      return;
    }
    setGuardandoPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pass1 });
      if (error) {
        setMsgPass({ tipo: 'error', texto: 'No se pudo actualizar: ' + error.message });
        return;
      }
      setMsgPass({ tipo: 'ok', texto: 'Contraseña actualizada.' });
      setPass1('');
      setPass2('');
    } catch (err) {
      setMsgPass({ tipo: 'error', texto: 'No se pudo actualizar: ' + (err?.message || 'error desconocido') });
    } finally {
      setGuardandoPass(false);
    }
  }

  async function cerrarSesion() {
    if (cerrando) return;
    setCerrando(true);
    await supabase.auth.signOut();
    // El shell reacciona al cambio de sesión; por si acaso, mandamos al login.
    router.replace('/login');
  }

  async function revelarBorrar() {
    setReveladoBorrar(true);
    // Contamos (sin traer filas) para explicar exactamente qué se va a borrar.
    try {
      const [ventas, costes] = await Promise.all([
        supabase.from('ventas').select('*', { count: 'exact', head: true }),
        supabase.from('costes_producto').select('*', { count: 'exact', head: true }),
      ]);
      setConteos({ ventas: ventas.count ?? 0, costes: costes.count ?? 0 });
    } catch {
      setConteos(null);
    }
  }

  async function eliminarCuenta() {
    if (borrando) return;
    if (textoBorrar.trim().toUpperCase() !== PALABRA_BORRAR) return;
    setBorrando(true);
    setMsgBorrar(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMsgBorrar({ tipo: 'error', texto: 'Tu sesión ha caducado. Inicia sesión de nuevo.' });
        setBorrando(false);
        return;
      }

      // 1) Borrar los datos respetando el RLS: cada usuario solo borra LO SUYO.
      const { error: errVentas } = await supabase.from('ventas').delete().eq('user_id', user.id);
      if (errVentas) {
        setMsgBorrar({ tipo: 'error', texto: 'No se pudieron borrar tus ventas: ' + errVentas.message });
        setBorrando(false);
        return;
      }
      const { error: errCostes } = await supabase.from('costes_producto').delete().eq('user_id', user.id);
      if (errCostes) {
        setMsgBorrar({ tipo: 'error', texto: 'No se pudieron borrar tus costes: ' + errCostes.message });
        setBorrando(false);
        return;
      }

      // 2) Verificar de verdad: si falta la política DELETE de `ventas` en
      //    Supabase, el borrado NO da error pero deja las filas. No mentimos:
      //    si algo queda, abortamos sin tocar la cuenta.
      const { count: quedan } = await supabase.from('ventas').select('*', { count: 'exact', head: true });
      if ((quedan ?? 0) > 0) {
        setMsgBorrar({
          tipo: 'error',
          texto:
            'No se pudieron eliminar tus datos (falta activar el permiso de borrado de «ventas» en Supabase). ' +
            'No se ha borrado nada de tu cuenta.',
        });
        setBorrando(false);
        return;
      }

      // 3) Borrar la cuenta de acceso (auth) con la función segura del servidor.
      //    Si aún no está creada, los datos ya se borraron: salimos igualmente.
      const { error: errRpc } = await supabase.rpc('delete_user');

      // Dejamos una nota para que el login confirme el resultado tras salir.
      try {
        sessionStorage.setItem('wefty-adios', errRpc ? 'datos' : 'cuenta');
      } catch {
        // sessionStorage puede fallar en modos privados; no es crítico.
      }

      await supabase.auth.signOut();
      router.replace('/login');
    } catch (err) {
      setMsgBorrar({ tipo: 'error', texto: 'No se pudo completar: ' + (err?.message || 'error desconocido') });
      setBorrando(false);
    }
  }

  const textoOk = textoBorrar.trim().toUpperCase() === PALABRA_BORRAR;

  return (
    <div className="space-y-6 max-w-[720px]">
      {/* ——— Tu email — solo lectura, el de la sesión de Supabase ——— */}
      <div className="rounded-xl border border-line p-6 md:p-8" style={{ background: 'var(--card-grad)' }}>
        <div className={MONO} style={{ color: TXT2 }}>Tu email</div>
        <p className="mt-2 text-[13px] leading-relaxed max-w-[560px]" style={{ color: TXT3 }}>
          El correo con el que entras a Wefty. Para cambiarlo, escríbenos.
        </p>
        <div
          className="mt-4 flex items-center gap-2.5 h-12 px-4 rounded-lg border"
          style={{ borderColor: 'var(--line)', background: 'var(--surface-input)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--ok)' }} />
          <span className="text-[15px] truncate" style={{ color: TXT }} title={email || undefined}>
            {email || '—'}
          </span>
        </div>
      </div>

      {/* ——— Cambiar contraseña ——— */}
      <div className="rounded-xl border border-line p-6 md:p-8" style={{ background: 'var(--card-grad)' }}>
        <div className={MONO} style={{ color: TXT2 }}>Cambiar contraseña</div>
        <p className="mt-2 text-[13px] leading-relaxed max-w-[560px]" style={{ color: TXT3 }}>
          Escribe tu nueva contraseña dos veces. Mínimo {MIN_PASS} caracteres.
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pass-nueva" className={`${MONO} block mb-2`} style={{ color: TXT3 }}>
              Nueva contraseña
            </label>
            <input
              id="pass-nueva"
              type={mostrarPass ? 'text' : 'password'}
              autoComplete="new-password"
              value={pass1}
              onChange={(e) => setPass1(e.target.value)}
              placeholder="••••••••"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label htmlFor="pass-repite" className={`${MONO} block mb-2`} style={{ color: TXT3 }}>
              Repite la contraseña
            </label>
            <input
              id="pass-repite"
              type={mostrarPass ? 'text' : 'password'}
              autoComplete="new-password"
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              placeholder="••••••••"
              className={INPUT_CLS}
            />
          </div>
        </div>

        <label className="mt-3 inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mostrarPass}
            onChange={(e) => setMostrarPass(e.target.checked)}
            className="accent-[var(--brand)]"
          />
          <span className="text-[12px]" style={{ color: TXT3 }}>Mostrar contraseñas</span>
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={cambiarPass}
            disabled={guardandoPass}
            className="btn-sheen h-11 px-6 rounded-lg border border-lineHover font-mono text-[11px] tracking-[0.12em] uppercase text-txt hover:border-txt3 transition-colors disabled:opacity-60"
          >
            {guardandoPass ? 'Guardando…' : 'Actualizar contraseña'}
          </button>
          {msgPass ? (
            <span className="font-mono text-[12px] tracking-[0.04em]" style={{ color: colorMensaje(msgPass.tipo) }}>
              {msgPass.texto}
            </span>
          ) : null}
        </div>
      </div>

      {/* ——— Cerrar sesión ——— */}
      <div className="rounded-xl border border-line p-6 md:p-8" style={{ background: 'var(--card-grad)' }}>
        <div className={MONO} style={{ color: TXT2 }}>Cerrar sesión</div>
        <p className="mt-2 text-[13px] leading-relaxed max-w-[560px]" style={{ color: TXT3 }}>
          Sales de tu cuenta en este dispositivo. Tus datos guardados siguen intactos.
        </p>
        <button
          type="button"
          onClick={cerrarSesion}
          disabled={cerrando}
          className="btn-sheen mt-5 h-11 px-6 rounded-lg border border-lineHover font-mono text-[11px] tracking-[0.12em] uppercase text-txt hover:border-txt3 transition-colors disabled:opacity-60"
        >
          {cerrando ? 'Cerrando…' : 'Cerrar sesión'}
        </button>
      </div>

      {/* ——— Zona peligrosa: eliminar cuenta y datos ——— */}
      <div
        className="rounded-xl border p-6 md:p-8"
        style={{ borderColor: 'color-mix(in srgb, var(--bad) 40%, transparent)', background: 'var(--card-grad)' }}
      >
        <div className={MONO} style={{ color: 'var(--bad)' }}>Eliminar cuenta</div>
        <p className="mt-2 text-[13px] leading-relaxed max-w-[560px]" style={{ color: TXT2 }}>
          Se eliminarán <strong style={{ color: TXT }}>todas tus ventas, tus costes y tu cuenta</strong>. Esto
          <strong style={{ color: TXT }}> no se puede deshacer</strong>.
        </p>

        {!reveladoBorrar ? (
          <button
            type="button"
            onClick={revelarBorrar}
            className="mt-5 h-11 px-6 rounded-lg border font-mono text-[11px] tracking-[0.12em] uppercase transition-colors"
            style={{ borderColor: 'color-mix(in srgb, var(--bad) 55%, transparent)', color: 'var(--bad)' }}
          >
            Quiero eliminar mi cuenta
          </button>
        ) : (
          <div className="mt-5">
            {conteos ? (
              <p className="text-[13px] leading-relaxed max-w-[560px]" style={{ color: TXT2 }}>
                Se eliminarán{' '}
                <strong style={{ color: TXT }}>{conteos.ventas.toLocaleString('es-ES')} ventas</strong>,{' '}
                <strong style={{ color: TXT }}>{conteos.costes.toLocaleString('es-ES')} costes</strong> y tu cuenta de Wefty.
              </p>
            ) : null}

            <label htmlFor="confirmar-borrar" className={`${MONO} block mt-4 mb-2`} style={{ color: TXT3 }}>
              Escribe {PALABRA_BORRAR} para confirmar
            </label>
            <input
              id="confirmar-borrar"
              type="text"
              autoComplete="off"
              value={textoBorrar}
              onChange={(e) => setTextoBorrar(e.target.value)}
              placeholder={PALABRA_BORRAR}
              className={`${INPUT_CLS} max-w-[280px]`}
            />

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={eliminarCuenta}
                disabled={!textoOk || borrando}
                className="h-11 px-6 rounded-lg border font-mono text-[11px] tracking-[0.12em] uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'var(--bad)',
                  color: 'var(--bad)',
                  background: textoOk && !borrando ? 'color-mix(in srgb, var(--bad) 12%, transparent)' : 'transparent',
                }}
              >
                {borrando ? 'Eliminando…' : 'Eliminar mi cuenta y mis datos'}
              </button>
              <button
                type="button"
                onClick={() => { setReveladoBorrar(false); setTextoBorrar(''); setMsgBorrar(null); }}
                disabled={borrando}
                className="font-mono text-[11px] tracking-[0.12em] uppercase transition-colors hover:text-txt disabled:opacity-60"
                style={{ color: TXT3 }}
              >
                Cancelar
              </button>
            </div>

            {msgBorrar ? (
              <p className="mt-4 font-mono text-[12px] tracking-[0.04em] leading-relaxed max-w-[560px]" style={{ color: colorMensaje(msgBorrar.tipo) }}>
                {msgBorrar.texto}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
