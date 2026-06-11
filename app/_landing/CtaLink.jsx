"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Cliente Supabase del proyecto (lib/supabase.js): la misma instancia que
// usan /login y /upload.
import { supabase } from "@/lib/supabase";

/**
 * CTA con la lógica de sesión existente:
 *   con sesión de Supabase → /upload · sin sesión → /login
 * Renderiza /login por defecto (SSR) y se promociona a /upload
 * en cliente si hay sesión — sin parpadeo y sin bloquear el render.
 */
export default function CtaLink({ className, children }) {
  const [href, setHref] = useState("/login");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (alive && data?.session) setHref("/upload");
      } catch {
        /* sin cliente disponible → se queda en /login */
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
