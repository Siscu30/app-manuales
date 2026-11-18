-- Estado real a 2026-11-18: SIN CAMBIOS en la base de datos.
-- public.user_prefs ya existía (user_id uuid PK, prefs jsonb default '{}', updated_at timestamptz)
-- con las políticas "own prefs select/insert/update" (auth.uid() = user_id).
-- app-v2 guarda su tema en prefs.tema = { estilo, modo } y fusiona el resto de claves;
-- app.js conserva prefs.tema al guardar sus propias preferencias.
-- (Se crearon y después se borraron 3 políticas duplicadas; verificado en pg_policies.)
select 1;
