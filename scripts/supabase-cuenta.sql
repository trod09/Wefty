-- ============================================================================
-- Wefty · SQL para «Ajustes de cuenta» (eliminar cuenta y datos)
-- Ejecutar UNA vez en Supabase → SQL Editor. No expone ninguna clave.
-- ============================================================================

-- 1) PERMISO DE BORRADO DE «ventas» (RLS)
--    Sin esto, un usuario NO puede borrar sus propias ventas: el borrado no da
--    error, pero deja las filas. La app lo detecta y aborta sin tocar la cuenta.
--    Con esto, cada usuario borra SOLO lo suyo (auth.uid() = user_id).
alter table public.ventas enable row level security;

drop policy if exists "ventas_delete_own" on public.ventas;
create policy "ventas_delete_own"
  on public.ventas
  for delete
  to authenticated
  using (auth.uid() = user_id);


-- 2) FUNCIÓN PARA BORRAR LA CUENTA DE ACCESO (auth.users)
--    El cliente NO puede borrar auth.users (haría falta la service_role key,
--    que jamás va en el navegador). Esta función corre en el servidor con
--    privilegios (security definer) y SOLO borra al usuario que la llama
--    (auth.uid()); nunca puede tocar a otros. La app la invoca con
--    supabase.rpc('delete_user').
create or replace function public.delete_user()
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- Red de seguridad: borra también los datos por si quedara algo.
  delete from public.costes_producto where user_id = auth.uid();
  delete from public.ventas where user_id = auth.uid();
  -- Y por último la propia cuenta de acceso.
  delete from auth.users where id = auth.uid();
end;
$$;

-- Que solo puedan ejecutarla usuarios con sesión (no anónimos).
revoke all on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;
