-- Fila para o worker do Claude (assinatura) e registro de qual cérebro respondeu.

alter table public.whatsapp_mensagens
  add column if not exists pendente boolean not null default false,
  add column if not exists processando_em timestamptz,
  add column if not exists cerebro text;

create index if not exists whatsapp_mensagens_pendentes_idx
  on public.whatsapp_mensagens (created_at)
  where pendente;
