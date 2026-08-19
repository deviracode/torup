"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
import { toast } from "sonner";
import { Button, Input, Skeleton } from "@torup/ui";

interface BookingRules {
  min_advance_minutes: number;
  max_future_days: number;
  cancellation_window_minutes: number;
  reschedule_window_minutes: number;
}

interface RuleCard {
  titleKey: string;
  descKey: string;
  labelKey: string;
  unitKey: string;
  min: number;
  get: (r: BookingRules) => number;
  set: (r: BookingRules, v: number) => BookingRules;
}

const RULE_CARDS: RuleCard[] = [
  {
    titleKey: "rulesAdvanceTitle",
    descKey: "minAdvanceDesc",
    labelKey: "minAdvance",
    unitKey: "min",
    min: 0,
    get: (r) => r.min_advance_minutes,
    set: (r, v) => ({ ...r, min_advance_minutes: v }),
  },
  {
    titleKey: "rulesWindowTitle",
    descKey: "maxFutureDaysDesc",
    labelKey: "maxFutureDays",
    unitKey: "unitDays",
    min: 1,
    get: (r) => r.max_future_days,
    set: (r, v) => ({ ...r, max_future_days: v }),
  },
  {
    titleKey: "rulesCancellationTitle",
    descKey: "cancellationWindowDesc",
    labelKey: "cancellationWindow",
    unitKey: "min",
    min: 0,
    get: (r) => r.cancellation_window_minutes,
    set: (r, v) => ({ ...r, cancellation_window_minutes: v }),
  },
  {
    titleKey: "rulesRescheduleTitle",
    descKey: "rescheduleWindowDesc",
    labelKey: "rescheduleWindow",
    unitKey: "min",
    min: 0,
    get: (r) => r.reschedule_window_minutes,
    set: (r, v) => ({ ...r, reschedule_window_minutes: v }),
  },
];

export default function BookingRulesTab() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { businessId } = useBusiness();
  const api = useApi();
  const [rules, setRules] = useState<BookingRules>({
    min_advance_minutes: 60,
    max_future_days: 30,
    cancellation_window_minutes: 120,
    reschedule_window_minutes: 120,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    api<BookingRules>(`/api/businesses/${businessId}/booking-rules`).then(
      (r) => {
        if (r) setRules(r);
        setLoading(false);
      }
    );
  }, [businessId]);

  const saveRules = async () => {
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}/booking-rules`, {
        method: "PUT",
        body: JSON.stringify(rules),
      });
      toast.success(t("saved"));
    } catch {
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-border p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <div className="flex items-center justify-center gap-2 pt-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-4 w-8" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {RULE_CARDS.map((card) => (
          <div key={card.titleKey} className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold">{t(card.titleKey)}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(card.descKey)}
            </p>
            {/* label | centered number | unit — number stays centered in RTL/LTR */}
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t(card.labelKey)}
              </span>
              <Input
                type="number"
                min={card.min}
                value={card.get(rules)}
                onChange={(e) => setRules(card.set(rules, Number(e.target.value)))}
                className="w-24 justify-self-center text-center tabular-nums"
              />
              <span className="text-sm text-muted-foreground">
                {t(card.unitKey)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={saveRules} loading={saving}>
        {tCommon("save")}
      </Button>
    </div>
  );
}
