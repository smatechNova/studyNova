# StudyNova 1.0 Play Store Publication Runbook

Last updated: July 20, 2026

## Release Identity

- App: StudyNova
- Android package: `com.studynova.app`
- Version: `1.0.0`
- Android target: API 36 through Expo SDK 55
- Artifact: signed Android App Bundle (`.aab`)
- Audience for this release: students aged 13 or older, parents, guardians, and schools
- Support: `support@studynova.app`

## Management Presentation Today

Present the app as a release candidate, not as already approved by Google Play. Demonstrate:

1. Separate student and parent sign-in.
2. Parent-approved student sign-up and email verification.
3. Guided study-plan setup and generated timetable.
4. Study reflection, confidence, and optional photo proof.
5. Parent linking and multi-student monitoring.
6. Reminders, missed-session tracking, and plan rebalancing.
7. Privacy, Terms of Use, account recovery, and account deletion.

Use safe demo records only. Do not display production secrets, real student data, admin access codes, or Firebase service credentials.

## Publication Gates

All of the following must pass before uploading a release:

```powershell
npm ci
python -m pip install -r apps/api/requirements-dev.txt
npm run mobile:typecheck
npm run mobile:release-check
npm run security:release
npm run mobile:export:web
python -m pytest apps/api/tests --basetemp .pytest-tmp
python -m ruff check apps/api
```

The security gate fails on any high or critical npm advisory. The current moderate Expo build-tool findings and the reason they are not force-fixed are recorded in `docs/dependency-security-review.md`.

After Render deployment:

```powershell
npm run closed-test:preflight -- https://api.studynova.app <admin-code> https://studynova.app
```

The preflight must confirm the production API, backups/storage, Firebase, Resend email delivery, and public `/privacy`, `/terms`, and `/delete-account` routes.

## EAS Production Environment

Set production values in EAS. Never commit secrets to Git:

- `EXPO_PUBLIC_API_URL=https://api.studynova.app`
- Firebase public app configuration
- Google web and Android OAuth client IDs
- `EXPO_PUBLIC_ENABLE_DEMO_ENTRY=false`
- `EXPO_PUBLIC_ENABLE_TESTER_FEEDBACK=false` for public production

Confirm the environment, then build:

```powershell
cd apps/mobile
npx eas-cli@latest whoami
npx eas-cli@latest env:list --environment production
npx eas-cli@latest build --platform android --profile closed-test
```

Use the closed-test AAB for internal and closed testing. After the approved testing period and final sign-off:

```powershell
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --profile production
```

## Play Console Sequence

1. Create StudyNova in the Play Console with package `com.studynova.app`.
2. Upload the AAB to Internal testing first.
3. Complete App access, Ads, Content rating, Target audience, Data safety, privacy policy, and account deletion declarations.
4. Use the listing copy in `docs/play-store-listing-pack.md`.
5. Upload `docs/play-store-assets/feature-graphic.png` and actual release-candidate phone screenshots.
6. Run internal tests on at least two physical Android versions and screen sizes.
7. Promote to Closed testing and invite testers.
8. For a new personal Play developer account, maintain at least 12 opted-in testers continuously for 14 days before applying for production access.
9. Review crashes, Android vitals, tester feedback, account email delivery, reminders, and deletion requests.
10. Submit the production release only after the production launch gate is green.

## External Actions That Code Cannot Complete

- Verify ownership of `studynova.app` and make the public routes live.
- Create and monitor `support@studynova.app`.
- Verify the sending domain in Resend and configure its production API key.
- Configure Firebase Android credentials, SHA fingerprints, Storage rules, and password-reset template.
- Complete Play Console identity and policy declarations.
- Capture screenshots from the actual signed Android build.
- Complete Google's required testing period and review.

Official references:

- Google Play target API requirements: `https://support.google.com/googleplay/android-developer/answer/11926878`
- App Bundle requirement: `https://support.google.com/googleplay/android-developer/answer/9844679`
- Testing requirements: `https://support.google.com/googleplay/android-developer/answer/14151465`
- Account deletion requirement: `https://support.google.com/googleplay/android-developer/answer/13327111`
- Data safety: `https://support.google.com/googleplay/android-developer/answer/10787469`
