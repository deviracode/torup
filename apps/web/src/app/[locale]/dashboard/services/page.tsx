"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
import {
  Card, CardContent, Button, Badge, Input, Label, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@torup/ui";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatILS } from "@/lib/format";

interface ServiceCategory {
  id: string;
  name_he: string;
  name_ar: string | null;
  name_en: string | null;
  sort_order: number;
}

interface Service {
  id: string;
  name_he: string;
  name_ar: string | null;
  name_en: string | null;
  description_he: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  price: number;
  max_capacity: number;
  is_active: boolean;
  sort_order: number;
  category_id: string | null;
  reminder_confirmation: boolean;
  color: string | null;
}

export default function ServicesPage() {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { businessId } = useBusiness();
  const api = useApi();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name_he: "", name_ar: "", name_en: "", description_he: "",
    duration_minutes: 30, buffer_minutes: 0, price: 0, max_capacity: 1, is_active: true,
    category_id: "" as string, reminder_confirmation: true,
    color: "#6366f1",
  });
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchServices = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [svcResult, catResult] = await Promise.all([
        api<Service[] | { categories: ServiceCategory[]; services: Service[] }>(
          `/api/businesses/${businessId}/services`
        ),
        api<ServiceCategory[]>(`/api/businesses/${businessId}/categories`),
      ]);
      setServices(svcResult ? (Array.isArray(svcResult) ? svcResult : (svcResult.services || [])) : []);
      setCategories(catResult || []);
    } catch { setServices([]); }
    finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { if (businessId) fetchServices(); }, [businessId, fetchServices]);

  const openEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name_he: service.name_he, name_ar: service.name_ar || "", name_en: service.name_en || "",
      description_he: service.description_he || "", duration_minutes: service.duration_minutes,
      buffer_minutes: service.buffer_minutes, price: service.price,
      max_capacity: service.max_capacity, is_active: service.is_active,
      category_id: service.category_id || "", reminder_confirmation: service.reminder_confirmation ?? true,
      color: service.color || "#6366f1",
    });
    setShowForm(true);
  };

  const openNew = () => {
    setEditingService(null);
    setFormData({ name_he: "", name_ar: "", name_en: "", description_he: "",
      duration_minutes: 30, buffer_minutes: 0, price: 0, max_capacity: 1, is_active: true,
      category_id: "", reminder_confirmation: true, color: "#6366f1" });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError("");
    try {
      const body = { ...formData, name_ar: formData.name_ar || null, name_en: formData.name_en || null, description_he: formData.description_he || null, category_id: formData.category_id || null };
      if (editingService) {
        await api(`/api/businesses/${businessId}/services/${editingService.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api(`/api/businesses/${businessId}/services`, { method: "POST", body: JSON.stringify(body) });
      }
      setShowForm(false);
      fetchServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const handleDelete = async (serviceId: string) => {
    if (!businessId || !confirm(t("deleteServiceConfirm"))) return;
    try {
      await api(`/api/businesses/${businessId}/services/${serviceId}`, { method: "DELETE" });
      fetchServices();
    } catch {}
  };

  const handleToggleActive = async (service: Service) => {
    if (!businessId) return;
    await api(`/api/businesses/${businessId}/services/${service.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !service.is_active }) }).catch(() => {});
    fetchServices();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{tNav("services")}</h1>
        <Button onClick={openNew} size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          {tCommon("add")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-8 w-8 ms-auto rounded" />
                </div>
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{t("noResults")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tNav("services")}</TableHead>
                  <TableHead>{t("serviceCategory")}</TableHead>
                  <TableHead>{t("min")}</TableHead>
                  <TableHead>₪</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id} className={!service.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {service.color && (
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ background: service.color }}
                          />
                        )}
                        <div>
                          <p className="font-medium">{service.name_he}</p>
                          {service.name_en && <p className="text-xs text-muted-foreground">{service.name_en}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {categories.find((c) => c.id === service.category_id)?.name_he || "—"}
                    </TableCell>
                    <TableCell>
                      {service.duration_minutes}
                      {service.buffer_minutes > 0 && <span className="text-muted-foreground"> +{service.buffer_minutes}</span>}
                    </TableCell>
                    <TableCell>{formatILS(service.price)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={service.is_active ? "success" : "outline"}
                        className="cursor-pointer"
                        onClick={() => handleToggleActive(service)}
                      >
                        {service.is_active ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(service)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(service.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Service Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingService ? tCommon("edit") : tCommon("add")} {tNav("services")}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

            <div className="space-y-2">
              <Label>{t("nameHe")} *</Label>
              <Input required value={formData.name_he} onChange={(e) => setFormData({ ...formData, name_he: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("nameEn")}</Label>
                <Input value={formData.name_en} onChange={(e) => setFormData({ ...formData, name_en: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("nameAr")}</Label>
                <Input value={formData.name_ar} onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("descriptionHe")}</Label>
              <textarea value={formData.description_he} onChange={(e) => setFormData({ ...formData, description_he: e.target.value })} rows={2}
                dir="auto"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-start" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("min")} *</Label>
                <Input type="number" required min={5} value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                  className="text-end" />
              </div>
              <div className="space-y-2">
                <Label>{t("buffer")} ({t("min")})</Label>
                <Input type="number" min={0} value={formData.buffer_minutes}
                  onChange={(e) => setFormData({ ...formData, buffer_minutes: Number(e.target.value) })}
                  className="text-end" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>₪ {t("price")}</Label>
                <Input type="number" min={0} value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="text-end" />
              </div>
              <div className="space-y-2">
                <Label>{t("capacity")}</Label>
                <Input type="number" min={1} value={formData.max_capacity}
                  onChange={(e) => setFormData({ ...formData, max_capacity: Number(e.target.value) })}
                  className="text-end" />
              </div>
            </div>
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>{t("serviceCategory")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                >
                  <option value="">{t("noCategory")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name_he}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
              <Label htmlFor="is_active">{t("active")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="reminder_confirmation" checked={formData.reminder_confirmation}
                onChange={(e) => setFormData({ ...formData, reminder_confirmation: e.target.checked })} />
              <Label htmlFor="reminder_confirmation">{t("reminderConfirmation")}</Label>
            </div>
            <div className="flex items-center gap-3">
              <Label>{t("serviceColor")}</Label>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full border-2 border-white/20 cursor-pointer overflow-hidden flex-shrink-0"
                  style={{ background: formData.color }}
                  onClick={() => document.getElementById("service-color-input")?.click()}
                />
                <input
                  id="service-color-input"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="sr-only"
                />
                <span className="text-xs text-muted-foreground font-mono">{formData.color}</span>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
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
