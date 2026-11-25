-- Nome e cidade de origem que a própria pessoa informa ao agente (diferente do nome do perfil do WhatsApp).

alter table public.whatsapp_contatos
  add column if not exists nome_preferido text,
  add column if not exists cidade_origem text;
