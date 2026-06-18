'use client';

// Página /login — registro e inicio de sesión con Supabase Auth.
// El usuario escribe email y contraseña, y puede crear cuenta o iniciar sesión.
// Estilo "dark editorial premium" de Loop, igual que /upload.
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Reveal } from '@/components/hooks';
import { CornerCrosshairs } from '@/components/decor';
import { supabase } from '@/lib/supabase';
import TituloDecodificado from '@/components/TituloDecodificado';
import TemaToggle from '@/components/TemaToggle';

const MONO = 'font-mono text-[10px] tracking-[0.18em] uppercase';
const SURFACE_BG = 'var(--card-grad)';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Si la contraseña se muestra en texto (true) o como puntitos (false).
  const [mostrarPassword, setMostrarPassword] = useState(false);
  // Estado del formulario: 'idle' | 'working'
  const [busy, setBusy] = useState(false);
  // Mensaje a mostrar bajo el formulario
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'info' | 'ok' | 'error'
  // Email del usuario con sesión iniciada (si lo hay)
  const [sessionEmail, setSessionEmail] = useState(null);
  const router = useRouter();

  // Comprobamos la sesión al cargar y nos suscribimos a sus cambios.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSessionEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  function showMessage(text, type) {
    setMessage(text);
    setMessageType(type);
  }

  // Crear cuenta nueva (registro).
  async function handleSignUp() {
    if (busy) return;
    if (!email || !password) {
      showMessage('Escribe un email y una contraseña.', 'error');
      return;
    }
    setBusy(true);
    showMessage('', 'info');
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        showMessage('No se pudo crear la cuenta: ' + error.message, 'error');
      } else if (data.session) {
        // Hay sesión directa: el proyecto no exige confirmar el email.
        showMessage('Cuenta creada. Entrando…', 'ok');
        router.replace('/upload');
      } else {
        // Sin sesión: Supabase pide confirmar el email antes de entrar.
        showMessage('Cuenta creada. Revisa tu correo para confirmar el email y luego inicia sesión.', 'ok');
      }
    } catch (err) {
      showMessage('No se pudo crear la cuenta: ' + (err?.message || 'error desconocido'), 'error');
    } finally {
      setBusy(false);
    }
  }

  // Iniciar sesión con una cuenta existente.
  async function handleSignIn() {
    if (busy) return;
    if (!email || !password) {
      showMessage('Escribe un email y una contraseña.', 'error');
      return;
    }
    setBusy(true);
    showMessage('', 'info');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showMessage('No se pudo iniciar sesión: ' + error.message, 'error');
      } else {
        showMessage('Sesión iniciada. Entrando…', 'ok');
        router.replace('/upload');
      }
    } catch (err) {
      showMessage('No se pudo iniciar sesión: ' + (err?.message || 'error desconocido'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    showMessage('Has cerrado la sesión.', 'info');
  }

  const messageColor =
    messageType === 'error' ? 'var(--bad)' : messageType === 'ok' ? 'var(--ok)' : 'var(--txt-2)';

  return (
    <main
      className="relative min-h-screen overflow-hidden text-txt"
      style={{ background: 'var(--bg-grad)' }}
    >
      <div className="absolute inset-0 grid-noise-dark opacity-70 pointer-events-none" />

      <div className="relative max-w-[1440px] mx-auto px-8 md:px-12 pt-16 md:pt-32 pb-24">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <a href="/" className="ul-anim font-display text-[22px] tracking-[-0.02em]" style={{ color: 'var(--txt)' }}>
            Wefty
          </a>
          <div className="flex items-center gap-4">
            <span className={MONO} style={{ color: 'var(--txt-2)' }}>Wefty · acceso</span>
            <TemaToggle variante="icono" />
          </div>
        </div>

        <div className="mt-6 h-px w-full" style={{ background: 'var(--hairline)' }} />

        {/* Section label row */}
        <div className="grid grid-cols-12 gap-6 mt-10 md:mt-20">
          <div className="col-span-12 md:col-span-7 flex items-baseline gap-4">
            <span className="font-mono text-[11px] tracking-[0.18em] tnum" style={{ color: 'var(--txt-3)' }}>00 //</span>
            <span className="font-mono text-[11px] tracking-[0.18em] uppercase" style={{ color: 'var(--txt-2)' }}>
              Acceso — Tu cuenta de Wefty.
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="mt-8 font-display font-bold leading-[1.02] tracking-[-0.03em] text-[12vw] md:text-[84px] lg:text-[100px] max-w-[14ch] [text-wrap:balance]">
          <TituloDecodificado texto="Entra en" acento="tu cuenta." />
        </h1>

        <div className="grid grid-cols-12 gap-6 mt-9 md:mt-16">
          {/* Columna izquierda: descripción / estado de sesión */}
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              {sessionEmail ? (
                <div>
                  <p className="text-[18px] md:text-[20px] leading-[1.45] max-w-[34ch]" style={{ color: 'var(--txt-2)' }}>
                    Tienes la sesión iniciada como{' '}
                    <span style={{ color: 'var(--txt)' }}>{sessionEmail}</span>.
                  </p>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className={`mt-6 ${MONO} transition-colors text-txt2 hover:text-txt py-3 -my-3 px-2 -mx-2`}
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <p className="text-[18px] md:text-[20px] leading-[1.45] max-w-[34ch]" style={{ color: 'var(--txt-2)' }}>
                  Crea una cuenta o inicia sesión con tu email y contraseña para
                  acceder a Wefty.
                </p>
              )}
            </Reveal>
          </div>

          {/* Columna derecha: formulario */}
          <div className="col-span-12 md:col-span-6 md:col-start-7">
            <Reveal delay={150}>
              <div
                className="card-elev relative rounded-xl border border-line p-8 md:p-10"
                style={{ background: SURFACE_BG }}
              >
                <CornerCrosshairs size={12} inset={10} color="var(--txt)" opacity={0.35} />
                <span className={MONO} style={{ color: 'var(--txt-2)' }}>Email y contraseña</span>

                <div className="mt-6 space-y-5">
                  <div>
                    <label htmlFor="email" className={`${MONO} block mb-2`} style={{ color: 'var(--txt-3)' }}>
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="w-full h-12 px-4 rounded-lg bg-surfaceInput border field-bordered text-[16px] md:text-[15px] text-txt placeholder-txt3 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className={`${MONO} block mb-2`} style={{ color: 'var(--txt-3)' }}>
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={mostrarPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-12 pl-4 pr-12 rounded-lg bg-surfaceInput border field-bordered text-[16px] md:text-[15px] text-txt placeholder-txt3 outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarPassword((v) => !v)}
                        aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        aria-pressed={mostrarPassword}
                        title={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        className="absolute right-0 top-0 grid h-12 w-12 place-items-center text-txt3 hover:text-txt transition-colors"
                      >
                        {mostrarPassword ? (
                          // Ojo tachado: la contraseña está visible, pulsa para ocultarla.
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68" />
                            <path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 7 11 7a9.74 9.74 0 0 0 5.39-1.61" />
                            <line x1="2" y1="2" x2="22" y2="22" />
                          </svg>
                        ) : (
                          // Ojo abierto: la contraseña está oculta, pulsa para verla.
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={busy}
                    className="btn-neon select-none"
                  >
                    {busy ? 'Procesando…' : 'Iniciar sesión'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSignUp}
                    disabled={busy}
                    className="btn-neon-borde select-none"
                  >
                    Crear cuenta
                  </button>
                </div>

                {message ? (
                  <p className="mt-6 font-mono text-[12px] tracking-[0.04em] leading-relaxed" style={{ color: messageColor }}>
                    {message}
                  </p>
                ) : null}
              </div>
            </Reveal>
          </div>
        </div>

        <div className="mt-24 md:mt-32">
          <div className="h-px w-full" style={{ background: 'var(--hairline)' }} />
          <p className="mt-6 font-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: 'var(--txt-2)' }}>
            Acceso seguro con Supabase Auth
          </p>
        </div>
      </div>
    </main>
  );
}
