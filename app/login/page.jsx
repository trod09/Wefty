'use client';

// Página /login — registro e inicio de sesión con Supabase Auth.
// El usuario escribe email y contraseña, y puede crear cuenta o iniciar sesión.
// Estilo "dark editorial premium" de Loop, igual que /upload.
import React, { useEffect, useState } from 'react';
import { Reveal } from '@/components/hooks';
import { Hairline, UnderlineLink } from '@/components/primitives';
import { CornerCrosshairs } from '@/components/decor';
import { supabase } from '@/lib/supabase';

const MONO = 'font-mono text-[10px] tracking-[0.18em] uppercase';
const SURFACE_BG = 'linear-gradient(150deg, #16171b 0%, #121316 100%)';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Estado del formulario: 'idle' | 'working'
  const [busy, setBusy] = useState(false);
  // Mensaje a mostrar bajo el formulario
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'info' | 'ok' | 'error'
  // Email del usuario con sesión iniciada (si lo hay)
  const [sessionEmail, setSessionEmail] = useState(null);

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
        showMessage('Cuenta creada. Ya tienes la sesión iniciada.', 'ok');
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
        showMessage('Sesión iniciada.', 'ok');
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
    messageType === 'error' ? '#E07A5F' : messageType === 'ok' ? '#6BCB9A' : '#8A8A8F';

  return (
    <main
      className="relative min-h-screen overflow-hidden text-[#F5F5F7]"
      style={{ background: 'radial-gradient(135% 90% at 50% 0%, #0F1014 0%, #0A0A0B 55%)' }}
    >
      <div className="absolute inset-0 grid-noise-dark opacity-70 pointer-events-none" />

      <div className="relative max-w-[1440px] mx-auto px-8 md:px-12 pt-24 md:pt-32 pb-24">
        {/* Top bar */}
        <div className="flex items-baseline justify-between">
          <UnderlineLink href="/" dark className="font-serif text-[22px] tracking-[-0.02em]">
            Weft
          </UnderlineLink>
          <span className={MONO} style={{ color: '#8A8A8F' }}>Loop · acceso</span>
        </div>

        <Hairline dark className="mt-6" />

        {/* Section label row */}
        <div className="grid grid-cols-12 gap-6 mt-16 md:mt-20">
          <div className="col-span-12 md:col-span-7 flex items-baseline gap-4">
            <span className="font-mono text-[11px] tracking-[0.18em] tnum" style={{ color: '#5d5e63' }}>[00]</span>
            <span className="font-mono text-[11px] tracking-[0.18em] uppercase" style={{ color: '#8A8A8F' }}>
              Acceso — Tu cuenta de Loop.
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="mt-8 font-serif font-light leading-[0.94] tracking-[-0.035em] text-[12vw] md:text-[84px] lg:text-[100px] max-w-[14ch]">
          Entra en tu cuenta.
        </h1>

        <div className="grid grid-cols-12 gap-6 mt-12 md:mt-16">
          {/* Columna izquierda: descripción / estado de sesión */}
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              {sessionEmail ? (
                <div>
                  <p className="text-[18px] md:text-[20px] leading-[1.45] max-w-[34ch]" style={{ color: '#8A8A8F' }}>
                    Tienes la sesión iniciada como{' '}
                    <span className="text-[#F5F5F7]">{sessionEmail}</span>.
                  </p>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className={`mt-6 ${MONO} transition-colors text-[#8A8A8F] hover:text-[#F5F5F7]`}
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <p className="text-[18px] md:text-[20px] leading-[1.45] max-w-[34ch]" style={{ color: '#8A8A8F' }}>
                  Crea una cuenta o inicia sesión con tu email y contraseña para
                  acceder a Loop.
                </p>
              )}
            </Reveal>
          </div>

          {/* Columna derecha: formulario */}
          <div className="col-span-12 md:col-span-6 md:col-start-7">
            <Reveal delay={150}>
              <div
                className="relative rounded-xl border border-[#232428] p-8 md:p-10"
                style={{ background: SURFACE_BG }}
              >
                <CornerCrosshairs size={12} inset={10} color="#F5F5F7" opacity={0.35} />
                <span className={MONO} style={{ color: '#8A8A8F' }}>Email y contraseña</span>

                <div className="mt-6 space-y-5">
                  <div>
                    <label htmlFor="email" className={`${MONO} block mb-2`} style={{ color: '#6f7075' }}>
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="w-full h-12 px-4 rounded-lg bg-[#0E0F12] border border-[#232428] text-[15px] text-[#F5F5F7] placeholder-[#5d5e63] outline-none transition-colors focus:border-[#3F7BEC]"
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className={`${MONO} block mb-2`} style={{ color: '#6f7075' }}>
                      Contraseña
                    </label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-12 px-4 rounded-lg bg-[#0E0F12] border border-[#232428] text-[15px] text-[#F5F5F7] placeholder-[#5d5e63] outline-none transition-colors focus:border-[#3F7BEC]"
                    />
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={busy}
                    className="relative inline-flex items-center justify-center px-7 h-12 font-medium text-[14px] tracking-[-0.005em] text-white rounded-lg cursor-pointer select-none transition-all duration-300 hover:brightness-110 disabled:opacity-60 disabled:cursor-default"
                    style={{
                      background: 'linear-gradient(135deg, #3F7BEC 0%, #2D6BE4 100%)',
                      boxShadow: '0 0 40px -12px rgba(45,107,228,0.85)',
                    }}
                  >
                    {busy ? 'Procesando…' : 'Iniciar sesión'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSignUp}
                    disabled={busy}
                    className="relative inline-flex items-center justify-center px-7 h-12 font-medium text-[14px] tracking-[-0.005em] rounded-lg cursor-pointer select-none transition-all duration-300 border border-[#3a3c42] text-[#F5F5F7] hover:border-[#5d5e63] disabled:opacity-60 disabled:cursor-default"
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
          <Hairline dark />
          <p className="mt-6 font-mono text-[10px] tracking-[0.18em] uppercase" style={{ color: '#8A8A8F' }}>
            Loop · acceso seguro con Supabase Auth
          </p>
        </div>
      </div>
    </main>
  );
}
