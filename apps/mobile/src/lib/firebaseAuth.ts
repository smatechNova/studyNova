import { Platform } from "react-native";

type FirebaseClientConfig = {
  apiKey: string;
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

export function getFirebaseClientConfig(): FirebaseClientConfig {
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
    googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? ""
  };
}

export function isFirebaseClientConfigured() {
  return getFirebaseClientReadiness().configured;
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
