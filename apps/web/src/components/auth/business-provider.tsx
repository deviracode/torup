"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { apiFetch } from "@/lib/api";

interface BusinessContextType {
  businessId: string | null;
  hasNoBusiness: boolean;
  loading: boolean;
  businesses: Array<{ businessId: string; role: "owner" | "staff"; name: string }>;
  switchBusiness: (businessId: string) => void;
  impersonating: { id: string; name: string } | null;
  startImpersonation: (biz: { id: string; name: string }) => void;
  stopImpersonation: () => void;
}

const IMPERSONATE_KEY = "impersonate_business";

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [hasNoBusiness, setHasNoBusiness] = useState(false);
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<BusinessContextType["businesses"]>([]);

  // Keyed on user id, not the access token — background token refreshes swap the
  // token string on every renewal without changing who's signed in, and re-running
  // this fetch on each renewal (which can itself trigger a refresh on 401) creates
  // a self-sustaining refresh/fetch loop.
  const userId = session?.user?.id ?? null;

  const isSuperAdmin = session?.user?.user_metadata?.role === "super_admin";
  const [impersonating, setImpersonating] = useState<{ id: string; name: string } | null>(null);

  // Load persisted impersonation once auth resolves. Only super-admins may
  // impersonate; a tampering non-admin's injected key is ignored and cleared.
  // The backend independently 403s non-admins on any business-scoped call, so
  // this gate is UX-only defense-in-depth, not the security boundary.
  useEffect(() => {
    if (!userId) return;
    if (!isSuperAdmin) {
      window.localStorage.removeItem(IMPERSONATE_KEY);
      setImpersonating(null);
      return;
    }
    const raw = window.localStorage.getItem(IMPERSONATE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { id: string; name: string };
      if (typeof parsed.id === "string" && typeof parsed.name === "string") {
        setImpersonating({ id: parsed.id, name: parsed.name });
      } else {
        window.localStorage.removeItem(IMPERSONATE_KEY);
      }
    } catch {
      window.localStorage.removeItem(IMPERSONATE_KEY);
    }
  }, [userId, isSuperAdmin]);

  useEffect(() => {
    if (!userId || !session?.access_token) {
      setBusinessId(null);
      setHasNoBusiness(false);
      setBusinesses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    apiFetch<{ id: string; memberships?: Array<{ businessId: string; role: "owner" | "staff"; name: string }> }>(
      "/api/businesses/me", {}, session.access_token
    )
      .then((data) => {
        if (data?.id) {
          setBusinessId(data.id);
          setHasNoBusiness(false);
          setBusinesses(data.memberships || []);
        } else {
          setBusinessId(null);
          setHasNoBusiness(true);
          setBusinesses([]);
        }
      })
      .catch(() => {
        setBusinessId(null);
        setHasNoBusiness(true);
        setBusinesses([]);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const switchBusiness = useCallback((newBusinessId: string) => {
    if (businesses.some((b) => b.businessId === newBusinessId)) {
      setBusinessId(newBusinessId);
    }
  }, [businesses]);

  const startImpersonation = useCallback((biz: { id: string; name: string }) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(IMPERSONATE_KEY, JSON.stringify(biz));
    }
    setImpersonating(biz);
  }, []);

  const stopImpersonation = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(IMPERSONATE_KEY);
    }
    setImpersonating(null);
  }, []);

  const effectiveBusinessId = impersonating && isSuperAdmin ? impersonating.id : businessId;

  return (
    <BusinessContext.Provider
      value={{
        businessId: effectiveBusinessId,
        hasNoBusiness: impersonating && isSuperAdmin ? false : hasNoBusiness,
        loading,
        businesses,
        switchBusiness,
        impersonating: isSuperAdmin ? impersonating : null,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used within BusinessProvider");
  return ctx;
}
