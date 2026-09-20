alter table public.flight_offers enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.flight_offers to service_role;

drop policy if exists "flight offers are managed only by service role" on public.flight_offers;
create policy "flight offers are managed only by service role" on public.flight_offers for all to service_role using (true) with check (true);
