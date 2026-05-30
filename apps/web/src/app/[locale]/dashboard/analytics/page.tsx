"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@torup/ui";
import { CalendarDays, CheckCircle2, UserX, TrendingDown, Banknote } from "lucide-react";

interface Analytics {
  period: string;
  total_appointments: number;
  completed_appointments: number;
  no_show_count: number;
  no_show_rate: string;
  estimated_revenue: number;
  busiest_hours: { hour: number; count: number }[];
  booking_sources: { whatsapp: number; web: number; manual: number };
}

export default function AnalyticsPage() {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { session } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [period, setPeriod] = useState("30d");
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch<{ id: string }>("/api/businesses/me", {}, session.access_token)
      .then((r) => { if (r.id) setBusinessId(r.id); })
      .catch(() => {});
  }, [session?.access_token]);

  useEffect(() => {
    if (!businessId || !session?.access_token) return;
    apiFetch<Analytics>(
      `/api/businesses/${businessId}/analytics?period=${period}`, {}, session.access_token
    )
      .then((r) => setAnalytics(r))
      .catch(() => {});
  }, [businessId, period, session?.access_token]);

  const statCards = analytics
    ? [
        { label: t("totalAppointments"), value: analytics.total_appointments, icon: CalendarDays, color: "text-blue-600" },
        { label: t("completed"), value: analytics.completed_appointments, icon: CheckCircle2, color: "text-green-600" },
        { label: t("noShows"), value: analytics.no_show_count, icon: UserX, color: "text-muted-foreground" },
        { label: t("noShowRate"), value: analytics.no_show_rate, icon: TrendingDown, color: "text-destructive" },
        { label: t("revenue"), value: `₪${analytics.estimated_revenue.toLocaleString()}`, icon: Banknote, color: "text-emerald-600" },
      ]
    : [];

  const maxBusiestCount = analytics?.busiest_hours?.length
    ? Math.max(...analytics.busiest_hours.map((h) => h.count))
    : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{tNav("analytics")}</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="7d">{t("days7")}</option>
          <option value="30d">{t("days30")}</option>
          <option value="90d">{t("days90")}</option>
        </select>
      </div>

      {!analytics ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {statCards.map((card) => (
              <Card key={card.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{card.label}</p>
                  </div>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {analytics.busiest_hours?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t("busiestHours")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-32">
                  {analytics.busiest_hours
                    .sort((a, b) => a.hour - b.hour)
                    .map((h) => (
                      <div key={h.hour} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-primary/60 rounded-t"
                          style={{ height: `${(h.count / maxBusiestCount) * 100}%`, minHeight: h.count > 0 ? "4px" : "0" }}
                        />
                        <span className="text-xs text-muted-foreground mt-1">{h.hour}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {analytics.booking_sources && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t("bookingSources")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(["whatsapp", "web", "manual"] as const).map((source) => {
                    const count = analytics.booking_sources[source] || 0;
                    const pct = analytics.total_appointments > 0
                      ? (count / analytics.total_appointments) * 100
                      : 0;
                    return (
                      <div key={source} className="flex items-center gap-3">
                        <span className="w-20 text-sm capitalize">{source}</span>
                        <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                          <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm text-muted-foreground w-12 text-end">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
