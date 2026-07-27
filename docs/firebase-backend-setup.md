# StudyNova Firebase backend setup

StudyNova uses Firebase Authentication for identity, Firestore for private cloud
records, and Firebase Storage for optional study-proof images. The FastAPI
service remains the trusted study-planning and authorization boundary.

## Project and Android app

- Firebase project ID: `studynova-f6859`
- Firebase project number: `268039439117`
- Android package: `com.studynova.app`
- Android display name: `StudyNova`
- Android Firebase app ID: `1:268039439117:android:747fd7c12306353ebae644`
- Web Firebase app ID: `1:268039439117:web:c68bbcdc22efbd69bae644`

First install the official Firebase agent guidance and CLI:

```powershell
npx skills add firebase/agent-skills --agent=codex
npx -y -p firebase-tools@latest firebase login
npx -y -p firebase-tools@latest firebase projects:list
```

In the projects list, copy the **Project ID** whose project number is
`268039439117`. Project ID and project number are different values.

Register the Android app:

```powershell
npx -y -p firebase-tools@latest firebase apps:create ANDROID StudyNova --package-name=com.studynova.app --project studynova-f6859
npx -y -p firebase-tools@latest firebase apps:list --project studynova-f6859
npx -y -p firebase-tools@latest firebase apps:sdkconfig ANDROID 1:268039439117:android:747fd7c12306353ebae644 --project studynova-f6859
```

`apps/mobile/app.config.js` detects `google-services.json` automatically.
For EAS builds, store the same file as a secret file variable named
`GOOGLE_SERVICES_JSON`; `app.config.js` uses that injected file path.

## Firebase Console settings

Open `https://console.firebase.google.com/`, select the project matching project
number `268039439117`, and configure:

1. Authentication > Sign-in method: enable **Email/Password**, **Google**, and
   **Phone**.
2. Authentication > Settings > Authorized domains: add the deployed StudyNova
   web host.
3. Firestore Database: create the production database. Choose a region close to
   the majority of users and the API deployment.
4. Project settings > Your apps > Android app: add SHA-1 and SHA-256 fingerprints
   for the EAS/Play signing certificate. Google and Phone authentication need
   these fingerprints.
5. Project settings > Service accounts: generate a private key for the API.
   Never commit this JSON file.

Deploy deny-by-default client rules:

```powershell
npx -y -p firebase-tools@latest firebase use studynova-f6859
npx -y -p firebase-tools@latest firebase deploy --only firestore
```

The API uses Firebase Admin SDK, which bypasses client rules. Mobile clients
cannot read or write StudyNova records directly.

## Mobile public environment

Copy the Web app configuration values from Firebase Project settings into the
mobile/EAS environment:

```text
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=268039439117-3p8tcbgu7h021graqimnd5tu2r5jt1od.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

Firebase web configuration and API keys identify the Firebase project; they are
not service-account secrets. Restrict API keys in Google Cloud to the expected
Firebase APIs and app origins/package where supported.

## API secret environment

Set these only on the API host:

```text
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
FIREBASE_STORAGE_BUCKET=
FIRESTORE_ENABLED=true
FIRESTORE_REQUIRED=true
STUDY_PROOF_STORAGE_BACKEND=firebase
```

`FIREBASE_SERVICE_ACCOUNT_JSON` is highly sensitive. Store it as a secret
environment variable and never put it in Git, Expo public variables, screenshots,
or the APK.

## Phone authentication

Email/password and Google authentication use the current universal client.
Production Android phone OTP requires a native development/Play build:

```powershell
npm install --workspace @studynova/mobile firebase @react-native-firebase/app @react-native-firebase/auth
npx expo prebuild --platform android
```

Phone authentication cannot be validated in Expo Go. Test it with an EAS
development/preview build after `google-services.json`, SHA-1, and SHA-256 are
registered. Configure Firebase test phone numbers during development to avoid
sending real SMS messages.
