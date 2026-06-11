"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { AppointmentModal } from "./appointment-modal";
import { GCalConvertModal } from "./gcal-convert-modal";
import { MonthYearPicker } from "./month-year-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { calendarRowContainer, calendarRowItem } from "@/components/motion";
import { serviceColorStyle } from "./service-color";

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
  services?: { name_he: string; name_ar: string | null; name_en: string | null; duration_minutes?: number; price?: number; color?: string | null };
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

const HIDDEN_STATUSES = new Set(["cancelled", "no_show"]);
const isVisible = (a: Appointment) => !HIDDEN_STATUSES.has(a.status);

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const ROW_HEIGHT = 48; // px per hour (= 0.8px per minute)

type CalEvent = { kind: "apt"; apt: Appointment } | { kind: "gcal"; evt: { google_event_id: string; summary: string; start_time: string; end_time: string } };

interface EventLayout {
  event: CalEvent;
  col: number;
  totalCols: number;
  top: number;
  height: number;
}

function computeLayout(events: CalEvent[]): EventLayout[] {
  if (!events.length) return [];
  const getStart = (e: CalEvent) => new Date(e.kind === "apt" ? e.apt.start_time : e.evt.start_time).getTime();
  const getEnd   = (e: CalEvent) => new Date(e.kind === "apt" ? e.apt.end_time   : e.evt.end_time  ).getTime();
  const sorted = [...events].sort((a, b) => getStart(a) - getStart(b));
  const n = sorted.length;

  const colEnds: number[] = [];
  const cols: number[] = [];
  for (const ev of sorted) {
    const start = getStart(ev);
    let col = 0;
    while (col < colEnds.length && colEnds[col] > start) col++;
    cols.push(col);
    if (col === colEnds.length) colEnds.push(getEnd(ev));
    else colEnds[col] = getEnd(ev);
  }

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => { if (parent[x] !== x) parent[x] = find(parent[x]); return parent[x]; };
  const union = (x: number, y: number) => { parent[find(x)] = find(y); };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (getStart(sorted[i]) < getEnd(sorted[j]) && getEnd(sorted[i]) > getStart(sorted[j])) union(i, j);
    }
  }

  const compMaxCol: Record<number, number> = {};
  for (let i = 0; i < n; i++) {
    const root = find(i);
    compMaxCol[root] = Math.max(compMaxCol[root] ?? 0, cols[i]);
  }

  return sorted.map((event, i) => {
    const totalCols = (compMaxCol[find(i)] ?? 0) + 1;
    const startMin = (() => { const d = new Date(getStart(event)); return d.getHours() * 60 + d.getMinutes(); })();
    const endMin   = (() => { const d = new Date(getEnd(event));   return d.getHours() * 60 + d.getMinutes(); })();
    const top    = (startMin - HOURS[0] * 60) * (ROW_HEIGHT / 60);
    const height = Math.max(18, (endMin - startMin) * (ROW_HEIGHT / 60));
    return { event, col: cols[i], totalCols, top, height };
  });
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(12, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function WeeklyCalendar({ businessId, controlledDate }: { businessId: string; controlledDate?: string }) {
  const t = useTranslations("dashboard");
  const { session } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(controlledDate ? new Date(controlledDate + "T12:00:00") : new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [gcalEvents, setGcalEvents] = useState<{ google_event_id: string; summary: string; start_time: string; end_time: string; date: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedGcalEvent, setSelectedGcalEvent] = useState<{ google_event_id: string; summary: string; start_time: string; end_time: string } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [showGcal, setShowGcal] = useState(true);

  useEffect(() => {
    if (controlledDate) setWeekStart(getWeekStart(new Date(controlledDate + "T12:00:00")));
  }, [controlledDate]);

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

  const visibleAppointments = appointments.filter(isVisible);

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
        <MonthYearPicker
          value={weekDays[0]}
          onSelect={(d) => setWeekStart(getWeekStart(d))}
          trigger={
            <span className="block">
              <span className="text-sm font-semibold text-white hover:text-[#a78bfa] transition-colors">
                {weekLabel}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setWeekStart(getWeekStart(new Date()));
                }}
                disabled={isCurrentWeek}
                className={`text-xs transition-colors mt-0.5 block mx-auto ${isCurrentWeek ? "text-white/25 cursor-default" : "text-[#a78bfa] hover:text-white"}`}
              >
                {t("today")}
              </button>
            </span>
          }
        />
        <button
          onClick={() => changeWeek(1)}
          className="w-9 h-9 rounded-lg flex items-center justify-center border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {gcalEvents.length > 0 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setShowGcal((v) => !v)}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium border transition-colors ${
              showGcal
                ? "bg-white/10 border-white/20 text-white/70"
                : "bg-transparent border-white/10 text-white/30 hover:text-white/50"
            }`}
          >
            📅 Google Calendar
          </button>
        </div>
      )}

      {dropError && (
        <div className="mb-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center justify-between gap-2">
          <span>{dropError}</span>
          <button onClick={() => setDropError(null)} className="shrink-0 opacity-70 hover:opacity-100">×</button>
        </div>
      )}

      {/* Grid */}
      <div className="rounded-xl border border-white/8 overflow-auto" style={{ background: "rgba(255,255,255,0.02)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/30 text-sm">
            {t("loadingAppointments")}
          </div>
        ) : (
          <div className="min-w-[700px]">
            {/* Day headers row */}
            <div className="flex border-b border-white/7" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="w-14 shrink-0 border-e border-white/7" />
              {weekDays.map((day) => {
                const isToday = formatDate(day) === todayStr;
                return (
                  <div
                    key={day.toISOString()}
                    className="flex-1 border-e border-white/7 last:border-e-0 px-2 py-3 text-center"
                    style={isToday ? { background: "rgba(99,102,241,0.1)" } : {}}
                  >
                    <div className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? "text-[#a78bfa]" : "text-white/40"}`}>
                      {day.toLocaleDateString("he-IL", { weekday: "short" })}
                    </div>
                    <div className={`text-xl font-black mt-0.5 leading-none ${isToday ? "text-white" : "text-white/60"}`}>
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
                  </div>
                );
              })}
            </div>

            {/* Time grid + appointments */}
            <div className="flex">
              {/* Time labels column */}
              <div className="w-14 shrink-0 border-e border-white/5" style={{ background: "rgba(255,255,255,0.01)" }}>
                <motion.div variants={calendarRowContainer} initial="hidden" animate="show">
                  {HOURS.map((hour) => (
                    <motion.div
                      key={hour}
                      variants={calendarRowItem}
                      className="border-b border-white/5 last:border-b-0 text-end pe-3 flex items-start pt-2"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <span className="text-xs text-white/25 font-mono w-full text-end">
                        {String(hour).padStart(2, "0")}:00
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              {/* Day columns */}
              {weekDays.map((day) => {
                const isToday = formatDate(day) === todayStr;
                const dayStr = formatDate(day);
                const dayAppts = visibleAppointments.filter((a) => a.start_time.split("T")[0] === dayStr);
                const rawDayGcals = gcalEvents.filter((e) => e.date === dayStr);
                // Hide GCal events already captured as system appointments:
                // match if the event summary contains the customer's name or phone number.
                const dayGcals = rawDayGcals.filter(evt => {
                  const summary = (evt.summary || "").toLowerCase();
                  const summaryDigits = summary.replace(/\D/g, "");
                  return !appointments.some(apt => {
                    const name = (apt.customers?.name || "").trim().toLowerCase();
                    const phone = (apt.customers?.phone || "").replace(/\D/g, "");
                    return (name.length > 1 && summary.includes(name)) ||
                           (phone.length > 4 && summaryDigits.includes(phone));
                  });
                });

                return (
                  <div
                    key={day.toISOString()}
                    className="flex-1 border-e border-white/5 last:border-e-0 relative"
                    style={isToday ? { background: "rgba(99,102,241,0.03)" } : {}}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {/* Hour grid — visual only */}
                    {HOURS.map((hour) => {
                      const cellKey = `${dayStr}_${hour}`;
                      return (
                        <div
                          key={hour}
                          className={`border-b border-white/5 last:border-b-0 transition-colors ${dragOver === cellKey ? "bg-primary/10" : ""}`}
                          style={{ height: ROW_HEIGHT }}
                        />
                      );
                    })}

                    {/* Unified overlay — appointments + gcal side-by-side */}
                    {computeLayout([
                      ...dayAppts.map((apt): CalEvent => ({ kind: "apt", apt })),
                      ...(showGcal ? dayGcals.map((evt): CalEvent => ({ kind: "gcal", evt })) : []),
                    ]).map(({ event, col, totalCols, top, height }) => {
                      const posStyle: React.CSSProperties = {
                        position: "absolute",
                        top,
                        height,
                        left: `calc(${(col / totalCols) * 100}% + 1px)`,
                        width: `calc(${(1 / totalCols) * 100}% - 2px)`,
                        zIndex: 2,
                        pointerEvents: "auto",
                      };

                      if (event.kind === "gcal") {
                        const { evt } = event;
                        const time = new Date(evt.start_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
                        return (
                          <button
                            key={evt.google_event_id}
                            onClick={() => setSelectedGcalEvent(evt)}
                            style={posStyle}
                            className="rounded border-s-2 px-1.5 py-0.5 text-start text-xs overflow-hidden bg-white/5 border-white/20 text-white/50 hover:bg-white/8 hover:text-white/70 transition-all"
                          >
                            <div className="font-semibold truncate">📅 {evt.summary || "Google Calendar"}</div>
                            {height >= 36 && <div className="opacity-60 truncate text-[10px]">{time}</div>}
                          </button>
                        );
                      }

                      const { apt } = event;
                      const svcStyle = serviceColorStyle(apt.services?.color);
                      const sc = STATUS_COLORS[apt.status] ?? STATUS_COLORS.pending;
                      const time = new Date(apt.start_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
                      return (
                        <button
                          key={apt.id}
                          onClick={() => setSelectedAppointment(apt)}
                          draggable={!["completed", "cancelled", "no_show"].includes(apt.status)}
                          onDragStart={(e) => { e.dataTransfer.setData("appointmentId", apt.id); requestAnimationFrame(() => setDraggingId(apt.id)); }}
                          onDragEnd={() => setDraggingId(null)}
                          style={{
                            ...posStyle,
                            ...(svcStyle ? { background: svcStyle.background, borderLeftColor: svcStyle.borderLeftColor, color: svcStyle.color } : {}),
                          }}
                          className={`rounded border-s-2 px-1.5 py-0.5 text-start text-xs overflow-hidden hover:brightness-110 transition-all ${svcStyle ? "" : sc} ${draggingId === apt.id ? "opacity-50" : ""}`}
                        >
                          <div className="font-semibold truncate">{time} {apt.customers?.name || ""}</div>
                          {height >= 36 && apt.services?.name_he && (
                            <div className="opacity-70 truncate text-[10px]">{apt.services.name_he}</div>
                          )}
                          {apt.notes && height >= 54 && <span className="opacity-50 ms-1" title={apt.notes}>📝</span>}
                        </button>
                      );
                    })}

                    {/* Transparent drag-target — only present during drag, sits above everything */}
                    {draggingId && (
                      <div
                        className="absolute inset-0"
                        style={{ zIndex: 50 }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const idx = Math.floor((e.clientY - rect.top) / ROW_HEIGHT);
                          const hour = HOURS[Math.max(0, Math.min(idx, HOURS.length - 1))];
                          setDragOver(`${dayStr}_${hour}`);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                        }}
                        onDrop={async (e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const idx = Math.floor((e.clientY - rect.top) / ROW_HEIGHT);
                          const hour = HOURS[Math.max(0, Math.min(idx, HOURS.length - 1))];
                          setDragOver(null);
                          const appointmentId = e.dataTransfer.getData("appointmentId");
                          if (!appointmentId || !session?.access_token) return;
                          const apt = appointments.find((a) => a.id === appointmentId);
                          const newStart = new Date(`${dayStr}T${String(hour).padStart(2, "0")}:00:00`);
                          if (apt) {
                            const current = new Date(apt.start_time);
                            if (formatDate(current) === dayStr && current.getHours() === hour) return;
                          }
                          setDropError(null);
                          try {
                            await apiFetch(
                              `/api/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
                              { method: "PATCH", body: JSON.stringify({ start_time: newStart.toISOString() }) },
                              session.access_token
                            );
                            fetchWeekAppointments();
                          } catch (err) {
                            console.error("Reschedule failed:", err);
                            setDropError(err instanceof Error ? err.message : t("rescheduleFailed"));
                          }
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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
