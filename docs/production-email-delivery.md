# Production Email Delivery

StudyNova uses Resend for parent verification codes. Firebase handles password-reset links for Firebase email/password accounts. Accounts that use only the StudyNova 4-to-6-digit access code continue through the protected support recovery queue.

## Resend Setup

1. Create a Resend account.
2. Add a sending subdomain such as `accounts.studynova.app`.
3. Add the SPF and DKIM records supplied by Resend to the domain DNS.
4. Wait until the domain is verified.
5. Create a sending-only API key.
6. Add the following private environment variables to the production API host:

```text
EMAIL_PROVIDER=resend
RESEND_API_KEY=<private Resend API key>
EMAIL_FROM=StudyNova <accounts@studynova.app>
SUPPORT_EMAIL=support@studynova.app
EMAIL_VERIFICATION_TTL_MINUTES=20
EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS=60
EMAIL_VERIFICATION_MAX_REQUESTS_PER_HOUR=5
EMAIL_VERIFICATION_MAX_ATTEMPTS=5
```

Do not put `RESEND_API_KEY` in Expo variables or commit it to Git. It belongs only on the API server.

## Firebase Password Reset

Enable Email/Password in Firebase Authentication even when Google sign-in is also enabled. Configure an authorized domain and the password-reset email template in Firebase Console.

The Android production EAS environment needs these public client values:

```powershell
cd apps/mobile
npx eas-cli@latest env:create production --name EXPO_PUBLIC_FIREBASE_API_KEY --value <firebase-web-api-key> --visibility plaintext --force
npx eas-cli@latest env:create production --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value <google-web-client-id> --visibility plaintext --force
npx eas-cli@latest env:create production --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value <google-android-client-id> --visibility plaintext --force
```

The API server separately requires `FIREBASE_SERVICE_ACCOUNT_JSON` so it can verify Firebase ID tokens. Never place the service-account JSON in the mobile app.

## Release Gate

The deployment readiness endpoint fails production preflight when Resend or the support address is missing. Before an EAS build, run:

```powershell
npm run closed-test:preflight -- https://your-api-host <admin-code> https://studynova.app
```

Then test on a real Android build:

1. Create a parent account and receive the six-digit email code.
2. Confirm resend stays disabled for 60 seconds.
3. Confirm an expired or incorrect code is rejected.
4. Sign in with the matching verified Google email and confirm no second verification is required.
5. Request a Firebase password reset and open the link on the phone.
6. Submit recovery for an access-code-only account and confirm it appears in the support queue.
