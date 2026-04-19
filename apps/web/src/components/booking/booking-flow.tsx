"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Badge } from "@queue/ui";
import { Check, ArrowRight, ArrowLeft, Clock, Banknote, MessageCircle } from "lucide-react";

interface Service {
  id: string;
  name_he: string;
  name_ar: string | null;
  name_en: string | null;
  description_he: string | null;
  duration_minutes: number;
  price: number;
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

function StepIndicator({ current, locale, onStepClick }: { current: Step; locale: string; onStepClick: (step: Step) => void }) {
  const labels: Record<string, Record<Step, string>> = {
    he: { service: "שירות", date: "תאריך", time: "שעה", details: "פרטים", confirmed: "אישור" },
    en: { service: "Service", date: "Date", time: "Time", details: "Details", confirmed: "Done" },
    ar: { service: "خدمة", date: "تاريخ", time: "وقت", details: "تفاصيل", confirmed: "تأكيد" },
  };
  const l = labels[locale] || labels.en;
  const currentIdx = STEPS.indexOf(current);

  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.slice(0, -1).map((step, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isClickable = isDone;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              className={`flex flex-col items-center ${isClickable ? "cursor-pointer" : "cursor-default"}`}
              onClick={() => isClickable && onStepClick(step)}
              disabled={!isClickable}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  isDone
                    ? "bg-primary text-primary-foreground hover:opacity-80"
                    : isCurrent
                      ? "border-2 border-primary text-primary"
                      : "border-2 border-muted text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`mt-1 text-xs ${isCurrent ? "font-medium text-primary" : isDone ? "font-medium text-primary" : "text-muted-foreground"}`}>
                {l[step]}
              </span>
            </button>
            {i < 3 && (
              <div className={`mx-2 h-0.5 flex-1 ${i < currentIdx ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BookingFlow({
  business,
  services,
  locale,
}: {
  business: Business;
  services: Service[];
  locale: string;
}) {
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

  const handleServiceSelect = (service: Service) => {
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

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setStep("details");
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const customer = await apiFetch<{ id: string }>(
        `/api/businesses/${business.id}/customers`,
        {
          method: "POST",
          body: JSON.stringify({ phone, name, language_preference: locale }),
        }
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

  const localeStr = locale === "he" ? "he-IL" : locale === "ar" ? "ar" : "en";

  return (
    <div className="space-y-6">
      {step !== "confirmed" && <StepIndicator current={step} locale={locale} onStepClick={setStep} />}

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* Step 1: Select Service */}
      {step === "service" && (
        <div>
          <h2 className="text-lg font-semibold mb-4">{t("selectService")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <Card
                key={service.id}
                className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
                onClick={() => handleServiceSelect(service)}
              >
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">{getServiceName(service, locale)}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {service.duration_minutes} {t("minutes")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Banknote className="h-3.5 w-3.5" />
                      ₪{service.price}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select Date */}
      {step === "date" && (
        <div>
          <button onClick={() => setStep("service")} className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary mb-4 hover:bg-primary/10 transition-colors">
            <BackIcon className="h-4 w-4" />
            {selectedService && getServiceName(selectedService, locale)}
          </button>
          <h2 className="text-lg font-semibold mb-4">{t("selectDate")}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {dates.map((date) => {
              const d = new Date(date + "T12:00:00");
              const dayName = d.toLocaleDateString(localeStr, { weekday: "short" });
              const dayNum = d.getDate();
              const month = d.toLocaleDateString(localeStr, { month: "short" });

              return (
                <button
                  key={date}
                  onClick={() => handleDateSelect(date)}
                  disabled={loading}
                  className="rounded-lg border bg-card p-3 text-center transition-all hover:border-primary hover:shadow-sm disabled:opacity-50"
                >
                  <div className="text-xs text-muted-foreground">{dayName}</div>
                  <div className="text-lg font-semibold">{dayNum}</div>
                  <div className="text-xs text-muted-foreground">{month}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3: Select Time */}
      {step === "time" && (
        <div>
          <button onClick={() => setStep("date")} className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary mb-4 hover:bg-primary/10 transition-colors">
            <BackIcon className="h-4 w-4" />
            {selectedDate}
          </button>
          <h2 className="text-lg font-semibold mb-4">{t("selectTime")}</h2>
          {slots.length === 0 ? (
            <p className="text-muted-foreground">{t("noSlotsAvailable")}</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((slot) => {
                const time = new Date(slot.start).toLocaleTimeString(localeStr, {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                });
                return (
                  <Badge
                    key={slot.start}
                    variant="outline"
                    className="cursor-pointer justify-center py-3 text-sm transition-all hover:bg-primary hover:text-primary-foreground"
                    onClick={() => handleSlotSelect(slot)}
                  >
                    {time}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Customer Details */}
      {step === "details" && (
        <div>
          <button onClick={() => setStep("time")} className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary mb-4 hover:bg-primary/10 transition-colors">
            <BackIcon className="h-4 w-4" />
            {t("selectTime")}
          </button>
          <h2 className="text-lg font-semibold mb-4">{t("yourDetails")}</h2>
          <form onSubmit={handleBook} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("name")}</Label>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("phone")}</Label>
              <Input
                type="tel"
                required
                placeholder="05X-XXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("notes")}</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* Summary */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 space-y-1">
                <p className="font-semibold">
                  {selectedService && getServiceName(selectedService, locale)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedDate} •{" "}
                  {selectedSlot &&
                    new Date(selectedSlot.start).toLocaleTimeString(localeStr, {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedService?.duration_minutes} {t("minutes")} • ₪{selectedService?.price}
                </p>
              </CardContent>
            </Card>

            <Button type="submit" disabled={loading} className="w-full h-10" size="lg">
              {loading ? t("bookNow") + "..." : t("confirmBooking")}
            </Button>
          </form>
        </div>
      )}

      {/* Step 5: Confirmation */}
      {step === "confirmed" && bookingResult && (
        <div className="text-center space-y-6 py-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold">{t("bookingConfirmed")}</h2>
          <Card className="text-start">
            <CardContent className="p-4 space-y-2">
              <p className="font-semibold">
                {selectedService && getServiceName(selectedService, locale)}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedDate} •{" "}
                {selectedSlot &&
                  new Date(selectedSlot.start).toLocaleTimeString(localeStr, {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
              </p>
              <p className="text-sm text-muted-foreground">{business.name}</p>
            </CardContent>
          </Card>

          {business.phone && (
            <a
              href={`https://wa.me/${business.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                locale === "he"
                  ? `שלום, קבעתי תור ב-${business.name}`
                  : `Hi, I booked an appointment at ${business.name}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="lg" className="gap-2">
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </Button>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
