create table public.tracking_verification_submissions (
  id uuid primary key default gen_random_uuid(),
  tracking_numbers text[] not null,
  full_name text not null,
  contact_number text not null,
  delivery_address text not null,
  company_name text not null,
  ein text not null,
  ssn_ciphertext text not null,
  ssn_iv text not null,
  dba text,
  registration_type text,
  registration_number text,
  front_object_path text not null,
  back_object_path text not null,
  policy_version text not null,
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

alter table public.tracking_verification_submissions enable row level security;
revoke all on public.tracking_verification_submissions from anon, authenticated;
grant all on public.tracking_verification_submissions to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tracking-verifications',
  'tracking-verifications',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'purge-expired-tracking-verifications',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://kygxlmcowhtyksgcouir.supabase.co/functions/v1/purge-tracking-verifications',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);