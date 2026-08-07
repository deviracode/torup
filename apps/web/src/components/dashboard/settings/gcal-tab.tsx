"use client";

import { useState, useEffect } from "react";
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
import { toast } from "sonner";

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

export default function GcalTab() {
  const { businessId } = useBusiness();
  const api = useApi();
  const [gcalStatus, setGcalStatus] = useState<GCalStatus | null>(null);
  const [gcalCalendars, setGcalCalendars] = useState<GCalCalendar[]>([]);
  const [gcalAuthUrl, setGcalAuthUrl] = useState("");
  const [gcalConnecting, setGcalConnecting] = useState(false);
  const [gcalCode, setGcalCode] = useState("");
  const [gcalSyncResult, setGcalSyncResult] = useState<{
    imported: number;
    deleted: number;
    error?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!businessId) return;
    const status = await api<GCalStatus>(
      `/api/businesses/${businessId}/google-calendar/status`
    );
    if (status) setGcalStatus(status);
    if (status?.connected) {
      const calRes = await api<{ calendars: GCalCalendar[] }>(
        `/api/businesses/${businessId}/google-calendar/calendars`
      );
      if (calRes?.calendars) setGcalCalendars(calRes.calendars);
    }
  };

  useEffect(() => {
    if (businessId) fetchData();
  }, [businessId]);

  const connectGCal = async () => {
    setGcalConnecting(true);
    try {
      const res = await api<{ url: string }>(
        `/api/businesses/${businessId}/google-calendar/auth-url`
      );
      if (res?.url) {
        setGcalAuthUrl(res.url);
        window.open(res.url, "_blank");
      }
    } catch {
    } finally {
      setGcalConnecting(false);
    }
  };

  const handleGCalCode = async (code: string) => {
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}/google-calendar/connect`, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      fetchData();
      toast.success("נשמר בהצלחה");
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const disconnectGCal = async () => {
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}/google-calendar/connect`, {
        method: "DELETE",
      });
      setGcalStatus({
        connected: false,
        calendarId: null,
        syncEnabled: false,
        pushEnabled: false,
        tokenExpiresAt: null,
        lastSyncAt: null,
      });
      setGcalCalendars([]);
      toast.success("נשמר בהצלחה");
    } catch {
    } finally {
      setSaving(false);
    }
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
        const syncRes = await api<{
          imported: number;
          deleted: number;
          error?: string;
        }>(
          `/api/businesses/${businessId}/google-calendar/sync`,
          { method: "POST" }
        );
        setGcalSyncResult(syncRes);
      }
      toast.success("נשמר בהצלחה");
      fetchData();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-md">
      {!gcalStatus?.connected ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            חבר את יומן Google שלך לסנכרון דו-כיווני — אירועים מהיומן יחסמו
            משבצות זמן, ותורים חדשים יופיעו ביומן.
          </p>
          <button
            onClick={connectGCal}
            disabled={gcalConnecting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
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
                onClick={() => {
                  handleGCalCode(gcalCode);
                  setGcalCode("");
                }}
                disabled={saving || !gcalCode}
                className="rounded-md bg-green-600 px-4 py-2 text-sm text-white font-medium hover:bg-green-700 disabled:opacity-50"
              >
                שמירה
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
            <button
              onClick={disconnectGCal}
              disabled={saving}
              className="text-red-600 text-xs hover:underline"
            >
              ניתוק
            </button>
          </div>

          {/* Calendar selector */}
          {gcalCalendars.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">
                בחר יומן
              </label>
              <select
                value={gcalStatus.calendarId || ""}
                onChange={(e) =>
                  setGcalStatus({
                    ...gcalStatus,
                    calendarId: e.target.value || null,
                  })
                }
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">—</option>
                {gcalCalendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.summary}
                    {c.primary ? " (ראשי)" : ""}
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
                <p className="text-xs text-muted-foreground">
                  אירועים מהיומן יחסמו משבצות זמן
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={gcalStatus.syncEnabled}
                  onChange={(e) =>
                    setGcalStatus({
                      ...gcalStatus,
                      syncEnabled: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">דחיפת תורים ליומן</p>
                <p className="text-xs text-muted-foreground">
                  תורים חדשים יופיעו אוטומטית ביומן Google
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={gcalStatus.pushEnabled}
                  onChange={(e) =>
                    setGcalStatus({
                      ...gcalStatus,
                      pushEnabled: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={saveGCalSettings}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "מסנכרן..." : "שמירה"}
            </button>
            <button
              onClick={async () => {
                setSaving(true);
                const res = await api<{
                  imported: number;
                  deleted: number;
                  error?: string;
                }>(
                  `/api/businesses/${businessId}/google-calendar/sync`,
                  { method: "POST" }
                );
                setGcalSyncResult(res);
                fetchData();
                setSaving(false);
              }}
              disabled={saving}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              🔄 סנכרן עכשיו
            </button>
          </div>
          {gcalSyncResult && (
            <div
              className={`rounded-md px-4 py-2 text-sm ${gcalSyncResult.error ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}
            >
              {gcalSyncResult.error
                ? `שגיאה: ${gcalSyncResult.error}`
                : `יובאו ${gcalSyncResult.imported} אירועים, נמחקו ${gcalSyncResult.deleted}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
