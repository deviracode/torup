"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Input,
} from "@torup/ui";
import { useApi } from "@/lib/use-api";
import { toLocalDateString } from "@/lib/format";

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

export function StaffCard({
  member,
  services,
  businessId,
  onUpdate,
  onRemove,
  onEdit,
}: {
  member: StaffMember;
  services: Service[];
  businessId: string;
  onUpdate: (updated: StaffMember) => void;
  onRemove: (id: string) => void;
  onEdit?: (member: StaffMember) => void;
}) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const api = useApi();

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

  const today = toLocalDateString(new Date());

  const displayLabel =
    member.display_name || member.user?.user_metadata?.name || member.user?.email || t("unnamedStaffMember");

  const initials = displayLabel
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const saveName = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api(
        `/api/businesses/${businessId}/staff/${member.id}`,
        { method: "PATCH", body: JSON.stringify({ display_name: displayName.trim() }) }
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
      await api(
        `/api/businesses/${businessId}/staff/${member.id}/services`,
        { method: "PUT", body: JSON.stringify({ service_ids: next }) }
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
      await api(
        `/api/businesses/${businessId}/staff/${member.id}/time-off`,
        { method: "POST", body: JSON.stringify({ start_date: timeOffStart, end_date: timeOffEnd }) }
      );
      const result = await api<{ ranges: TimeOffRange[] }>(
        `/api/businesses/${businessId}/staff/${member.id}/time-off`
      );
      if (!result) return;
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
      await api(
        `/api/businesses/${businessId}/staff/${member.id}/time-off`,
        { method: "DELETE", body: JSON.stringify({ break_ids: range.break_ids }) }
      );
      const next = timeOffRanges.filter((r) => r.id !== range.id);
      setTimeOffRanges(next);
      onUpdate({ ...member, service_ids: serviceIds, time_off_ranges: next });
    } catch {
      setError(t("errorRemoveTimeOff") as string);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 text-start"
        >
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{displayLabel}</span>
            {member.user?.email && member.display_name && (
              <span className="text-xs text-muted-foreground">{member.user.email}</span>
            )}
          </div>
          <Badge
            variant={member.role === "owner" ? "info" : "secondary"}
          >
            {t(member.role as "owner" | "staff")}
          </Badge>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <div className="flex items-center gap-1">
          {member.role !== "owner" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEdit) {
                    onEdit(member);
                  } else {
                    setExpanded(!expanded);
                  }
                }}
                aria-label={tCommon("edit")}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(member.id)}
                aria-label={tCommon("delete")}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <CardContent className="border-t border-border px-4 py-4 space-y-5">
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("staffDisplayName")}
            </label>
            <div className="flex gap-2">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                dir="auto"
              />
              <Button
                onClick={saveName}
                disabled={saving || !displayName.trim()}
                size="sm"
              >
                {tCommon("save")}
              </Button>
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
                <Input
                  type="date"
                  min={today}
                  value={timeOffStart}
                  onChange={(e) => setTimeOffStart(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t("endDate")}</label>
                <Input
                  type="date"
                  min={timeOffStart || today}
                  value={timeOffEnd}
                  onChange={(e) => setTimeOffEnd(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button
                onClick={addTimeOff}
                disabled={saving || !timeOffStart || !timeOffEnd}
                size="sm"
              >
                {tCommon("add")}
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
