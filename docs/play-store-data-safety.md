# StudyNova Play Store Data Safety Draft

Last updated: June 2, 2026

This document prepares the Google Play Console Data safety form for StudyNova. Review it before submission and keep it aligned with the app, backend, privacy policy, and any third-party SDKs used in the Android build.

Google Play requires developers to declare how the app collects, shares, protects, and deletes user data. For StudyNova, answer from the production Android build behavior, not from localhost, Codespaces, or Expo Go testing.

## Top-Level Form Answers

| Play Console question | Draft answer | StudyNova note |
| --- | --- | --- |
| Does the app collect or share any required user data types? | Yes | StudyNova collects student, parent, study plan, progress, and support data through the app and backend. |
| Is all collected user data encrypted in transit? | Yes, after production API is HTTPS-only | Do not submit a production/closed-test build that points to plain HTTP. Firebase/Google auth and the hosted API must use HTTPS/TLS. |
| Does the app provide a way to request data deletion? | Yes | Signed-in users can request deletion in-app, and the hosted `/delete-account` page provides a public request path for users who cannot sign in. |
| Is data shared with third parties? | No, if Firebase/Google auth and hosting are used only as service providers | Revisit this if analytics, ads, crash reporting, marketing pixels, or non-service-provider SDKs are added. |
| Is data processed ephemerally only? | No | StudyNova stores account, plan, progress, support, and deletion records in the backend. |
| Is data required or optional? | Mixed, but most core account/study data is required | Play marks required when the data is necessary for the app's primary functionality for any users. Optional support, tester feedback, and deletion reasons are only collected when users submit them. |

## Data Types To Declare

| Play category | Play data type | Collect? | Share? | Required? | Purposes | StudyNova examples |
| --- | --- | --- | --- | --- | --- | --- |
| Personal info | Name | Yes | No | Required | App functionality, Account management, Personalization | Student name, parent/guardian name. |
| Personal info | Email address | Yes | No | Required when used as login or Google sign-in identity | App functionality, Account management, Fraud prevention/security/compliance | Student login email, parent login email, Google/Firebase email. |
| Personal info | User IDs | Yes | No | Required | App functionality, Account management, Fraud prevention/security/compliance | StudyNova account IDs, login IDs, Firebase auth UID. |
| Personal info | Phone number | Yes | No | Required when phone is used as parent contact or login contact | App functionality, Account management, Developer communications | Parent/guardian contact, support contact, deletion contact. |
| Personal info | Other info | Yes | No | Required for student setup/profile | App functionality, Personalization, Account management | Age, class level, school name, parent relationship. |
| App activity | App interactions | Yes | No | Required | App functionality, Personalization, Analytics | Study progress, selected student, linked parent/student monitoring activity, reminder preferences. |
| App activity | Other user-generated content | Yes | No | Required for study planning; optional for support, tester feedback notes, and study proof images | App functionality, Personalization, Account management, Developer communications | Subjects, topics, pages, study resources, reading pace notes, recall proof, confidence, optional note photos/screenshots, support notes, tester feedback, deletion request reason. |
| Photos and videos | Photos | Yes | No | Optional | App functionality, Account management | Optional study proof photos or screenshots attached by a student for parent review. |
| App activity | Other actions | Yes | No | Required for core app actions; optional for tester feedback ratings | App functionality, Personalization, Analytics | Marking sessions done, missed-session recovery, check-ins, rebalance activity, closed-test rating/recommendation answers. |

## Data Types Not Currently Collected

Do not select these unless the product changes:

- Location: approximate location, precise location.
- Financial info: payment info, purchase history, credit score, other financial info.
- Health and fitness: health info, fitness info.
- Messages: emails, SMS/MMS, other in-app messages.
- Photos and videos: videos.
- Audio files: voice/sound recordings, music files, other audio.
- Files and docs: no document uploads in the current app.
- Calendar: calendar events.
- Contacts: device contacts.
- Web browsing: browsing history.
- App info and performance: crash logs, diagnostics, other app performance data, unless a crash/analytics SDK is added.
- Device or other IDs: advertising ID, device ID, Firebase installation ID, or similar device identifiers are not intentionally collected by the current app. Revisit this if Firebase client SDK analytics, crash reporting, push tokens, or advertising SDKs are added.

## Security Practices

- Encryption in transit: declare Yes only when the production backend uses HTTPS/TLS and the mobile app points to that URL through `EXPO_PUBLIC_API_URL`.
- Deletion request mechanism: declare Yes. The app has in-app student/parent deletion requests, and the `/delete-account` public web route must be hosted.
- Independent security review: declare No unless StudyNova completes an approved independent mobile security review.
- Families policy badge: only opt in after the Play Console Target audience and content review confirms the app meets the applicable Families policy requirements.

## Third-Party Services To Recheck Before Submission

| Service/library | Current role | Data safety treatment |
| --- | --- | --- |
| Hosted StudyNova API | First-party backend | Declared as collection because data is transmitted from the app to StudyNova servers. |
| Firebase/Google sign-in | Authentication service provider | Auth identity data is collected for account management. Treat as not shared if used only as a service provider on StudyNova's behalf. |
| Expo/EAS build services | Build/distribution tooling | Not a runtime data collector for the production app by itself. Recheck if Expo push notifications or analytics are added. |
| expo-notifications | Local reminders in current build | No remote push token collection in the current implementation. Recheck if remote push is added. |
| Hosting provider | Service provider | Backend host processes StudyNova data on StudyNova's behalf. Ensure contract and HTTPS are production-ready. |

## Data Safety Submission Checklist

Before submitting the Play Console Data safety form:

- Confirm `EXPO_PUBLIC_API_URL` points to the production HTTPS API.
- Confirm the `/privacy` page is hosted on a public, non-editable URL and entered in Play Console.
- Confirm the `/delete-account` page is hosted on a public URL and entered in Play Console.
- Confirm no ads, third-party analytics SDK, crash reporting, remote push, contacts, calendar, location, payment, video, audio, or document-upload SDK has been added since this document was updated.
- Confirm Firebase/Google sign-in configuration and backend token verification are ready for the Android build.
- Confirm the privacy policy names StudyNova, includes a privacy contact, and describes retention/deletion behavior.
- Export or screenshot the submitted Data safety form after Play Console submission and store it with release records.

## Privacy Policy Alignment

The privacy policy should remain consistent with this form. If this document changes, update:

- `docs/privacy-policy-draft.md`
- `docs/account-deletion-request.md`
- `docs/play-store-closed-test.md`
- `docs/mobile-release-readiness.md`
