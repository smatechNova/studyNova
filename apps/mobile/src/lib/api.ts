import type {
  AccountSignInInput,
  AuthSession,
  FamilyAccount,
  FirebaseSignInInput,
  ParentAccount,
  ParentFamilyAccount,
  ParentAccountInput,
  ParentStudentLink,
  SavedStudyPlan,
  StudentAccount,
  StudentAccountInput,
  StudyPlanProgress,
  StudyPlanRequest,
  StudyPlanResponse,
  StudySessionCompletion,
  StudySessionCompletionRequest
} from "@/types";

const API_URL = getApiUrl();

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

export async function createStudentAccount(payload: StudentAccountInput): Promise<StudentAccount> {
  const response = await fetch(`${API_URL}/api/v1/accounts/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Student account request failed with ${response.status}`);
  }

  return response.json() as Promise<StudentAccount>;
}

export async function createParentAccount(payload: ParentAccountInput): Promise<ParentAccount> {
  const response = await fetch(`${API_URL}/api/v1/accounts/parents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Parent account request failed with ${response.status}`);
  }

  return response.json() as Promise<ParentAccount>;
}

export async function linkParentStudent(parentId: string, studentId: string): Promise<ParentStudentLink> {
  const response = await fetch(`${API_URL}/api/v1/accounts/links`, {
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
    throw new Error(`Parent-child link request failed with ${response.status}`);
  }

  return response.json() as Promise<ParentStudentLink>;
}

export async function signInAccount(payload: AccountSignInInput): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/api/v1/accounts/sign-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Account sign-in failed with ${response.status}`);
  }

  return response.json() as Promise<AuthSession>;
}

export async function firebaseSignInAccount(payload: FirebaseSignInInput): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/api/v1/accounts/firebase-sign-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Google sign-in failed with ${response.status}`);
  }

  return response.json() as Promise<AuthSession>;
}

export async function getLatestFamilyAccount(): Promise<FamilyAccount> {
  const response = await fetch(`${API_URL}/api/v1/accounts/family/latest`);

  if (!response.ok) {
    throw new Error(`Family account request failed with ${response.status}`);
  }

  return response.json() as Promise<FamilyAccount>;
}

export async function getStudentFamily(studentId: string): Promise<FamilyAccount> {
  const response = await fetch(`${API_URL}/api/v1/accounts/students/${studentId}/family`);

  if (!response.ok) {
    throw new Error(`Student family account request failed with ${response.status}`);
  }

  return response.json() as Promise<FamilyAccount>;
}

export async function getLatestParentFamily(): Promise<ParentFamilyAccount> {
  const response = await fetch(`${API_URL}/api/v1/accounts/parents/latest/family`);

  if (!response.ok) {
    throw new Error(`Parent family account request failed with ${response.status}`);
  }

  return response.json() as Promise<ParentFamilyAccount>;
}

export async function getParentFamily(parentId: string): Promise<ParentFamilyAccount> {
  const response = await fetch(`${API_URL}/api/v1/accounts/parents/${parentId}/family`);

  if (!response.ok) {
    throw new Error(`Parent family account request failed with ${response.status}`);
  }

  return response.json() as Promise<ParentFamilyAccount>;
}

export async function generateStudyPlan(payload: StudyPlanRequest): Promise<StudyPlanResponse> {
  const response = await fetch(`${API_URL}/api/v1/study-plans/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Study plan request failed with ${response.status}`);
  }

  return response.json() as Promise<StudyPlanResponse>;
}

export async function saveStudyPlan(payload: StudyPlanResponse, studentId?: string): Promise<SavedStudyPlan> {
  const response = await fetch(`${API_URL}/api/v1/study-plans/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      plan: payload,
      student_id: studentId ?? null
    })
  });

  if (!response.ok) {
    throw new Error(`Study plan save failed with ${response.status}`);
  }

  return response.json() as Promise<SavedStudyPlan>;
}

export async function getLatestStudyPlan(options?: { studentName?: string; studentId?: string }): Promise<SavedStudyPlan> {
  const params = new URLSearchParams();
  if (options?.studentId) {
    params.set("student_id", options.studentId);
  } else if (options?.studentName) {
    params.set("student_name", options.studentName);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_URL}/api/v1/study-plans/latest${query}`);

  if (!response.ok) {
    throw new Error(`Latest study plan request failed with ${response.status}`);
  }

  return response.json() as Promise<SavedStudyPlan>;
}

export async function getStudyPlanProgress(planId: string): Promise<StudyPlanProgress> {
  const response = await fetch(`${API_URL}/api/v1/study-plans/${planId}/progress`);

  if (!response.ok) {
    throw new Error(`Study plan progress request failed with ${response.status}`);
  }

  return response.json() as Promise<StudyPlanProgress>;
}

export async function completeStudySession(
  planId: string,
  payload: StudySessionCompletionRequest
): Promise<StudySessionCompletion> {
  const response = await fetch(`${API_URL}/api/v1/study-plans/${planId}/session-completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Study session completion failed with ${response.status}`);
  }

  return response.json() as Promise<StudySessionCompletion>;
}

export async function deleteStudySessionCompletion(planId: string, sessionKey: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/v1/study-plans/${planId}/session-completions/${encodeURIComponent(sessionKey)}`,
    {
      method: "DELETE"
    }
  );

  if (!response.ok) {
    throw new Error(`Study session undo failed with ${response.status}`);
  }
}
