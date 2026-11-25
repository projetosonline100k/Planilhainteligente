-- Agente de viagens no WhatsApp: contatos, conversa, viagens desejadas e envios proativos.

create table if not exists public.whatsapp_contatos (
  id uuid primary key default gen_random_uuid(),
  telefone text not null unique,
  nome text,
  user_id uuid references auth.users(id) on delete set null,
  modo text not null default 'agente' check (modo in ('agente', 'humano')),
  bloqueado boolean not null default false,
  simulado boolean not null default false,
  total_mensagens integer not null default 0,
  ultima_mensagem_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_contatos_ultima_idx
  on public.whatsapp_contatos (ultima_mensagem_em desc nulls last);

create table if not exists public.whatsapp_mensagens (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references public.whatsapp_contatos(id) on delete cascade,
  externo_id text unique,
  direcao text not null check (direcao in ('entrada', 'saida')),
  autor text not null check (autor in ('usuario', 'agente', 'humano', 'sistema')),
  tipo text not null default 'texto',
  texto text not null default '',
  ferramentas jsonb,
  erro text,
  duracao_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_mensagens_contato_idx
  on public.whatsapp_mensagens (contato_id, created_at desc);

create index if not exists whatsapp_mensagens_data_idx
  on public.whatsapp_mensagens (created_at desc);

create table if not exists public.whatsapp_viagens (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references public.whatsapp_contatos(id) on delete cascade,
  destino text not null check (char_length(trim(destino)) > 0),
  origem text,
  data_viagem date,
  custo_estimado numeric,
  valor_guardado numeric not null default 0,
  guardar_por_mes numeric,
  seguir_ofertas boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_viagens_unica
  on public.whatsapp_viagens (contato_id, lower(trim(destino)));

create table if not exists public.whatsapp_envios_ofertas (
  contato_id uuid not null references public.whatsapp_contatos(id) on delete cascade,
  offer_id uuid not null references public.flight_offers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contato_id, offer_id)
);

alter table public.whatsapp_contatos enable row level security;
alter table public.whatsapp_mensagens enable row level security;
alter table public.whatsapp_viagens enable row level security;
alter table public.whatsapp_envios_ofertas enable row level security;

grant select, insert, update, delete on public.whatsapp_contatos to service_role;
grant select, insert, update, delete on public.whatsapp_mensagens to service_role;
grant select, insert, update, delete on public.whatsapp_viagens to service_role;
grant select, insert, update, delete on public.whatsapp_envios_ofertas to service_role;

create or replace function public.whatsapp_registrar_atividade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.whatsapp_contatos
    set total_mensagens = total_mensagens + 1,
        ultima_mensagem_em = new.created_at
    where id = new.contato_id;
  return new;
end;
$$;

revoke execute on function public.whatsapp_registrar_atividade() from public, anon, authenticated;

drop trigger if exists whatsapp_mensagens_atividade on public.whatsapp_mensagens;
create trigger whatsapp_mensagens_atividade
  after insert on public.whatsapp_mensagens
  for each row execute function public.whatsapp_registrar_atividade();
