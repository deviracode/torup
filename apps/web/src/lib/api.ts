import { createClient } from "@/lib/supabase-browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function doFetch(path: string, options: RequestInit, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

let refreshInFlight: Promise<string | null> | null = null;
let refreshFailedAt = 0;
const REFRESH_COOLDOWN_MS = 10_000;

// Coalesce concurrent refresh attempts (multiple 401s can land at once) into one Supabase call,
// and back off for a bit after a failure so a dead session can't retry-storm the API.
function refreshAccessToken(): Promise<string | null> {
  if (Date.now() - refreshFailedAt < REFRESH_COOLDOWN_MS) {
    return Promise.resolve(null);
  }
  if (!refreshInFlight) {
    refreshInFlight = createClient()
      .auth.refreshSession()
      .then(({ data, error }) => {
        const newToken = error ? null : data.session?.access_token ?? null;
        if (!newToken) refreshFailedAt = Date.now();
        return newToken;
      })
      .catch(() => {
        refreshFailedAt = Date.now();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  let res = await doFetch(path, options, token);

  if (res.status === 401 && token) {
    const refreshedToken = await refreshAccessToken();
    // Only retry if refresh actually produced a *different* token — otherwise
    // we'd just hit the same 401 again (or worse, loop with other refresh callers).
    if (refreshedToken && refreshedToken !== token) {
      res = await doFetch(path, options, refreshedToken);
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
