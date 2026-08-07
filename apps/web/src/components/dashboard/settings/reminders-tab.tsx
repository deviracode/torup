"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
import { toast } from "sonner";
import { Bell, Trash2 } from "lucide-react";
import {
  Button,
  Switch,
  SettingRow,
  EmptyState,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@torup/ui";

const REMINDER_PRESETS = [
  { minutes: 15, label: "15min" },
  { minutes: 30, label: "30min" },
  { minutes: 60, label: "1h" },
  { minutes: 120, label: "2h" },
  { minutes: 240, label: "4h" },
  { minutes: 720, label: "12h" },
  { minutes: 1440, label: "24h" },
  { minutes: 2880, label: "48h" },
];

interface ReminderSetting {
  id: string;
  minutes_before: number;
  is_active: boolean;
}

function getPresetLabel(
  minutesBefore: number,
  t: ReturnType<typeof useTranslations<"dashboard">>
) {
  const preset = REMINDER_PRESETS.find((p) => p.minutes === minutesBefore);
  if (preset) return t(`reminder_${preset.label}`);
  return `${minutesBefore} ${t("min")}`;
}

export default function RemindersTab() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { businessId } = useBusiness();
  const api = useApi();
  const [reminders, setReminders] = useState<ReminderSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPresets, setSelectedPresets] = useState<Set<number>>(
    new Set()
  );
  const [deleteTarget, setDeleteTarget] = useState<ReminderSetting | null>(
    null
  );

  const fetchReminders = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const r = await api<ReminderSetting[]>(
      `/api/businesses/${businessId}/reminder-settings`
    );
    setReminders(Array.isArray(r) ? r : []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    if (businessId) fetchReminders();
  }, [businessId, fetchReminders]);

  const addSelected = async () => {
    if (selectedPresets.size === 0) return;
    setSaving(true);
    try {
      for (const minutesBefore of selectedPresets) {
        await api(`/api/businesses/${businessId}/reminder-settings`, {
          method: "POST",
          body: JSON.stringify({ minutes_before: minutesBefore }),
        });
      }
      setSelectedPresets(new Set());
      await fetchReminders();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setSaving(false);
    }
  };

  const toggleReminder = async (id: string, isActive: boolean) => {
    // optimistic
    const previous = reminders;
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_active: isActive } : r))
    );
    try {
      await api(`/api/businesses/${businessId}/reminder-settings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      });
    } catch {
      setReminders(previous);
      toast.error(tCommon("error"));
    }
  };

  const deleteReminder = async () => {
    if (!deleteTarget) return;
    await api(
      `/api/businesses/${businessId}/reminder-settings/${deleteTarget.id}`,
      {
        method: "DELETE",
      }
    );
    setDeleteTarget(null);
    fetchReminders();
  };

  const togglePreset = (minutes: number) => {
    setSelectedPresets((prev) => {
      const next = new Set(prev);
      if (next.has(minutes)) {
        next.delete(minutes);
      } else {
        next.add(minutes);
      }
      return next;
    });
  };

  const activeMinutes = new Set(reminders.map((r) => r.minutes_before));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("remindersDescription")}
      </p>

      {/* Active reminders */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-border"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-9 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-4 w-4 rounded" />
            </div>
          ))}
        </div>
      ) : reminders.length > 0 ? (
        <div className="space-y-2">
          {reminders.map((r) => (
            <SettingRow
              key={r.id}
              title={getPresetLabel(r.minutes_before, t)}
              className="rounded-lg border border-border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Switch
                  checked={r.is_active}
                  onCheckedChange={(checked) => toggleReminder(r.id, checked)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(r)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </SettingRow>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title={t("noReminders")}
          description={t("noRemindersDesc")}
        />
      )}

      {/* Add form: preset chips */}
      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-medium mb-3">{t("addReminder")}</h4>
        <div className="flex flex-wrap gap-2">
          {REMINDER_PRESETS.map((p) => {
            const isActive = activeMinutes.has(p.minutes);
            const isSelected = selectedPresets.has(p.minutes);
            return (
              <button
                key={p.minutes}
                disabled={isActive || saving}
                onClick={() => togglePreset(p.minutes)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "border-transparent bg-muted text-muted-foreground cursor-not-allowed"
                    : isSelected
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "border-border hover:bg-accent"
                } disabled:opacity-50`}
                title={isActive ? t("addReminder") : undefined}
              >
                {t(`reminder_${p.label}`)}
              </button>
            );
          })}
        </div>
        {selectedPresets.size > 0 && (
          <Button
            onClick={addSelected}
            loading={saving}
            className="mt-3"
            variant="default"
          >
            {t("addReminder")}
          </Button>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteReminderTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteReminderConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={deleteReminder}>
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
