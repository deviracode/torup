"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
import { Card, CardContent, Button, Input, Label } from "@torup/ui";
import { StaffCard, type StaffMember } from "@/components/dashboard/staff-card";
import WhatsAppSettings from "@/components/dashboard/whatsapp-settings";
import { formatILS } from "@/lib/format";

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
  contact_phone: string | null;
  email: string | null;
  address: string | null;
  bot_context: string | null;
}

interface ServiceItem {
  id: string;
  name_he: string;
  name_ar: string | null;
  name_en: string | null;
  duration_minutes: number;
  price: number;
  price_type: string;
  sort_order: number;
  category_id: string | null;
}

interface ServiceCategory {
  id: string;
  name_he: string;
  name_ar: string | null;
  name_en: string | null;
  sort_order: number;
}

type Tab = "hours" | "breaks" | "reminders" | "rules" | "staff" | "profile" | "booking" | "gcal" | "services" | "whatsapp";

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
  const { businessId } = useBusiness();
  const api = useApi();
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

  // Services state
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<Partial<ServiceItem>>({});

  // Google Calendar state
  const [gcalStatus, setGcalStatus] = useState<GCalStatus | null>(null);
  const [gcalCalendars, setGcalCalendars] = useState<GCalCalendar[]>([]);
  const [gcalAuthUrl, setGcalAuthUrl] = useState("");
  const [gcalConnecting, setGcalConnecting] = useState(false);
  const [gcalCode, setGcalCode] = useState("");
  const [gcalSyncResult, setGcalSyncResult] = useState<{ imported: number; deleted: number; error?: string } | null>(null);
  const fetchingRef = React.useRef(false);

  const searchParams = useSearchParams();

  // Auto-handle OAuth redirect: if ?code= is in the URL, connect and clean
  useEffect(() => {
    const code = searchParams.get("code");
    if (code && businessId && tab !== "gcal") {
      setTab("gcal");
    }
    if (code && businessId) {
      setGcalConnecting(true);
      api(`/api/businesses/${businessId}/google-calendar/connect`, {
        method: "POST",
        body: JSON.stringify({ code }),
      })
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
        .finally(() => setGcalConnecting(false));
    }
  }, [searchParams, businessId]);

  const fetchTab = useCallback(async () => {
    if (!businessId) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setMessage("");
    try {
      if (tab === "hours") {
        const r = await api<WorkingHour[]>(`/api/businesses/${businessId}/working-hours`);
        setHours(Array.isArray(r) && r.length ? r : DAYS.map((_, i) => ({ day_of_week: i, start_time: "09:00", end_time: "18:00", is_closed: i === 6 })));
      } else if (tab === "breaks") {
        const r = await api<Break[]>(`/api/businesses/${businessId}/breaks`);
        setBreaks(Array.isArray(r) ? r : []);
      } else if (tab === "reminders") {
        const r = await api<ReminderSetting[]>(`/api/businesses/${businessId}/reminder-settings`);
        setReminders(Array.isArray(r) ? r : []);
      } else if (tab === "rules") {
        const r = await api<BookingRules>(`/api/businesses/${businessId}/booking-rules`);
        if (r) setRules(r);
      } else if (tab === "staff") {
        const [r, svcResult] = await Promise.all([
          api<StaffMember[]>(`/api/businesses/${businessId}/staff`),
          api<ServiceItem[] | { categories: ServiceCategory[]; services: ServiceItem[] }>(
            `/api/businesses/${businessId}/services`
          ),
        ]);
        setStaff(Array.isArray(r) ? r : []);
        const svcList = Array.isArray(svcResult) ? svcResult : (svcResult as { services: ServiceItem[] }).services;
        setServices(svcList || []);
      } else if (tab === "profile") {
        const r = await api<BusinessProfile>(`/api/businesses/${businessId}`);
        if (r) setProfile(r);
      } else if (tab === "booking") {
        const r = await api<{ allow_multiple_bookings: boolean }>(`/api/businesses/${businessId}`);
        if (r) setAllowMultipleBookings(r.allow_multiple_bookings ?? false);
      } else if (tab === "services") {
        const [svcResult, catResult] = await Promise.all([
          api<ServiceItem[] | { categories: ServiceCategory[]; services: ServiceItem[] }>(
            `/api/businesses/${businessId}/services`
          ),
          api<ServiceCategory[]>(`/api/businesses/${businessId}/categories`),
        ]);
        const svcList = Array.isArray(svcResult) ? svcResult : (svcResult as { services: ServiceItem[] }).services;
        setServices(svcList || []);
        setCategories(catResult || []);
      } else if (tab === "gcal") {
        const status = await api<GCalStatus>(`/api/businesses/${businessId}/google-calendar/status`);
        if (status) setGcalStatus(status);
        if (status?.connected) {
          const calRes = await api<{ calendars: GCalCalendar[] }>(`/api/businesses/${businessId}/google-calendar/calendars`);
          if (calRes?.calendars) setGcalCalendars(calRes.calendars);
        }
      }
    } catch {
      // ignore
    } finally {
      fetchingRef.current = false;
    }
  }, [businessId, tab]);

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
      await api(`/api/businesses/${businessId}/working-hours`, { method: "PUT", body: JSON.stringify(payload) });
      showSaved();
    } catch {} finally { setSaving(false); }
  };

  const addBreak = async () => {
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}/breaks`, {
        method: "POST",
        body: JSON.stringify({
          type: newBreak.type,
          day_of_week: newBreak.type === "recurring" ? newBreak.day_of_week : null,
          specific_date: newBreak.type === "one_time" ? newBreak.specific_date : null,
          start_time: newBreak.start_time,
          end_time: newBreak.end_time,
          label: newBreak.label || null,
        }),
      });
      fetchTab();
    } catch {} finally { setSaving(false); }
  };

  const deleteBreak = async (id: string) => {
    await api(`/api/businesses/${businessId}/breaks/${id}`, { method: "DELETE" });
    fetchTab();
  };

  const addReminder = async (minutesBefore: number) => {
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}/reminder-settings`, {
        method: "POST",
        body: JSON.stringify({ minutes_before: minutesBefore }),
      });
      fetchTab();
    } catch {} finally { setSaving(false); }
  };

  const toggleReminder = async (id: string, isActive: boolean) => {
    try {
      await api(`/api/businesses/${businessId}/reminder-settings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      });
      setReminders((prev) => prev.map((r) => r.id === id ? { ...r, is_active: isActive } : r));
    } catch {}
  };

  const deleteReminder = async (id: string) => {
    await api(`/api/businesses/${businessId}/reminder-settings/${id}`, { method: "DELETE" });
    fetchTab();
  };

  const saveRules = async () => {
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}/booking-rules`, { method: "PUT", body: JSON.stringify(rules) });
      showSaved();
    } catch {} finally { setSaving(false); }
  };

  const addStaff = async () => {
    if (!newStaffEmail) return;
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}/staff`, { method: "POST", body: JSON.stringify({ email: newStaffEmail, role: "staff" }) });
      setNewStaffEmail("");
      fetchTab();
    } catch {} finally { setSaving(false); }
  };

  const removeStaff = async (memberId: string) => {
    await api(`/api/businesses/${businessId}/staff/${memberId}`, { method: "DELETE" });
    fetchTab();
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: profile.name, description: profile.description, phone: profile.phone, contact_phone: profile.contact_phone, email: profile.email, address: profile.address, bot_context: profile.bot_context }),
      });
      showSaved();
    } catch {} finally { setSaving(false); }
  };

  const saveBooking = async () => {
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}`, {
        method: "PATCH",
        body: JSON.stringify({ allow_multiple_bookings: allowMultipleBookings }),
      });
      showSaved();
    } catch {} finally { setSaving(false); }
  };

  // Google Calendar handlers
  const connectGCal = async () => {
    setGcalConnecting(true);
    try {
      const res = await api<{ url: string }>(`/api/businesses/${businessId}/google-calendar/auth-url`);
      if (res?.url) {
        setGcalAuthUrl(res.url);
        window.open(res.url, "_blank");
      }
    } catch {} finally { setGcalConnecting(false); }
  };

  const handleGCalCode = async (code: string) => {
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}/google-calendar/connect`, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      fetchTab();
      showSaved();
    } catch {} finally { setSaving(false); }
  };

  const disconnectGCal = async () => {
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}/google-calendar/connect`, { method: "DELETE" });
      setGcalStatus({ connected: false, calendarId: null, syncEnabled: false, pushEnabled: false, tokenExpiresAt: null, lastSyncAt: null });
      setGcalCalendars([]);
      showSaved();
    } catch {} finally { setSaving(false); }
  };

  const saveGCalSettings = async () => {
    if (!gcalStatus) return;
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}/google-calendar/settings`, {
        method: "PATCH",
        body: JSON.stringify({
          google_calendar_id: gcalStatus.calendarId,
          sync_enabled: gcalStatus.syncEnabled,
          push_enabled: gcalStatus.pushEnabled,
        }),
      });
      // Immediately sync so calendar events block slots without waiting for scheduler
      if (gcalStatus.calendarId) {
        const syncRes = await api<{ imported: number; deleted: number; error?: string }>(
          `/api/businesses/${businessId}/google-calendar/sync`, { method: "POST" }
        );
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
    { key: "services", label: t("services") },
    { key: "whatsapp", label: t("whatsapp") },
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
                        className="rounded border border-border px-2 py-1 text-sm"
                      />
                      <span className="text-muted-foreground">–</span>
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
                        className="rounded border border-border px-2 py-1 text-sm"
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
                  <div key={b.id} className="flex items-center justify-between rounded-md border border-border px-4 py-2 text-sm">
                    <div>
                      <span className="font-medium">{b.label || t(b.type === "recurring" ? "recurring" : "oneTime")}</span>
                      <span className="text-muted-foreground ms-2">
                        {b.type === "recurring" && b.day_of_week !== null ? t(DAYS[b.day_of_week]) : b.specific_date}
                        {" "}{b.start_time} – {b.end_time}
                      </span>
                    </div>
                    <button onClick={() => deleteBreak(b.id)} className="text-red-500 text-xs hover:underline">{tCommon("delete")}</button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-sm font-medium">{t("addBreak")}</h4>
              <div className="flex gap-3 flex-wrap">
                <select value={newBreak.type} onChange={(e) => setNewBreak({ ...newBreak, type: e.target.value })}
                  className="rounded border border-border px-2 py-1 text-sm">
                  <option value="recurring">{t("recurring")}</option>
                  <option value="one_time">{t("oneTime")}</option>
                </select>
                {newBreak.type === "recurring" ? (
                  <select value={newBreak.day_of_week} onChange={(e) => setNewBreak({ ...newBreak, day_of_week: Number(e.target.value) })}
                    className="rounded border border-border px-2 py-1 text-sm">
                    {DAYS.map((d, i) => <option key={d} value={i}>{t(d)}</option>)}
                  </select>
                ) : (
                  <input type="date" value={newBreak.specific_date} onChange={(e) => setNewBreak({ ...newBreak, specific_date: e.target.value })}
                    className="rounded border border-border px-2 py-1 text-sm" />
                )}
                <input type="time" value={newBreak.start_time} onChange={(e) => setNewBreak({ ...newBreak, start_time: e.target.value })}
                  className="rounded border border-border px-2 py-1 text-sm" />
                <input type="time" value={newBreak.end_time} onChange={(e) => setNewBreak({ ...newBreak, end_time: e.target.value })}
                  className="rounded border border-border px-2 py-1 text-sm" />
                <input type="text" placeholder={t("label")} value={newBreak.label} onChange={(e) => setNewBreak({ ...newBreak, label: e.target.value })}
                  dir="auto"
                  className="rounded border border-border px-2 py-1 text-sm text-start" />
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
                    <div key={r.id} className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={r.is_active}
                            onChange={(e) => toggleReminder(r.id, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                        <span className={`font-medium ${!r.is_active ? "text-muted-foreground" : ""}`}>{label}</span>
                      </div>
                      <button onClick={() => deleteReminder(r.id)} className="text-red-500 text-xs hover:underline">{tCommon("delete")}</button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium mb-3">{t("addReminder")}</h4>
              <div className="flex flex-wrap gap-2">
                {REMINDER_PRESETS.filter((p) => !reminders.some((r) => r.minutes_before === p.minutes)).map((p) => (
                  <button
                    key={p.minutes}
                    onClick={() => addReminder(p.minutes)}
                    disabled={saving}
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors disabled:opacity-50"
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
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-end" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("maxFutureDays")}</label>
              <input type="number" min={1} value={rules.max_future_days}
                onChange={(e) => setRules({ ...rules, max_future_days: Number(e.target.value) })}
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-end" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("cancellationWindow")}</label>
              <input type="number" min={0} value={rules.cancellation_window_minutes}
                onChange={(e) => setRules({ ...rules, cancellation_window_minutes: Number(e.target.value) })}
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-end" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("rescheduleWindow")}</label>
              <input type="number" min={0} value={rules.reschedule_window_minutes}
                onChange={(e) => setRules({ ...rules, reschedule_window_minutes: Number(e.target.value) })}
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-end" />
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
                  <StaffCard
                    key={m.id}
                    member={m}
                    services={services}
                    businessId={businessId!}
                    onUpdate={(updated) => setStaff((prev) => prev.map((s) => s.id === updated.id ? updated : s))}
                    onRemove={(id) => removeStaff(id)}
                  />
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="email"
                placeholder={t("email")}
                value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
              />
              <button
                onClick={addStaff}
                disabled={saving || !newStaffEmail}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {t("addStaff")}
              </button>
            </div>
          </div>
        )}

        {/* Booking Settings */}
        {tab === "booking" && (
          <div className="space-y-4 max-w-md">
            <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
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
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
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
                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    לאחר אישור Google, העתק את הקוד שהתקבל בחזרה לכאן:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="קוד אימות"
                      value={gcalCode}
                      onChange={(e) => setGcalCode(e.target.value)}
                      dir="auto"
                      className="flex-1 rounded-md border border-border px-3 py-2 text-sm font-mono text-start"
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
                      className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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
                  <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
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
                      <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
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
                      <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
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
                      const res = await api<{ imported: number; deleted: number; error?: string }>(
                        `/api/businesses/${businessId}/google-calendar/sync`, { method: "POST" }
                      );
                      setGcalSyncResult(res);
                      fetchTab();
                      setSaving(false);
                    }}
                    disabled={saving}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
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
              <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} dir="auto"
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-start" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("description")}</label>
              <textarea value={profile.description || ""} onChange={(e) => setProfile({ ...profile, description: e.target.value })} rows={3} dir="auto"
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-start" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("phone")}</label>
              <input value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} dir="ltr"
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-start" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("contactPhone")}</label>
              <p className="text-xs text-muted-foreground mb-1">{t("contactPhoneDesc")}</p>
              <input value={profile.contact_phone || ""} onChange={(e) => setProfile({ ...profile, contact_phone: e.target.value })} dir="ltr"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("email")}</label>
              <input type="email" value={profile.email || ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} dir="ltr"
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-start" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("address")}</label>
              <input value={profile.address || ""} onChange={(e) => setProfile({ ...profile, address: e.target.value })} dir="auto"
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-start" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("botContext")}</label>
              <p className="text-xs text-muted-foreground mb-1">{t("botContextDesc")}</p>
              <textarea value={profile.bot_context || ""} onChange={(e) => setProfile({ ...profile, bot_context: e.target.value })} rows={5} dir="auto"
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-start" />
            </div>
            <button onClick={saveProfile} disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50">
              {tCommon("save")}
            </button>
          </div>
        )}
        {/* Services */}
        {tab === "services" && (
          <div className="space-y-6">
            {[
              ...categories.map((cat) => ({
                catId: cat.id,
                label: cat.name_he,
                items: services.filter((s) => s.category_id === cat.id),
              })),
              {
                catId: null as string | null,
                label: t("noCategory"),
                items: services.filter((s) => !s.category_id),
              },
            ]
              .filter((group) => group.items.length > 0 || group.catId === null)
              .map((group) => (
                <div key={group.catId ?? "uncategorized"}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                      {group.label}
                    </h3>
                    {group.catId && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1 text-xs"
                          onClick={async () => {
                            const cat = categories.find((c) => c.id === group.catId);
                            if (!cat) return;
                            const newOrder = Math.max(0, cat.sort_order - 1);
                            await api(`/api/businesses/${businessId}/categories/${cat.id}`, {
                              method: "PATCH", body: JSON.stringify({ sort_order: newOrder }),
                            });
                            setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, sort_order: newOrder } : c).sort((a, b) => a.sort_order - b.sort_order));
                          }}
                        >▲</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1 text-xs"
                          onClick={async () => {
                            const cat = categories.find((c) => c.id === group.catId);
                            if (!cat) return;
                            const newOrder = cat.sort_order + 1;
                            await api(`/api/businesses/${businessId}/categories/${cat.id}`, {
                              method: "PATCH", body: JSON.stringify({ sort_order: newOrder }),
                            });
                            setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, sort_order: newOrder } : c).sort((a, b) => a.sort_order - b.sort_order));
                          }}
                        >▼</Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    {group.items.map((svc) => (
                      <Card key={svc.id}>
                        <CardContent className="p-4">
                          {editingService === svc.id ? (
                            <div className="space-y-3">
                              <Input
                                value={serviceForm.name_he ?? svc.name_he}
                                onChange={(e) => setServiceForm((f) => ({ ...f, name_he: e.target.value }))}
                                placeholder={t("serviceName")}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  type="number"
                                  value={serviceForm.duration_minutes ?? svc.duration_minutes}
                                  onChange={(e) => setServiceForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                                  placeholder={t("duration")}
                                  className="text-end"
                                />
                                <Input
                                  type="number"
                                  value={serviceForm.price ?? svc.price}
                                  onChange={(e) => setServiceForm((f) => ({ ...f, price: Number(e.target.value) }))}
                                  placeholder={t("price")}
                                  className="text-end"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">{t("serviceCategory")}</Label>
                                <select
                                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  value={serviceForm.category_id ?? svc.category_id ?? ""}
                                  onChange={async (e) => {
                                    const val = e.target.value;
                                    if (val === "__new__") {
                                      setShowNewCategoryInput(svc.id);
                                      return;
                                    }
                                    setServiceForm((f) => ({ ...f, category_id: val || null }));
                                  }}
                                >
                                  <option value="">{t("noCategory")}</option>
                                  {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name_he}</option>
                                  ))}
                                  <option value="__new__">{t("newCategory")}</option>
                                </select>
                                {showNewCategoryInput === svc.id && (
                                  <div className="flex gap-2 mt-2">
                                    <Input
                                      value={newCategoryName}
                                      onChange={(e) => setNewCategoryName(e.target.value)}
                                      placeholder={t("categoryName")}
                                      className="text-sm"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={async () => {
                                        if (!newCategoryName.trim()) return;
                                        const created = await api<ServiceCategory>(
                                          `/api/businesses/${businessId}/categories`,
                                          { method: "POST", body: JSON.stringify({ name_he: newCategoryName, sort_order: categories.length }) },
                                        );
                                        if (!created) return;
                                        setCategories((prev) => [...prev, created]);
                                        setServiceForm((f) => ({ ...f, category_id: created.id }));
                                        setNewCategoryName("");
                                        setShowNewCategoryInput(null);
                                      }}
                                    >{tCommon("save")}</Button>
                                    <Button size="sm" variant="outline" onClick={() => setShowNewCategoryInput(null)}>{tCommon("cancel")}</Button>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    const updated = await api<ServiceItem>(
                                      `/api/businesses/${businessId}/services/${svc.id}`,
                                      { method: "PATCH", body: JSON.stringify(serviceForm) },
                                    );
                                    if (!updated) return;
                                    setServices((prev) => prev.map((s) => s.id === updated.id ? updated : s));
                                    setEditingService(null);
                                    setServiceForm({});
                                  }}
                                >{tCommon("save")}</Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingService(null); setServiceForm({}); }}>{tCommon("cancel")}</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{svc.name_he}</p>
                                <p className="text-xs text-muted-foreground">{svc.duration_minutes} {t("min")} • {formatILS(svc.price)}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setEditingService(svc.id); setServiceForm({}); }}
                              >{tCommon("edit")}</Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {tab === "whatsapp" && <WhatsAppSettings />}

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
