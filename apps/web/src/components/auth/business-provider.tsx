"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { apiFetch } from "@/lib/api";

interface BusinessContextType {
  businessId: string | null;
  hasNoBusiness: boolean;
  loading: boolean;
  businesses: Array<{ businessId: string; role: "owner" | "staff" }>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [hasNoBusiness, setHasNoBusiness] = useState(false);
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<BusinessContextType["businesses"]>([]);

  useEffect(() => {
    if (!session?.access_token) {
      setBusinessId(null);
      setHasNoBusiness(false);
      setBusinesses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    apiFetch<{ id: string; memberships?: Array<{ businessId: string; role: "owner" | "staff" }> }>(
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
  }, [session?.access_token]);

  return (
    <BusinessContext.Provider value={{ businessId, hasNoBusiness, loading, businesses }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used within BusinessProvider");
  return ctx;
}
