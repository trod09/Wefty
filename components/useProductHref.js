'use client';

// ¿A dónde debe llevar el botón de "entrar al producto"?
//   · con sesión iniciada  → /upload (directo a usar Wefty)
//   · sin sesión           → /login
// Empieza apuntando a /login (lo seguro) y, en cuanto Supabase nos confirma si
// hay sesión, se actualiza. Se suscribe a los cambios (login/logout) para no
// quedarse desactualizado, igual que hace SessionBadge.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useProductHref() {
  const [href, setHref] = useState('/login');

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHref(data.session ? '/upload' : '/login');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHref(session ? '/upload' : '/login');
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return href;
}
