'use client';

// Insignia de sesión — esquina superior derecha.
// Si hay sesión iniciada, muestra el email del usuario y un botón para cerrar
// sesión. Si no, muestra un enlace para ir a /login. Escucha los cambios de
// sesión de Supabase Auth para actualizarse solo.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const MONO = 'font-mono text-[10px] tracking-[0.18em] uppercase';

export default function SessionBadge() {
  const [email, setEmail] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Estado inicial: ¿hay sesión guardada?
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user?.email ?? null);
      setReady(true);
    });

    // Nos suscribimos a los cambios (login / logout) para refrescar la insignia.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Mientras comprobamos la sesión, no mostramos nada (evita parpadeos).
  if (!ready) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-[#232428] px-4 py-2.5"
      style={{ background: 'linear-gradient(150deg, #16171b 0%, #121316 100%)' }}
    >
      {email ? (
        <>
          <span className={MONO} style={{ color: '#6BCB9A' }}>●</span>
          <span className="text-[13px] text-[#F5F5F7] max-w-[200px] truncate">{email}</span>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className={`${MONO} transition-colors`}
            style={{ color: '#8A8A8F' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#F5F5F7')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#8A8A8F')}
          >
            Cerrar sesión
          </button>
        </>
      ) : (
        <a href="/login" className={`${MONO} text-[#8A8A8F] hover:text-[#F5F5F7] transition-colors`}>
          Iniciar sesión
        </a>
      )}
    </div>
  );
}
