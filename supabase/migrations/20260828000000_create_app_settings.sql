create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.app_settings enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.app_settings to service_role;

create policy "settings are managed only by service role"
  on public.app_settings
  for all
  to service_role
  using (true)
  with check (true);
