import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

type DashboardRole = "student" | "parent";

const DASHBOARD_INTRO_KEY_PREFIX = "studynova.dashboard-intro-dismissed.v1";
const memoryIntroDismissals = new Set<string>();

export async function hasDismissedDashboardIntro(role: DashboardRole, accountId: string) {
  const key = getDashboardIntroKey(role, accountId);

  if (canUseWebStorage()) {
    return window.localStorage.getItem(key) === "true";
  }

  try {
    if (await SecureStore.isAvailableAsync()) {
      return (await SecureStore.getItemAsync(key)) === "true";
    }
  } catch {
    return memoryIntroDismissals.has(key);
  }

  return memoryIntroDismissals.has(key);
}

export async function dismissDashboardIntro(role: DashboardRole, accountId: string) {
  const key = getDashboardIntroKey(role, accountId);
  memoryIntroDismissals.add(key);

  if (canUseWebStorage()) {
    window.localStorage.setItem(key, "true");
    return;
  }

  try {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(key, "true");
    }
  } catch {
    // The in-memory fallback keeps the card hidden during the current app session.
  }
}

function getDashboardIntroKey(role: DashboardRole, accountId: string) {
  return `${DASHBOARD_INTRO_KEY_PREFIX}.${role}.${accountId}`;
}

function canUseWebStorage() {
  return Platform.OS === "web" && typeof window !== "undefined" && Boolean(window.localStorage);
}
