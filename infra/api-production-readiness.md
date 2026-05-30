# API Production Readiness

This is the preflight checklist before pointing a Play Store build at a stable StudyNova API.

## Recommended Path For Closed Testing

Use the persistent-disk bridge in `infra/api-persistent-disk.md` for the first Play Store internal or closed test. It keeps the current SQLite backend but moves the database and backups onto a persistent disk.

Use Cloud Run after the PostgreSQL/Supabase migration, or only with an external database. Cloud Run's container contract says services receive a `PORT` environment variable and should listen on `0.0.0.0`, and its filesystem is not a durable database location.

Official Cloud Run references:

- https://docs.cloud.google.com/run/docs/container-contract
- https://docs.cloud.google.com/run/docs/deploying

## Required Deployment Checks

The backend now exposes an admin-only readiness endpoint:

```bash
curl -H "X-Admin-Code: <admin-code>" https://your-api-host/api/v1/admin/deployment/readiness
```

The endpoint verifies:

- `APP_ENV=production`
- `PUBLIC_API_BASE_URL` is a stable HTTPS host
- SQLite data and backup paths are absolute persistent paths
- Database schema has been initialized
- `SESSION_SECRET` is non-default and at least 32 characters
- `ADMIN_ACCESS_CODE` is non-default and at least 8 characters
- CORS no longer exposes localhost, Codespaces, or wildcard development access
- Firebase server-side token verification is configured, or clearly flagged

The same status is visible in the mobile `/support` admin screen.

## Closed-Test Environment

Set these backend variables on the host:

```text
APP_ENV=production
PUBLIC_API_BASE_URL=https://your-api-host
LOCAL_DATA_PATH=/persistent/studynova/studynova.sqlite3
BACKUP_DATA_PATH=/persistent/studynova/backups
SESSION_SECRET=<32+ character private random value>
ADMIN_ACCESS_CODE=<8+ character private admin code>
SESSION_TTL_HOURS=168
ALLOWED_ORIGINS=
ALLOWED_ORIGIN_REGEX=
FIREBASE_SERVICE_ACCOUNT_JSON=<Firebase Admin JSON if Google sign-in is enabled>
```

Then set the mobile build variable:

```text
EXPO_PUBLIC_API_URL=https://your-api-host
```

The mobile API URL must match the backend `PUBLIC_API_BASE_URL`.

## Smoke Test Before EAS Build

1. Open `https://your-api-host/health`.
2. Confirm the environment is `production`.
3. Run the deployment readiness endpoint.
4. Open the StudyNova support screen.
5. Confirm Deployment, Persistence, and Google sign-in status.
6. Create one database backup.
7. Generate a student plan from a real phone build.
8. Link a parent account and confirm progress loads.
