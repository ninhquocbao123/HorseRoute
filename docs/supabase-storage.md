# Shared private documents on Supabase

Keep MySQL on Aiven. Supabase is used only for file storage; existing JWT authentication and document authorization remain in the API. No frontend Supabase key is needed.

## Setup

1. Create a Supabase project on the Free plan.
2. Create a **private** bucket named `wdp-documents`. Set max file size to 5 MB and allowed MIME types to `application/pdf`, `image/png`, `image/jpeg`. Do not enable Public.
3. Copy the Project URL and a backend secret API key from project settings. A legacy service_role key also works. Do not use a publishable/anon key.
4. Add the following to the root `.env` used by the API (never `apps/web/.env`):

```dotenv
DOCUMENT_STORAGE_PROVIDER=supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_BACKEND_SECRET_KEY
SUPABASE_STORAGE_BUCKET=wdp-documents
```

Restart the API. Every team backend must use the same project/bucket and the shared Aiven DB. Share credentials privately; never commit them or put them in VITE_* variables. The existing production Compose file passes `.env` with `env_file`, but overrides `DB_HOST` to its local MySQL service. This guide assumes the API runs locally with Aiven; adjust the Compose database configuration and mount the CA certificate before running that API container against Aiven.

## Behavior

- The existing Flow 2 frontend upload/download endpoints work unchanged. PDF/JPG/PNG signature checks and 5 MiB limit remain enforced.
- The API verifies that the bucket is private before uploads. Do not change its visibility afterward.
- `attachments.storage_path` records `supabase:bucket/uuid`, not a public URL. Downloads pass through the existing authorized API; admin credentials are never sent to the browser.
- Existing UUID-only references still read from `DOCUMENT_STORAGE_DIR` (default `var/private-documents` relative to backend cwd). They are **not automatically migrated**, and remain available only on the machine that holds those files. Excel paths/URLs remain unsupported.
- Setting `DOCUMENT_STORAGE_PROVIDER=local` changes the destination for new uploads only. Existing Supabase references still need Supabase credentials.
- DB rollback triggers best-effort file deletion. A network failure or process crash can leave an orphan; a warning records its key when cleanup fails. No automatic deletion of existing attachments.
- Storage failures return a generic 503 without provider response details or credentials. Missing local files return 404.
- No database migration or change of auth provider is required for this integration.

## Verification

Run `node apps/api/test/storage.test.cjs` and build the API. Tests use mocked Storage HTTP responses and temporary local files; they do not upload to a real project.

For a live check, upload a small PDF or image on an authorized Customer order. Check the object in the private bucket, download through the app, and repeat from another team machine. A different Customer must not access that order's download endpoint. Live checks need actual Supabase configuration and have not been performed by the agent.

Free storage is limited (currently 1 GB); projects may pause after a week of inactivity. Check https://supabase.com/pricing for current limits. No paid plan or external resource is created by these code changes.
