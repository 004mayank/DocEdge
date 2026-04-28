'use client';

import { setAuthToken } from './api';

const KEY = 'docedge_token';

export function loadToken(): string | null {
  if (typeof window === 'undefined') return null;
  const t = window.localStorage.getItem(KEY);
  setAuthToken(t);
  return t;
}

export function saveToken(token: string) {
  window.localStorage.setItem(KEY, token);
  setAuthToken(token);
}

export function clearToken() {
  window.localStorage.removeItem(KEY);
  setAuthToken(null);
}
