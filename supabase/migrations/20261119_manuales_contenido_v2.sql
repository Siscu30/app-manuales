-- Columna para el contenido del editor nuevo (app-v2, formato BlockNote).
-- Solo aditiva: nullable, sin valor por defecto, no toca ninguna fila existente.
-- RLS de `manuales` no cambia: las políticas son por fila y cubren la columna nueva.
alter table public.manuales add column if not exists contenido_v2 jsonb;

comment on column public.manuales.contenido_v2 is
  'Contenido en formato del editor nuevo (app-v2). NULL = el manual solo existe en el formato antiguo (contenido).';
