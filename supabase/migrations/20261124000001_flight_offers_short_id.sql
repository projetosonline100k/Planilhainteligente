-- Código curto (10 caracteres) para links /r/{short_id} que abrem direto a passagem.

alter table public.flight_offers
  add column if not exists short_id text generated always as (left(replace(id::text, '-', ''), 10)) stored;

create index if not exists flight_offers_short_id_idx on public.flight_offers (short_id);
