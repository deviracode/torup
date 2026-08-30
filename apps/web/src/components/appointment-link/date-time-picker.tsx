"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";

interface TimeSlot {
  start: string;
  end: string;
  available_capacity: number;
  total_capacity: number;
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [step, setStep] = useState<"date" | "time">("date");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [maxFutureDays, setMaxFutureDays] = useState(14);

  useEffect(() => {
    apiFetch<{ max_future_days?: number }>(`/api/businesses/${businessId}/booking-rules`)
      .then((r) => { if (r.max_future_days) setMaxFutureDays(r.max_future_days); })
      .catch(() => {});
  }, [businessId]);

  const dates = Array.from({ length: maxFutureDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return toLocalDateString(d);
  });

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{ slots: TimeSlot[] }>(
        `/api/businesses/${businessId}/availability?service_id=${serviceId}&date=${date}`
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
      <div>
        <div className="grid grid-cols-4 gap-2">
          {dates.map((date) => {
            const d = new Date(date + "T12:00:00");
            return (
              <button
                key={date}
                onClick={() => handleDateSelect(date)}
                disabled={loading}
                className="rounded-xl border border-gray-200 bg-white p-2 text-center text-sm hover:border-indigo-400 disabled:opacity-50"
              >
                <div className="text-xs text-gray-400">{d.toLocaleDateString("he-IL", { weekday: "short" })}</div>
                <div className="font-bold text-gray-900">{d.getDate()}</div>
              </button>
            );
          })}
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <button onClick={onCancel} className="mt-3 w-full text-sm text-gray-500">
          {t("back")}
        </button>
      </div>
    );
  }

  return (
    <div>
      {slots.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">{t("noSlots")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => {
            const time = new Date(slot.start).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false });
            return (
              <button
                key={slot.start}
                onClick={() => onSelect(slot.start)}
                className="rounded-xl border border-gray-200 bg-white p-2 text-sm hover:border-indigo-400"
              >
                {time}
              </button>
            );
          })}
        </div>
      )}
      <button onClick={() => setStep("date")} className="mt-3 w-full text-sm text-gray-500">
        {t("back")}
      </button>
    </div>
  );
}
