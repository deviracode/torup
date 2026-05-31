"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, Button, Input, Label } from "@torup/ui";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

interface WorkingHour {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

interface Break {
  id: string;
  type: string;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  label: string | null;
}

interface BookingRules {
  min_advance_minutes: number;
  max_future_days: number;
  cancellation_window_minutes: number;
  reschedule_window_minutes: number;
}

interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  user?: { email: string; user_metadata?: { name?: string } };
}

interface ReminderSetting {
  id: string;
  minutes_before: number;
  is_active: boolean;
}

const REMINDER_PRESETS = [
  { minutes: 15, label: "15min" },
  { minutes: 30, label: "30min" },
  { minutes: 60, label: "1h" },
  { minutes: 120, label: "2h" },
  { minutes: 240, label: "4h" },
  { minutes: 720, label: "12h" },
  { minutes: 1440, label: "24h" },
  { minutes: 2880, label: "48h" },
];

interface BusinessProfile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

type Tab = "hours" | "breaks" | "reminders" | "rules" | "staff" | "profile" | "booking" | "gcal";

interface GCalStatus {
  connected: boolean;
  calendarId: string | null;
  syncEnabled: boolean;
  pushEnabled: boolean;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
}

interface GCalCalendar {
  id: string;
  summary: string;
  primary: boolean;
}

function SettingsPageInner() {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { session } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("hours");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Working Hours state
  const [hours, setHours] = useState<WorkingHour[]>([]);

  // Breaks state
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [newBreak, setNewBreak] = useState({ type: "recurring", day_of_week: 0, specific_date: "", start_time: "12:00", end_time: "13:00", label: "" });

  // Booking Rules state
  const [rules, setRules] = useState<BookingRules>({ min_advance_minutes: 60, max_future_days: 30, cancellation_window_minutes: 120, reschedule_window_minutes: 120 });

  // Staff state
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [newStaffEmail, setNewStaffEmail] = useState("");

  // Reminders state
  const [reminders, setReminders] = useState<ReminderSetting[]>([]);

  // Profile state
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  // Booking settings state
  const [allowMultipleBookings, setAllowMultipleBookings] = useState(false);

  // Google Calendar state
  const [gcalStatus, setGcalStatus] = useState<GCalStatus | null>(null);
  const [gcalCalendars, setGcalCalendars] = useState<GCalCalendar[]>([]);
  const [gcalAuthUrl, setGcalAuthUrl] = useState("");
  const [gcalConnecting, setGcalConnecting] = useState(false);
  const [gcalCode, setGcalCode] = useState("");
  const [gcalSyncResult, setGcalSyncResult] = useState<{ imported: number; deleted: number; error?: string } | null>(null);
  const fetchingRef = React.useRef(false);

  const searchParams = useSearchParams();

  const token = session?.access_token || "";

  // Auto-handle OAuth redirect: if ?code= is in the URL, connect and clean
  useEffect(() => {
    const code = searchParams.get("code");
    if (code && businessId && tab !== "gcal") {
      setTab("gcal");
    }
    if (code && businessId) {
      setGcalConnecting(true);
      apiFetch(`/api/businesses/${businessId}/google-calendar/connect`, {
        method: "POST",
        body: JSON.stringify({ code }),
      }, token)
        .then(() => {
          setGcalCode("");
          // Remove code from URL without full reload
          const url = new URL(window.location.href);
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          url.searchParams.delete("scope");
          window.history.replaceState({}, "", url.toString());
          // Refresh gcal tab
          if (tab === "gcal") fetchTab();
        })
        .catch(() => {})
        .finally(() => setGcalConnecting(false));
    }
  }, [searchParams, businessId, token]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ id: string }>("/api/businesses/me", {}, token)
      .then((r) => { if (r.id) setBusinessId(r.id); })
      .catch(() => {});
  }, [token]);

  const fetchTab = useCallback(async () => {
    if (!businessId || !token) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setMessage("");
    try {
      if (tab === "hours") {
        const r = await apiFetch<WorkingHour[]>(`/api/businesses/${businessId}/working-hours`, {}, token);
        setHours(Array.isArray(r) && r.length ? r : DAYS.map((_, i) => ({ day_of_week: i, start_time: "09:00", end_time: "18:00", is_closed: i === 6 })));
      } else if (tab === "breaks") {
        const r = await apiFetch<Break[]>(`/api/businesses/${businessId}/breaks`, {}, token);
        setBreaks(Array.isArray(r) ? r : []);
      } else if (tab === "reminders") {
        const r = await apiFetch<ReminderSetting[]>(`/api/businesses/${businessId}/reminder-settings`, {}, token);
        setReminders(Array.isArray(r) ? r : []);
      } else if (tab === "rules") {
        const r = await apiFetch<BookingRules>(`/api/businesses/${businessId}/booking-rules`, {}, token);
        if (r) setRules(r);
      } else if (tab === "staff") {
        const r = await apiFetch<StaffMember[]>(`/api/businesses/${businessId}/staff`, {}, token);
        setStaff(Array.isArray(r) ? r : []);
      } else if (tab === "profile") {
        const r = await apiFetch<BusinessProfile>(`/api/businesses/${businessId}`, {}, token);
        if (r) setProfile(r);
      } else if (tab === "booking") {
        const r = await apiFetch<{ allow_multiple_bookings: boolean }>(`/api/businesses/${businessId}`, {}, token);
        if (r) setAllowMultipleBookings(r.allow_multiple_bookings ?? false);
      } else if (tab === "gcal") {
        const status = await apiFetch<GCalStatus>(`/api/businesses/${businessId}/google-calendar/status`, {}, token);
        if (status) setGcalStatus(status);
        if (status?.connected) {
          const calRes = await apiFetch<{ calendars: GCalCalendar[] }>(`/api/businesses/${businessId}/google-calendar/calendars`, {}, token);
          if (calRes?.calendars) setGcalCalendars(calRes.calendars);
        }
      }
    } catch {
      // ignore
    } finally {
      fetchingRef.current = false;
    }
  }, [businessId, tab, token]);

  useEffect(() => {
    if (businessId) fetchTab();
  }, [businessId, fetchTab]);

  const showSaved = () => { setMessage(t("saved")); setTimeout(() => setMessage(""), 2000); };

  const saveHours = async () => {
    setSaving(true);
    try {
      const payload = hours.map((h) => ({
        day_of_week: h.day_of_week,
        start_time: h.start_time,
        end_time: h.end_time,
        is_closed: h.is_closed,
      }));
      await apiFetch(`/api/businesses/${businessId}/working-hours`, { method: "PUT", body: JSON.stringify(payload) }, token);
      showSaved();
    } catch {} finally { setSaving(false); }
  };

  const addBreak = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/businesses/${businessId}/breaks`, {
        method: "POST",
        body: JSON.stringify({
          type: newBreak.type,
          day_of_week: newBreak.type === "recurring" ? newBreak.day_of_week : null,
          specific_date: newBreak.type === "one_time" ? newBreak.specific_date : null,
          start_time: newBreak.start_time,
          end_time: newBreak.end_time,
          label: newBreak.label || null,
        }),
      }, token);
      fetchTab();
    } catch {} finally { setSaving(false); }
  };

  const deleteBreak = async (id: string) => {
    await apiFetch(`/api/businesses/${businessId}/breaks/${id}`, { method: "DELETE" }, token).catch(() => {});
    fetchTab();
  };

  const addReminder = async (minutesBefore: number) => {
    setSaving(true);
    try {
      await apiFetch(`/api/businesses/${businessId}/reminder-settings`, {
        method: "POST",
        body: JSON.stringify({ minutes_before: minutesBefore }),
      }, token);
      fetchTab();
    } catch {} finally { setSaving(false); }
  };

  const toggleReminder = async (id: string, isActive: boolean) => {
    try {
      await apiFetch(`/api/businesses/${businessId}/reminder-settings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      }, token);
      setReminders((prev) => prev.map((r) => r.id === id ? { ...r, is_active: isActive } : r));
    } catch {}
  };

  const deleteReminder = async (id: string) => {
    await apiFetch(`/api/businesses/${businessId}/reminder-settings/${id}`, { method: "DELETE" }, token).catch(() => {});
    fetchTab();
  };

  const saveRules = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/businesses/${businessId}/booking-rules`, { method: "PUT", body: JSON.stringify(rules) }, token);
      showSaved();
    } catch {} finally { setSaving(false); }
  };

  const addStaff = async () => {
    if (!newStaffEmail) return;
    setSaving(true);
    try {
      await apiFetch(`/api/businesses/${businessId}/staff`, { method: "POST", body: JSON.stringify({ email: newStaffEmail, role: "staff" }) }, token);
      setNewStaffEmail("");
      fetchTab();
    } catch {} finally { setSaving(false); }
  };

  const removeStaff = async (memberId: string) => {
    await apiFetch(`/api/businesses/${businessId}/staff/${memberId}`, { method: "DELETE" }, token).catch(() => {});
    fetchTab();
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await apiFetch(`/api/businesses/${businessId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: profile.name, description: profile.description, phone: profile.phone, email: profile.email, address: profile.address }),
      }, token);
      showSaved();
    } catch {} finally { setSaving(false); }
  };

  const saveBooking = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/businesses/${businessId}`, {
        method: "PATCH",
        body: JSON.stringify({ allow_multiple_bookings: allowMultipleBookings }),
      }, token);
      showSaved();
    } catch {} finally { setSaving(false); }
  };

  // Google Calendar handlers
  const connectGCal = async () => {
    setGcalConnecting(true);
    try {
      const res = await apiFetch<{ url: string }>(`/api/businesses/${businessId}/google-calendar/auth-url`, {}, token);
      if (res?.url) {
        setGcalAuthUrl(res.url);
        window.open(res.url, "_blank");
      }
    } catch {} finally { setGcalConnecting(false); }
  };

  const handleGCalCode = async (code: string) => {
    setSaving(true);
    try {
      await apiFetch(`/api/businesses/${businessId}/google-calendar/connect`, {
        method: "POST",
        body: JSON.stringify({ code }),
      }, token);
      fetchTab();
      showSaved();
    } catch {} finally { setSaving(false); }
  };

  const disconnectGCal = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/businesses/${businessId}/google-calendar/connect`, { method: "DELETE" }, token);
      setGcalStatus({ connected: false, calendarId: null, syncEnabled: false, pushEnabled: false, tokenExpiresAt: null, lastSyncAt: null });
      setGcalCalendars([]);
      showSaved();
    } catch {} finally { setSaving(false); }
  };

  const saveGCalSettings = async () => {
    if (!gcalStatus) return;
    setSaving(true);
    try {
      await apiFetch(`/api/businesses/${businessId}/google-calendar/settings`, {
        method: "PATCH",
        body: JSON.stringify({
          google_calendar_id: gcalStatus.calendarId,
          sync_enabled: gcalStatus.syncEnabled,
          push_enabled: gcalStatus.pushEnabled,
        }),
      }, token);
      // Immediately sync so calendar events block slots without waiting for scheduler
      if (gcalStatus.calendarId) {
        const syncRes = await apiFetch<{ imported: number; deleted: number; error?: string }>(
          `/api/businesses/${businessId}/google-calendar/sync`, { method: "POST" }, token
        ).catch(() => null);
        setGcalSyncResult(syncRes);
      }
      showSaved();
      fetchTab();
    } catch {} finally { setSaving(false); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "hours", label: t("workingHours") },
    { key: "breaks", label: t("breaks") },
    { key: "reminders", label: t("reminders") },
    { key: "rules", label: t("bookingRules") },
    { key: "staff", label: t("staffManagement") },
    { key: "profile", label: t("businessProfile") },
    { key: "booking", label: t("booking") },
    { key: "gcal", label: "Google Calendar" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{tNav("settings")}</h1>

      {message && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
        {/* Working Hours */}
        {tab === "hours" && (
          <div className="space-y-3">
            {DAYS.map((day, i) => {
              const h = hours.find((x) => x.day_of_week === i) || { day_of_week: i, start_time: "09:00", end_time: "18:00", is_closed: false };
              return (
                <div key={day} className="flex items-center gap-4">
                  <span className="w-20 text-sm font-medium">{t(day)}</span>
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={h.is_closed}
                      onChange={() => {
                        setHours((prev) => {
                          const arr = [...prev];
                          const idx = arr.findIndex((x) => x.day_of_week === i);
                          if (idx >= 0) arr[idx] = { ...arr[idx], is_closed: !arr[idx].is_closed };
                          else arr.push({ ...h, is_closed: !h.is_closed });
                          return arr;
                        });
                      }}
                    />
                    {t("closed")}
                  </label>
                  {!h.is_closed && (
                    <>
                      <input
                        type="time"
                        value={h.start_time}
                        onChange={(e) => {
                          setHours((prev) => {
                            const arr = [...prev];
                            const idx = arr.findIndex((x) => x.day_of_week === i);
                            if (idx >= 0) arr[idx] = { ...arr[idx], start_time: e.target.value };
                            else arr.push({ ...h, start_time: e.target.value });
                            return arr;
                          });
                        }}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <span className="text-gray-400">–</span>
                      <input
                        type="time"
                        value={h.end_time}
                        onChange={(e) => {
                          setHours((prev) => {
                            const arr = [...prev];
                            const idx = arr.findIndex((x) => x.day_of_week === i);
                            if (idx >= 0) arr[idx] = { ...arr[idx], end_time: e.target.value };
                            else arr.push({ ...h, end_time: e.target.value });
                            return arr;
                          });
                        }}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </>
                  )}
                </div>
              );
            })}
            <button onClick={saveHours} disabled={saving}
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50">
              {tCommon("save")}
            </button>
          </div>
        )}

        {/* Breaks */}
        {tab === "breaks" && (
          <div className="space-y-4">
            {breaks.length > 0 && (
              <div className="space-y-2">
                {breaks.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-2 text-sm">
                    <div>
                      <span className="font-medium">{b.label || t(b.type === "recurring" ? "recurring" : "oneTime")}</span>
                      <span className="text-gray-500 ms-2">
                        {b.type === "recurring" && b.day_of_week !== null ? t(DAYS[b.day_of_week]) : b.specific_date}
                        {" "}{b.start_time} – {b.end_time}
                      </span>
                    </div>
                    <button onClick={() => deleteBreak(b.id)} className="text-red-500 text-xs hover:underline">{tCommon("delete")}</button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-200 pt-4 space-y-3">
              <h4 className="text-sm font-medium">{t("addBreak")}</h4>
              <div className="flex gap-3 flex-wrap">
                <select value={newBreak.type} onChange={(e) => setNewBreak({ ...newBreak, type: e.target.value })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm">
                  <option value="recurring">{t("recurring")}</option>
                  <option value="one_time">{t("oneTime")}</option>
                </select>
                {newBreak.type === "recurring" ? (
                  <select value={newBreak.day_of_week} onChange={(e) => setNewBreak({ ...newBreak, day_of_week: Number(e.target.value) })}
                    className="rounded border border-gray-300 px-2 py-1 text-sm">
                    {DAYS.map((d, i) => <option key={d} value={i}>{t(d)}</option>)}
                  </select>
                ) : (
                  <input type="date" value={newBreak.specific_date} onChange={(e) => setNewBreak({ ...newBreak, specific_date: e.target.value })}
                    className="rounded border border-gray-300 px-2 py-1 text-sm" />
                )}
                <input type="time" value={newBreak.start_time} onChange={(e) => setNewBreak({ ...newBreak, start_time: e.target.value })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm" />
                <input type="time" value={newBreak.end_time} onChange={(e) => setNewBreak({ ...newBreak, end_time: e.target.value })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm" />
                <input type="text" placeholder={t("label")} value={newBreak.label} onChange={(e) => setNewBreak({ ...newBreak, label: e.target.value })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm" />
              </div>
              <button onClick={addBreak} disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50">
                {t("addBreak")}
              </button>
            </div>
          </div>
        )}

        {/* Reminders */}
        {tab === "reminders" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("remindersDescription")}</p>

            {reminders.length > 0 && (
              <div className="space-y-2">
                {reminders.map((r) => {
                  const preset = REMINDER_PRESETS.find((p) => p.minutes === r.minutes_before);
                  const label = preset ? t(`reminder_${preset.label}`) : `${r.minutes_before} ${t("minutes")}`;
                  return (
                    <div key={r.id} className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={r.is_active}
                            onChange={(e) => toggleReminder(r.id, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                        <span className={`font-medium ${!r.is_active ? "text-muted-foreground" : ""}`}>{label}</span>
                      </div>
                      <button onClick={() => deleteReminder(r.id)} className="text-red-500 text-xs hover:underline">{tCommon("delete")}</button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium mb-3">{t("addReminder")}</h4>
              <div className="flex flex-wrap gap-2">
                {REMINDER_PRESETS.filter((p) => !reminders.some((r) => r.minutes_before === p.minutes)).map((p) => (
                  <button
                    key={p.minutes}
                    onClick={() => addReminder(p.minutes)}
                    disabled={saving}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors disabled:opacity-50"
                  >
                    {t(`reminder_${p.label}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Booking Rules */}
        {tab === "rules" && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-1">{t("minAdvance")}</label>
              <input type="number" min={0} value={rules.min_advance_minutes}
                onChange={(e) => setRules({ ...rules, min_advance_minutes: Number(e.target.value) })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("maxFutureDays")}</label>
              <input type="number" min={1} value={rules.max_future_days}
                onChange={(e) => setRules({ ...rules, max_future_days: Number(e.target.value) })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("cancellationWindow")}</label>
              <input type="number" min={0} value={rules.cancellation_window_minutes}
                onChange={(e) => setRules({ ...rules, cancellation_window_minutes: Number(e.target.value) })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("rescheduleWindow")}</label>
              <input type="number" min={0} value={rules.reschedule_window_minutes}
                onChange={(e) => setRules({ ...rules, reschedule_window_minutes: Number(e.target.value) })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <button onClick={saveRules} disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50">
              {tCommon("save")}
            </button>
          </div>
        )}

        {/* Staff Management */}
        {tab === "staff" && (
          <div className="space-y-4">
            {staff.length > 0 && (
              <div className="space-y-2">
                {staff.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3 text-sm">
                    <div>
                      <span className="font-medium">{m.user?.user_metadata?.name || m.user_id}</span>
                      <span className={`ms-2 inline-block rounded-full px-2 py-0.5 text-xs ${m.role === "owner" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                        {t(m.role as "owner" | "staff")}
                      </span>
                    </div>
                    {m.role !== "owner" && (
                      <button onClick={() => removeStaff(m.id)} className="text-red-500 text-xs hover:underline">{tCommon("delete")}</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input type="email" placeholder={t("email")} value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
              <button onClick={addStaff} disabled={saving || !newStaffEmail}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50">
                {t("addStaff")}
              </button>
            </div>
          </div>
        )}

        {/* Booking Settings */}
        {tab === "booking" && (
          <div className="space-y-4 max-w-md">
            <div className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{t("allowMultipleBookings")}</p>
                <p className="text-xs text-muted-foreground">{t("allowMultipleBookingsDesc")}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowMultipleBookings}
                  onChange={(e) => setAllowMultipleBookings(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <button onClick={saveBooking} disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50">
              {tCommon("save")}
            </button>
          </div>
        )}

        {/* Google Calendar */}
        {tab === "gcal" && (
          <div className="space-y-4 max-w-md">
            {!gcalStatus?.connected ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  חבר את יומן Google שלך לסנכרון דו-כיווני — אירועים מהיומן יחסמו משבצות זמן, ותורים חדשים יופיעו ביומן.
                </p>
                <button onClick={connectGCal} disabled={gcalConnecting}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50">
                  {gcalConnecting ? "מתחבר..." : "🔗 חיבור Google Calendar"}
                </button>
                <div className="border-t border-gray-200 pt-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    לאחר אישור Google, העתק את הקוד שהתקבל בחזרה לכאן:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Authorization code"
                      value={gcalCode}
                      onChange={(e) => setGcalCode(e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                    />
                    <button
                      onClick={() => { handleGCalCode(gcalCode); setGcalCode(""); }}
                      disabled={saving || !gcalCode}
                      className="rounded-md bg-green-600 px-4 py-2 text-sm text-white font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {tCommon("save")}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-md border border-green-300 bg-green-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-green-800">מחובר</p>
                    <p className="text-xs text-green-600">
                      {gcalStatus.lastSyncAt
                        ? `סנכרון אחרון: ${new Date(gcalStatus.lastSyncAt).toLocaleString("he-IL")}`
                        : "טרם סונכרן"}
                    </p>
                  </div>
                  <button onClick={disconnectGCal} disabled={saving}
                    className="text-red-600 text-xs hover:underline">
                    ניתוק
                  </button>
                </div>

                {/* Calendar selector */}
                {gcalCalendars.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-1">בחר יומן</label>
                    <select
                      value={gcalStatus.calendarId || ""}
                      onChange={(e) => setGcalStatus({ ...gcalStatus, calendarId: e.target.value || null })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">—</option>
                      {gcalCalendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.summary}{c.primary ? " (ראשי)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Toggles */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">סנכרון מיומן Google</p>
                      <p className="text-xs text-muted-foreground">אירועים מהיומן יחסמו משבצות זמן</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={gcalStatus.syncEnabled}
                        onChange={(e) => setGcalStatus({ ...gcalStatus, syncEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">דחיפת תורים ליומן</p>
                      <p className="text-xs text-muted-foreground">תורים חדשים יופיעו אוטומטית ביומן Google</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={gcalStatus.pushEnabled}
                        onChange={(e) => setGcalStatus({ ...gcalStatus, pushEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={saveGCalSettings} disabled={saving}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50">
                    {saving ? "מסנכרן..." : tCommon("save")}
                  </button>
                  <button
                    onClick={async () => {
                      setSaving(true);
                      const res = await apiFetch<{ imported: number; deleted: number; error?: string }>(
                        `/api/businesses/${businessId}/google-calendar/sync`, { method: "POST" }, token
                      ).catch(() => null);
                      setGcalSyncResult(res);
                      fetchTab();
                      setSaving(false);
                    }}
                    disabled={saving}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    🔄 סנכרן עכשיו
                  </button>
                </div>
                {gcalSyncResult && (
                  <div className={`rounded-md px-4 py-2 text-sm ${gcalSyncResult.error ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                    {gcalSyncResult.error
                      ? `שגיאה: ${gcalSyncResult.error}`
                      : `יובאו ${gcalSyncResult.imported} אירועים, נמחקו ${gcalSyncResult.deleted}`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Business Profile */}
        {tab === "profile" && profile && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-1">{t("businessName")}</label>
              <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("description")}</label>
              <textarea value={profile.description || ""} onChange={(e) => setProfile({ ...profile, description: e.target.value })} rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("phone")}</label>
              <input value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} dir="ltr"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("email")}</label>
              <input type="email" value={profile.email || ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} dir="ltr"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("address")}</label>
              <input value={profile.address || ""} onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <button onClick={saveProfile} disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50">
              {tCommon("save")}
            </button>
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">טוען...</div>}>
      <SettingsPageInner />
    </Suspense>
  );
}
