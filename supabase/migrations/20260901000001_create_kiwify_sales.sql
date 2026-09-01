create table if not exists public.kiwify_sales (
  order_id text primary key,
  customer_email text not null,
  customer_name text,
  product_id text,
  product_name text not null,
  event_type text not null,
  order_status text not null,
  access_status text not null check (access_status in ('active', 'blocked')),
  amount_cents integer,
  currency text not null default 'BRL',
  auth_user_id uuid references auth.users(id) on delete set null,
  purchased_at timestamptz,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.kiwify_webhook_events (
  id bigint generated always as identity primary key,
  order_id text not null,
  event_type text not null,
  received_at timestamptz not null default timezone('utc'::text, now()),
  unique (order_id, event_type)
);

alter table public.kiwify_sales enable row level security;
alter table public.kiwify_webhook_events enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.kiwify_sales, public.kiwify_webhook_events to service_role;

create policy "sales are managed only by service role" on public.kiwify_sales for all to service_role using (true) with check (true);
create policy "webhook events are managed only by service role" on public.kiwify_webhook_events for all to service_role using (true) with check (true);
