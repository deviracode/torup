"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import {
  cn,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@torup/ui";

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number | null;
  max_staff: number | null;
  max_appointments_monthly: number | null;
  has_whatsapp_bot: boolean;
  has_ai_bot: boolean;
  max_ai_tokens_monthly: number;
  is_active: boolean;
}

const DEFAULT_AI_TOKENS = 2_400_000;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M tokens/mo`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K tokens/mo`;
  return `${n} tokens/mo`;
}

const emptyForm = {
  name: "",
  monthly_price: 0,
  yearly_price: "" as number | "",
  max_staff: "" as number | "",
  max_appointments_monthly: "" as number | "",
  has_whatsapp_bot: false,
  has_ai_bot: false,
  max_ai_tokens_monthly: 0,
  is_active: true,
};

type FormData = typeof emptyForm;

export default function AdminPlansPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { session } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const token = session?.access_token || "";

  const fetchPlans = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<Plan[]>("/api/admin/plans", {}, token);
      setPlans(Array.isArray(data) ? data : []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const openNew = () => {
    setEditingPlan(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      monthly_price: plan.monthly_price,
      yearly_price: plan.yearly_price ?? "",
      max_staff: plan.max_staff ?? "",
      max_appointments_monthly: plan.max_appointments_monthly ?? "",
      has_whatsapp_bot: plan.has_whatsapp_bot,
      has_ai_bot: plan.has_ai_bot,
      max_ai_tokens_monthly: plan.max_ai_tokens_monthly,
      is_active: plan.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...formData,
      yearly_price: formData.yearly_price === "" ? null : Number(formData.yearly_price),
      max_staff: formData.max_staff === "" ? null : Number(formData.max_staff),
      max_appointments_monthly:
        formData.max_appointments_monthly === "" ? null : Number(formData.max_appointments_monthly),
    };
    try {
      if (editingPlan) {
        await apiFetch(
          `/api/admin/plans/${editingPlan.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
          token
        );
      } else {
        await apiFetch(
          "/api/admin/plans",
          { method: "POST", body: JSON.stringify(payload) },
          token
        );
      }
      setDialogOpen(false);
      fetchPlans();
    } catch {
      // TODO: surface error toast
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("plans")}</h1>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Plan
        </Button>
      </div>

      {/* Plan cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="col-span-full text-center text-muted-foreground py-12">
            {tCommon("loading")}
          </p>
        ) : plans.length === 0 ? (
          <p className="col-span-full text-center text-muted-foreground py-12">
            No plans yet.
          </p>
        ) : (
          plans.map((plan) => (
            <Card
              key={plan.id}
              className={cn(!plan.is_active && "opacity-60")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? t("active") : t("inactive")}
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  ₪{plan.monthly_price}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
              </CardHeader>

              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("maxStaff")}</span>
                  <span>{plan.max_staff ?? "Unlimited"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("maxAppointments")}</span>
                  <span>{plan.max_appointments_monthly ?? "Unlimited"}</span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant={plan.has_whatsapp_bot ? "default" : "secondary"}>
                    {plan.has_whatsapp_bot ? "✓" : "✗"} WhatsApp Bot
                  </Badge>
                  <Badge variant={plan.has_ai_bot ? "default" : "secondary"}>
                    {plan.has_ai_bot ? "✓" : "✗"} AI Bot
                  </Badge>
                </div>

                {plan.has_ai_bot && (
                  <p className="text-xs text-muted-foreground">
                    {formatTokens(plan.max_ai_tokens_monthly)}
                  </p>
                )}
              </CardContent>

              <CardFooter>
                <Button variant="outline" size="sm" onClick={() => openEdit(plan)} className="w-full">
                  {t("editPlan")}
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? t("editPlan") : t("addPlan")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Plan name */}
            <div className="space-y-1.5">
              <Label htmlFor="plan-name">{t("planName")} *</Label>
              <Input
                id="plan-name"
                required
                value={formData.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="monthly-price">{t("monthlyPrice")} (₪)</Label>
                <Input
                  id="monthly-price"
                  type="number"
                  min={0}
                  value={formData.monthly_price}
                  onChange={(e) => set("monthly_price", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="yearly-price">{t("yearlyPrice")} (₪)</Label>
                <Input
                  id="yearly-price"
                  type="number"
                  min={0}
                  placeholder="Optional"
                  value={formData.yearly_price}
                  onChange={(e) =>
                    set("yearly_price", e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="max-staff">{t("maxStaff")}</Label>
                <Input
                  id="max-staff"
                  type="number"
                  min={1}
                  placeholder="Unlimited (leave blank)"
                  value={formData.max_staff}
                  onChange={(e) =>
                    set("max_staff", e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-appt">{t("maxAppointments")}</Label>
                <Input
                  id="max-appt"
                  type="number"
                  min={1}
                  placeholder="Unlimited (leave blank)"
                  value={formData.max_appointments_monthly}
                  onChange={(e) =>
                    set(
                      "max_appointments_monthly",
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                />
              </div>
            </div>

            {/* WhatsApp Bot */}
            <div className="flex items-center justify-between">
              <Label htmlFor="whatsapp-bot">WhatsApp Bot</Label>
              <input
                id="whatsapp-bot"
                type="checkbox"
                className="h-4 w-4 cursor-pointer"
                checked={formData.has_whatsapp_bot}
                onChange={(e) => set("has_whatsapp_bot", e.target.checked)}
              />
            </div>

            {/* AI Bot */}
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-bot">AI Bot</Label>
              <input
                id="ai-bot"
                type="checkbox"
                className="h-4 w-4 cursor-pointer"
                checked={formData.has_ai_bot}
                onChange={(e) => {
                  set("has_ai_bot", e.target.checked);
                  set("max_ai_tokens_monthly", e.target.checked ? DEFAULT_AI_TOKENS : 0);
                }}
              />
            </div>

            {/* AI Tokens */}
            <div className="space-y-1.5">
              <Label htmlFor="ai-tokens">AI Tokens/Month</Label>
              <Input
                id="ai-tokens"
                type="number"
                min={0}
                disabled
                value={formData.max_ai_tokens_monthly}
              />
              {formData.has_ai_bot && (
                <p className="text-xs text-muted-foreground">
                  ≈ 2,000 conversations/month
                </p>
              )}
            </div>

            {/* Active */}
            <div className="flex items-center justify-between">
              <Label htmlFor="plan-active">{t("active")}</Label>
              <input
                id="plan-active"
                type="checkbox"
                className="h-4 w-4 cursor-pointer"
                checked={formData.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {tCommon("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
