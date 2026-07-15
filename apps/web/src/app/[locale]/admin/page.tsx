"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import {
  Card, CardContent, Button, Badge, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  Skeleton,
} from "@torup/ui";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, Search } from "lucide-react";

interface Business {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  phone: string | null;
  contact_phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  address: string | null;
  subscriptions?: { status: string; plan_id: string; plans?: { name: string } }[];
}

interface Plan {
  id: string;
  name: string;
}

const BUSINESS_CATEGORIES = [
  { value: "barber", label_he: "מספרה", label_en: "Barber", label_ar: "حلاق" },
  { value: "hair_salon", label_he: "סלון שיער", label_en: "Hair Salon", label_ar: "صالون شعر" },
  { value: "beauty_salon", label_he: "סלון יופי", label_en: "Beauty Salon", label_ar: "صالون تجميل" },
  { value: "nail_salon", label_he: "סלון ציפורניים", label_en: "Nail Salon", label_ar: "صالون أظافر" },
  { value: "spa", label_he: "ספא", label_en: "Spa", label_ar: "سبا" },
  { value: "gym", label_he: "חדר כושר", label_en: "Gym", label_ar: "صالة رياضية" },
  { value: "clinic", label_he: "קליניקה", label_en: "Clinic", label_ar: "عيادة" },
  { value: "dental", label_he: "מרפאת שיניים", label_en: "Dental", label_ar: "عيادة أسنان" },
  { value: "physiotherapy", label_he: "פיזיותרפיה", label_en: "Physiotherapy", label_ar: "علاج طبيعي" },
  { value: "tattoo", label_he: "קעקועים", label_en: "Tattoo", label_ar: "وشم" },
  { value: "yoga_studio", label_he: "סטודיו יוגה", label_en: "Yoga Studio", label_ar: "استوديو يوغا" },
  { value: "pet_grooming", label_he: "טיפוח חיות מחמד", label_en: "Pet Grooming", label_ar: "تجميل حيوانات" },
  { value: "auto_service", label_he: "מוסך / שירות רכב", label_en: "Auto Service", label_ar: "خدمة سيارات" },
  { value: "consulting", label_he: "ייעוץ", label_en: "Consulting", label_ar: "استشارات" },
  { value: "tutoring", label_he: "שיעורים פרטיים", label_en: "Tutoring", label_ar: "دروس خصوصية" },
  { value: "photography", label_he: "צילום", label_en: "Photography", label_ar: "تصوير" },
  { value: "other", label_he: "אחר", label_en: "Other", label_ar: "أخرى" },
];

export default function AdminBusinessesPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { session } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showOnboard, setShowOnboard] = useState(false);
  const [editBusiness, setEditBusiness] = useState<Business | null>(null);
  const [impersonating, setImpersonating] = useState<Business | null>(null);

  const [formData, setFormData] = useState({
    name: "", slug: "", category: "", phone: "", contact_phone: "", email: "", address: "", plan_id: "", owner_email: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const token = session?.access_token || "";

  const fetchBusinesses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const query = params.toString() ? `?${params}` : "";
      const data = await apiFetch<Business[]>(`/api/admin/businesses${query}`, {}, token);
      setBusinesses(Array.isArray(data) ? data : []);
    } catch {
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter]);

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);

  useEffect(() => {
    if (!token) return;
    apiFetch<Plan[]>("/api/admin/plans", {}, token)
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [token]);

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch<{ temp_password?: string | null }>("/api/admin/businesses", {
        method: "POST",
        body: JSON.stringify({ ...formData, contact_phone: formData.contact_phone || null }),
      }, token);
      if (result?.temp_password) {
        await navigator.clipboard.writeText(result.temp_password).catch(() => {});
        alert(
          `Business created.\n\nOwner login:\nEmail: ${formData.owner_email}\nTemp password (copied to clipboard): ${result.temp_password}`
        );
      }
      setShowOnboard(false);
      setFormData({ name: "", slug: "", category: "", phone: "", contact_phone: "", email: "", address: "", plan_id: "", owner_email: "" });
      fetchBusinesses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (biz: Business) => {
    try {
      await apiFetch(`/api/admin/businesses/${biz.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !biz.is_active }),
      }, token);
      fetchBusinesses();
    } catch {}
  };

  const handleImpersonate = async (biz: Business) => {
    try {
      await apiFetch("/api/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({ business_id: biz.id }),
      }, token);
      setImpersonating(biz);
    } catch {}
  };

  const handleStopImpersonate = async () => {
    if (impersonating) {
      await apiFetch("/api/admin/stop-impersonate", {
        method: "POST",
        body: JSON.stringify({ business_id: impersonating.id }),
      }, token).catch(() => {});
    }
    setImpersonating(null);
  };

  const handleDelete = async (biz: Business) => {
    if (!confirm(`Delete "${biz.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/admin/businesses/${biz.id}`, { method: "DELETE" }, token);
      fetchBusinesses();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleSaveEdit = async () => {
    if (!editBusiness) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/businesses/${editBusiness.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editBusiness.name,
          slug: editBusiness.slug,
          category: editBusiness.category,
          phone: editBusiness.phone,
          contact_phone: editBusiness.contact_phone || null,
          email: editBusiness.email,
          address: editBusiness.address,
        }),
      }, token);
      setEditBusiness(null);
      fetchBusinesses();
    } catch {} finally { setSaving(false); }
  };

  const SUB_VARIANT: Record<string, "success" | "warning" | "outline"> = {
    active: "success",
    trial: "warning",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("businesses")}</h1>
        <Button onClick={() => setShowOnboard(true)} size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          {t("onboardBusiness")}
        </Button>
      </div>

      {impersonating && (
        <Card className="mb-4 border-orange-300 bg-orange-50">
          <CardContent className="p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-orange-800">
              {t("impersonating")} <strong>{impersonating.name}</strong>
            </span>
            <Button variant="destructive" size="sm" onClick={handleStopImpersonate}>
              {t("stopImpersonating")}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={tCommon("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">{t("status")}: All</option>
          <option value="active">{t("active")}</option>
          <option value="inactive">{t("inactive")}</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-8 w-8 ms-auto rounded" />
                </div>
              ))}
            </div>
          ) : businesses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No businesses found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("businessName")}</TableHead>
                  <TableHead>{t("slug")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("subscription")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses.map((biz) => {
                  const sub = biz.subscriptions?.[0];
                  return (
                    <TableRow key={biz.id}>
                      <TableCell className="font-medium">{biz.name}</TableCell>
                      <TableCell className="text-muted-foreground">{biz.slug}</TableCell>
                      <TableCell className="text-muted-foreground">{biz.category || "—"}</TableCell>
                      <TableCell>
                        {sub ? (
                          <Badge variant={SUB_VARIANT[sub.status] || "outline"}>
                            {sub.plans?.name || sub.plan_id} ({sub.status})
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={biz.is_active ? "success" : "destructive"}
                          className="cursor-pointer"
                          onClick={() => handleToggleActive(biz)}
                        >
                          {biz.is_active ? t("active") : t("inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleImpersonate(biz)}>
                              <Eye className="h-4 w-4 me-2" />
                              {t("viewAs")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditBusiness(biz)}>
                              <Pencil className="h-4 w-4 me-2" />
                              {tCommon("edit")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(biz)} className="text-destructive">
                              <Trash2 className="h-4 w-4 me-2" />
                              {tCommon("delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Onboard Business Dialog */}
      <Dialog open={showOnboard} onOpenChange={setShowOnboard}>
        <DialogContent className="backdrop:bg-black/50">
          <DialogHeader>
            <DialogTitle>{t("onboardBusiness")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleOnboard} className="space-y-3">
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="space-y-2">
              <Label>{t("businessName")} *</Label>
              <Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>URL Slug</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground shrink-0">/b/</span>
                <Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="my-business" dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("category")}</Label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="">— {t("category")} —</option>
                {BUSINESS_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label_he} / {c.label_en}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{tCommon("phone") || "Phone"}</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} dir="ltr" placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>{t("selectPlan")}</Label>
              <select value={formData.plan_id} onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="">— No plan —</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("ownerEmail")}</Label>
              <Input type="email" value={formData.owner_email} onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })} dir="ltr" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowOnboard(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {t("onboardBusiness")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Business Dialog */}
      <Dialog open={!!editBusiness} onOpenChange={(open) => { if (!open) setEditBusiness(null); }}>
        <DialogContent className="backdrop:bg-black/50">
          <DialogHeader>
            <DialogTitle>{tCommon("edit")}: {editBusiness?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{t("businessName")}</Label>
              <Input value={editBusiness?.name || ""} onChange={(e) => editBusiness && setEditBusiness({ ...editBusiness, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>URL Slug</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground shrink-0">/b/</span>
                <Input value={editBusiness?.slug || ""} onChange={(e) => editBusiness && setEditBusiness({ ...editBusiness, slug: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("category")}</Label>
              <select value={editBusiness?.category || ""} onChange={(e) => editBusiness && setEditBusiness({ ...editBusiness, category: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option value="">— {t("category")} —</option>
                {BUSINESS_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label_he} / {c.label_en}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={editBusiness?.address || ""} onChange={(e) => editBusiness && setEditBusiness({ ...editBusiness, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editBusiness?.phone || ""} onChange={(e) => editBusiness && setEditBusiness({ ...editBusiness, phone: e.target.value })} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editBusiness?.email || ""} onChange={(e) => editBusiness && setEditBusiness({ ...editBusiness, email: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input value={editBusiness?.contact_phone || ""} onChange={(e) => editBusiness && setEditBusiness({ ...editBusiness, contact_phone: e.target.value })} dir="ltr" placeholder="Optional" />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setEditBusiness(null)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
