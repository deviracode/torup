"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations, useLocale } from "next-intl";
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
import { DailyCalendar } from "@/components/dashboard/daily-calendar";
import { WeeklyCalendar } from "@/components/dashboard/weekly-calendar";
import { NewAppointmentForm } from "@/components/dashboard/new-appointment-form";
import { TopBarSlot } from "@/components/dashboard/top-bar-slot";
import { motion, useSpring, useTransform, useMotionValue, useReducedMotion, AnimatePresence } from "framer-motion";
import { staggerContainer, springItem } from "@/components/motion";
import { CalendarDays, Clock, CheckCircle2, AlertCircle, Plus, X, ChevronRight, User, Scissors } from "lucide-react";
import { toLocalDateString } from "@/lib/format";
import { PendingApprovalsPanel } from "@/components/dashboard/pending-approvals-panel";

interface DayStats {
  total: number;
  pending: number;
  completed: number;
  pendingApproval: number;
}

interface Appointment {
  id: string;
  status: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  customers?: { name: string; phone: string };
  services?: { name_he: string; name_en: string | null; duration_minutes?: number; price?: number };
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

const STATUS_LABELS: Record<string, { he: string; en: string; color: string }> = {
  pending_approval: { he: "ממתין לאישור", en: "Needs Approval", color: "text-orange-300 bg-orange-500/15 border-orange-400/40" },
  pending:          { he: "ממתין",        en: "Pending",        color: "text-yellow-300 bg-yellow-500/15 border-yellow-400/40" },
  confirmed:        { he: "מאושר",        en: "Confirmed",      color: "text-indigo-300 bg-indigo-500/15 border-indigo-400/40" },
  in_progress:      { he: "בטיפול",       en: "In Progress",    color: "text-violet-300 bg-violet-500/15 border-violet-400/40" },
  completed:        { he: "הושלם",        en: "Completed",      color: "text-emerald-300 bg-emerald-500/15 border-emerald-400/40" },
  cancelled:        { he: "בוטל",         en: "Cancelled",      color: "text-white/30 bg-white/5 border-white/10" },
  no_show:          { he: "לא הגיע",      en: "No Show",        color: "text-red-300 bg-red-500/15 border-red-400/40" },
};

type FilterKey = "total" | "pending" | "completed" | "pendingApproval";

const STAT_CONFIG = [
  {
    key: "total" as const,
    labelKey: "todayAppointments",
    icon: CalendarDays,
    gradient: "linear-gradient(135deg, #6366f1, #d4a24e)",
    drawerTitle: { he: "כל התורים להיום", en: "All Today's Appointments" },
    statusFilter: null as string[] | null,
  },
  {
    key: "pending" as const,
    labelKey: "pending",
    icon: Clock,
    gradient: "linear-gradient(135deg, #f59e0b, #f97316)",
    badgeKey: "pendingApproval" as const,
    drawerTitle: { he: "תורים פתוחים", en: "Open Appointments" },
    statusFilter: ["pending", "confirmed"],
  },
  {
    key: "completed" as const,
    labelKey: "completed",
    icon: CheckCircle2,
    gradient: "linear-gradient(135deg, #10b981, #06b6d4)",
    drawerTitle: { he: "תורים שהושלמו", en: "Completed Appointments" },
    statusFilter: ["completed"],
  },
  {
    key: "pendingApproval" as const,
    labelKey: "pendingApproval",
    icon: AlertCircle,
    gradient: "linear-gradient(135deg, #ef4444, #d4a24e)",
    drawerTitle: { he: "ממתינים לאישורך", en: "Awaiting Your Approval" },
    statusFilter: ["pending_approval"],
  },
];

// Slide-in drawer showing filtered appointments
function AppointmentDrawer({
  title,
  appointments,
  loading,
  onClose,
  isRtl,
  onApprove,
  onReject,
}: {
  title: string;
  appointments: Appointment[];
  loading: boolean;
  onClose: () => void;
  isRtl: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Drawer */}
      <motion.div
        initial={{ x: isRtl ? "-100%" : "100%" }}
        animate={{ x: 0 }}
        exit={{ x: isRtl ? "-100%" : "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute start-0 top-0 bottom-0 w-full max-w-md flex flex-col"
        style={{ background: "hsl(244 40% 10%)", borderInlineStart: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/7">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl bg-white/5 h-20" />
            ))
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-white/30">
              <CheckCircle2 className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">{isRtl ? "אין תורים" : "No appointments"}</p>
            </div>
          ) : (
            appointments.map((apt) => {
              const statusInfo = STATUS_LABELS[apt.status] ?? STATUS_LABELS.pending;
              const startDate = new Date(apt.start_time);
              const time = startDate.toLocaleTimeString(isRtl ? "he-IL" : "en-US", {
                hour: "2-digit", minute: "2-digit", hour12: false,
              });
              const endTime = new Date(apt.end_time).toLocaleTimeString(isRtl ? "he-IL" : "en-US", {
                hour: "2-digit", minute: "2-digit", hour12: false,
              });
              const dateLabel = startDate.toLocaleDateString(isRtl ? "he-IL" : "en-US", {
                weekday: "short", day: "numeric", month: "short",
              });
              const isPendingApproval = apt.status === "pending_approval";

              return (
                <motion.div
                  key={apt.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-4 border border-white/7"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: "var(--grad-primary)" }}>
                        {apt.customers?.name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{apt.customers?.name ?? "—"}</p>
                        <p className="text-xs text-white/40">{apt.customers?.phone ?? ""}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
                      {isRtl ? statusInfo.he : statusInfo.en}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-white/50 mb-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {dateLabel} · {time} – {endTime}
                    </span>
                    {apt.services && (
                      <span className="flex items-center gap-1">
                        <Scissors className="h-3 w-3" />
                        {isRtl ? apt.services.name_he : (apt.services.name_en ?? apt.services.name_he)}
                      </span>
                    )}
                  </div>

                  {apt.notes && (
                    <p className="text-xs text-white/35 border-t border-white/6 pt-2 mt-2 line-clamp-2">{apt.notes}</p>
                  )}

                  {isPendingApproval && onApprove && onReject && (
                    <div className="flex gap-2 mt-3 pt-2 border-t border-white/6">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => onApprove(apt.id)}
                        className="flex-1 rounded-lg py-1.5 text-xs font-bold text-white"
                        style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)" }}
                      >
                        {isRtl ? "אשר" : "Approve"}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => onReject(apt.id)}
                        className="flex-1 rounded-lg py-1.5 text-xs font-bold text-white border border-red-500/30 bg-red-500/10 text-red-300"
                      >
                        {isRtl ? "דחה" : "Reject"}
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const isRtl = locale === "he" || locale === "ar";
  const { businessId, hasNoBusiness, loading: bizLoading } = useBusiness();
  const api = useApi();
  const [view, setView] = useState<"day" | "week">("day");
  const [showNewAppt, setShowNewAppt] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<DayStats>({
    total: 0, pending: 0, completed: 0, pendingApproval: 0,
  });

  // Drawer state
  const [drawerFilter, setDrawerFilter] = useState<FilterKey | null>(null);
  const [drawerAppts, setDrawerAppts] = useState<Appointment[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [splitMode, setSplitMode] = useState(false);
  const [splitAppts, setSplitAppts] = useState<Appointment[]>([]);
  const [splitLoading, setSplitLoading] = useState(false);
  const [calendarDate, setCalendarDate] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!businessId) return;
    const today = toLocalDateString(new Date());

    // Today's total + completed (date-scoped)
    api<Array<{ status: string }>>(
      `/api/businesses/${businessId}/appointments?date=${today}`
    ).then((apts) => {
      if (Array.isArray(apts)) {
        setStats((prev) => ({
          ...prev,
          total: apts.length,
          completed: apts.filter((a) => a.status === "completed").length,
        }));
      }
    });

    // Pending = all future pending+confirmed (not just today)
    Promise.all([
      api<Array<{ id: string }>>(`/api/businesses/${businessId}/appointments?status=pending`),
      api<Array<{ id: string }>>(`/api/businesses/${businessId}/appointments?status=confirmed`),
    ]).then(([pending, confirmed]) => {
      setStats((prev) => ({ ...prev, pending: (pending?.length ?? 0) + (confirmed?.length ?? 0) }));
    });

    // Needs approval (all, not date-scoped)
    api<Array<{ id: string }>>(
      `/api/businesses/${businessId}/appointments?status=pending_approval`
    ).then((apts) => {
      if (Array.isArray(apts)) {
        setStats((prev) => ({ ...prev, pendingApproval: apts.length }));
      }
    });
  }, [businessId, refreshKey]);

  const openDrawer = async (filterKey: FilterKey) => {
    if (!businessId) return;
    setDrawerFilter(filterKey);
    setDrawerLoading(true);
    setDrawerAppts([]);

    const cfg = STAT_CONFIG.find((c) => c.key === filterKey)!;
    const today = toLocalDateString(new Date());

    if (cfg.statusFilter) {
      const results = await Promise.all(
        cfg.statusFilter.map((status) =>
          api<Appointment[]>(
            `/api/businesses/${businessId}/appointments?status=${status}`
          )
        )
      );
      setDrawerAppts(results.flat().filter((r): r is Appointment => r !== null).sort((a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ));
    } else {
      const r = await api<Appointment[]>(
        `/api/businesses/${businessId}/appointments?date=${today}`
      );
      setDrawerAppts(Array.isArray(r) ? r.sort((a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ) : []);
    }
    setDrawerLoading(false);
  };

  const openSplitMode = async () => {
    if (splitMode) return;
    if (!businessId) return;
    setSplitMode(true);
    setSplitLoading(true);
    setSplitAppts([]);
    const r = await api<Appointment[]>(
      `/api/businesses/${businessId}/appointments?status=pending_approval`
    );
    setSplitAppts(Array.isArray(r) ? r.sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    ) : []);
    setSplitLoading(false);
  };

  const handleApprove = async (id: string, date?: string) => {
    if (!businessId) return;
    await api(`/api/businesses/${businessId}/appointments/${id}/approve`, { method: "POST" });
    if (date) setCalendarDate(date);
    setSplitAppts((prev) => prev.filter((a) => a.id !== id));
    setDrawerAppts((prev) => prev.filter((a) => a.id !== id));
    setRefreshKey((k) => k + 1);
  };

  const handleReject = async (id: string) => {
    if (!businessId) return;
    await api(`/api/businesses/${businessId}/appointments/${id}/reject`, { method: "POST" });
    setSplitAppts((prev) => prev.filter((a) => a.id !== id));
    setDrawerAppts((prev) => prev.filter((a) => a.id !== id));
    setRefreshKey((k) => k + 1);
  };

  const activeDrawerCfg = STAT_CONFIG.find((c) => c.key === drawerFilter);

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

      {/* Stat Cards — clickable */}
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
              <motion.button
                key={cfg.key}
                variants={springItem}
                onClick={() => cfg.key === "pendingApproval" ? openSplitMode() : openDrawer(cfg.key)}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="rounded-xl p-4 border border-white/8 text-start group cursor-pointer transition-all"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center"
                    style={{ background: cfg.gradient }}
                  >
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <ChevronRight className={`h-3.5 w-3.5 text-white/20 group-hover:text-white/50 transition-colors mt-0.5 ${isRtl ? "rotate-180" : ""}`} />
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
              </motion.button>
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

      {/* Calendar / Split view */}
      {bizLoading || !businessId ? (
        bizLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-4 w-12 rounded bg-white/8" />
                <div className="h-10 flex-1 rounded-lg bg-white/8" />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/8 p-8 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
            <p className="text-white/60 text-sm mb-2">Your account is not connected to a business yet.</p>
            <a
              href="https://wa.me/972524433123?text=%D7%94%D7%99%D7%99%2C%20%D7%99%D7%A6%D7%A8%D7%AA%D7%99%20%D7%97%D7%A9%D7%91%D7%95%D7%9F%20%D7%91-TorUp%20%D7%95%D7%90%D7%A0%D7%99%20%D7%A8%D7%95%D7%A6%D7%94%20%D7%9C%D7%94%D7%AA%D7%97%D7%91%D7%A8%20%D7%9C%D7%A2%D7%A1%D7%A7%20%D7%A9%D7%9C%D7%99"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-bold text-white mt-3 hover:brightness-110"
              style={{ background: "#25D366" }}
            >
              Contact us on WhatsApp
            </a>
          </div>
        )
      ) : (
        splitMode ? (
          <div className="flex gap-4 items-start">
            <div className="flex-1 min-w-0">
              {view === "day" ? (
                <DailyCalendar key={`day-split-${refreshKey}`} businessId={businessId} controlledDate={calendarDate} />
              ) : (
                <WeeklyCalendar key={`week-split-${refreshKey}`} businessId={businessId} controlledDate={calendarDate} />
              )}
            </div>
            <PendingApprovalsPanel
              appointments={splitAppts}
              loading={splitLoading}
              isRtl={isRtl}
              onClose={() => { setSplitMode(false); setCalendarDate(undefined); }}
              onApprove={handleApprove}
              onReject={handleReject}
              onSelectDate={(date) => setCalendarDate(date)}
            />
          </div>
        ) : view === "day" ? (
          <DailyCalendar key={`day-${refreshKey}`} businessId={businessId} controlledDate={calendarDate} />
        ) : (
          <WeeklyCalendar key={`week-${refreshKey}`} businessId={businessId} />
        )
      )}

      {showNewAppt && businessId && (
        <NewAppointmentForm
          businessId={businessId}
          onClose={() => setShowNewAppt(false)}
          onCreated={(date) => { setCalendarDate(date); setRefreshKey((k) => k + 1); }}
        />
      )}

      {/* Mobile FAB — rendered via portal to escape Framer Motion transform context */}
      {businessId && typeof document !== "undefined" && createPortal(
        <button
          onClick={() => setShowNewAppt(true)}
          className="fixed bottom-6 end-6 z-[9999] flex md:hidden h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
          style={{ background: "var(--grad-primary)" }}
          aria-label={t("newAppointment")}
        >
          <Plus className="h-6 w-6" />
        </button>,
        document.body
      )}

      {/* Appointment drawer */}
      <AnimatePresence>
        {drawerFilter && activeDrawerCfg && (
          <AppointmentDrawer
            title={isRtl ? activeDrawerCfg.drawerTitle.he : activeDrawerCfg.drawerTitle.en}
            appointments={drawerAppts}
            loading={drawerLoading}
            onClose={() => setDrawerFilter(null)}
            isRtl={isRtl}
            onApprove={drawerFilter === "pendingApproval" ? handleApprove : undefined}
            onReject={drawerFilter === "pendingApproval" ? handleReject : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
