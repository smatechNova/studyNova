# Google Play Store Checklist

## Account

- Create or use the StudyNova-owned Google Play Console account.
- Pay the one-time developer registration fee.
- Prefer an organization account so StudyNova remains independent of any one school.

## App Identity

- App name: StudyNova
- Package name: `com.studynova.app`
- Category: Education
- Default language: English
- Short description: Smart study planner and parent progress monitor for students.

Confirm the package name before the first Play upload. It cannot be changed for the same Play Store app after the first uploaded build.

## Required Assets

- App icon
- Adaptive icon
- Notification icon
- Splash artwork
- Feature graphic
- Phone screenshots
- Privacy policy URL using the hosted `/privacy` route
- Terms of Use URL using the hosted `/terms` route
- App description
- Store listing copy
- Closed-test release notes
- Tester invitation message
- Contact email
- Data safety answers
- Public account deletion URL: `https://studynova.app/delete-account`

## Testing Path

- Build an Android App Bundle with EAS:

```bash
npm run mobile:release-check
npx eas-cli@latest build --platform android --profile production
```

- Upload the `.aab` to Play Console.
- Run internal testing first.
- Run closed testing if required by the developer account type.
- If the developer account is a new personal account, keep at least 12 testers opted in continuously for 14 days before applying for production access.
- Fix crashes, policy warnings, and feedback.
- Submit production release.

## Policy Notes

- The app handles student data, so privacy copy must be clear.
- This release is for students aged 13 or older and requires parent or guardian approval at sign-up.
- Expo SDK 55 targets Android API 36 for the 2026 Play requirement.
- Data safety answers must match the app and privacy policy.
- Store listing copy and graphics must describe the actual app experience.
- Parent monitoring must require student-parent linking, not open public lookup.
- Do not collect unnecessary sensitive data.
- Keep the in-app account deletion request flow enabled for students and parents.
- Host the `/privacy` public privacy policy page before Play submission and enter the URL in Play Console.
- Host the `/terms` public Terms of Use page before public testing.
- Host the `/delete-account` public account deletion page before Play submission and enter the URL in Play Console.
