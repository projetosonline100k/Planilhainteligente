-- Conversa de apresentação: nome -> estado/aeroporto -> destino. O estado da etapa é derivado destes campos.

alter table public.whatsapp_contatos
  add column if not exists estado text,
  add column if not exists aeroporto_origem text,
  add column if not exists destino_perguntado boolean not null default false;
