type FirebaseClientConfig = {
  apiKey: string;
  googleWebClientId: string;
  googleAndroidClientId: string;
  googleIosClientId: string;
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
  const config = getFirebaseClientConfig();
  return Boolean(
    config.apiKey &&
      (config.googleWebClientId || config.googleAndroidClientId || config.googleIosClientId)
  );
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
