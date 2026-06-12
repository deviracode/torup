"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";

interface Service {
  id: string;
  name_he: string;
}

interface TimeOffRange {
  id: string;
  start_date: string;
  end_date: string;
  break_ids: string[];
}

export interface StaffMember {
  id: string;
  user_id: string;
  role: string;
  display_name?: string;
  user?: { email: string; user_metadata?: { name?: string } };
  service_ids: string[];
  time_off_ranges: TimeOffRange[];
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export function StaffCard({
  member,
  services,
  businessId,
  token,
  onUpdate,
  onRemove,
}: {
  member: StaffMember;
  services: Service[];
  businessId: string;
  token: string;
  onUpdate: (updated: StaffMember) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");

  const [expanded, setExpanded] = useState(false);
  const [displayName, setDisplayName] = useState(
    member.display_name || member.user?.user_metadata?.name || member.user?.email || ""
  );
  const [serviceIds, setServiceIds] = useState<string[]>(member.service_ids);
  const [timeOffRanges, setTimeOffRanges] = useState<TimeOffRange[]>(member.time_off_ranges);
  const [timeOffStart, setTimeOffStart] = useState("");
  const [timeOffEnd, setTimeOffEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const saveName = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(
        `/api/businesses/${businessId}/staff/${member.id}`,
        { method: "PATCH", body: JSON.stringify({ display_name: displayName.trim() }) },
        token
      );
      onUpdate({ ...member, display_name: displayName.trim(), service_ids: serviceIds, time_off_ranges: timeOffRanges });
    } catch {
      setError(t("errorSaveName") as string);
    } finally {
      setSaving(false);
    }
  };

  const toggleService = async (serviceId: string) => {
    const next = serviceIds.includes(serviceId)
      ? serviceIds.filter((id) => id !== serviceId)
      : [...serviceIds, serviceId];
    setServiceIds(next);
    try {
      await apiFetch(
        `/api/businesses/${businessId}/staff/${member.id}/services`,
        { method: "PUT", body: JSON.stringify({ service_ids: next }) },
        token
      );
      onUpdate({ ...member, service_ids: next, time_off_ranges: timeOffRanges });
    } catch {
      setError(t("errorUpdateServices") as string);
      setServiceIds(serviceIds);
    }
  };

  const addTimeOff = async () => {
    if (!timeOffStart || !timeOffEnd) return;
    if (timeOffEnd < timeOffStart) {
      setError(t("errorEndBeforeStart") as string);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiFetch(
        `/api/businesses/${businessId}/staff/${member.id}/time-off`,
        { method: "POST", body: JSON.stringify({ start_date: timeOffStart, end_date: timeOffEnd }) },
        token
      );
      const result = await apiFetch<{ ranges: TimeOffRange[] }>(
        `/api/businesses/${businessId}/staff/${member.id}/time-off`,
        {},
        token
      );
      setTimeOffRanges(result.ranges);
      setTimeOffStart("");
      setTimeOffEnd("");
      onUpdate({ ...member, service_ids: serviceIds, time_off_ranges: result.ranges });
    } catch {
      setError(t("errorAddTimeOff") as string);
    } finally {
      setSaving(false);
    }
  };

  const removeTimeOff = async (range: TimeOffRange) => {
    try {
      await apiFetch(
        `/api/businesses/${businessId}/staff/${member.id}/time-off`,
        { method: "DELETE", body: JSON.stringify({ break_ids: range.break_ids }) },
        token
      );
      const next = timeOffRanges.filter((r) => r.id !== range.id);
      setTimeOffRanges(next);
      onUpdate({ ...member, service_ids: serviceIds, time_off_ranges: next });
    } catch {
      setError(t("errorRemoveTimeOff") as string);
    }
  };

  const displayLabel =
    member.display_name || member.user?.user_metadata?.name || member.user?.email || member.user_id;

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm font-medium text-foreground hover:text-primary"
          >
            {expanded ? "▾" : "▸"} {displayLabel}
          </button>
          {member.user?.email && member.display_name && (
            <span className="text-xs text-muted-foreground">{member.user.email}</span>
          )}
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs ${
              member.role === "owner" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            {t(member.role as "owner" | "staff")}
          </span>
        </div>
        {member.role !== "owner" && (
          <button onClick={() => onRemove(member.id)} className="text-red-500 text-xs hover:underline">
            {tCommon("delete")}
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-5">
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("staffDisplayName")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputCls}
              />
              <button
                onClick={saveName}
                disabled={saving || !displayName.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {tCommon("save")}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {t("assignedServices")}
            </label>
            <div className="space-y-1.5">
              {services.map((svc) => (
                <label key={svc.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={serviceIds.includes(svc.id)}
                    onChange={() => toggleService(svc.id)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm text-foreground">{svc.name_he}</span>
                </label>
              ))}
              {services.length === 0 && (
                <p className="text-xs text-muted-foreground">{t("noServices")}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {t("timeOff")}
            </label>
            {timeOffRanges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {timeOffRanges.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs text-primary"
                  >
                    {r.start_date === r.end_date ? r.start_date : `${r.start_date} – ${r.end_date}`}
                    <button onClick={() => removeTimeOff(r)} className="hover:text-destructive leading-none">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t("startDate")}</label>
                <input
                  type="date"
                  min={today}
                  value={timeOffStart}
                  onChange={(e) => setTimeOffStart(e.target.value)}
                  className={inputCls + " w-40"}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t("endDate")}</label>
                <input
                  type="date"
                  min={timeOffStart || today}
                  value={timeOffEnd}
                  onChange={(e) => setTimeOffEnd(e.target.value)}
                  className={inputCls + " w-40"}
                />
              </div>
              <button
                onClick={addTimeOff}
                disabled={saving || !timeOffStart || !timeOffEnd}
                className="rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {tCommon("add")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
