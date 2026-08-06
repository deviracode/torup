"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "./api";
import { toast } from "sonner";

export function useApi() {
  const { session, signOut } = useAuth();

  return async function api<T>(path: string, options?: RequestInit): Promise<T | null> {
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
  };
}
