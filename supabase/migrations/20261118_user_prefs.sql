-- Preferencias visuales por usuario (estilo y modo del espacio de trabajo).
-- Solo añade una tabla nueva: no modifica ni borra datos existentes.
create table if not exists public.user_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  estilo     text not null default 'obra' check (estilo in ('obra','atlas','cuaderno')),
  modo       text not null default 'auto' check (modo in ('light','dark','auto')),
  updated_at timestamptz not null default now()
);

alter table public.user_prefs enable row level security;

-- Cada usuario solo ve y edita su propia fila.
create policy "user_prefs select own" on public.user_prefs
  for select to authenticated using (user_id = auth.uid());
create policy "user_prefs insert own" on public.user_prefs
  for insert to authenticated with check (user_id = auth.uid());
create policy "user_prefs update own" on public.user_prefs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
