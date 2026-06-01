# Render Closed-Test Backend Deployment

This is the fastest hosted backend path for StudyNova closed testing. It uses the root `render.yaml` blueprint, a Docker web service, and a persistent disk for the current SQLite database.

Official Render references:

- https://render.com/docs/blueprint-spec
- https://render.com/docs/disks
- https://render.com/docs/health-checks

## 1. Create The Web Service

1. Push the latest `main` branch to GitHub.
2. Open Render and create a new Blueprint from the StudyNova GitHub repo.
3. Confirm Render detects the root `render.yaml`.
4. Confirm the service name is `studynova-api`.
5. Confirm the disk is mounted at `/var/data/studynova`.
6. Confirm the health check path is `/health`.

The first deploy can take a few minutes because Render builds the Docker image.

## 2. Set Backend Environment Variables

Use these values in Render:

```text
APP_ENV=production
LOCAL_DATA_PATH=/var/data/studynova/studynova.sqlite3
BACKUP_DATA_PATH=/var/data/studynova/backups
SESSION_TTL_HOURS=168
PUBLIC_API_BASE_URL=https://your-render-service.onrender.com
ALLOWED_ORIGINS=
ALLOWED_ORIGIN_REGEX=
SESSION_SECRET=<32+ character private random value>
ADMIN_ACCESS_CODE=<8+ character private admin code>
FIREBASE_SERVICE_ACCOUNT_JSON=<Firebase Admin JSON if Google sign-in is enabled>
```

Keep `SESSION_SECRET`, `ADMIN_ACCESS_CODE`, and `FIREBASE_SERVICE_ACCOUNT_JSON` private.

## 3. Smoke Test The Hosted API

From the repository root:

```powershell
npm run api:smoke -- https://your-render-service.onrender.com <admin-code>
```

To also write the local mobile env file:

```powershell
npm run closed-test:api-env -- https://your-render-service.onrender.com <admin-code>
```

This writes:

```text
apps/mobile/.env.local
```

That file is intentionally ignored by Git and is loaded by Expo for local testing. EAS cloud builds still need the EAS environment variable in the next step.

## 4. Set The EAS Build Environment

For the cloud Android build, create the same public API URL on EAS:

```powershell
cd apps/mobile
npx eas-cli@latest env:create production --name EXPO_PUBLIC_API_URL --value https://your-render-service.onrender.com --visibility plaintext --force
```

Expo documents that `EXPO_PUBLIC_` variables are substituted into the app bundle for EAS builds when they are set in the selected EAS environment.

Official Expo references:

- https://docs.expo.dev/eas/environment-variables/
- https://docs.expo.dev/eas/environment-variables/manage/

## 5. Build The Closed-Test App

From `apps/mobile`:

```powershell
npm run release:check
npx eas-cli@latest build --platform android --profile closed-test
```

After install, test on a real phone:

1. Create a student account.
2. Generate and save a plan.
3. Create a parent account.
4. Link the student from the parent account.
5. Mark one session done from the student account.
6. Confirm the parent account sees the updated progress.
7. Turn on reminders and send a test notification.
