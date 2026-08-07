"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
import { Card, CardContent, Button, Input, Label, Skeleton, EmptyState } from "@torup/ui";
import { Scissors } from "lucide-react";
import { formatILS } from "@/lib/format";

interface ServiceItem {
  id: string;
  name_he: string;
  name_ar: string | null;
  name_en: string | null;
  duration_minutes: number;
  price: number;
  price_type: string;
  sort_order: number;
  category_id: string | null;
}

interface ServiceCategory {
  id: string;
  name_he: string;
  name_ar: string | null;
  name_en: string | null;
  sort_order: number;
}

export default function ServicesTab() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { businessId } = useBusiness();
  const api = useApi();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState<
    string | null
  >(null);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<Partial<ServiceItem>>({});

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    Promise.all([
      api<ServiceItem[] | { categories: ServiceCategory[]; services: ServiceItem[] }>(
        `/api/businesses/${businessId}/services`
      ),
      api<ServiceCategory[]>(`/api/businesses/${businessId}/categories`),
    ])
      .then(([svcResult, catResult]) => {
        const svcList = Array.isArray(svcResult)
          ? svcResult
          : (svcResult as { services: ServiceItem[] }).services;
        setServices(svcList || []);
        setCategories(catResult || []);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // Preserve the original save handler for services (inline editing)
  const handleSaveService = async (svcId: string) => {
    const svc = services.find((s) => s.id === svcId);
    if (!svc) return;
    const updated = await api<ServiceItem>(
      `/api/businesses/${businessId}/services/${svc.id}`,
      { method: "PATCH", body: JSON.stringify(serviceForm) }
    );
    if (!updated) return;
    setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditingService(null);
    setServiceForm({});
  };

  const handleReorderCategory = async (
    catId: string,
    direction: "up" | "down"
  ) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const newOrder = direction === "up"
      ? Math.max(0, cat.sort_order - 1)
      : cat.sort_order + 1;
    await api(`/api/businesses/${businessId}/categories/${cat.id}`, {
      method: "PATCH",
      body: JSON.stringify({ sort_order: newOrder }),
    });
    setCategories((prev) =>
      prev
        .map((c) => (c.id === cat.id ? { ...c, sort_order: newOrder } : c))
        .sort((a, b) => a.sort_order - b.sort_order)
    );
  };

  const handleCreateCategory = async (svcId: string) => {
    if (!newCategoryName.trim()) return;
    const created = await api<ServiceCategory>(
      `/api/businesses/${businessId}/categories`,
      {
        method: "POST",
        body: JSON.stringify({
          name_he: newCategoryName,
          sort_order: categories.length,
        }),
      }
    );
    if (!created) return;
    setCategories((prev) => [...prev, created]);
    setServiceForm((f) => ({ ...f, category_id: created.id }));
    setNewCategoryName("");
    setShowNewCategoryInput(null);
  };

  if (loading) {
    return (
      <div className="space-y-4" data-testid="services-skeleton">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (services.length === 0 && categories.length === 0) {
    return (
      <EmptyState icon={Scissors} title={t("noServices")} />
    );
  }

  return (
    <div className="space-y-6">
      {[
        ...categories.map((cat) => ({
          catId: cat.id,
          label: cat.name_he,
          items: services.filter((s) => s.category_id === cat.id),
        })),
        {
          catId: null as string | null,
          label: t("noCategory"),
          items: services.filter((s) => !s.category_id),
        },
      ]
        .filter((group) => group.items.length > 0 || group.catId === null)
        .map((group) => (
          <div key={group.catId ?? "uncategorized"}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                {group.label}
              </h3>
              {group.catId && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1 text-xs"
                    onClick={() => handleReorderCategory(group.catId!, "up")}
                  >
                    ▲
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1 text-xs"
                    onClick={() => handleReorderCategory(group.catId!, "down")}
                  >
                    ▼
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {group.items.map((svc) => (
                <Card key={svc.id}>
                  <CardContent className="p-4">
                    {editingService === svc.id ? (
                      <div className="space-y-3">
                        <Input
                          value={serviceForm.name_he ?? svc.name_he}
                          onChange={(e) =>
                            setServiceForm((f) => ({
                              ...f,
                              name_he: e.target.value,
                            }))
                          }
                          placeholder={t("serviceName")}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            value={
                              serviceForm.duration_minutes ??
                              svc.duration_minutes
                            }
                            onChange={(e) =>
                              setServiceForm((f) => ({
                                ...f,
                                duration_minutes: Number(e.target.value),
                              }))
                            }
                            placeholder={t("duration")}
                            className="text-end"
                          />
                          <Input
                            type="number"
                            value={serviceForm.price ?? svc.price}
                            onChange={(e) =>
                              setServiceForm((f) => ({
                                ...f,
                                price: Number(e.target.value),
                              }))
                            }
                            placeholder={t("price")}
                            className="text-end"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            {t("serviceCategory")}
                          </Label>
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={
                              serviceForm.category_id ?? svc.category_id ?? ""
                            }
                            onChange={async (e) => {
                              const val = e.target.value;
                              if (val === "__new__") {
                                setShowNewCategoryInput(svc.id);
                                return;
                              }
                              setServiceForm((f) => ({
                                ...f,
                                category_id: val || null,
                              }));
                            }}
                          >
                            <option value="">{t("noCategory")}</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name_he}
                              </option>
                            ))}
                            <option value="__new__">
                              {t("newCategory")}
                            </option>
                          </select>
                          {showNewCategoryInput === svc.id && (
                            <div className="flex gap-2 mt-2">
                              <Input
                                value={newCategoryName}
                                onChange={(e) =>
                                  setNewCategoryName(e.target.value)
                                }
                                placeholder={t("categoryName")}
                                className="text-sm"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleCreateCategory(svc.id)}
                              >
                                {tCommon("save")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowNewCategoryInput(null)}
                              >
                                {tCommon("cancel")}
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveService(svc.id)}
                          >
                            {tCommon("save")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingService(null);
                              setServiceForm({});
                            }}
                          >
                            {tCommon("cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{svc.name_he}</p>
                          <p className="text-xs text-muted-foreground">
                            {svc.duration_minutes} {t("min")} •{" "}
                            {formatILS(svc.price)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingService(svc.id);
                            setServiceForm({});
                          }}
                        >
                          {tCommon("edit")}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
