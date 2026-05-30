# StudyNova Notification Readiness

This checklist covers local study reminders for the Android closed-test build. It is focused on phone reminders, missed-session nudges, and tester verification before Play Store release.

## Current Notification Scope

StudyNova uses local notifications for:

- Daily study reminders at the student's selected reminder time.
- Missed-session nudges at the selected follow-up time.
- Manual test notifications from the generated plan screen.

Remote push notifications are a later production feature. Expo notes that remote push notifications on Android require a development build from SDK 53 onward, while local notifications remain available for Expo Go testing. See the official Expo notifications docs: https://docs.expo.dev/versions/latest/sdk/notifications/

## App Configuration

The Android app config includes:

```json
{
  "android": {
    "permissions": ["POST_NOTIFICATIONS"]
  },
  "plugins": ["expo-notifications"]
}
```

This supports the Android notification permission flow. Expo's permissions guide explains that permissions for standalone and development builds need build-time configuration in app config: https://docs.expo.dev/guides/permissions/

## In-App Readiness Checks

After a plan is generated and saved, the Study reminders panel now shows:

- Permission: whether the phone has allowed notifications.
- Scheduled: how many StudyNova reminders are scheduled for the saved plan.
- Channel: whether the Android notification channel was prepared.

The panel also includes a Send test notification button. Use it before sending testers a build.

## Manual Android Test Flow

1. Install the app through Expo Go, a development build, or the Play Store test track.
2. Sign in as a student.
3. Generate and save a study plan.
4. Open the Study reminders section.
5. Select a reminder time.
6. Turn missed-session nudges on.
7. Tap Send test notification.
8. Allow Android notification permission when prompted.
9. Confirm a StudyNova reminder notification appears on the phone.
10. Confirm the panel shows Permission as Allowed and Scheduled as at least 1.

If the test notification does not appear:

- Check Android Settings > Apps > StudyNova > Notifications.
- Confirm battery saver is not blocking notifications.
- Re-open the app and tap Send test notification again.
- For Play Store testing, install a fresh closed-test build and repeat the flow.

## Release Notes For Testers

Tell testers:

- Reminders are optional and can be disabled.
- Notifications stay on the phone for now; this is not yet server push messaging.
- Missed-session nudges are intended to encourage catch-up, not punish the student.
- They should report whether reminder wording feels calm and helpful.

