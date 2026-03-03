import type { AuthResponse } from "./api";

const AUTH_SESSION_KEY = "chessgg.auth.session";

export type AuthSession = AuthResponse;

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadAuthSession(): AuthSession | null {
  if (!hasStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_KEY);
}
