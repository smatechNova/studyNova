import type {
  AccountRecoveryRequestInput,
  AccountRecoveryRequestRecord,
  AccountRecoveryRequestReceipt,
  AccountSignInInput,
  AuthSession,
  FamilyAccount,
  FirebaseAuthReadiness,
  FirebaseSignInInput,
  ParentAccount,
  ParentFamilyAccount,
  ParentInviteCode,
  ParentAccountInput,
  ParentStudentLink,
  SavedStudyPlan,
  StorageBackupReceipt,
  StorageHealth,
  StudentAccount,
  StudentAccountInput,
  StudyReminderSettings,
  StudyReminderSettingsUpdate,
  StudyPlanProgress,
  StudyPlanRequest,
  StudyPlanResponse,
  StudySessionCompletion,
  StudySessionCompletionRequest,
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
