"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "./api";
import { toast } from "sonner";

// GET memoization with a short grace window. React StrictMode (dev) double-runs
// effects, App Router soft-navigation can replay effects after the RSC payload
// resolves, and AnimatePresence page transitions can remount — all of which can
// re-request the same endpoint within a few hundred ms, sometimes AFTER the
// first fetch completed (so in-flight-only dedup misses it). Memoizing for
// GRACE_MS collapses those duplicates into one request. Mutations clear the
// memo, so refetches after a save/delete are always fresh.
const GRACE_MS = 750;
const memo = new Map<string, { promise: Promise<unknown>; expires: number }>();

export function useApi() {
  const { session, signOut } = useAuth();

  return async function api<T>(path: string, options?: RequestInit): Promise<T | null> {
    const method = options?.method ?? "GET";
    const key = `${method} ${path}`;

    if (method !== "GET") {
      memo.clear(); // mutations invalidate memoized GETs — never serve stale data
      return run();
    }

    const now = Date.now();
    const hit = memo.get(key);
    if (hit && hit.expires > now) return hit.promise as Promise<T | null>;

    const p = run();
    memo.set(key, { promise: p, expires: now + GRACE_MS });
    return p;

    async function run(): Promise<T | null> {
      try {
        // apiFetch already retries once after a silent token refresh on 401 —
        // reaching this catch with an auth error means the refresh failed too.
        return await apiFetch<T>(path, options, session?.access_token);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong";
        if (message.includes("401") || message.includes("Invalid or expired token")) {
          await signOut();
          return null;
        }
        toast.error(message);
        return null;
      }
    }
  };
}
