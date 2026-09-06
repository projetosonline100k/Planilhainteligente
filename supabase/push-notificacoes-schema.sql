create extension if not exists pgcrypto;

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
create index if not exists notificacoes_user_data_idx on public.notificacoes(user_id, created_at desc);
create index if not exists notificacoes_alerta_idx on public.notificacoes(alerta_id, created_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.notificacoes enable row level security;

drop policy if exists "Usuarios gerenciam suas inscricoes push" on public.push_subscriptions;
create policy "Usuarios gerenciam suas inscricoes push" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Usuarios leem suas notificacoes" on public.notificacoes;
create policy "Usuarios leem suas notificacoes" on public.notificacoes for select using (auth.uid() = user_id);
drop policy if exists "Usuarios atualizam suas notificacoes" on public.notificacoes;
create policy "Usuarios atualizam suas notificacoes" on public.notificacoes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
