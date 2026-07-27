import { Platform } from "react-native";

type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket: string;
  googleWebClientId: string;
  googleAndroidClientId: string;
  googleIosClientId: string;
};

type FirebaseClientReadiness = {
  configured: boolean;
  missingKeys: string[];
  warnings: string[];
};

type FirebaseIdpResponse = {
  idToken?: string;
  error?: {
    message?: string;
  };
};

type FirebaseOobResponse = {
  email?: string;
  error?: {
    message?: string;
  };
};

type FirebasePasswordResponse = {
  idToken?: string;
  refreshToken?: string;
  localId?: string;
  email?: string;
  expiresIn?: string;
  error?: {
    message?: string;
  };
};

export type FirebaseEmailCredential = {
  idToken: string;
  refreshToken: string;
  uid: string;
  email: string;
  expiresIn: number;
};

export function getFirebaseClientConfig(): FirebaseClientConfig {
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
    googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? ""
  };
}

export function isFirebaseClientConfigured() {
  return getFirebaseClientReadiness().configured;
}

export function isFirebasePasswordResetConfigured() {
  return Boolean(getFirebaseClientConfig().apiKey);
}

export function isFirebaseEmailPasswordConfigured() {
  return Boolean(getFirebaseClientConfig().apiKey);
}

export function getFirebaseClientReadiness(): FirebaseClientReadiness {
  const config = getFirebaseClientConfig();
  const missingKeys: string[] = [];
  const warnings: string[] = [];

  if (!config.apiKey) {
    missingKeys.push("EXPO_PUBLIC_FIREBASE_API_KEY");
  }

  if (!config.googleWebClientId) {
    missingKeys.push("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID");
  }

  if (Platform.OS === "android" && !config.googleAndroidClientId) {
    missingKeys.push("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID");
  }

  if (Platform.OS === "ios" && !config.googleIosClientId) {
    missingKeys.push("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID");
  }

  if (Platform.OS === "web" && !config.googleWebClientId) {
    warnings.push("Web sign-in needs the Google web client ID.");
  }

  if (Platform.OS !== "web" && !config.googleWebClientId) {
    warnings.push("Firebase token exchange should use the Google web client ID from the same Firebase project.");
  }

  return {
    configured: missingKeys.length === 0,
    missingKeys,
    warnings
  };
}

export async function exchangeGoogleIdTokenForFirebaseIdToken(googleIdToken: string): Promise<string> {
  const config = getFirebaseClientConfig();
  if (!config.apiKey) {
    throw new Error("Firebase API key is not configured.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${config.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`,
        requestUri: "https://studynova.app",
        returnIdpCredential: true,
        returnSecureToken: true
      })
    }
  );
  const payload = (await response.json()) as FirebaseIdpResponse;

  if (!response.ok || !payload.idToken) {
    throw new Error(payload.error?.message ?? "Firebase sign-in did not return an ID token.");
  }

  return payload.idToken;
}

export async function sendFirebasePasswordResetEmail(email: string): Promise<void> {
  const config = getFirebaseClientConfig();
  if (!config.apiKey) {
    throw new Error("Firebase API key is not configured.");
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${config.apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      requestType: "PASSWORD_RESET"
    })
  });
  const payload = (await response.json()) as FirebaseOobResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Firebase password reset could not be sent.");
  }
}

export async function createFirebaseEmailPasswordAccount(
  email: string,
  password: string
): Promise<FirebaseEmailCredential> {
  return firebasePasswordRequest("accounts:signUp", {
    email: email.trim().toLowerCase(),
    password,
    returnSecureToken: true
  });
}

export async function signInFirebaseEmailPassword(
  email: string,
  password: string
): Promise<FirebaseEmailCredential> {
  return firebasePasswordRequest("accounts:signInWithPassword", {
    email: email.trim().toLowerCase(),
    password,
    returnSecureToken: true
  });
}

export async function sendFirebaseEmailVerification(idToken: string): Promise<void> {
  const config = getFirebaseClientConfig();
  if (!config.apiKey) {
    throw new Error("Firebase API key is not configured.");
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${config.apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      idToken,
      requestType: "VERIFY_EMAIL"
    })
  });
  const payload = (await response.json()) as FirebaseOobResponse;
  if (!response.ok) {
    throw new Error(firebaseAuthErrorMessage(payload.error?.message));
  }
}

async function firebasePasswordRequest(
  operation: "accounts:signUp" | "accounts:signInWithPassword",
  body: Record<string, unknown>
): Promise<FirebaseEmailCredential> {
  const config = getFirebaseClientConfig();
  if (!config.apiKey) {
    throw new Error("Firebase API key is not configured.");
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${operation}?key=${config.apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as FirebasePasswordResponse;

  if (!response.ok || !payload.idToken || !payload.refreshToken || !payload.localId || !payload.email) {
    throw new Error(firebaseAuthErrorMessage(payload.error?.message));
  }

  return {
    idToken: payload.idToken,
    refreshToken: payload.refreshToken,
    uid: payload.localId,
    email: payload.email,
    expiresIn: Number.parseInt(payload.expiresIn ?? "3600", 10)
  };
}

function firebaseAuthErrorMessage(code?: string) {
  const normalized = (code ?? "").split(" : ")[0];
  switch (normalized) {
    case "EMAIL_EXISTS":
      return "An account already uses this email. Sign in instead.";
    case "EMAIL_NOT_FOUND":
    case "INVALID_LOGIN_CREDENTIALS":
    case "INVALID_PASSWORD":
      return "The email or password is incorrect.";
    case "WEAK_PASSWORD":
      return "Use a stronger password with at least 8 characters.";
    case "USER_DISABLED":
      return "This account has been disabled. Contact StudyNova support.";
    case "TOO_MANY_ATTEMPTS_TRY_LATER":
      return "Too many attempts. Wait a little, then try again.";
    default:
      return code ? `Firebase authentication failed: ${code}` : "Firebase authentication could not be completed.";
  }
}
