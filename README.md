# StudyNova

StudyNova is a smart academic planning and parent monitoring application for students.

The first production path is an Android mobile app published on Google Play, with a Python API backend and cloud database support for future upgrades.

## Stack

- Mobile: Expo React Native, TypeScript
- Backend: Python, FastAPI
- Database target: Supabase PostgreSQL
- Auth target: Firebase Auth with Google sign-in and login-ID fallback
- Cloud API target: Google Cloud Run
- Builds: Expo EAS Build
- Development workspace: GitHub Codespaces

## Repository Layout

```text
apps/
  api/       FastAPI backend and study planning engine
  mobile/    Expo React Native app
docs/        Product, development, and Play Store notes
infra/       Deployment notes and Docker assets
```

## Local Development

Backend:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r apps/api/requirements-dev.txt
python -m uvicorn app.main:app --reload --app-dir apps/api
```

Mobile:

```bash
npm install
npm --workspace @studynova/mobile run start
```

Set the mobile API URL in `apps/mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=http://localhost:8000
```

For a physical Android phone, use the Codespaces forwarded backend URL or the local network IP instead of `localhost`.

Optional Google sign-in variables for `apps/mobile/.env`:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

Optional Firebase Admin variable for `apps/api/.env`:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON=
```

See `docs/firebase-google-sign-in.md` for the production Firebase/Google sign-in setup checklist.
See `docs/notification-readiness.md` for Android reminder permissions and closed-test notification checks.

## First MVP

- Student dashboard
- Parent dashboard
- Study data input model
- Smart timetable generation API
- Spaced-repetition revision schedule
- Progress summary endpoint
- Play Store launch checklist
