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
    const session = parseSession(stored);
    if (stored && !session) {
      window.localStorage.removeItem(SESSION_KEY);
    }
    return session;
  }

  if (await SecureStore.isAvailableAsync()) {
    const stored = await SecureStore.getItemAsync(SESSION_KEY);
    const session = parseSession(stored);
    if (stored && !session) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
    return session;
  }

  return isUsableAuthSession(memorySession) ? memorySession : null;
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
    const parsed = JSON.parse(value) as unknown;
    return isUsableAuthSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isUsableAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<AuthSession>;
  if (session.role !== "student" && session.role !== "parent") {
    return false;
  }

  if (!session.session_token || typeof session.session_token !== "string") {
    return false;
  }

  if (!isFutureTimestamp(session.session_expires_at)) {
    return false;
  }

  if (session.role === "student") {
    return Boolean(session.student?.id);
  }

  return Boolean(session.parent?.id);
}

function isFutureTimestamp(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}
