"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { AppointmentModal } from "./appointment-modal";
import { GCalConvertModal } from "./gcal-convert-modal";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { calendarRowContainer, calendarRowItem } from "@/components/motion";

interface Appointment {
  id: string;
  service_id: string;
  customer_id: string;
  staff_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  created_via: string;
  customers?: { name: string; phone: string };
  services?: { name_he: string; name_ar: string | null; name_en: string | null; duration_minutes?: number; price?: number };
}

const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-orange-500/15 border-orange-400/60 text-orange-300",
  pending:          "bg-yellow-500/15 border-yellow-400/60 text-yellow-300",
  confirmed:        "bg-indigo-500/15 border-indigo-400/60 text-indigo-300",
  in_progress:      "bg-violet-500/15 border-violet-400/60 text-violet-300",
  completed:        "bg-emerald-500/15 border-emerald-400/60 text-emerald-300",
  cancelled:        "bg-white/5 border-white/10 text-white/30",
  no_show:          "bg-red-500/15 border-red-400/60 text-red-300",
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(12, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function WeeklyCalendar({ businessId }: { businessId: string }) {
  const t = useTranslations("dashboard");
  const { session } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [gcalEvents, setGcalEvents] = useState<{ google_event_id: string; summary: string; start_time: string; end_time: string; date: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedGcalEvent, setSelectedGcalEvent] = useState<{ google_event_id: string; summary: string; start_time: string; end_time: string } | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const fetchWeekAppointments = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const allAppts: Appointment[] = [];
      const allGcal: typeof gcalEvents = [];
      await Promise.all(
        weekDays.map((day) => {
          const dateStr = formatDate(day);
          return Promise.all([
            apiFetch<Appointment[]>(`/api/businesses/${businessId}/appointments?date=${dateStr}`, {}, session.access_token)
              .then((r) => { if (Array.isArray(r)) allAppts.push(...r); }).catch(() => {}),
            apiFetch<{ google_event_id: string; summary: string; start_time: string; end_time: string }[]>(
              `/api/businesses/${businessId}/google-calendar/events?date=${dateStr}`, {}, session.access_token
            ).then((r) => { if (Array.isArray(r)) allGcal.push(...r.map((e) => ({ ...e, date: dateStr }))); }).catch(() => {}),
          ]);
        })
      );
      setAppointments(allAppts);
      setGcalEvents(allGcal);
    } finally {
      setLoading(false);
    }
  }, [businessId, weekStart.toISOString(), session?.access_token]);

  useEffect(() => { fetchWeekAppointments(); }, [fetchWeekAppointments]);

  const changeWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  };

  const getAppointmentsForDayHour = (day: Date, hour: number) => {
    const dayStr = formatDate(day);
    return appointments.filter((apt) =>
      apt.start_time.split("T")[0] === dayStr && new Date(apt.start_time).getHours() === hour
    );
  };

  const getGcalEventsForDayHour = (day: Date, hour: number) => {
    const dayStr = formatDate(day);
    return gcalEvents.filter((e) => e.date === dayStr && new Date(e.start_time).getHours() === hour);
  };

  const todayStr = formatDate(new Date());
  const weekLabel = `${weekDays[0].toLocaleDateString("he-IL", { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" })}`;
  const isCurrentWeek = weekDays.some((d) => formatDate(d) === todayStr);

  return (
    <div>
      {/* Navigation — same as daily */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => changeWeek(-1)}
          className="w-9 h-9 rounded-lg flex items-center justify-center border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-white">{weekLabel}</p>
          <button
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            disabled={isCurrentWeek}
            className={`text-xs transition-colors mt-0.5 ${isCurrentWeek ? "text-white/25 cursor-default" : "text-[#a78bfa] hover:text-white"}`}
          >
            {t("today")}
          </button>
        </div>
        <button
          onClick={() => changeWeek(1)}
          className="w-9 h-9 rounded-lg flex items-center justify-center border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="rounded-xl border border-white/8 overflow-auto" style={{ background: "rgba(255,255,255,0.02)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/30 text-sm">
            {t("loadingAppointments")}
          </div>
        ) : (
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr>
                {/* Time column header */}
                <th className="w-14 border-b border-e border-white/7 p-0" style={{ background: "rgba(255,255,255,0.03)" }} />
                {weekDays.map((day) => {
                  const isToday = formatDate(day) === todayStr;
                  return (
                    <th
                      key={day.toISOString()}
                      className="border-b border-e border-white/7 last:border-e-0 px-2 py-3 text-center"
                      style={isToday
                        ? { background: "rgba(99,102,241,0.1)" }
                        : { background: "rgba(255,255,255,0.03)" }
                      }
                    >
                      <div className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? "text-[#a78bfa]" : "text-white/40"}`}>
                        {day.toLocaleDateString("he-IL", { weekday: "short" })}
                      </div>
                      <div
                        className={`text-xl font-black mt-0.5 leading-none ${isToday ? "text-white" : "text-white/60"}`}
                      >
                        {isToday ? (
                          <span
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-black"
                            style={{ background: "var(--grad-primary)" }}
                          >
                            {day.getDate()}
                          </span>
                        ) : (
                          day.getDate()
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <motion.tbody variants={calendarRowContainer} initial="hidden" animate="show">
              {HOURS.map((hour) => (
                <motion.tr key={hour} variants={calendarRowItem} className="group">
                  {/* Time label */}
                  <td
                    className="border-b border-e border-white/5 p-0 text-end align-top"
                    style={{ background: "rgba(255,255,255,0.01)" }}
                  >
                    <span className="block py-2 pe-3 text-xs text-white/25 font-mono">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  </td>
                  {weekDays.map((day) => {
                    const isToday = formatDate(day) === todayStr;
                    const appts = getAppointmentsForDayHour(day, hour);
                    const gcals = getGcalEventsForDayHour(day, hour);
                    return (
                      <td
                        key={day.toISOString()}
                        className="border-b border-e border-white/5 last:border-e-0 p-0.5 align-top"
                        style={isToday ? { background: "rgba(99,102,241,0.03)" } : {}}
                      >
                        <div className="min-h-[44px] space-y-0.5 p-0.5">
                          {gcals.map((evt) => {
                            const time = new Date(evt.start_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
                            return (
                              <button
                                key={evt.google_event_id}
                                onClick={() => setSelectedGcalEvent(evt)}
                                className="w-full rounded border-s-2 px-1.5 py-1 text-xs truncate bg-white/5 border-white/20 text-white/45 hover:bg-white/8 hover:text-white/65 transition-all text-start"
                              >
                                📅 {time}
                              </button>
                            );
                          })}
                          {appts.map((apt) => {
                            const sc = STATUS_COLORS[apt.status] ?? STATUS_COLORS.pending;
                            const time = new Date(apt.start_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
                            return (
                              <button
                                key={apt.id}
                                onClick={() => setSelectedAppointment(apt)}
                                className={`w-full rounded border-s-2 px-1.5 py-1 text-start text-xs truncate hover:brightness-110 transition-all ${sc}`}
                              >
                                <span className="font-semibold">{time}</span>
                                {" "}
                                <span className="opacity-80">{apt.customers?.name || ""}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        )}
      </div>

      {selectedGcalEvent && (
        <GCalConvertModal
          event={selectedGcalEvent}
          businessId={businessId}
          token={session?.access_token || ""}
          onClose={() => setSelectedGcalEvent(null)}
          onCreated={fetchWeekAppointments}
        />
      )}
      {selectedAppointment && (
        <AppointmentModal
          appointment={selectedAppointment}
          businessId={businessId}
          token={session?.access_token || ""}
          onClose={() => setSelectedAppointment(null)}
          onUpdate={fetchWeekAppointments}
        />
      )}
    </div>
  );
}
