alter table public.shipments
  add column if not exists needs_reverification boolean not null default true;
