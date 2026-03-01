import type { LoginResult } from './apiClient';
import {
  AUTH_SESSION_COOKIE_KEY,
  AUTH_SESSION_STORAGE_KEY,
} from './authSession.constants';

const AUTH_SESSION_COOKIE_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

export type StoredAuthSession = LoginResult;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function canUseDocument(): boolean {
  return typeof document !== 'undefined';
}

function setAuthSessionCookie(): void {
  if (!canUseDocument()) {
    return;
  }

  document.cookie = `${AUTH_SESSION_COOKIE_KEY}=1; Path=/; Max-Age=${AUTH_SESSION_COOKIE_LIFETIME_SECONDS}; SameSite=Lax`;
}

function clearAuthSessionCookie(): void {
  if (!canUseDocument()) {
    return;
  }

  document.cookie = `${AUTH_SESSION_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readAuthSession(): StoredAuthSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const rawSession = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    const parsedSession = JSON.parse(rawSession) as StoredAuthSession;
    setAuthSessionCookie();

    return parsedSession;
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    clearAuthSessionCookie();

    return null;
  }
}

export function saveAuthSession(session: StoredAuthSession): void {
  if (canUseStorage()) {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  setAuthSessionCookie();
}

export function clearAuthSession(): void {
  if (canUseStorage()) {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  }

  clearAuthSessionCookie();
}
