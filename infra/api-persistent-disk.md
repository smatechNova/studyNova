# API Deployment: Persistent Disk Bridge

This is the practical deployment bridge before the final Supabase/PostgreSQL migration. It runs the FastAPI backend in Docker and stores the SQLite database on a persistent disk.

Use this for internal testing and closed testing. For large public rollout, migrate to the Supabase/PostgreSQL target in `infra/supabase`.

## What This Solves

- Gives the mobile app a real API URL instead of `localhost`, Codespaces, or Expo tunnel.
- Keeps student accounts, parent links, generated plans, progress, reminders, and recovery requests after deploy restarts.
- Enables admin storage health checks and manual SQLite backups from the `/support` screen.

## Required Environment Variables

Set these on the hosting provider:

```text
APP_ENV=production
LOCAL_DATA_PATH=/var/data/studynova/studynova.sqlite3
BACKUP_DATA_PATH=/var/data/studynova/backups
SESSION_SECRET=<long random secret>
ADMIN_ACCESS_CODE=<private admin code>
SESSION_TTL_HOURS=168
ALLOWED_ORIGINS=<production mobile web/admin origin if used>
ALLOWED_ORIGIN_REGEX=
FIREBASE_SERVICE_ACCOUNT_JSON=<optional Firebase Admin JSON>
```

Never use `studynova-admin-dev` as the production admin code.

## Render-Style Deployment

The root `render.yaml` is a ready blueprint for a Docker web service with a persistent disk mounted at:

```text
/var/data/studynova
```

After deployment:

1. Open `https://your-api-host/health`.
2. Confirm the response is `{"status":"ok","environment":"production"}`.
3. Set `EXPO_PUBLIC_API_URL` in the mobile app build environment to the API host.
4. Open `/support` in the app, enter the admin code, and load the admin view.
5. Confirm storage health shows a production-ready database path.
6. Create a database backup from the support screen.

## Docker Build

Build from the API directory:

```bash
cd apps/api
docker build -t studynova-api .
docker run --rm -p 8000:8000 \
  -e APP_ENV=production \
  -e LOCAL_DATA_PATH=/var/data/studynova/studynova.sqlite3 \
  -e BACKUP_DATA_PATH=/var/data/studynova/backups \
  -e SESSION_SECRET=replace-me \
  -e ADMIN_ACCESS_CODE=replace-me \
  -v studynova-data:/var/data/studynova \
  studynova-api
```

The container listens on `$PORT` when the platform provides it, otherwise it uses `8000`.

## Backup Notes

The admin backup endpoint creates a consistent SQLite backup using the SQLite backup API. Backup files are stored under `BACKUP_DATA_PATH`.

Download or copy these backups from the hosting provider regularly during testing. Do not rely on one disk copy as the only recovery plan for production.
