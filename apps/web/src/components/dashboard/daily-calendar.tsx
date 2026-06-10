"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";
import { AppointmentModal } from "./appointment-modal";
import { GCalConvertModal } from "./gcal-convert-modal";
import { MonthYearPicker } from "./month-year-picker";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
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

const ROW_HEIGHT = 60; // px per hour (= 1px per minute)

type CalEvent = { kind: "apt"; apt: Appointment } | { kind: "gcal"; evt: { google_event_id: string; summary: string; start_time: string; end_time: string } };

interface EventLayout {
  event: CalEvent;
  col: number;
  totalCols: number;
  top: number;
  height: number;
}

function computeLayout(events: CalEvent[], firstHour: number, rowHeight: number): EventLayout[] {
  if (!events.length) return [];
  const sorted = [...events].sort(
    (a, b) => new Date(a.kind === "apt" ? a.apt.start_time : a.evt.start_time).getTime()
            - new Date(b.kind === "apt" ? b.apt.start_time : b.evt.start_time).getTime()
  );
  const getStart = (e: CalEvent) => new Date(e.kind === "apt" ? e.apt.start_time : e.evt.start_time).getTime();
  const getEnd   = (e: CalEvent) => new Date(e.kind === "apt" ? e.apt.end_time   : e.evt.end_time  ).getTime();
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
    const top    = (startMin - firstHour * 60) * (rowHeight / 60);
    const height = Math.max(24, (endMin - startMin) * (rowHeight / 60));
    return { event, col: cols[i], totalCols, top, height };
  });
}

function computeHours(
  appointments: Appointment[],
  gcalEvents: { start_time: string; end_time: string }[],
  workingHours: { start_time: string; end_time: string; is_closed: boolean }[],
  dayOfWeek: number
): number[] {
  const dayWh = workingHours.find((wh) => (wh as unknown as { day_of_week: number }).day_of_week === dayOfWeek);
  let startHour = 7;
  let endHour = 20;
  if (dayWh && !dayWh.is_closed) {
    startHour = Math.min(startHour, parseInt(dayWh.start_time.split(":")[0], 10));
    endHour = Math.max(endHour, parseInt(dayWh.end_time.split(":")[0], 10));
  }
  for (const apt of appointments) {
    startHour = Math.min(startHour, new Date(apt.start_time).getHours());
    endHour = Math.max(endHour, new Date(apt.end_time).getHours() + 1);
  }
  for (const evt of gcalEvents) {
    startHour = Math.min(startHour, new Date(evt.start_time).getHours());
    endHour = Math.max(endHour, new Date(evt.end_time).getHours() + 1);
  }
  endHour = Math.min(endHour, 24);
  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) hours.push(h);
  return hours;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function DailyCalendar({ businessId, controlledDate }: { businessId: string; controlledDate?: string }) {
  const t = useTranslations("dashboard");
  const tStatus = useTranslations("appointments");
  const { session } = useAuth();
  const [date, setDate] = useState(() => controlledDate ?? formatDate(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [gcalEvents, setGcalEvents] = useState<{ google_event_id: string; summary: string; start_time: string; end_time: string }[]>([]);
  const [workingHours, setWorkingHours] = useState<{ day_of_week: number; start_time: string; end_time: string; is_closed: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedGcalEvent, setSelectedGcalEvent] = useState<{ google_event_id: string; summary: string; start_time: string; end_time: string } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [showGcal, setShowGcal] = useState(true);

  useEffect(() => {
    if (controlledDate) setDate(controlledDate);
  }, [controlledDate]);

  const fetchAppointments = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const [result, gcal] = await Promise.all([
        apiFetch<Appointment[]>(`/api/businesses/${businessId}/appointments?date=${date}`, {}, session.access_token),
        apiFetch<{ google_event_id: string; summary: string; start_time: string; end_time: string }[]>(
          `/api/businesses/${businessId}/google-calendar/events?date=${date}`, {}, session.access_token
        ).catch(() => []),
      ]);
      setAppointments(Array.isArray(result) ? result : []);
      setGcalEvents(Array.isArray(gcal) ? gcal : []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, date, session?.access_token]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch<{ day_of_week: number; start_time: string; end_time: string; is_closed: boolean }[]>(
      `/api/businesses/${businessId}/working-hours`, {}, session.access_token
    ).then((r) => { if (Array.isArray(r)) setWorkingHours(r); }).catch(() => {});
  }, [businessId, session?.access_token]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`appointments-${businessId}-${date}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `business_id=eq.${businessId}` }, () => fetchAppointments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [businessId, date, fetchAppointments]);

  const changeDate = (delta: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setDate(formatDate(d));
  };

  const isToday = date === formatDate(new Date());
  const dateObj = new Date(date + "T12:00:00");
  const dayLabel = dateObj.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hours = computeHours(appointments, gcalEvents, workingHours, dateObj.getDay());
  const visibleAppointments = appointments.filter(isVisible);

  // Hide GCal events already captured as system appointments:
  // match if the event summary contains the customer's name or phone number.
  const deduplicatedGcalEvents = gcalEvents.filter(evt => {
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
    <div>
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => changeDate(-1)}
          className="w-9 h-9 rounded-lg flex items-center justify-center border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <MonthYearPicker
          value={dateObj}
          onSelect={(d) => setDate(formatDate(d))}
          trigger={
            <span className="block">
              <span className="text-sm font-semibold text-white hover:text-[#a78bfa] transition-colors">
                {dayLabel}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDate(formatDate(new Date()));
                }}
                disabled={isToday}
                className={`text-xs transition-colors mt-0.5 block mx-auto ${isToday ? "text-white/25 cursor-default" : "text-[#a78bfa] hover:text-white"}`}
              >
                {t("today")}
              </button>
            </span>
          }
        />
        <button
          onClick={() => changeDate(1)}
          className="w-9 h-9 rounded-lg flex items-center justify-center border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {dropError && (
        <div className="mb-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center justify-between gap-2">
          <span>{dropError}</span>
          <button onClick={() => setDropError(null)} className="shrink-0 opacity-70 hover:opacity-100">×</button>
        </div>
      )}

      {/* Calendar grid */}
      <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
        {/* Day header */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b border-white/7"
          style={isToday ? { background: "rgba(99,102,241,0.08)" } : {}}
        >
          <CalendarDays className="h-4 w-4 text-white/30" />
          <span className={`text-xs font-semibold ${isToday ? "text-[#a78bfa]" : "text-white/40"}`}>
            {isToday ? t("today") : dateObj.toLocaleDateString("he-IL", { weekday: "long" })}
          </span>
          <div className="ms-auto flex items-center gap-2">
            {deduplicatedGcalEvents.length > 0 && (
              <button
                onClick={() => setShowGcal((v) => !v)}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border transition-colors ${
                  showGcal
                    ? "bg-white/10 border-white/20 text-white/70"
                    : "bg-transparent border-white/10 text-white/30 hover:text-white/50"
                }`}
              >
                📅 Google
              </button>
            )}
            <span className="text-xs text-white/25">{visibleAppointments.length} {t("appointmentsCount")}</span>
          </div>
        </div>

        {loading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex border-b border-white/5 animate-pulse">
                <div className="w-14 shrink-0 border-e border-white/5 py-3" />
                <div className="flex-1 min-h-[56px] py-2 px-3">
                  {i % 3 === 0 && <div className="h-8 rounded-lg bg-white/5 w-3/4" />}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ position: "relative" }} onDragOver={(e) => e.preventDefault()}>
            {/* Hour grid rows — drop zones only, no appointment rendering */}
            <motion.div variants={calendarRowContainer} initial="hidden" animate="show">
              {hours.map((hour) => {
                const hasItems = visibleAppointments.some((a) => new Date(a.start_time).getHours() === hour)
                  || (showGcal && deduplicatedGcalEvents.some((e) => new Date(e.start_time).getHours() === hour));
                return (
                  <motion.div
                    key={hour}
                    variants={calendarRowItem}
                    className={`flex border-b border-white/5 last:border-b-0 ${hasItems ? "bg-white/[0.015]" : ""}`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div className="w-14 shrink-0 border-e border-white/5 py-3 pe-3 text-end text-xs text-white/25 font-mono">
                      {String(hour).padStart(2, "0")}:00
                    </div>
                    <div
                      className={`flex-1 transition-colors ${dragOver === hour ? "bg-primary/10" : ""}`}
                      style={{ height: ROW_HEIGHT }}
                    />
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Unified overlay — appointments + gcal events, absolutely positioned, side-by-side */}
            <div className="absolute inset-0 flex" style={{ pointerEvents: "none" }}>
              <div className="w-14 shrink-0" />
              <div className="flex-1 relative">
                {computeLayout(
                  [
                    ...visibleAppointments.map((apt): CalEvent => ({ kind: "apt", apt })),
                    ...(showGcal ? deduplicatedGcalEvents.map((evt): CalEvent => ({ kind: "gcal", evt })) : []),
                  ],
                  hours[0],
                  ROW_HEIGHT
                ).map(({ event, col, totalCols, top, height }) => {
                  const posStyle: React.CSSProperties = {
                    position: "absolute",
                    top,
                    height,
                    left: `calc(${(col / totalCols) * 100}% + 2px)`,
                    width: `calc(${(1 / totalCols) * 100}% - 4px)`,
                    pointerEvents: "auto",
                  };

                  if (event.kind === "gcal") {
                    const { evt } = event;
                    const st = new Date(evt.start_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
                    const et = new Date(evt.end_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
                    return (
                      <button
                        key={evt.google_event_id}
                        onClick={() => setSelectedGcalEvent(evt)}
                        style={posStyle}
                        className="rounded-lg border-s-[3px] px-3 py-1.5 text-start text-xs font-medium bg-white/5 border-white/20 text-white/50 hover:bg-white/8 hover:text-white/70 transition-all overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold truncate">📅 {evt.summary || "Google Calendar"}</span>
                          <span className="shrink-0 opacity-70">{st}–{et}</span>
                        </div>
                      </button>
                    );
                  }

                  const { apt } = event;
                  const svcStyle = serviceColorStyle(apt.services?.color);
                  const sc = STATUS_COLORS[apt.status] ?? STATUS_COLORS.pending;
                  const st = new Date(apt.start_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
                  const et = new Date(apt.end_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
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
                      className={`rounded-lg border-s-[3px] px-3 py-1.5 text-start text-xs font-medium hover:brightness-110 transition-all overflow-hidden ${svcStyle ? "" : sc} ${draggingId === apt.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{apt.customers?.name || t("unknownCustomer")}</span>
                        <span className="shrink-0 opacity-70">{st}–{et}</span>
                      </div>
                      {height >= 40 && (
                        <div className="opacity-60 truncate mt-0.5">
                          {apt.services?.name_he || ""}
                          {apt.services?.name_he ? " · " : ""}
                          {tStatus(apt.status === "in_progress" ? "inProgress" : apt.status === "no_show" ? "noShow" : apt.status === "pending_approval" ? "pendingApproval" : apt.status)}
                        </div>
                      )}
                      {apt.notes && height >= 56 && (
                        <div className="opacity-50 truncate mt-0.5 italic">📝 {apt.notes}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transparent drag-target — only present during a drag, sits above everything,
                has no children so dragover/drop always fire here directly */}
            {draggingId && (
              <div
                className="absolute inset-0"
                style={{ zIndex: 50 }}
                onDragOver={(e) => {
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const idx = Math.floor((e.clientY - rect.top) / ROW_HEIGHT);
                  setDragOver(hours[Math.max(0, Math.min(idx, hours.length - 1))]);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const idx = Math.floor((e.clientY - rect.top) / ROW_HEIGHT);
                  const hour = hours[Math.max(0, Math.min(idx, hours.length - 1))];
                  setDragOver(null);
                  const appointmentId = e.dataTransfer.getData("appointmentId");
                  if (!appointmentId || !session?.access_token) return;
                  const apt = appointments.find((a) => a.id === appointmentId);
                  const newStart = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`);
                  if (apt) {
                    const current = new Date(apt.start_time);
                    if (formatDate(current) === date && current.getHours() === hour) return;
                  }
                  setDropError(null);
                  try {
                    await apiFetch(
                      `/api/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
                      { method: "PATCH", body: JSON.stringify({ start_time: newStart.toISOString() }) },
                      session.access_token
                    );
                    fetchAppointments();
                  } catch (err) {
                    console.error("Reschedule failed:", err);
                    setDropError(err instanceof Error ? err.message : t("rescheduleFailed"));
                  }
                }}
              />
            )}
          </div>
        )}
      </div>

      {selectedGcalEvent && (
        <GCalConvertModal
          event={selectedGcalEvent}
          businessId={businessId}
          token={session?.access_token || ""}
          onClose={() => setSelectedGcalEvent(null)}
          onCreated={fetchAppointments}
        />
      )}
      {selectedAppointment && (
        <AppointmentModal
          appointment={selectedAppointment}
          businessId={businessId}
          token={session?.access_token || ""}
          onClose={() => setSelectedAppointment(null)}
          onUpdate={fetchAppointments}
        />
      )}
    </div>
  );
}
