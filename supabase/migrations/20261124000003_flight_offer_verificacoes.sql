-- Conferência do preço de hoje e do voo mais barato de cada oferta, antes de enviar pelo agente (evita gastar cota repetindo a busca).

create table if not exists public.flight_offer_verificacoes (
  offer_id uuid primary key references public.flight_offers(id) on delete cascade,
  preco_real numeric,
  link_voo text,
  voo text,
  verificada_em timestamptz not null default now()
);

alter table public.flight_offer_verificacoes enable row level security;

grant select, insert, update, delete on public.flight_offer_verificacoes to service_role;
