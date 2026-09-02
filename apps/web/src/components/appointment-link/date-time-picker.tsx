"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Clock, AlertCircle } from "lucide-react";
import { Calendar, Button, Spinner } from "@torup/ui";
import { apiFetch } from "@/lib/api";

interface TimeSlot {
  start: string;
  end: string;
  available_capacity: number;
  total_capacity: number;
}

const dateFmtLocale: Record<string, string> = { he: "he-IL", ar: "ar", en: "en-US" };

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function DateTimePicker({
  businessId,
  serviceId,
  onSelect,
  onCancel,
}: {
  businessId: string;
  serviceId: string;
  onSelect: (isoStart: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("appointmentLink");
  const locale = useLocale();
  const fmtLocale = dateFmtLocale[locale] ?? "he-IL";
  const [step, setStep] = useState<"date" | "time">("date");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [maxFutureDays, setMaxFutureDays] = useState(14);

  useEffect(() => {
    apiFetch<{ max_future_days?: number }>(`/api/businesses/${businessId}/booking-rules`)
      .then((r) => { if (r.max_future_days) setMaxFutureDays(r.max_future_days); })
      .catch(() => {});
  }, [businessId]);

  const today = startOfDay(new Date());
  const lastSelectable = new Date(today);
  lastSelectable.setDate(lastSelectable.getDate() + maxFutureDays);

  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{ slots: TimeSlot[] }>(
        `/api/businesses/${businessId}/availability?service_id=${serviceId}&date=${toLocalDateString(date)}`
      );
      setSlots(result.slots);
      setStep("time");
    } catch {
      setError(t("actionFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (step === "date") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-2">
        <Calendar
          mode="single"
          dir={fmtLocale === "en-US" ? "ltr" : "rtl"}
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={{ before: today, after: lastSelectable }}
          className="mx-auto"
          formatters={{
            formatCaption: (d) => d.toLocaleDateString(fmtLocale, { month: "long", year: "numeric" }),
            formatWeekdayName: (d) => d.toLocaleDateString(fmtLocale, { weekday: "short" }),
          }}
        />
        {error && (
          <p role="alert" className="flex items-center gap-1.5 px-3 pb-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        <Button onClick={onCancel} variant="ghost" className="w-full text-muted-foreground">
          {t("back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      {selectedDate && (
        <div className="text-center text-sm font-medium text-foreground">
          {selectedDate.toLocaleDateString(fmtLocale, { weekday: "long", day: "numeric", month: "long" })}
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : slots.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">{t("noSlots")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => {
            const full = slot.available_capacity <= 0;
            const time = new Date(slot.start).toLocaleTimeString(fmtLocale, {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
            return (
              <button
                key={slot.start}
                type="button"
                onClick={() => !full && onSelect(slot.start)}
                disabled={full}
                aria-disabled={full}
                title={full ? t("noSlots") : undefined}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2 text-sm text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
              >
                <Clock className="h-3.5 w-3.5 opacity-60" />
                {time}
              </button>
            );
          })}
        </div>
      )}
      <Button onClick={() => setStep("date")} variant="ghost" className="w-full text-muted-foreground">
        {t("back")}
      </Button>
    </div>
  );
}
