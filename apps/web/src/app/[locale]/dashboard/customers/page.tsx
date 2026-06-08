"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import {
  Card, CardContent, Input, Button, Skeleton,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@torup/ui";
import { Search } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  language_preference: string;
  created_at: string;
}

export default function CustomersPage() {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { session } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLang, setEditLang] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    apiFetch<{ id: string }>("/api/businesses/me", {}, session.access_token)
      .then((r) => { if (r.id) setBusinessId(r.id); })
      .catch(() => {});
  }, [session?.access_token]);

  const fetchCustomers = useCallback(async () => {
    if (!businessId || !session?.access_token) return;
    setLoading(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      const result = await apiFetch<Customer[] | { customers: Customer[] }>(
        `/api/businesses/${businessId}/customers${query}`, {}, session.access_token
      );
      setCustomers(Array.isArray(result) ? result : (result.customers || []));
    } catch { setCustomers([]); }
    finally { setLoading(false); }
  }, [businessId, search, session?.access_token]);

  useEffect(() => { if (businessId) fetchCustomers(); }, [businessId, fetchCustomers]);

  function openEdit(c: Customer) {
    setSelectedCustomer(c);
    setEditName(c.name);
    setEditPhone(c.phone);
    setEditLang(c.language_preference);
    setSaveError(null);
  }

  function closeEdit() {
    setSelectedCustomer(null);
    setSaveError(null);
  }

  async function handleSave() {
    if (!selectedCustomer || !businessId || !session?.access_token) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await apiFetch<Customer>(
        `/api/businesses/${businessId}/customers/${selectedCustomer.id}`,
        { method: "PATCH", body: JSON.stringify({ name: editName, phone: editPhone, language_preference: editLang }) },
        session.access_token
      );
      setCustomers((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      closeEdit();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{tNav("customers")}</h1>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t("searchCustomer")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12 ms-auto" />
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{t("noResults")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("customerName")}</TableHead>
                  <TableHead>{t("customerPhone")}</TableHead>
                  <TableHead>{tCommon("language")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id} className={selectedCustomer?.id === c.id ? "bg-muted/50" : ""}>
                    <TableCell className="font-medium">{c.name || <span className="text-muted-foreground italic">—</span>}</TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">{c.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{c.language_preference}</TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(c)}
                      >
                        {tCommon("edit")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCustomer} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tCommon("edit")}: {selectedCustomer?.name || selectedCustomer?.phone}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">{t("customerName")}</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("customerName")}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">{t("customerPhone")}</label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                dir="ltr"
                placeholder={t("customerPhone")}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">{tCommon("language")}</label>
              <Select value={editLang} onValueChange={setEditLang}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="he">עברית</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {saveError && <p className="text-sm text-destructive mt-3">{saveError}</p>}
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={closeEdit}>{tCommon("cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
