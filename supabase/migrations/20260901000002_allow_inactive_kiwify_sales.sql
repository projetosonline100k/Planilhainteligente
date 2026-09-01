alter table public.kiwify_sales
  drop constraint if exists kiwify_sales_access_status_check;

alter table public.kiwify_sales
  add constraint kiwify_sales_access_status_check
  check (access_status in ('active', 'blocked', 'inactive'));
