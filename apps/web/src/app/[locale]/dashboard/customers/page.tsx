"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";
import {
  Card, CardContent, Input, Button, Skeleton,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
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
      const result = await apiFetch<{ customers: Customer[] }>(
        `/api/businesses/${businessId}/customers${query}`, {}, session.access_token
      );
      setCustomers(result.customers || []);
    } catch { setCustomers([]); }
    finally { setLoading(false); }
  }, [businessId, search, session?.access_token]);

  useEffect(() => { if (businessId) fetchCustomers(); }, [businessId, fetchCustomers]);

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
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">{c.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{c.language_preference}</TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCustomer(selectedCustomer?.id === c.id ? null : c)}
                      >
                        {selectedCustomer?.id === c.id ? tCommon("close") : tCommon("edit")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedCustomer && (
        <Card className="mt-4">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">{selectedCustomer.name}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t("customerPhone")}:</span>
                <span className="ms-2" dir="ltr">{selectedCustomer.phone}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{tCommon("language")}:</span>
                <span className="ms-2">{selectedCustomer.language_preference}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
