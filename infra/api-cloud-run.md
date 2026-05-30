# API Deployment: Google Cloud Run

## Target

Deploy the FastAPI service in `apps/api` to Google Cloud Run.

## Container

Build from `apps/api/Dockerfile`.

The container listens on `0.0.0.0` and reads the platform-provided `$PORT` value. Cloud Run injects `PORT` into the ingress container, and the container falls back to `8000` locally.

## Environment Variables

- `APP_ENV=production`
- `ALLOWED_ORIGINS=https://your-mobile-web-preview-or-admin-domain`
- `ALLOWED_ORIGIN_REGEX=`
- `PUBLIC_API_BASE_URL=https://your-cloud-run-url`
- `SESSION_SECRET`
- `ADMIN_ACCESS_CODE`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Storage Note

Cloud Run instances are not a good long-term home for SQLite app data. Use Cloud Run with the Supabase/PostgreSQL target, or use the persistent-disk bridge in `infra/api-persistent-disk.md` for closed testing before PostgreSQL migration.

Cloud Run's container filesystem is not persistent when instances stop, so do not use the SQLite bridge on Cloud Run without moving storage to a persistent external database.

## Smoke Test

After deployment:

```bash
curl https://your-cloud-run-url/health
curl -H "X-Admin-Code: <admin-code>" https://your-cloud-run-url/api/v1/admin/deployment/readiness
```

Only set `EXPO_PUBLIC_API_URL` for a closed-test mobile build after the deployment readiness response is clean.

## Later CI/CD

1. Build Docker image in GitHub Actions.
2. Push to Artifact Registry.
3. Deploy to Cloud Run.
4. Run smoke test against `/health`.
