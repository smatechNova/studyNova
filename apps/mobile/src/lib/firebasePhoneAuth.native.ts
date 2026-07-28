type FirebaseAuthModule = typeof import("@react-native-firebase/auth");
type ConfirmationResult = import("@react-native-firebase/auth").ConfirmationResult;

export type FirebasePhoneCredential = {
  idToken: string;
  uid: string;
  phoneNumber: string;
};

let pendingConfirmation: ConfirmationResult | null = null;
let pendingPhoneNumber = "";

export function isNativeFirebasePhoneAuthAvailable() {
  return true;
}

export async function requestFirebasePhoneCode(phoneNumber: string): Promise<void> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const { getAuth, signInWithPhoneNumber } = await loadFirebaseAuth();
  pendingConfirmation = await signInWithPhoneNumber(getAuth(), normalized);
  pendingPhoneNumber = normalized;
}

export async function confirmFirebasePhoneCode(code: string): Promise<FirebasePhoneCredential> {
  if (!pendingConfirmation) {
    throw new Error("Request a fresh phone verification code first.");
  }

  const credential = await pendingConfirmation.confirm(code.trim());
  const { getIdToken } = await loadFirebaseAuth();
  const idToken = await getIdToken(credential.user, true);
  const result = {
    idToken,
    uid: credential.user.uid,
    phoneNumber: credential.user.phoneNumber ?? pendingPhoneNumber
  };
  clearFirebasePhoneConfirmation();
  return result;
}

export function clearFirebasePhoneConfirmation() {
  pendingConfirmation = null;
  pendingPhoneNumber = "";
}

function normalizePhoneNumber(value: string) {
  const normalized = value.replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Enter the phone number with country code, for example +2348012345678.");
  }
  return normalized;
}

async function loadFirebaseAuth(): Promise<FirebaseAuthModule> {
  try {
    return await import("@react-native-firebase/auth");
  } catch {
    throw new Error(
      "Phone verification could not start on this device. Use email sign-in or install the latest StudyNova update."
    );
  }
}
