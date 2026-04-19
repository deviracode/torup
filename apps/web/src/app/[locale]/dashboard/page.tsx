"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { DailyCalendar } from "@/components/dashboard/daily-calendar";
import { WeeklyCalendar } from "@/components/dashboard/weekly-calendar";
import { NewAppointmentForm } from "@/components/dashboard/new-appointment-form";
import { Card, CardContent, Button, Skeleton } from "@queue/ui";
import { CalendarDays, Clock, CheckCircle2, Plus } from "lucide-react";

interface DayStats {
  total: number;
  pending: number;
  completed: number;
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");
  const { session } = useAuth();
  const [view, setView] = useState<"day" | "week">("day");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<DayStats>({ total: 0, pending: 0, completed: 0 });

  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch<{ id: string }>(
      "/api/businesses/me",
      {},
      session.access_token
    )
      .then((r) => {
        if (r.id) setBusinessId(r.id);
      })
      .catch(() => {});
  }, [session?.access_token]);

  useEffect(() => {
    if (!businessId || !session?.access_token) return;
    const today = new Date().toISOString().split("T")[0];
    apiFetch<Array<{ status: string }>>(
      `/api/businesses/${businessId}/appointments?date=${today}`,
      {},
      session.access_token
    )
      .then((apts) => {
        if (Array.isArray(apts)) {
          setStats({
            total: apts.length,
            pending: apts.filter((a) => a.status === "pending" || a.status === "confirmed").length,
            completed: apts.filter((a) => a.status === "completed").length,
          });
        }
      })
      .catch(() => {});
  }, [businessId, session?.access_token, refreshKey]);

  const statCards = [
    { label: t("todayAppointments"), value: stats.total, icon: CalendarDays, color: "text-blue-600" },
    { label: t("pending"), value: stats.pending, icon: Clock, color: "text-yellow-600" },
    { label: t("completed"), value: stats.completed, icon: CheckCircle2, color: "text-green-600" },
  ];

  return (
    <div>
      {/* Stat Cards */}
      {businessId && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {statCards.map((s) => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-4 p-4">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{tNav("calendar")}</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setView("day")}
              className={`px-3 py-1.5 text-sm transition-colors ${
                view === "day" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("dayView")}
            </button>
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1.5 text-sm border-s transition-colors ${
                view === "week" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("weekView")}
            </button>
          </div>

          {businessId && (
            <Button onClick={() => setShowNewAppt(true)} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              {t("newAppointment")}
            </Button>
          )}
        </div>
      </div>

      {/* Calendar */}
      {!businessId ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 flex-1 rounded-md" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : view === "day" ? (
        <DailyCalendar key={`day-${refreshKey}`} businessId={businessId} />
      ) : (
        <WeeklyCalendar key={`week-${refreshKey}`} businessId={businessId} />
      )}

      {/* New Appointment Modal */}
      {showNewAppt && businessId && (
        <NewAppointmentForm
          businessId={businessId}
          onClose={() => setShowNewAppt(false)}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
