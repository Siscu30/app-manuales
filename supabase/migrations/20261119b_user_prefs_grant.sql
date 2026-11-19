-- Aplicada 2026-11-19: faltaba el permiso de tabla; las políticas RLS por usuario siguen limitando a la fila propia.
grant select, insert, update on public.user_prefs to authenticated;
