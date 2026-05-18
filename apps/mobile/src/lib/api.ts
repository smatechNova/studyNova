import type { SavedStudyPlan, StudyPlanRequest, StudyPlanResponse } from "@/types";

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

export async function saveStudyPlan(payload: StudyPlanResponse): Promise<SavedStudyPlan> {
  const response = await fetch(`${API_URL}/api/v1/study-plans/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Study plan save failed with ${response.status}`);
  }

  return response.json() as Promise<SavedStudyPlan>;
}

export async function getLatestStudyPlan(studentName?: string): Promise<SavedStudyPlan> {
  const query = studentName ? `?student_name=${encodeURIComponent(studentName)}` : "";
  const response = await fetch(`${API_URL}/api/v1/study-plans/latest${query}`);

  if (!response.ok) {
    throw new Error(`Latest study plan request failed with ${response.status}`);
  }

  return response.json() as Promise<SavedStudyPlan>;
}
