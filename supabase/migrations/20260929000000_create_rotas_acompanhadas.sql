create table if not exists public.rotas_acompanhadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origin_code text,
  origin_name text not null check (char_length(trim(origin_name)) > 0),
  destination_code text,
  destination_name text not null check (char_length(trim(destination_name)) > 0),
  created_at timestamptz not null default now(),
  check (lower(trim(origin_name)) <> lower(trim(destination_name)))
);

-- Evita cadastrar a mesma rota duas vezes para o mesmo usuario.
create unique index if not exists rotas_acompanhadas_unica
  on public.rotas_acompanhadas (user_id, lower(origin_name), lower(destination_name));

create index if not exists rotas_acompanhadas_user_idx
  on public.rotas_acompanhadas (user_id, created_at desc);

alter table public.rotas_acompanhadas enable row level security;

grant select, insert, update, delete on public.rotas_acompanhadas to authenticated, service_role;

drop policy if exists "Usuarios gerenciam suas rotas acompanhadas" on public.rotas_acompanhadas;
create policy "Usuarios gerenciam suas rotas acompanhadas" on public.rotas_acompanhadas
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
