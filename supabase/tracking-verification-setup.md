# Tracking Verification Setup

The verification function encrypts SSNs with AES-256-GCM. Configure a private 32-byte key before accepting submissions, and keep it outside source control:

```sh
supabase secrets set TRACKING_VERIFICATION_ENCRYPTION_KEY="$(openssl rand -base64 32)" --project-ref kygxlmcowhtyksgcouir
```

Apply the migration and deploy both functions:

```sh
supabase db push --project-ref kygxlmcowhtyksgcouir
supabase functions deploy  --project-ref kygxlmcowhtyksgcouir
supabase functions deploy purge-tracking-verifications --project-ref kygxlmcowhtyksgcouir
```

The migration creates a private storage bucket and schedules cleanup every minute. The cleanup function removes expired files first, then deletes their backend records. Submissions expire 14 days after creation. Add any production or preview site origins to `TRACKING_VERIFICATION_ALLOWED_ORIGINS` as a comma-separated Supabase Function secret; the defaults allow `https://dtdc.live` and `https://www.dtdc.live`, plus localhost for development.
