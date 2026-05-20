import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { AuthSession } from "@/types";

const SESSION_KEY = "studynova.auth-session.v1";
let memorySession: AuthSession | null = null;

export async function saveAuthSession(session: AuthSession) {
  memorySession = session;
  const serialized = JSON.stringify(session);

  if (canUseWebStorage()) {
    window.localStorage.setItem(SESSION_KEY, serialized);
    return;
  }

  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.setItemAsync(SESSION_KEY, serialized);
  }
}

export async function getStoredAuthSession() {
  if (canUseWebStorage()) {
    const stored = window.localStorage.getItem(SESSION_KEY);
    return parseSession(stored);
  }

  if (await SecureStore.isAvailableAsync()) {
    const stored = await SecureStore.getItemAsync(SESSION_KEY);
    return parseSession(stored);
  }

  return memorySession;
}

export async function clearStoredAuthSession() {
  memorySession = null;

  if (canUseWebStorage()) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }

  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}

function canUseWebStorage() {
  return Platform.OS === "web" && typeof window !== "undefined" && Boolean(window.localStorage);
}

function parseSession(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AuthSession;
  } catch {
    return null;
  }
}
