# StudyNova Play Store Closed Test Runbook

This runbook gets StudyNova into Google Play testing before the full public launch. It is for a closed-test or internal-test build, not the final public release.

## Current Release Target

- App name: StudyNova
- Android package: `com.studynova.app`
- Version name: `0.1.0`
- Version code: managed remotely by EAS and auto-incremented for store builds
- Build artifact for Play Store: Android App Bundle (`.aab`)
- Testing target: Google Play internal testing first, then closed testing

The Android package name becomes permanent after the first Play Console upload. Confirm this identity before uploading the first `.aab`.

## What Must Exist Before The Build

1. A real backend URL, not `localhost`, Codespaces, or Expo tunnel.
2. Expo account access on the machine running the build.
3. Google Play Console developer account.
4. A Google Play app draft created with package name `com.studynova.app`.
5. At least one tester email list or Google Group for Play testing.
6. Privacy policy URL. Use `docs/privacy-policy-draft.md` as the starting text.
7. Public account deletion URL. Use `docs/account-deletion-request.md` as the starting text.
8. Stable network access to Expo services, including `api.expo.dev` and `keystore.expo.dev`.
9. Firebase/Google sign-in configured using `docs/firebase-google-sign-in.md`.
10. Notification readiness checked using `docs/notification-readiness.md`.
11. Backend deployment readiness checked using `infra/api-production-readiness.md`.
12. Data safety draft reviewed using `docs/play-store-data-safety.md`.
13. Store listing pack reviewed using `docs/play-store-listing-pack.md`.

See `infra/api-persistent-disk.md` for the fastest backend path for closed testing.
See `infra/render-closed-test-deployment.md` for the hosted Render execution path.
See `docs/mobile-release-readiness.md` for the mobile app identity, assets, and guarded build commands.

## Backend Persistence Setup

For internal testing, the current API can run on SQLite if the deployment host provides a persistent disk.
Set these environment variables on the backend host:

```text
APP_ENV=production
LOCAL_DATA_PATH=/persistent/studynova/studynova.sqlite3
BACKUP_DATA_PATH=/persistent/studynova/backups
SESSION_SECRET=<long random secret>
ADMIN_ACCESS_CODE=<private admin code>
SESSION_TTL_HOURS=168
PUBLIC_API_BASE_URL=https://your-api-host
ALLOWED_ORIGINS=<production mobile web/admin origin if used>
ALLOWED_ORIGIN_REGEX=
FIREBASE_SERVICE_ACCOUNT_JSON=<optional Firebase Admin JSON>
```

Do not use the default development database path or default admin code for a public build. The support admin screen can load storage health, list backup files, create a SQLite backup, and mark account recovery requests as reviewed after the admin code is entered.

Before building the Android test release, open the support screen with the production admin code and confirm deployment readiness is marked ready. You can also call:

```powershell
curl.exe -H "X-Admin-Code: <admin-code>" https://your-api-host/api/v1/admin/deployment/readiness
```

Or run the repository smoke test and write the local mobile env file:

```powershell
npm run closed-test:api-env -- https://your-api-host <admin-code>
```

## Recommended Track Order

1. Internal testing: upload first `.aab` and test install with 1 to 5 trusted people.
2. Closed testing: invite the wider tester group after internal testing works.
3. Production: only after closed testing feedback and required Play Console checks are complete.

Google Play Console says internal or closed tests are not searchable on Google Play before public rollout; testers need an app link or opt-in link.

## Commands

Run these from `apps/mobile`.

```powershell
npm install
npm run typecheck
npm run release:check
npx eas-cli@latest login
npx eas-cli@latest env:create production --name EXPO_PUBLIC_API_URL --value https://your-api-host --visibility plaintext --force
npx eas-cli@latest build --platform android --profile closed-test
```

After the EAS build completes, download the `.aab` from the EAS dashboard and upload it manually in Play Console, or use EAS Submit after Play Console service account access is configured:

```powershell
npx eas-cli@latest submit --platform android --profile closed-test
```

For an installable APK that is not uploaded to Play Store:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

From the repository root, the same guarded commands are:

```powershell
npm run mobile:release-check
npm run mobile:build:closed-test
npm run mobile:submit:closed-test
```

## Play Console Steps

1. Create the app in Play Console.
2. Complete app content declarations:
   - Data safety
   - Privacy policy
   - App access
   - Ads declaration
   - Target audience and content
   - Content rating
3. Use `docs/play-store-data-safety.md` while completing the Data safety form.
4. Go to Testing > Internal testing or Testing > Closed testing.
5. Add tester emails or a Google Group.
6. Create release and upload the `.aab`.
7. Add release notes from `docs/play-store-listing-pack.md`.
   - "Initial StudyNova test build for student study planning, parent monitoring, reminders, and account-linking feedback."
8. Publish the test release.
9. Share the opt-in link with testers.

## Tester Instructions

Ask testers to confirm:

- They can create a student account.
- They can create a parent account.
- A student can generate a plan.
- A student can mark a study session as done with recall proof.
- A parent can link a student and see progress.
- Reminders request Android permission clearly.
- The Send test notification button produces a visible phone notification.
- Missed-session messages make sense and feel encouraging.
- The UI is readable in light and dark mode.
- A signed-in student or parent can submit an account deletion request from the app privacy section.
- Testers can open Tester feedback from the home screen and submit one structured feedback note.

Use the in-app Tester feedback screen for normal closed-test notes. Use `docs/tester-feedback-template.md` when a tester cannot open the app or needs to send feedback manually.

## Known V1 Blockers Before Public Production

- Backend must be deployed permanently.
- Google sign-in must be tested with real Firebase credentials on an Android build.
- App icon, feature graphic, and screenshots must be final.
- Privacy policy must be hosted on a public URL.
- Account deletion request instructions must be hosted on a public URL.
- Real-world testing must confirm notifications and parent linking on Android phones.
- Admin/support workflow must be tested for tester feedback, account recovery requests, account deletion requests, and backup export.
