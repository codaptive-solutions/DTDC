create table if not exists public.merchant_enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  business_email text not null,
  company_name text not null,
  tax_id text,
  volume text,
  trade_type text,
  details text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.merchant_enquiries enable row level security;
