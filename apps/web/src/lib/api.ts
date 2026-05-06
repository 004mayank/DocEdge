import axios from 'axios';

// Prefer same-origin proxy (works in Docker + local dev without env juggling).
// If you *do* set NEXT_PUBLIC_API_BASE_URL, it will override this.
const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

// For realtime connections (Socket.IO/WebSocket) we need an absolute origin.
// If baseURL is '/api', use same-origin.
export function getApiOrigin() {
  if (typeof window === 'undefined') {
    // Best effort for server-side usage; clients should pass NEXT_PUBLIC_API_BASE_URL.
    return process.env.NEXT_PUBLIC_API_BASE_URL || '';
  }
  if (baseURL.startsWith('http://') || baseURL.startsWith('https://')) return baseURL;
  return window.location.origin;
}

export const api = axios.create({
  baseURL,
});

// Auto-redirect to /login on 401 so stale tokens never show as raw error messages
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('docedge_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}
