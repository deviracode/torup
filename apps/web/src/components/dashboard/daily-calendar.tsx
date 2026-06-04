"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";
import { AppointmentModal } from "./appointment-modal";
import { GCalConvertModal } from "./gcal-convert-modal";
import { Button, Badge } from "@torup/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
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
  cancelled:        "bg-white/5 border-white/15 text-white/30",
  no_show:          "bg-red-500/15 border-red-400/60 text-red-300",
};

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
    const aptStart = new Date(apt.start_time).getHours();
    const aptEnd = new Date(apt.end_time).getHours();
    startHour = Math.min(startHour, aptStart);
    endHour = Math.max(endHour, aptEnd + 1);
  }

  for (const evt of gcalEvents) {
    const evtStart = new Date(evt.start_time).getHours();
    const evtEnd = new Date(evt.end_time).getHours();
    startHour = Math.min(startHour, evtStart);
    endHour = Math.max(endHour, evtEnd + 1);
  }

  endHour = Math.min(endHour, 24);
  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) hours.push(h);
  return hours;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function DailyCalendar({ businessId }: { businessId: string }) {
  const t = useTranslations("dashboard");
  const tStatus = useTranslations("appointments");
  const { session } = useAuth();
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [gcalEvents, setGcalEvents] = useState<{ google_event_id: string; summary: string; start_time: string; end_time: string }[]>([]);
  const [workingHours, setWorkingHours] = useState<{ day_of_week: number; start_time: string; end_time: string; is_closed: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedGcalEvent, setSelectedGcalEvent] = useState<{ google_event_id: string; summary: string; start_time: string; end_time: string } | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const [result, gcal] = await Promise.all([
        apiFetch<Appointment[]>(
          `/api/businesses/${businessId}/appointments?date=${date}`,
          {},
          session.access_token
        ),
        apiFetch<{ google_event_id: string; summary: string; start_time: string; end_time: string }[]>(
          `/api/businesses/${businessId}/google-calendar/events?date=${date}`,
          {},
          session.access_token
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

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch<{ day_of_week: number; start_time: string; end_time: string; is_closed: boolean }[]>(
      `/api/businesses/${businessId}/working-hours`,
      {},
      session.access_token
    ).then((r) => { if (Array.isArray(r)) setWorkingHours(r); }).catch(() => {});
  }, [businessId, session?.access_token]);

  // Supabase realtime subscription for live updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`appointments-${businessId}-${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          // Refetch when any appointment changes
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, date, fetchAppointments]);

  const changeDate = (delta: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setDate(formatDate(d));
  };

  const dateObj = new Date(date + "T12:00:00");
  const dayOfWeek = dateObj.getDay();
  const dayLabel = dateObj.toLocaleDateString("he-IL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const hours = computeHours(appointments, gcalEvents, workingHours, dayOfWeek);

  const getAppointmentsForHour = (hour: number) => {
    return appointments.filter((apt) => new Date(apt.start_time).getHours() === hour);
  };

  const getGcalEventsForHour = (hour: number) => {
    return gcalEvents.filter((e) => new Date(e.start_time).getHours() === hour);
  };

  return (
    <div>
      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => changeDate(-1)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-semibold">{dayLabel}</h2>
          <button
            onClick={() => setDate(formatDate(new Date()))}
            className="text-xs text-primary hover:underline"
          >
            {t("today")}
          </button>
        </div>
        <button
          onClick={() => changeDate(1)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            {t("loadingAppointments")}
          </div>
        ) : (
          <motion.div className="divide-y divide-gray-100" variants={calendarRowContainer} initial="hidden" animate="show">
            {hours.map((hour) => {
              const hourAppts = getAppointmentsForHour(hour);
              return (
                <motion.div key={hour} variants={calendarRowItem} className="flex">
                  {/* Time label */}
                  <div className="w-16 shrink-0 border-e border-gray-100 py-3 pe-2 text-end text-xs text-gray-400">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {/* Slot area */}
                  <div className="flex-1 min-h-[60px] py-1 px-2 space-y-1">
                    {getGcalEventsForHour(hour).map((evt) => {
                      const startTime = new Date(evt.start_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
                      return (
                        <button
                          key={evt.google_event_id}
                          onClick={() => setSelectedGcalEvent(evt)}
                          className="w-full rounded-md border-s-4 px-3 py-1.5 text-start text-sm bg-gray-50 border-gray-400 text-gray-600 opacity-80 hover:opacity-100 hover:shadow-sm transition-opacity cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">📅 {evt.summary || "Google Calendar"}</span>
                            <span className="text-xs shrink-0">{startTime}</span>
                          </div>
                          <div className="text-xs opacity-75">לחץ להמיר לתור</div>
                        </button>
                      );
                    })}
                    {hourAppts.map((apt) => {
                      const statusClass = STATUS_COLORS[apt.status] || STATUS_COLORS.pending;
                      const startTime = new Date(apt.start_time).toLocaleTimeString("he-IL", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      });
                      return (
                        <button
                          key={apt.id}
                          onClick={() => setSelectedAppointment(apt)}
                          className={`w-full rounded-md border-s-4 px-3 py-1.5 text-start text-sm transition-shadow hover:shadow-md cursor-pointer ${statusClass}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">
                              {apt.customers?.name || t("unknownCustomer")}
                            </span>
                            <span className="text-xs shrink-0">{startTime}</span>
                          </div>
                          <div className="text-xs truncate opacity-75">
                            {apt.services?.name_he || ""} • {tStatus(apt.status === "in_progress" ? "inProgress" : apt.status === "no_show" ? "noShow" : apt.status === "pending_approval" ? "pendingApproval" : apt.status)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Appointment count */}
      <div className="mt-3 text-sm text-muted-foreground text-center">
        {appointments.length} {t("appointmentsCount")}
      </div>

      {/* Appointment Detail Modal */}
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
