# Firebase and Google Sign-In Setup

StudyNova uses a practical two-layer auth model:

- Mobile app: starts Google sign-in with Expo AuthSession and exchanges the Google ID token for a Firebase ID token.
- API backend: verifies the Firebase ID token with Firebase Admin SDK before opening the student or parent account.

Firebase recommends sending client ID tokens to a trusted backend over HTTPS and verifying them with the Admin SDK before trusting the user identity: https://firebase.google.com/docs/auth/admin/verify-id-tokens

Expo AuthSession is the Expo browser-based OAuth flow used by the mobile app: https://docs.expo.dev/versions/latest/sdk/auth-session/

## Firebase Console

1. Create a Firebase project for StudyNova.
2. Enable Authentication > Sign-in method > Google.
3. Add an Android app:
   - Package name: `com.studynova.app`
   - App nickname: `StudyNova Android`
4. Add release SHA fingerprints for the signing key used by the Play Store/EAS build.
   Firebase notes that Android Google sign-in needs app SHA fingerprints in project settings: https://firebase.google.com/docs/auth/android/google-signin
5. Create OAuth client IDs for:
   - Web client
   - Android client
   - iOS client later, only when iOS is supported
6. Create a Firebase service account JSON for the backend.

## Mobile Environment

Set these in `apps/mobile/.env` for local testing and in the EAS build environment for closed-test builds:

```text
EXPO_PUBLIC_API_URL=https://your-production-api.example.com
EXPO_PUBLIC_FIREBASE_API_KEY=<firebase web api key>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<google web client id>
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<google android client id>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

The app requires the Firebase API key plus the Google web client ID and Android client ID for Android production testing.

## API Environment

Set these on the backend host:

```text
FIREBASE_SERVICE_ACCOUNT_JSON=<full service account json on one line>
```

Alternative production hosts can use Google application credentials, but `FIREBASE_SERVICE_ACCOUNT_JSON` is the simplest path for the current deployment bridge.

## Account Linking Rules

- A student account remains separate from a parent account.
- Parent accounts can monitor multiple linked students.
- Google sign-in opens an existing StudyNova account only when the Google email matches that account login ID.
- If a student does not have Gmail yet, create Gmail first, then use that Gmail as the student login ID.
- The first successful Google sign-in binds Firebase `uid` to the StudyNova account so later Google logins are smoother.

## Testing Checklist

1. Deploy the API with `FIREBASE_SERVICE_ACCOUNT_JSON`.
2. Open `/support`, enter the admin code, and load the admin view.
3. Confirm `Firebase verification ready` appears.
4. Build or run the mobile app with all `EXPO_PUBLIC_*` variables.
5. Create a student account with the same Gmail used for Google sign-in.
6. Sign out.
7. Sign in as student with Google.
8. Create a parent account with a parent Gmail.
9. Sign out.
10. Sign in as parent with Google.

If Google sign-in works but StudyNova says no account is linked, confirm the Gmail address exactly matches the account login ID and that the correct role was selected.
