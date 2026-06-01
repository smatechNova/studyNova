# Google Play Store Checklist

## Account

- Create or use the school-owned Google Play Console account.
- Pay the one-time developer registration fee.
- Prefer an organization account if SMATECH High School should officially own the app.

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
- Privacy policy URL
- App description
- Contact email

## Testing Path

- Build an Android App Bundle with EAS:

```bash
npm run mobile:release-check
npx eas-cli@latest build --platform android --profile production
```

- Upload the `.aab` to Play Console.
- Run internal testing first.
- Run closed testing if required by the developer account type.
- Fix crashes, policy warnings, and feedback.
- Submit production release.

## Policy Notes

- The app handles student data, so privacy copy must be clear.
- Parent monitoring must require student-parent linking, not open public lookup.
- Do not collect unnecessary sensitive data.
- Keep account deletion and support instructions ready before public release.
