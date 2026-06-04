"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { DailyCalendar } from "@/components/dashboard/daily-calendar";
import { WeeklyCalendar } from "@/components/dashboard/weekly-calendar";
import { NewAppointmentForm } from "@/components/dashboard/new-appointment-form";
import { TopBarSlot } from "@/components/dashboard/top-bar-slot";
import { motion, useSpring, useTransform, useMotionValue, useReducedMotion } from "framer-motion";
import { staggerContainer, springItem } from "@/components/motion";
import { CalendarDays, Clock, CheckCircle2, AlertCircle, Plus } from "lucide-react";

interface DayStats {
  total: number;
  pending: number;
  completed: number;
  pendingApproval: number;
}

function AnimatedNumber({ value }: { value: number }) {
  const shouldReduce = useReducedMotion();
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v).toString());

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  if (shouldReduce) return <span>{value}</span>;
  return <motion.span>{display}</motion.span>;
}

const STAT_CONFIG = [
  {
    key: "total" as const,
    labelKey: "todayAppointments",
    icon: CalendarDays,
    gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  },
  {
    key: "pending" as const,
    labelKey: "pending",
    icon: Clock,
    gradient: "linear-gradient(135deg, #f59e0b, #f97316)",
    badgeKey: "pendingApproval" as const,
  },
  {
    key: "completed" as const,
    labelKey: "completed",
    icon: CheckCircle2,
    gradient: "linear-gradient(135deg, #10b981, #06b6d4)",
  },
  {
    key: "pendingApproval" as const,
    labelKey: "pendingApproval",
    icon: AlertCircle,
    gradient: "linear-gradient(135deg, #ef4444, #f472b6)",
  },
];

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { session } = useAuth();
  const [view, setView] = useState<"day" | "week">("day");
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<DayStats>({
    total: 0,
    pending: 0,
    completed: 0,
    pendingApproval: 0,
  });

  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch<{ id: string }>("/api/businesses/me", {}, session.access_token)
      .then((r) => { if (r.id) setBusinessId(r.id); })
      .catch(() => {});
  }, [session?.access_token]);

  useEffect(() => {
    if (!businessId || !session?.access_token) return;
    const today = new Date().toISOString().split("T")[0];

    apiFetch<Array<{ status: string }>>(
      `/api/businesses/${businessId}/appointments?date=${today}`,
      {},
      session.access_token
    ).then((apts) => {
      if (Array.isArray(apts)) {
        setStats((prev) => ({
          ...prev,
          total: apts.length,
          pending: apts.filter((a) => a.status === "pending" || a.status === "confirmed").length,
          completed: apts.filter((a) => a.status === "completed").length,
        }));
      }
    }).catch(() => {});

    apiFetch<Array<{ id: string }>>(
      `/api/businesses/${businessId}/appointments?status=pending_approval`,
      {},
      session.access_token
    ).then((apts) => {
      if (Array.isArray(apts)) {
        setStats((prev) => ({ ...prev, pendingApproval: apts.length }));
      }
    }).catch(() => {});
  }, [businessId, session?.access_token, refreshKey]);

  return (
    <div>
      {/* Inject "New Appointment" button into the top bar */}
      {businessId && (
        <TopBarSlot>
          <motion.button
            onClick={() => setShowNewAppt(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-bold text-white"
            style={{ background: "var(--grad-primary)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("newAppointment")}
          </motion.button>
        </TopBarSlot>
      )}

      {/* Stat Cards */}
      {businessId && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          {STAT_CONFIG.map((cfg) => {
            const Icon = cfg.icon;
            return (
              <motion.div
                key={cfg.key}
                variants={springItem}
                className="rounded-xl p-4 border border-white/8"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <div
                  className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center mb-3"
                  style={{ background: cfg.gradient }}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">
                    <AnimatedNumber value={stats[cfg.key]} />
                  </span>
                  {"badgeKey" in cfg && cfg.badgeKey && stats[cfg.badgeKey] > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {stats[cfg.badgeKey]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40 mt-0.5">{t(cfg.labelKey as any)}</p>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* View toggle */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex rounded-lg overflow-hidden border border-white/8">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === v ? "text-white" : "text-white/40 hover:text-white/70"
              }`}
              style={view === v ? { background: "var(--grad-primary)" } : { background: "transparent" }}
            >
              {v === "day" ? t("dayView") : t("weekView")}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar */}
      {!businessId ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-4 w-12 rounded bg-white/8" />
              <div className="h-10 flex-1 rounded-lg bg-white/8" />
            </div>
          ))}
        </div>
      ) : view === "day" ? (
        <DailyCalendar key={`day-${refreshKey}`} businessId={businessId} />
      ) : (
        <WeeklyCalendar key={`week-${refreshKey}`} businessId={businessId} />
      )}

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
