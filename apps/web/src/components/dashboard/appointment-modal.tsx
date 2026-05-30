"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Badge, Button, Separator, Card, CardContent } from "@torup/ui";
import { User, Scissors, CalendarDays, FileText, Clock, Phone, Bell } from "lucide-react";

interface Appointment {
  id: string;
  service_id: string;
  customer_id: string;
  staff_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  created_via: string;
  customers?: { name: string; phone: string };
  services?: { name_he: string; name_ar: string | null; name_en: string | null; duration_minutes?: number; price?: number };
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_approval: [], // approve/reject use dedicated endpoints, not the generic PATCH /status
  pending: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  pending_approval: "warning",
  pending: "warning",
  confirmed: "default",
  in_progress: "secondary",
  completed: "success",
  cancelled: "outline",
  no_show: "destructive",
};

const STATUS_DOT: Record<string, string> = {
  pending_approval: "bg-orange-500",
  pending: "bg-yellow-500",
  confirmed: "bg-blue-500",
  in_progress: "bg-purple-500",
  completed: "bg-green-500",
  cancelled: "bg-gray-400",
  no_show: "bg-red-500",
};

export function AppointmentModal({
  appointment,
  businessId,
  token,
  onClose,
  onUpdate,
}: {
  appointment: Appointment;
  businessId: string;
  token: string;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const t = useTranslations("dashboard");
  const tStatus = useTranslations("appointments");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reminderLogs, setReminderLogs] = useState<{ template_id: string; status: string; sent_at: string; customer_response: string | null; responded_at: string | null }[]>([]);

  useEffect(() => {
    apiFetch<{ notifications: { template_id: string; status: string; sent_at: string; customer_response: string | null; responded_at: string | null }[] }>(
      `/api/businesses/${businessId}/notifications?appointment_id=${appointment.id}&type=reminder`,
      {},
      token
    ).then((r) => setReminderLogs(Array.isArray(r.notifications) ? r.notifications : [])).catch(() => {});
  }, [businessId, appointment.id, token]);

  const nextStatuses = VALID_TRANSITIONS[appointment.status] || [];

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    setError("");
    try {
      await apiFetch(
        `/api/businesses/${businessId}/appointments/${appointment.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        },
        token
      );
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const startTime = new Date(appointment.start_time).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const endTime = new Date(appointment.end_time).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateStr = new Date(appointment.start_time).toLocaleDateString("he-IL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleApprovalAction = async (action: "approve" | "reject") => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{ approved?: string; rejected: string | string[] }>(
        `/api/businesses/${businessId}/appointments/${appointment.id}/${action}`,
        { method: "POST" },
        token
      );
      if (action === "approve" && Array.isArray(result.rejected) && result.rejected.length > 0) {
        // Surface the side-effect to the manager.
        setError(`Approved. ${result.rejected.length} other applicant(s) for the same slot were auto-rejected and notified.`);
      }
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} appointment`);
    } finally {
      setLoading(false);
    }
  };

  const statusKey = appointment.status === "in_progress" ? "inProgress" : appointment.status === "no_show" ? "noShow" : appointment.status === "pending_approval" ? "pendingApproval" : appointment.status;
  const dotColor = STATUS_DOT[appointment.status] || STATUS_DOT.pending;

  const durationMin = appointment.services?.duration_minutes;
  const price = appointment.services?.price;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent>
        {/* Header with status */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{t("appointmentDetails")}</DialogTitle>
            <Badge variant={STATUS_VARIANT[appointment.status] || "outline"} className="text-xs">
              <span className={`inline-block h-2 w-2 rounded-full me-1.5 ${dotColor}`} />
              {tStatus(statusKey)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {appointment.created_via}
          </p>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Info cards grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Customer card */}
          <Card className="border-0 shadow-none bg-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("customer")}</p>
              </div>
              <p className="font-semibold text-sm">{appointment.customers?.name || "—"}</p>
              {appointment.customers?.phone && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground" dir="ltr">{appointment.customers.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Service card */}
          <Card className="border-0 shadow-none bg-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-purple-500/10">
                  <Scissors className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("service")}</p>
              </div>
              <p className="font-semibold text-sm">{appointment.services?.name_he || "—"}</p>
              {(durationMin || price) && (
                <div className="flex items-center gap-2 mt-1">
                  {durationMin && (
                    <span className="text-xs text-muted-foreground">{durationMin} {t("min")}</span>
                  )}
                  {durationMin && price && <span className="text-muted-foreground">·</span>}
                  {price && (
                    <span className="text-xs font-medium text-emerald-600">₪{price}</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Date & Time banner */}
        <Card className="border-0 shadow-none bg-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-500/10">
                <CalendarDays className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{dateStr}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{startTime} – {endTime}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {appointment.notes && (
          <Card className="border-0 shadow-none bg-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("notes")}</p>
              </div>
              <p className="text-sm leading-relaxed">{appointment.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Reminder Status */}
        {reminderLogs.length > 0 && (
          <Card className="border-0 shadow-none bg-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("reminderStatus")}</p>
              </div>
              <div className="space-y-1.5">
                {reminderLogs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {log.template_id.replace("reminder_", "").replace("m", " min")}
                    </span>
                    <span className={log.customer_response === "confirmed" ? "text-green-600 font-medium" : log.customer_response === "cancelled" ? "text-red-600 font-medium" : "text-muted-foreground"}>
                      {log.customer_response === "confirmed" ? t("reminderConfirmed") : log.customer_response === "cancelled" ? t("reminderCancelled") : log.status === "read" ? t("reminderRead") : log.status === "delivered" ? t("reminderDelivered") : t("reminderSent")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approval actions (only for pending_approval) */}
        {appointment.status === "pending_approval" && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {t("manageRequest") || "Manage request"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleApprovalAction("approve")}
                  disabled={loading}
                  variant="default"
                  size="sm"
                >
                  ✅ {tCommon("approve") || "Approve"}
                </Button>
                <Button
                  onClick={() => handleApprovalAction("reject")}
                  disabled={loading}
                  variant="destructive"
                  size="sm"
                >
                  ❌ {tCommon("reject") || "Reject"}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Status transition actions */}
        {nextStatuses.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {t("changeStatus")}
              </p>
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map((status) => {
                  const key = status === "in_progress" ? "inProgress" : status === "no_show" ? "noShow" : status;
                  const isDestructive = status === "cancelled" || status === "no_show";
                  const isPositive = status === "confirmed" || status === "completed";
                  return (
                    <Button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      disabled={loading}
                      variant={isDestructive ? "destructive" : isPositive ? "default" : "outline"}
                      size="sm"
                    >
                      <span className={`inline-block h-2 w-2 rounded-full me-1.5 ${STATUS_DOT[status] || ""}`} />
                      {tStatus(key)}
                    </Button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tCommon("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
