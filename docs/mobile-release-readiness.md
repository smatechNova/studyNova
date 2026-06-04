# StudyNova Mobile Release Readiness

Use this before every Play Store test build.

## App Identity

- App name: StudyNova
- Android package: `com.studynova.app`
- Version name: `0.1.0`
- EAS version source: remote
- Closed-test artifact: Android App Bundle (`.aab`)

The Android package name is permanent after the first uploaded Play Console build. Confirm the package before uploading the first `.aab`.

## Release Assets

The mobile app has committed assets under `apps/mobile/assets`:

- `icon.png`
- `adaptive-icon.png`
- `splash-icon.png`
- `splash.png`
- `notification-icon.png`

Regenerate the current placeholder assets from the repository root with:

```powershell
npm run mobile:assets
```

These assets are good enough for a closed-test build. Before public production, replace them with final designer-approved Play Store artwork, feature graphic, and screenshots.

## Preflight Command

From the repository root:

```powershell
npm run mobile:release-check
```

This validates the app config, EAS profiles, required Android assets, notification setup, hosted API preparation files, and Play Store docs references.

Before submitting to Play Store, host these policy and store-readiness documents or routes publicly:

- `docs/privacy-policy-draft.md`
- `docs/terms-of-use-draft.md`
- `docs/account-deletion-request.md`
- `docs/play-store-data-safety.md`
- `docs/play-store-listing-pack.md`
- `docs/play-store-screenshot-capture.md`

## Hosted API Preflight

Closed-test builds must point to a hosted HTTPS API, not localhost, Codespaces, or an Expo tunnel.

Use the Render execution path first:

- `infra/render-closed-test-deployment.md`
- `infra/render-env.closed-test.example`

After the backend is deployed, run from the repository root:

```powershell
npm run api:smoke -- https://your-api-host <admin-code>
npm run closed-test:api-env -- https://your-api-host <admin-code>
```

The second command writes `apps/mobile/.env.local` for local Expo testing. For EAS cloud builds, set the same URL in the production EAS environment:

```powershell
cd apps/mobile
npx eas-cli@latest env:create production --name EXPO_PUBLIC_API_URL --value https://your-api-host --visibility plaintext --force
```

## Closed-Test Build

After the hosted API smoke test passes and `EXPO_PUBLIC_API_URL` is set in the production EAS environment:

```powershell
npm run mobile:build:closed-test
```

Submit after the Play Console service account is configured:

```powershell
npm run mobile:submit:closed-test
```

For a quick installable APK outside Play Store:

```powershell
cd apps/mobile
npm run build:preview
```
