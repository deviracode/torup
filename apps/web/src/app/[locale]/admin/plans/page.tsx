"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number;
  max_staff: number;
  max_appointments_monthly: number;
  features: Record<string, boolean> | null;
  is_active: boolean;
}

export default function AdminPlansPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { session } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    name: "", monthly_price: 0, yearly_price: 0, max_staff: 1,
    max_appointments_monthly: 100, is_active: true,
  });
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

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name, monthly_price: plan.monthly_price, yearly_price: plan.yearly_price,
      max_staff: plan.max_staff, max_appointments_monthly: plan.max_appointments_monthly,
      is_active: plan.is_active,
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditingPlan(null);
    setFormData({ name: "", monthly_price: 0, yearly_price: 0, max_staff: 1, max_appointments_monthly: 100, is_active: true });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingPlan) {
        await apiFetch(`/api/admin/plans/${editingPlan.id}`, { method: "PATCH", body: JSON.stringify(formData) }, token);
      } else {
        await apiFetch("/api/admin/plans", { method: "POST", body: JSON.stringify(formData) }, token);
      }
      setShowForm(false);
      fetchPlans();
    } catch {} finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("plans")}</h1>
        <button onClick={openNew}
          className="rounded-md bg-red-600 px-4 py-2 text-sm text-white font-medium hover:bg-red-700">
          + {t("addPlan")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full rounded-lg bg-white p-8 text-center text-gray-400 border border-gray-200">{tCommon("loading")}</div>
        ) : plans.map((plan) => (
          <div key={plan.id} className={`rounded-lg border bg-white p-6 ${plan.is_active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <button onClick={() => openEdit(plan)} className="text-xs text-blue-600 hover:underline">{tCommon("edit")}</button>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">{t("monthlyPrice")}:</span> ₪{plan.monthly_price}</p>
              <p><span className="text-gray-500">{t("yearlyPrice")}:</span> ₪{plan.yearly_price}</p>
              <p><span className="text-gray-500">{t("maxStaff")}:</span> {plan.max_staff}</p>
              <p><span className="text-gray-500">{t("maxAppointments")}:</span> {plan.max_appointments_monthly}</p>
            </div>
            <div className="mt-3">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${plan.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {plan.is_active ? t("active") : t("inactive")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold">{editingPlan ? t("editPlan") : t("addPlan")}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t("planName")} *</label>
                <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("monthlyPrice")} (₪)</label>
                  <input type="number" min={0} value={formData.monthly_price} onChange={(e) => setFormData({ ...formData, monthly_price: Number(e.target.value) })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("yearlyPrice")} (₪)</label>
                  <input type="number" min={0} value={formData.yearly_price} onChange={(e) => setFormData({ ...formData, yearly_price: Number(e.target.value) })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("maxStaff")}</label>
                  <input type="number" min={1} value={formData.max_staff} onChange={(e) => setFormData({ ...formData, max_staff: Number(e.target.value) })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("maxAppointments")}</label>
                  <input type="number" min={1} value={formData.max_appointments_monthly} onChange={(e) => setFormData({ ...formData, max_appointments_monthly: Number(e.target.value) })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="plan_active" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                <label htmlFor="plan_active" className="text-sm">{t("active")}</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 rounded-md bg-red-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-red-700 disabled:opacity-50">
                  {tCommon("save")}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-md border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">
                  {tCommon("cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
