create extension if not exists pgcrypto;

create table if not exists public.alertas_preco (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origin text not null check (origin ~ '^[A-Z]{3}$'),
  destination text not null check (destination ~ '^[A-Z]{3}$'),
  outbound_date date not null,
  return_date date,
  adults integer not null default 1 check (adults between 1 and 9),
  preco_alvo numeric(12,2) not null check (preco_alvo > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin <> destination),
  check (return_date is null or return_date >= outbound_date)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  link text,
  alerta_id uuid,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
create index if not exists alertas_preco_ativos_idx on public.alertas_preco(ativo, user_id);
create index if not exists notificacoes_user_data_idx on public.notificacoes(user_id, created_at desc);
create index if not exists notificacoes_alerta_idx on public.notificacoes(alerta_id, created_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.alertas_preco enable row level security;
alter table public.notificacoes enable row level security;

grant select, insert, update, delete on public.alertas_preco to authenticated, service_role;
grant select, insert, update, delete on public.push_subscriptions to authenticated, service_role;
grant select, update on public.notificacoes to authenticated;
grant select, insert, update, delete on public.notificacoes to service_role;

drop policy if exists "Usuarios gerenciam suas inscricoes push" on public.push_subscriptions;
create policy "Usuarios gerenciam suas inscricoes push" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Usuarios gerenciam seus alertas de preco" on public.alertas_preco;
create policy "Usuarios gerenciam seus alertas de preco" on public.alertas_preco for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Usuarios leem suas notificacoes" on public.notificacoes;
create policy "Usuarios leem suas notificacoes" on public.notificacoes for select using (auth.uid() = user_id);
drop policy if exists "Usuarios atualizam suas notificacoes" on public.notificacoes;
create policy "Usuarios atualizam suas notificacoes" on public.notificacoes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
