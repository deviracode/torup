"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
import { toast } from "sonner";
import { Trash2, Coffee } from "lucide-react";
import {
  Button,
  Badge,
  Input,
  Field,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  DatePicker,
  SegmentedControl,
  Skeleton,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@torup/ui";

const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

interface Break {
  id: string;
  type: string;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  label: string | null;
}

export default function BreaksTab() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { businessId } = useBusiness();
  const api = useApi();
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Break | null>(null);
  const [newBreak, setNewBreak] = useState({
    type: "recurring",
    day_of_week: 0,
    specific_date: "",
    start_time: "12:00",
    end_time: "13:00",
    label: "",
  });

  const fetchBreaks = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const r = await api<Break[]>(`/api/businesses/${businessId}/breaks`);
    setBreaks(Array.isArray(r) ? r : []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    if (businessId) fetchBreaks();
  }, [businessId, fetchBreaks]);

  const addBreak = async () => {
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}/breaks`, {
        method: "POST",
        body: JSON.stringify({
          type: newBreak.type,
          day_of_week:
            newBreak.type === "recurring" ? newBreak.day_of_week : null,
          specific_date:
            newBreak.type === "one_time" ? newBreak.specific_date : null,
          start_time: newBreak.start_time,
          end_time: newBreak.end_time,
          label: newBreak.label || null,
        }),
      });
      toast.success(t("saved"));
      fetchBreaks();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const deleteBreak = async () => {
    if (!deleteTarget) return;
    await api(`/api/businesses/${businessId}/breaks/${deleteTarget.id}`, {
      method: "DELETE",
    });
    toast.success(t("saved"));
    setDeleteTarget(null);
    fetchBreaks();
  };

  const typeOptions: { value: string; label: string }[] = [
    { value: "recurring", label: t("recurring") },
    { value: "one_time", label: t("oneTime") },
  ];

  return (
    <div className="space-y-4">
      {/* Break list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      ) : breaks.length > 0 ? (
        <div className="space-y-2">
          {breaks.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant="secondary">
                  {b.type === "recurring" ? t("recurring") : t("oneTime")}
                </Badge>
                <span className="font-medium truncate">
                  {b.label || t(b.type === "recurring" ? "recurring" : "oneTime")}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {b.type === "recurring" && b.day_of_week !== null
                    ? t(DAYS[b.day_of_week])
                    : b.specific_date}{" "}
                  {b.start_time} – {b.end_time}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive shrink-0 ms-3"
                onClick={() => setDeleteTarget(b)}
              >
                <Trash2 className="h-4 w-4 me-1" />
                {tCommon("delete")}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Coffee}
          title={t("noBreaks")}
          description={t("noBreaksDesc")}
        />
      )}

      {/* Add break form */}
      <div className="max-w-md border-t border-border pt-4">
        <div className="space-y-4 rounded-lg border border-border p-4">
          <h4 className="text-sm font-medium">{t("addBreak")}</h4>

          {/* Type */}
          <SegmentedControl
            options={typeOptions}
            value={newBreak.type}
            onChange={(v) => setNewBreak({ ...newBreak, type: v })}
          />

          {/* Day (recurring) or Date (one_time) */}
          {newBreak.type === "recurring" ? (
            <Field label={t("day")}>
              <Select
                value={String(newBreak.day_of_week)}
                onValueChange={(v) =>
                  setNewBreak({ ...newBreak, day_of_week: Number(v) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => (
                    <SelectItem key={d} value={String(i)}>
                      {t(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field label={t("date")}>
              <DatePicker
                value={
                  newBreak.specific_date
                    ? new Date(newBreak.specific_date + "T00:00:00")
                    : undefined
                }
                onChange={(date) =>
                  setNewBreak({
                    ...newBreak,
                    specific_date: date
                      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
                      : "",
                  })
                }
                placeholder={t("selectDate")}
              />
            </Field>
          )}

          {/* Start / End time — native inputs, side by side */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("startTime")}>
              <Input
                type="time"
                value={newBreak.start_time}
                onChange={(e) =>
                  setNewBreak({ ...newBreak, start_time: e.target.value })
                }
                className="w-full"
              />
            </Field>
            <Field label={t("endTime")}>
              <Input
                type="time"
                value={newBreak.end_time}
                onChange={(e) =>
                  setNewBreak({ ...newBreak, end_time: e.target.value })
                }
                className="w-full"
              />
            </Field>
          </div>

          {/* Label */}
          <Field label={t("label")}>
            <Input
              placeholder={t("label")}
              value={newBreak.label}
              onChange={(e) =>
                setNewBreak({ ...newBreak, label: e.target.value })
              }
              dir="auto"
              className="text-start"
            />
          </Field>

          <Button onClick={addBreak} loading={saving} className="w-full sm:w-auto">
            {t("addBreak")}
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteBreakTitle")}</DialogTitle>
            <DialogDescription>{t("deleteBreakConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={deleteBreak}>
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
