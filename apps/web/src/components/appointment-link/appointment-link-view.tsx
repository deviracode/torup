"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { DateTimePicker } from "./date-time-picker";

interface AppointmentSummary {
  id: string;
  businessId: string;
  businessName: string;
  serviceName: string;
  startTime: string;
  status: string;
}

const inputCls =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-start";

export function AppointmentLinkView({ token }: { token: string }) {
  const t = useTranslations("appointmentLink");
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
    } catch {
      setError(t("verifyFailed"));
    } finally {
      setLoading(false);
    }
  };

  const setAttendance = async (decision: "confirm" | "reject") => {
    setLoading(true);
    try {
      await apiFetch(`/api/public/appointments/${token}/attendance`, {
        method: "POST",
        body: JSON.stringify({ phone, decision }),
      });
      setActionDone(decision);
    } catch {
      setError(t("actionFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900 mb-1">{t("title")}</h1>
        <p className="text-sm text-gray-500 mb-4">{t("enterPhone")}</p>
        <input
          className={inputCls}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("phonePlaceholder")}
        />
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <button
          onClick={verify}
          disabled={loading || !phone}
          className="mt-4 w-full rounded-lg bg-indigo-600 text-white py-3 font-medium disabled:opacity-50"
        >
          {t("continue")}
        </button>
      </div>
    );
  }

  if (actionDone) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
        <p className="text-gray-900 font-medium">
          {actionDone === "confirm" ? t("attendanceConfirmed") : t("attendanceRejected")}
        </p>
      </div>
    );
  }

  const date = new Date(appointment.startTime).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
  const time = new Date(appointment.startTime).toLocaleTimeString("he-IL", {
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
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center">
        <p className="text-gray-500">{t("noLongerActive")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="font-semibold text-gray-900">{t("yourAppointment")}</div>
        <div className="text-sm text-gray-500 mt-1">
          {appointment.serviceName} · {date} · {time}
        </div>
        <div className="text-sm text-gray-500">{appointment.businessName}</div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
        <button
          onClick={() => setAttendance("confirm")}
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 text-white py-3 font-medium disabled:opacity-50"
        >
          {t("iWillAttend")}
        </button>
        <ChangeRequestButtons
          token={token}
          phone={phone}
          appointment={appointment}
          onError={setError}
          parentLoading={loading}
        />
        <button
          onClick={() => setAttendance("reject")}
          disabled={loading}
          className="w-full rounded-lg border border-red-600 text-red-600 py-3 font-medium disabled:opacity-50"
        >
          {t("iWontAttend")}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ChangeRequestButtons({
  token,
  phone,
  appointment,
  onError,
  parentLoading,
}: {
  token: string;
  phone: string;
  appointment: AppointmentSummary;
  onError: (msg: string) => void;
  parentLoading: boolean;
}) {
  const t = useTranslations("appointmentLink");
  const [sent, setSent] = useState<"edit" | "cancel" | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const requestCancel = async () => {
    setSubmitting(true);
    try {
      await apiFetch(`/api/public/appointments/${token}/change-request`, {
        method: "POST",
        body: JSON.stringify({ phone, type: "cancel" }),
      });
      setSent("cancel");
    } catch {
      onError(t("actionFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return <p className="text-sm text-gray-500 text-center py-2">{t("requestSent")}</p>;
  }

  if (showPicker) {
    return (
      <DateTimePicker
        businessId={appointment.businessId}
        onSelect={async (slotStart) => {
          setSubmitting(true);
          try {
            await apiFetch(`/api/public/appointments/${token}/change-request`, {
              method: "POST",
              body: JSON.stringify({ phone, type: "edit", proposedStartTime: slotStart }),
            });
            setSent("edit");
          } catch {
            onError(t("actionFailed"));
          } finally {
            setSubmitting(false);
          }
        }}
        onCancel={() => setShowPicker(false)}
      />
    );
  }

  return (
    <>
      <button
        onClick={() => setShowPicker(true)}
        disabled={submitting || parentLoading}
        className="w-full rounded-lg border border-indigo-600 text-indigo-600 py-3 font-medium disabled:opacity-50"
      >
        {t("requestChange")}
      </button>
      <button
        onClick={requestCancel}
        disabled={submitting || parentLoading}
        className="w-full rounded-lg border border-red-600 text-red-600 py-3 font-medium disabled:opacity-50"
      >
        {t("requestCancel")}
      </button>
    </>
  );
}
