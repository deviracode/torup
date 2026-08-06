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
}

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

  return (
    <BusinessContext.Provider value={{ businessId, hasNoBusiness, loading, businesses, switchBusiness }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used within BusinessProvider");
  return ctx;
}
