"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Calendar as CalendarIcon, Clock, Store, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, Button, Input, Field, Badge, FadeIn } from "@torup/ui";
import { apiFetch } from "@/lib/api";

interface AppointmentSummary {
  id: string;
  businessId: string;
  businessName: string;
  serviceId: string;
  serviceName: string;
  startTime: string;
  status: string;
}

const dateFmtLocale: Record<string, string> = { he: "he-IL", ar: "ar", en: "en-US" };

function BrandMark() {
  return (
    <div
      className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
      style={{ background: "var(--grad-brand)" }}
    >
      <CalendarIcon className="h-7 w-7 text-white" />
    </div>
  );
}

export function AppointmentLinkView({ token }: { token: string }) {
  const t = useTranslations("appointmentLink");
  const locale = useLocale();
  const [phone, setPhone] = useState("");
  const [appointment, setAppointment] = useState<AppointmentSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionDone, setActionDone] = useState<string | null>(null);

  const verify = async () => {
    setLoading(true);
    setError("");
    try {
      const summary = await apiFetch<AppointmentSummary>(`/api/public/appointments/${token}/verify`, {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setAppointment(summary);
    } catch (err) {
      // The API's 410 ("no longer active") is worth surfacing distinctly —
      // everything else (bad token, wrong phone) stays a single generic
      // message on purpose, to not leak which part was wrong.
      const msg = err instanceof Error ? err.message : "";
      setError(msg === "This appointment is no longer active" ? t("noLongerActive") : t("verifyFailed"));
    } finally {
      setLoading(false);
    }
  };

  const setAttendance = async (decision: "confirm" | "reject") => {
    setLoading(true);
    setError("");
    try {
      await apiFetch(`/api/public/appointments/${token}/attendance`, {
        method: "POST",
        body: JSON.stringify({ phone, decision }),
      });
      setActionDone(decision);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg === "Too close to the appointment time to cancel" ? t("cancellationWindowClosed") : t("actionFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) {
    return (
      <FadeIn>
        <Card className="border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl">
          <CardHeader className="items-center text-center gap-3 pb-2">
            <BrandMark />
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
              <p className="text-sm text-muted-foreground">{t("enterPhone")}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <Field label={t("phoneLabel")} htmlFor="phone" error={error || undefined}>
              <Input
                id="phone"
                type="tel"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("phonePlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && phone && verify()}
              />
            </Field>
            <Button onClick={verify} disabled={loading || !phone} loading={loading} className="w-full" size="lg">
              {t("continue")}
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    );
  }

  if (actionDone) {
    const confirmed = actionDone === "confirm";
    return (
      <FadeIn>
        <Card className="border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full ${
                confirmed ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
              }`}
            >
              {confirmed ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
            </div>
            <p className="text-foreground font-medium">
              {confirmed ? t("attendanceConfirmed") : t("attendanceRejected")}
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    );
  }

  const fmtLocale = dateFmtLocale[locale] ?? "he-IL";
  const date = new Date(appointment.startTime).toLocaleDateString(fmtLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jerusalem",
  });
  const time = new Date(appointment.startTime).toLocaleTimeString(fmtLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  });

  // If the appointment status is inactive (cancelled/completed/no_show), the
  // API's verify call would have returned 410 and error would already be
  // set — but ALSO handle the case where verify succeeds and returns an
  // inactive status directly (defense in depth): show a neutral message
  // instead of the action buttons.
  const isInactive = ["cancelled", "completed", "no_show"].includes(appointment.status);
  if (isInactive) {
    return (
      <FadeIn>
        <Card className="border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <AlertCircle className="h-8 w-8" />
            </div>
            <p className="text-muted-foreground">{t("noLongerActive")}</p>
          </CardContent>
        </Card>
      </FadeIn>
    );
  }

  const statusVariant = appointment.status === "pending_approval" || appointment.status === "pending" ? "warning" : "success";

  return (
    <FadeIn className="space-y-3">
      <Card className="border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Store className="h-4 w-4" />
              {appointment.businessName}
            </div>
            <Badge variant={statusVariant} dot>
              {appointment.status}
            </Badge>
          </div>

          <div className="font-semibold text-foreground text-base">{appointment.serviceName}</div>

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <CalendarIcon className="h-4 w-4 text-primary" />
              {date}
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              {time}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-card/80 backdrop-blur-xl shadow-2xl">
        <CardContent className="space-y-2 pt-6">
          <Button onClick={() => setAttendance("confirm")} disabled={loading} loading={loading} className="w-full" size="lg">
            <CheckCircle2 className="me-2 h-4 w-4" />
            {t("iWillAttend")}
          </Button>
          <Button
            onClick={() => setAttendance("reject")}
            disabled={loading}
            variant="outline"
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            size="lg"
          >
            <XCircle className="me-2 h-4 w-4" />
            {t("iWontAttend")}
          </Button>
          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive pt-1">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
