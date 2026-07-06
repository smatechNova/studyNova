import type {
  AccountDeletionRequestInput,
  AccountDeletionRequestReceipt,
  AccountDeletionRequestRecord,
  AccountDeletionReviewInput,
  AccountRecoveryRequestInput,
  AccountRecoveryRequestRecord,
  AccountRecoveryRequestReceipt,
  AccountRecoveryReviewInput,
  AccountSignInInput,
  AuthSession,
  DeploymentReadiness,
  FamilyAccount,
  FirebaseAuthReadiness,
  FirebaseSignInInput,
  LaunchChecklistItemRecord,
  LaunchChecklistItemUpdate,
  ParentAccount,
  ParentEmailVerificationConfirmReceipt,
  ParentEmailVerificationReceipt,
  ParentFamilyAccount,
  ParentInviteCode,
  ParentAccountInput,
  ParentStudentLink,
  PublicAccountDeletionRequestInput,
  SavedStudyPlan,
  StorageBackupReceipt,
  StorageHealth,
  StudentAccount,
  StudentAccountInput,
  StudyReminderSettings,
  StudyReminderSettingsUpdate,
  StudyProofImageUploadRequest,
  StudyPlanProgress,
  StudyPlanRequest,
  StudyPlanResponse,
  StudySessionCompletion,
  StudySessionCompletionRequest,
  TesterFeedbackInput,
  TesterFeedbackReceipt,
  TesterFeedbackRecord,
  TesterFeedbackReviewInput,
  WeeklyStudyDigest
} from "@/types";
import { clearStoredAuthSession, getStoredAuthSession } from "@/lib/session";

const API_URL = getApiUrl();

type ApiErrorPayload = {
  detail?: string | Array<{ msg?: string }>;
};

function getApiUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && window.location.hostname.endsWith(".app.github.dev")) {
    return `${window.location.protocol}//${window.location.hostname.replace("-8081.", "-8000.")}`;
  }

  return "http://localhost:8000";
}

async function createApiError(response: Response, fallback: string) {
  let detail = "";

  try {
    const payload = (await response.json()) as ApiErrorPayload;
    if (typeof payload.detail === "string") {
      detail = payload.detail;
    } else if (Array.isArray(payload.detail)) {
      detail = payload.detail.map((item) => item.msg).filter(Boolean).join(" ");
    }
  } catch {
    detail = "";
  }

  if (
    response.status === 401 &&
    (detail === "Sign in required." || detail === "Invalid sign-in session." || detail === "Sign-in session expired.")
  ) {
    await clearStoredAuthSession();
    return new Error("Your sign-in session expired. Please sign in again.");
  }

  return new Error(detail ? `${fallback}: ${detail}` : `${fallback} (${response.status})`);
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const session = await getStoredAuthSession();
  const headers = new Headers(options.headers);

  if (session?.session_token) {
    headers.set("Authorization", `Bearer ${session.session_token}`);
  }

  return fetch(url, {
    ...options,
    headers
  });
}

export async function createStudentAccount(payload: StudentAccountInput): Promise<StudentAccount> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Student account request failed");
  }

  return response.json() as Promise<StudentAccount>;
}

export async function createParentAccount(payload: ParentAccountInput): Promise<ParentAccount> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/parents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Parent account request failed");
  }

  return response.json() as Promise<ParentAccount>;
}

export async function requestParentEmailVerification(parentId: string): Promise<ParentEmailVerificationReceipt> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/parents/${parentId}/email-verification`, {
    method: "POST"
  });

  if (!response.ok) {
    throw await createApiError(response, "Parent email verification request failed");
  }

  return response.json() as Promise<ParentEmailVerificationReceipt>;
}

export async function confirmParentEmailVerification(
  parentId: string,
  code: string
): Promise<ParentEmailVerificationConfirmReceipt> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/parents/${parentId}/email-verification/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ code })
  });

  if (!response.ok) {
    throw await createApiError(response, "Parent email verification confirmation failed");
  }

  return response.json() as Promise<ParentEmailVerificationConfirmReceipt>;
}

export async function linkParentStudent(parentId: string, studentId: string): Promise<ParentStudentLink> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      parent_id: parentId,
      student_id: studentId
    })
  });

  if (!response.ok) {
    throw await createApiError(response, "Parent-child link request failed");
  }

  return response.json() as Promise<ParentStudentLink>;
}

export async function createParentInviteCode(studentId: string): Promise<ParentInviteCode> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/students/${studentId}/parent-invites`, {
    method: "POST"
  });

  if (!response.ok) {
    throw await createApiError(response, "Parent invite code request failed");
  }

  return response.json() as Promise<ParentInviteCode>;
}

export async function redeemParentInviteCode(parentId: string, code: string): Promise<ParentFamilyAccount> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/parents/${parentId}/parent-invites/redeem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ code })
  });

  if (!response.ok) {
    throw await createApiError(response, "Parent invite redeem request failed");
  }

  return response.json() as Promise<ParentFamilyAccount>;
}

export async function signInAccount(payload: AccountSignInInput): Promise<AuthSession> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/sign-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Account sign-in failed");
  }

  return response.json() as Promise<AuthSession>;
}

export async function createAccountRecoveryRequest(
  payload: AccountRecoveryRequestInput
): Promise<AccountRecoveryRequestReceipt> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/recovery-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Account help request failed");
  }

  return response.json() as Promise<AccountRecoveryRequestReceipt>;
}

export async function createAccountDeletionRequest(
  payload: AccountDeletionRequestInput
): Promise<AccountDeletionRequestReceipt> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/deletion-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Account deletion request failed");
  }

  return response.json() as Promise<AccountDeletionRequestReceipt>;
}

export async function createPublicAccountDeletionRequest(
  payload: PublicAccountDeletionRequestInput
): Promise<AccountDeletionRequestReceipt> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/public-deletion-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Public account deletion request failed");
  }

  return response.json() as Promise<AccountDeletionRequestReceipt>;
}

export async function createTesterFeedback(payload: TesterFeedbackInput): Promise<TesterFeedbackReceipt> {
  const response = await apiFetch(`${API_URL}/api/v1/feedback/tester-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Tester feedback request failed");
  }

  return response.json() as Promise<TesterFeedbackReceipt>;
}

export async function getAccountRecoveryRequests(adminCode: string, limit = 50): Promise<AccountRecoveryRequestRecord[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await apiFetch(`${API_URL}/api/v1/admin/account-recovery-requests?${params.toString()}`, {
    headers: {
      "X-Admin-Code": adminCode
    }
  });

  if (!response.ok) {
    throw await createApiError(response, "Account recovery list request failed");
  }

  return response.json() as Promise<AccountRecoveryRequestRecord[]>;
}

export async function reviewAccountRecoveryRequest(
  adminCode: string,
  requestId: string,
  payload: AccountRecoveryReviewInput
): Promise<AccountRecoveryRequestRecord> {
  const response = await apiFetch(`${API_URL}/api/v1/admin/account-recovery-requests/${requestId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Code": adminCode
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Account recovery review request failed");
  }

  return response.json() as Promise<AccountRecoveryRequestRecord>;
}

export async function getAccountDeletionRequests(adminCode: string, limit = 50): Promise<AccountDeletionRequestRecord[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await apiFetch(`${API_URL}/api/v1/admin/account-deletion-requests?${params.toString()}`, {
    headers: {
      "X-Admin-Code": adminCode
    }
  });

  if (!response.ok) {
    throw await createApiError(response, "Account deletion list request failed");
  }

  return response.json() as Promise<AccountDeletionRequestRecord[]>;
}

export async function reviewAccountDeletionRequest(
  adminCode: string,
  requestId: string,
  payload: AccountDeletionReviewInput
): Promise<AccountDeletionRequestRecord> {
  const response = await apiFetch(`${API_URL}/api/v1/admin/account-deletion-requests/${requestId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Code": adminCode
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Account deletion review request failed");
  }

  return response.json() as Promise<AccountDeletionRequestRecord>;
}

export async function getTesterFeedbackRequests(adminCode: string, limit = 50): Promise<TesterFeedbackRecord[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await apiFetch(`${API_URL}/api/v1/admin/tester-feedback?${params.toString()}`, {
    headers: {
      "X-Admin-Code": adminCode
    }
  });

  if (!response.ok) {
    throw await createApiError(response, "Tester feedback list request failed");
  }

  return response.json() as Promise<TesterFeedbackRecord[]>;
}

export async function reviewTesterFeedbackRequest(
  adminCode: string,
  feedbackId: string,
  payload: TesterFeedbackReviewInput
): Promise<TesterFeedbackRecord> {
  const response = await apiFetch(`${API_URL}/api/v1/admin/tester-feedback/${feedbackId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Code": adminCode
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Tester feedback review request failed");
  }

  return response.json() as Promise<TesterFeedbackRecord>;
}

export async function getStorageHealth(adminCode: string): Promise<StorageHealth> {
  const response = await apiFetch(`${API_URL}/api/v1/admin/storage/health`, {
    headers: {
      "X-Admin-Code": adminCode
    }
  });

  if (!response.ok) {
    throw await createApiError(response, "Storage health request failed");
  }

  return response.json() as Promise<StorageHealth>;
}

export async function createStorageBackup(adminCode: string): Promise<StorageBackupReceipt> {
  const response = await apiFetch(`${API_URL}/api/v1/admin/storage/backups`, {
    method: "POST",
    headers: {
      "X-Admin-Code": adminCode
    }
  });

  if (!response.ok) {
    throw await createApiError(response, "Storage backup request failed");
  }

  return response.json() as Promise<StorageBackupReceipt>;
}

export async function getStorageBackups(adminCode: string, limit = 20): Promise<StorageBackupReceipt[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await apiFetch(`${API_URL}/api/v1/admin/storage/backups?${params.toString()}`, {
    headers: {
      "X-Admin-Code": adminCode
    }
  });

  if (!response.ok) {
    throw await createApiError(response, "Storage backup list request failed");
  }

  return response.json() as Promise<StorageBackupReceipt[]>;
}

export function getStorageBackupDownloadUrl(filename: string) {
  return `${API_URL}/api/v1/admin/storage/backups/${encodeURIComponent(filename)}`;
}

export async function getFirebaseAuthReadiness(adminCode: string): Promise<FirebaseAuthReadiness> {
  const response = await apiFetch(`${API_URL}/api/v1/admin/auth/firebase/readiness`, {
    headers: {
      "X-Admin-Code": adminCode
    }
  });

  if (!response.ok) {
    throw await createApiError(response, "Firebase auth readiness request failed");
  }

  return response.json() as Promise<FirebaseAuthReadiness>;
}

export async function getDeploymentReadiness(adminCode: string): Promise<DeploymentReadiness> {
  const response = await apiFetch(`${API_URL}/api/v1/admin/deployment/readiness`, {
    headers: {
      "X-Admin-Code": adminCode
    }
  });

  if (!response.ok) {
    throw await createApiError(response, "Deployment readiness request failed");
  }

  return response.json() as Promise<DeploymentReadiness>;
}

export async function getLaunchChecklistItems(adminCode: string): Promise<LaunchChecklistItemRecord[]> {
  const response = await apiFetch(`${API_URL}/api/v1/admin/launch-checklist`, {
    headers: {
      "X-Admin-Code": adminCode
    }
  });

  if (!response.ok) {
    throw await createApiError(response, "Launch checklist request failed");
  }

  return response.json() as Promise<LaunchChecklistItemRecord[]>;
}

export async function updateLaunchChecklistItem(
  adminCode: string,
  itemKey: string,
  payload: LaunchChecklistItemUpdate
): Promise<LaunchChecklistItemRecord> {
  const response = await apiFetch(`${API_URL}/api/v1/admin/launch-checklist/${encodeURIComponent(itemKey)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Code": adminCode
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Launch checklist update failed");
  }

  return response.json() as Promise<LaunchChecklistItemRecord>;
}

export async function firebaseSignInAccount(payload: FirebaseSignInInput): Promise<AuthSession> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/firebase-sign-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Google sign-in failed");
  }

  return response.json() as Promise<AuthSession>;
}

export async function getLatestFamilyAccount(): Promise<FamilyAccount> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/family/latest`);

  if (!response.ok) {
    throw await createApiError(response, "Family account request failed");
  }

  return response.json() as Promise<FamilyAccount>;
}

export async function getStudentFamily(studentId: string): Promise<FamilyAccount> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/students/${studentId}/family`);

  if (!response.ok) {
    throw await createApiError(response, "Student family account request failed");
  }

  return response.json() as Promise<FamilyAccount>;
}

export async function getLatestParentFamily(): Promise<ParentFamilyAccount> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/parents/latest/family`);

  if (!response.ok) {
    throw await createApiError(response, "Parent family account request failed");
  }

  return response.json() as Promise<ParentFamilyAccount>;
}

export async function getParentFamily(parentId: string): Promise<ParentFamilyAccount> {
  const response = await apiFetch(`${API_URL}/api/v1/accounts/parents/${parentId}/family`);

  if (!response.ok) {
    throw await createApiError(response, "Parent family account request failed");
  }

  return response.json() as Promise<ParentFamilyAccount>;
}

export async function generateStudyPlan(payload: StudyPlanRequest): Promise<StudyPlanResponse> {
  const response = await apiFetch(`${API_URL}/api/v1/study-plans/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Study plan request failed");
  }

  return response.json() as Promise<StudyPlanResponse>;
}

export async function saveStudyPlan(
  payload: StudyPlanResponse,
  studentId?: string,
  setupPayload?: StudyPlanRequest
): Promise<SavedStudyPlan> {
  const response = await apiFetch(`${API_URL}/api/v1/study-plans/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      plan: payload,
      student_id: studentId ?? null,
      setup_payload: setupPayload ?? null
    })
  });

  if (!response.ok) {
    throw await createApiError(response, "Study plan save failed");
  }

  return response.json() as Promise<SavedStudyPlan>;
}

export async function getStudyPlanHistory(options?: {
  studentName?: string;
  studentId?: string;
  limit?: number;
}): Promise<SavedStudyPlan[]> {
  const params = new URLSearchParams();
  if (options?.studentId) {
    params.set("student_id", options.studentId);
  } else if (options?.studentName) {
    params.set("student_name", options.studentName);
  }
  if (options?.limit) {
    params.set("limit", `${options.limit}`);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await apiFetch(`${API_URL}/api/v1/study-plans/history${query}`);

  if (!response.ok) {
    throw await createApiError(response, "Study plan history request failed");
  }

  return response.json() as Promise<SavedStudyPlan[]>;
}

export async function getLatestStudyPlan(options?: { studentName?: string; studentId?: string }): Promise<SavedStudyPlan> {
  const params = new URLSearchParams();
  if (options?.studentId) {
    params.set("student_id", options.studentId);
  } else if (options?.studentName) {
    params.set("student_name", options.studentName);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await apiFetch(`${API_URL}/api/v1/study-plans/latest${query}`);

  if (!response.ok) {
    throw await createApiError(response, "Latest study plan request failed");
  }

  return response.json() as Promise<SavedStudyPlan>;
}

export async function getStudyPlanProgress(planId: string): Promise<StudyPlanProgress> {
  const response = await apiFetch(`${API_URL}/api/v1/study-plans/${planId}/progress`);

  if (!response.ok) {
    throw await createApiError(response, "Study plan progress request failed");
  }

  return response.json() as Promise<StudyPlanProgress>;
}

export async function getWeeklyStudyDigest(planId: string): Promise<WeeklyStudyDigest> {
  const response = await apiFetch(`${API_URL}/api/v1/study-plans/${planId}/weekly-digest`);

  if (!response.ok) {
    throw await createApiError(response, "Weekly study digest request failed");
  }

  return response.json() as Promise<WeeklyStudyDigest>;
}

export async function getStudyReminderSettings(planId: string): Promise<StudyReminderSettings> {
  const response = await apiFetch(`${API_URL}/api/v1/study-plans/${planId}/reminders`);

  if (!response.ok) {
    throw await createApiError(response, "Study reminder settings request failed");
  }

  return response.json() as Promise<StudyReminderSettings>;
}

export async function updateStudyReminderSettings(
  planId: string,
  payload: StudyReminderSettingsUpdate
): Promise<StudyReminderSettings> {
  const response = await apiFetch(`${API_URL}/api/v1/study-plans/${planId}/reminders`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Study reminder settings update failed");
  }

  return response.json() as Promise<StudyReminderSettings>;
}

export async function rebalanceStudyPlan(planId: string): Promise<SavedStudyPlan> {
  const response = await apiFetch(`${API_URL}/api/v1/study-plans/${planId}/reschedule`, {
    method: "POST"
  });

  if (!response.ok) {
    throw await createApiError(response, "Study plan rebalance request failed");
  }

  return response.json() as Promise<SavedStudyPlan>;
}

export async function completeStudySession(
  planId: string,
  payload: StudySessionCompletionRequest
): Promise<StudySessionCompletion> {
  const response = await apiFetch(`${API_URL}/api/v1/study-plans/${planId}/session-completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Study session completion failed");
  }

  return response.json() as Promise<StudySessionCompletion>;
}

export async function uploadStudyProofImage(
  planId: string,
  payload: StudyProofImageUploadRequest
): Promise<StudySessionCompletion> {
  const response = await apiFetch(`${API_URL}/api/v1/study-plans/${planId}/session-completions/study-proof-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw await createApiError(response, "Study proof image upload failed");
  }

  return response.json() as Promise<StudySessionCompletion>;
}

export function getStudyProofImageUrl(completion: StudySessionCompletion): string | null {
  if (!completion.proof_image_token) {
    return null;
  }

  return `${API_URL}/api/v1/study-proofs/${encodeURIComponent(completion.id)}/image?token=${encodeURIComponent(
    completion.proof_image_token
  )}`;
}

export async function deleteStudySessionCompletion(planId: string, sessionKey: string): Promise<void> {
  const response = await apiFetch(
    `${API_URL}/api/v1/study-plans/${planId}/session-completions/${encodeURIComponent(sessionKey)}`,
    {
      method: "DELETE"
    }
  );

  if (!response.ok) {
    throw await createApiError(response, "Study session undo failed");
  }
}
