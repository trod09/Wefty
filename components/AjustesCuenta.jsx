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

export default function AjustesCuenta({ email }) {
  const router = useRouter();
  const [cerrando, setCerrando] = useState(false);

  async function cerrarSesion() {
    if (cerrando) return;
    setCerrando(true);
    await supabase.auth.signOut();
    // El shell ya reacciona al cambio de sesión; por si acaso, mandamos al login.
    router.replace('/login');
  }

  return (
    <div className="space-y-6 max-w-[720px]">
      {/* Tu email — solo lectura, el de la sesión de Supabase */}
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

      {/* Cerrar sesión */}
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
    </div>
  );
}
