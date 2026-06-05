"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { Check, ArrowRight, ArrowLeft, Clock, Banknote, MessageCircle, ChevronLeft } from "lucide-react";

interface Service {
  id: string;
  name_he: string;
  name_ar: string | null;
  name_en: string | null;
  description_he: string | null;
  duration_minutes: number;
  price: number;
  price_type: string;
}

interface Business {
  id: string;
  name: string;
  phone: string;
  slug: string;
}

interface TimeSlot {
  start: string;
  end: string;
  available_capacity: number;
}

type Step = "service" | "date" | "time" | "details" | "confirmed";
const STEPS: Step[] = ["service", "date", "time", "details", "confirmed"];

function getServiceName(service: Service, locale: string) {
  if (locale === "ar" && service.name_ar) return service.name_ar;
  if (locale === "en" && service.name_en) return service.name_en;
  return service.name_he;
}

// Shared input class for the light booking page
const inputCls =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 transition-all";

function StepIndicator({ current, onStepClick }: { current: Step; locale: string; onStepClick: (step: Step) => void }) {
  const labels: Record<Step, string> = { service: "שירות", date: "תאריך", time: "שעה", details: "פרטים", confirmed: "אישור" };
  const currentIdx = STEPS.indexOf(current);

  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.slice(0, -1).map((step, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              className={`flex flex-col items-center ${isDone ? "cursor-pointer" : "cursor-default"}`}
              onClick={() => isDone && onStepClick(step)}
              disabled={!isDone}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                  isDone
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                    : isCurrent
                      ? "border-2 border-indigo-600 text-indigo-600 bg-white"
                      : "border-2 border-gray-200 text-gray-400 bg-white"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`mt-1.5 text-xs font-medium ${isCurrent || isDone ? "text-indigo-600" : "text-gray-400"}`}>
                {labels[step]}
              </span>
            </button>
            {i < 3 && (
              <div className={`mx-2 h-0.5 flex-1 rounded ${i < currentIdx ? "bg-indigo-500" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BookingFlow({ business, services, locale }: { business: Business; services: Service[]; locale: string }) {
  const t = useTranslations("booking");
  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bookingResult, setBookingResult] = useState<Record<string, unknown> | null>(null);
  const [maxFutureDays, setMaxFutureDays] = useState(14);

  useEffect(() => {
    apiFetch<{ max_future_days?: number }>(`/api/businesses/${business.id}/booking-rules`)
      .then((r) => { if (r.max_future_days) setMaxFutureDays(r.max_future_days); })
      .catch(() => {});
  }, [business.id]);

  const isRtl = locale === "he" || locale === "ar";
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const localeStr = locale === "he" ? "he-IL" : locale === "ar" ? "ar" : "en";

  const handleServiceSelect = (service: Service) => {
    if (service.price_type === "discuss") {
      window.open(`https://wa.me/${business.phone.replace(/[^0-9]/g, "")}`, "_blank");
      return;
    }
    setSelectedService(service);
    setStep("date");
  };

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{ slots: TimeSlot[] }>(
        `/api/businesses/${business.id}/availability?service_id=${selectedService!.id}&date=${date}`
      );
      setSlots(result.slots);
      setStep("time");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load slots");
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = (slot: TimeSlot) => { setSelectedSlot(slot); setStep("details"); };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const customer = await apiFetch<{ id: string }>(
        `/api/businesses/${business.id}/customers`,
        { method: "POST", body: JSON.stringify({ phone, name, language_preference: locale }) }
      );
      const appointment = await apiFetch<Record<string, unknown>>(
        `/api/businesses/${business.id}/appointments`,
        {
          method: "POST",
          body: JSON.stringify({
            service_id: selectedService!.id,
            customer_id: customer.id,
            start_time: selectedSlot!.start,
            notes: notes || null,
            created_via: "web",
          }),
        }
      );
      setBookingResult(appointment);
      setStep("confirmed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  const dates = Array.from({ length: maxFutureDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  const BackBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 mb-5 hover:bg-indigo-100 transition-colors"
    >
      <BackIcon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {step !== "confirmed" && <StepIndicator current={step} locale={locale} onStepClick={setStep} />}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">{error}</div>
      )}

      {/* Step 1: Service */}
      {step === "service" && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">{t("selectService")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => handleServiceSelect(service)}
                className="rounded-xl border border-gray-200 bg-white p-4 text-start shadow-sm hover:border-indigo-400 hover:shadow-md transition-all group"
              >
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-700 transition-colors">
                  {getServiceName(service, locale)}
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {service.duration_minutes} {t("minutes")}
                  </span>
                  <span className="flex items-center gap-1">
                    {service.price_type === "discuss" ? (
                      <><MessageCircle className="h-3.5 w-3.5" />לשיחה</>
                    ) : (
                      <><Banknote className="h-3.5 w-3.5" />₪{service.price}</>
                    )}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Date */}
      {step === "date" && (
        <div>
          <BackBtn onClick={() => setStep("service")} label={selectedService ? getServiceName(selectedService, locale) : ""} />
          <h2 className="text-lg font-bold text-gray-900 mb-4">{t("selectDate")}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {dates.map((date) => {
              const d = new Date(date + "T12:00:00");
              return (
                <button
                  key={date}
                  onClick={() => handleDateSelect(date)}
                  disabled={loading}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm hover:border-indigo-400 hover:shadow-md hover:text-indigo-700 transition-all disabled:opacity-50"
                >
                  <div className="text-xs text-gray-400">{d.toLocaleDateString(localeStr, { weekday: "short" })}</div>
                  <div className="text-lg font-bold text-gray-900">{d.getDate()}</div>
                  <div className="text-xs text-gray-400">{d.toLocaleDateString(localeStr, { month: "short" })}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Time */}
      {step === "time" && (
        <div>
          <BackBtn onClick={() => setStep("date")} label={selectedDate} />
          <h2 className="text-lg font-bold text-gray-900 mb-4">{t("selectTime")}</h2>
          {slots.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t("noSlotsAvailable")}</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((slot) => {
                const time = new Date(slot.start).toLocaleTimeString(localeStr, { hour: "2-digit", minute: "2-digit", hour12: false });
                return (
                  <button
                    key={slot.start}
                    onClick={() => handleSlotSelect(slot)}
                    className="rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 shadow-sm hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Details */}
      {step === "details" && (
        <div>
          <BackBtn onClick={() => setStep("time")} label={t("selectTime")} />
          <h2 className="text-lg font-bold text-gray-900 mb-4">{t("yourDetails")}</h2>
          <form onSubmit={handleBook} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("name")}</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("phone")}</label>
              <input type="tel" required placeholder="05X-XXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("notes")}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400 mb-2">סיכום</p>
              <p className="font-semibold text-gray-900">{selectedService && getServiceName(selectedService, locale)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {selectedDate} · {selectedSlot && new Date(selectedSlot.start).toLocaleTimeString(localeStr, { hour: "2-digit", minute: "2-digit", hour12: false })}
              </p>
              <p className="text-sm text-gray-500">
                {selectedService?.duration_minutes} {t("minutes")}
                {selectedService?.price_type === "discuss" ? " · לשיחה עם בעל העסק" : ` · ₪${selectedService?.price}`}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              {loading ? `${t("confirmBooking")}...` : t("confirmBooking")}
            </button>
          </form>
        </div>
      )}

      {/* Step 5: Confirmed */}
      {step === "confirmed" && bookingResult && (
        <div className="text-center space-y-6 py-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 shadow-lg shadow-indigo-200">
            <Check className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t("bookingConfirmed")}</h2>
            <p className="text-gray-500 mt-1 text-sm">נשלח אליך אישור בוואטסאפ</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-start shadow-sm">
            <p className="font-semibold text-gray-900">{selectedService && getServiceName(selectedService, locale)}</p>
            <p className="text-sm text-gray-500 mt-1">
              {selectedDate} · {selectedSlot && new Date(selectedSlot.start).toLocaleTimeString(localeStr, { hour: "2-digit", minute: "2-digit", hour12: false })}
            </p>
            <p className="text-sm text-gray-500">{business.name}</p>
          </div>
          {business.phone && (
            <a
              href={`https://wa.me/${business.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(locale === "he" ? `שלום, קבעתי תור ב-${business.name}` : `Hi, I booked an appointment at ${business.name}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:border-green-400 hover:text-green-700 transition-all"
            >
              <MessageCircle className="h-5 w-5" />
              WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}
