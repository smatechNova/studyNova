export type FirebasePhoneCredential = {
  idToken: string;
  uid: string;
  phoneNumber: string;
};

export function isNativeFirebasePhoneAuthAvailable() {
  return false;
}

export async function requestFirebasePhoneCode(_phoneNumber: string): Promise<void> {
  throw new Error("Phone verification is available in the StudyNova Android app.");
}

export async function confirmFirebasePhoneCode(_code: string): Promise<FirebasePhoneCredential> {
  throw new Error("Phone verification is available in the StudyNova Android app.");
}

export function clearFirebasePhoneConfirmation() {}
