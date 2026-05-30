# StudyNova Play Store Closed Test Runbook

This runbook gets StudyNova into Google Play testing before the full public launch. It is for a closed-test or internal-test build, not the final public release.

## Current Release Target

- App name: StudyNova
- Android package: `com.smatech.studynova`
- Version name: `0.1.0`
- Version code: managed remotely by EAS and auto-incremented for store builds
- Build artifact for Play Store: Android App Bundle (`.aab`)
- Testing target: Google Play internal testing first, then closed testing

## What Must Exist Before The Build

1. A real backend URL, not `localhost`, Codespaces, or Expo tunnel.
2. Expo account access on the machine running the build.
3. Google Play Console developer account.
4. A Google Play app draft created with package name `com.smatech.studynova`.
5. At least one tester email list or Google Group for Play testing.
6. Privacy policy URL. Use `docs/privacy-policy-draft.md` as the starting text.
7. Stable network access to Expo services, including `api.expo.dev` and `keystore.expo.dev`.

See `infra/api-persistent-disk.md` for the fastest backend path for closed testing.

## Backend Persistence Setup

For internal testing, the current API can run on SQLite if the deployment host provides a persistent disk.
Set these environment variables on the backend host:

```text
APP_ENV=production
LOCAL_DATA_PATH=/persistent/studynova/studynova.sqlite3
BACKUP_DATA_PATH=/persistent/studynova/backups
SESSION_SECRET=<long random secret>
ADMIN_ACCESS_CODE=<private admin code>
```

Do not use the default development database path or default admin code for a public build. The support admin screen can load storage health and create a SQLite backup after the admin code is entered.

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
eas login
eas build --platform android --profile closed-test
```

After the EAS build completes, download the `.aab` from the EAS dashboard and upload it manually in Play Console, or use EAS Submit after Play Console service account access is configured:

```powershell
eas submit --platform android --profile closed-test
```

For an installable APK that is not uploaded to Play Store:

```powershell
eas build --platform android --profile preview
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
3. Go to Testing > Internal testing or Testing > Closed testing.
4. Add tester emails or a Google Group.
5. Create release and upload the `.aab`.
6. Add release notes:
   - "Initial StudyNova test build for student study planning, parent monitoring, reminders, and account-linking feedback."
7. Publish the test release.
8. Share the opt-in link with testers.

## Tester Instructions

Ask testers to confirm:

- They can create a student account.
- They can create a parent account.
- A student can generate a plan.
- A student can mark a study session as done with recall proof.
- A parent can link a student and see progress.
- Reminders and missed-session messages make sense.
- The UI is readable in light and dark mode.

Use `docs/tester-feedback-template.md` to collect structured feedback.

## Known V1 Blockers Before Public Production

- Backend must be deployed permanently.
- Google sign-in must be configured with real Firebase credentials.
- App icon, feature graphic, and screenshots must be final.
- Privacy policy must be hosted on a public URL.
- Real-world testing must confirm notifications and parent linking on Android phones.
- Admin/support view is still needed for account recovery requests.
