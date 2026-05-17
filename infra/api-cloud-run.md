# API Deployment: Google Cloud Run

## Target

Deploy the FastAPI service in `apps/api` to Google Cloud Run.

## Container

Build from `apps/api/Dockerfile`.

## Environment Variables

- `APP_ENV=production`
- `ALLOWED_ORIGINS=https://your-mobile-web-preview-or-admin-domain`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Later CI/CD

1. Build Docker image in GitHub Actions.
2. Push to Artifact Registry.
3. Deploy to Cloud Run.
4. Run smoke test against `/health`.

