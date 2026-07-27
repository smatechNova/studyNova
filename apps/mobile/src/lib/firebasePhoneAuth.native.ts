import {
  getAuth,
  getIdToken,
  signInWithPhoneNumber,
  type ConfirmationResult
} from "@react-native-firebase/auth";

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
  pendingConfirmation = await signInWithPhoneNumber(getAuth(), normalized);
  pendingPhoneNumber = normalized;
}

export async function confirmFirebasePhoneCode(code: string): Promise<FirebasePhoneCredential> {
  if (!pendingConfirmation) {
    throw new Error("Request a fresh phone verification code first.");
  }

  const credential = await pendingConfirmation.confirm(code.trim());
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
