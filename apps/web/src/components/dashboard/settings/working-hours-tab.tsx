"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
import { Skeleton } from "@torup/ui";
import { toast } from "sonner";

const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

interface WorkingHour {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

export default function WorkingHoursTab() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { businessId } = useBusiness();
  const api = useApi();
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    api<WorkingHour[]>(`/api/businesses/${businessId}/working-hours`)
      .then((r) => {
        setHours(
          Array.isArray(r) && r.length
            ? r
            : DAYS.map((_, i) => ({
                day_of_week: i,
                start_time: "09:00",
                end_time: "18:00",
                is_closed: i === 6,
              }))
        );
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const saveHours = async () => {
    setSaving(true);
    try {
      const payload = hours.map((h) => ({
        day_of_week: h.day_of_week,
        start_time: h.start_time,
        end_time: h.end_time,
        is_closed: h.is_closed,
      }));
      await api(`/api/businesses/${businessId}/working-hours`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      toast.success(t("saved"));
    } catch {
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" data-testid="working-hours-skeleton">
        {DAYS.map((day) => (
          <Skeleton key={day} className="h-9 w-full" />
        ))}
        <Skeleton className="h-10 w-24" />
      </div>
    );
  }

  return (
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
  );
}
