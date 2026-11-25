-- Busca de passagens ao vivo feita pelo agente: guarda o resultado por algumas horas e os links curtos dos voos achados.

create table if not exists public.busca_passagens_cache (
  chave text primary key,
  resultado jsonb not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.links_voo (
  codigo text primary key,
  url text not null,
  criado_em timestamptz not null default now()
);

alter table public.busca_passagens_cache enable row level security;
alter table public.links_voo enable row level security;

grant select, insert, update, delete on public.busca_passagens_cache to service_role;
grant select, insert, update, delete on public.links_voo to service_role;
