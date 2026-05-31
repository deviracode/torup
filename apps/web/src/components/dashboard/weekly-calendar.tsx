"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { AppointmentModal } from "./appointment-modal";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  pending: "bg-yellow-100 border-yellow-400 text-yellow-800",
  confirmed: "bg-blue-100 border-blue-400 text-blue-800",
  in_progress: "bg-purple-100 border-purple-400 text-purple-800",
  completed: "bg-green-100 border-green-400 text-green-800",
  cancelled: "bg-gray-100 border-gray-300 text-gray-500",
  no_show: "bg-red-100 border-red-400 text-red-800",
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(12, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function WeeklyCalendar({ businessId }: { businessId: string }) {
  const t = useTranslations("dashboard");
  const tStatus = useTranslations("appointments");
  const { session } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [gcalEvents, setGcalEvents] = useState<{ google_event_id: string; summary: string; start_time: string; end_time: string; date: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

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
      const fetches = weekDays.map((day) => {
        const dateStr = formatDate(day);
        return Promise.all([
          apiFetch<Appointment[]>(
            `/api/businesses/${businessId}/appointments?date=${dateStr}`,
            {},
            session.access_token
          ).then((r) => { if (Array.isArray(r)) allAppts.push(...r); }).catch(() => {}),
          apiFetch<{ google_event_id: string; summary: string; start_time: string; end_time: string }[]>(
            `/api/businesses/${businessId}/google-calendar/events?date=${dateStr}`,
            {},
            session.access_token
          ).then((r) => { if (Array.isArray(r)) allGcal.push(...r.map((e) => ({ ...e, date: dateStr }))); }).catch(() => {}),
        ]);
      });
      await Promise.all(fetches);
      setAppointments(allAppts);
      setGcalEvents(allGcal);
    } finally {
      setLoading(false);
    }
  }, [businessId, weekStart.toISOString(), session?.access_token]);

  useEffect(() => {
    fetchWeekAppointments();
  }, [fetchWeekAppointments]);

  const changeWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  };

  const getAppointmentsForDayHour = (day: Date, hour: number) => {
    const dayStr = formatDate(day);
    return appointments.filter((apt) => {
      const aptDate = apt.start_time.split("T")[0];
      const aptHour = new Date(apt.start_time).getHours();
      return aptDate === dayStr && aptHour === hour;
    });
  };

  const getGcalEventsForDayHour = (day: Date, hour: number) => {
    const dayStr = formatDate(day);
    return gcalEvents.filter((e) => e.date === dayStr && new Date(e.start_time).getHours() === hour);
  };

  const weekLabel = `${weekDays[0].toLocaleDateString("he-IL", { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div>
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => changeWeek(-1)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="text-center">
          <h2 className="text-lg font-semibold">{weekLabel}</h2>
          <button
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            className="text-xs text-blue-600 hover:underline"
          >
            {t("today")}
          </button>
        </div>
        <button
          onClick={() => changeWeek(1)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Weekly Grid */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            {t("loadingAppointments")}
          </div>
        ) : (
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr>
                <th className="w-16 border-b border-e border-gray-200 p-2" />
                {weekDays.map((day) => {
                  const isToday = formatDate(day) === formatDate(new Date());
                  return (
                    <th
                      key={day.toISOString()}
                      className={`border-b border-e border-gray-200 p-2 text-center text-sm font-medium last:border-e-0 ${isToday ? "bg-blue-50 text-blue-700" : "text-gray-600"
                        }`}
                    >
                      <div>{day.toLocaleDateString("he-IL", { weekday: "short" })}</div>
                      <div className={`text-lg ${isToday ? "font-bold" : ""}`}>{day.getDate()}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour) => (
                <tr key={hour}>
                  <td className="border-b border-e border-gray-100 p-1 text-end text-xs text-gray-400 align-top pe-2">
                    {String(hour).padStart(2, "0")}:00
                  </td>
                  {weekDays.map((day) => {
                    const appts = getAppointmentsForDayHour(day, hour);
                    return (
                      <td
                        key={day.toISOString()}
                        className="border-b border-e border-gray-100 p-0.5 align-top last:border-e-0 min-h-[40px] h-[40px]"
                      >
                        {getGcalEventsForDayHour(day, hour).map((evt) => {
                            const time = new Date(evt.start_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
                            return (
                              <div
                                key={evt.google_event_id}
                                className="w-full rounded border-s-2 px-1 py-0.5 text-xs truncate mb-0.5 bg-gray-50 border-gray-400 text-gray-600"
                              >
                                📅 {time} {evt.summary || "Google Calendar"}
                              </div>
                            );
                          })}
                        {appts.map((apt) => {
                          const statusClass = STATUS_COLORS[apt.status] || "";
                          const time = new Date(apt.start_time).toLocaleTimeString("he-IL", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          });
                          return (
                            <button
                              key={apt.id}
                              onClick={() => setSelectedAppointment(apt)}
                              className={`w-full rounded border-s-2 px-1 py-0.5 text-start text-xs truncate mb-0.5 hover:shadow ${statusClass}`}
                            >
                              {time} {apt.customers?.name || ""}
                            </button>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
