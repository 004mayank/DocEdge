import axios from 'axios';

// Prefer same-origin proxy (works in Docker + local dev without env juggling).
// If you *do* set NEXT_PUBLIC_API_BASE_URL, it will override this.
const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

export const api = axios.create({
  baseURL,
});

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}
