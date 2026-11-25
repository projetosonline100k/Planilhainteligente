-- Mensagens que o servidor não consegue enviar sozinho (WAHA roda no Mac/VPS) ficam na fila do worker.

alter table public.whatsapp_mensagens
  add column if not exists aguardando_envio boolean not null default false;

create index if not exists whatsapp_mensagens_envio_idx
  on public.whatsapp_mensagens (created_at)
  where aguardando_envio;
