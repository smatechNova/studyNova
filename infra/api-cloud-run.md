# API Deployment: Google Cloud Run

## Target

Deploy the FastAPI service in `apps/api` to Google Cloud Run.

## Container

Build from `apps/api/Dockerfile`.

The container reads the platform-provided `$PORT` value and falls back to `8000` locally.

## Environment Variables

- `APP_ENV=production`
- `ALLOWED_ORIGINS=https://your-mobile-web-preview-or-admin-domain`
- `SESSION_SECRET`
- `ADMIN_ACCESS_CODE`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Storage Note

Cloud Run instances are not a good long-term home for SQLite app data. Use Cloud Run with the Supabase/PostgreSQL target, or use the persistent-disk bridge in `infra/api-persistent-disk.md` for closed testing before PostgreSQL migration.

## Later CI/CD

1. Build Docker image in GitHub Actions.
2. Push to Artifact Registry.
3. Deploy to Cloud Run.
4. Run smoke test against `/health`.
