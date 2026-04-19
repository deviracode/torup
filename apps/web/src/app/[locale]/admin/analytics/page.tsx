"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, Skeleton } from "@queue/ui";
import { Building2, CalendarDays, CreditCard } from "lucide-react";

interface PlatformAnalytics {
  total_businesses: number;
  total_appointments: number;
  active_subscriptions: number;
}

export default function AdminAnalyticsPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { session } = useAuth();
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch<PlatformAnalytics>("/api/admin/analytics", {}, session.access_token)
      .then(setAnalytics)
      .catch(() => {});
  }, [session?.access_token]);

  if (!analytics) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{t("analytics")}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { label: t("totalBusinesses"), value: analytics.total_businesses, icon: Building2, color: "text-blue-600" },
    { label: t("totalAppointments"), value: analytics.total_appointments, icon: CalendarDays, color: "text-green-600" },
    { label: t("activeSubscriptions"), value: analytics.active_subscriptions, icon: CreditCard, color: "text-purple-600" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("analytics")}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`h-5 w-5 ${card.color}`} />
                <p className="text-sm text-muted-foreground">{card.label}</p>
              </div>
              <p className={`text-4xl font-bold ${card.color}`}>{card.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
