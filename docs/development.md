# Development Guide

## Recommended Environment

Use GitHub Codespaces for day-to-day work. The project does not require Android Studio locally because Expo Go handles live testing and EAS Build handles cloud builds.

## Codespaces Setup

1. Push this repository to GitHub.
2. Open the repository in GitHub Codespaces.
3. Wait for `.devcontainer/post-create.sh` to install Python and Node dependencies.
4. Start the API:

```bash
npm run api
```

5. Start Expo:

```bash
npm run mobile
```

6. Open the Expo QR code with Expo Go on an Android phone.

## Mobile API URL

When testing on a phone, `localhost` points to the phone, not the Codespace.

Set `apps/mobile/.env` to the forwarded Codespaces API URL:

```bash
EXPO_PUBLIC_API_URL=https://your-codespace-8000.app.github.dev
```

Restart Expo after changing environment variables.

## Backend API

Health check:

```bash
curl http://localhost:8000/health
```

Generate a plan:

```bash
curl -X POST http://localhost:8000/api/v1/study-plans/generate \
  -H "Content-Type: application/json" \
  -d @docs/sample-plan-request.json
```

