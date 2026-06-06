"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";

interface Service {
  id: string;
  name_he: string;
  duration_minutes: number;
  price: number;
  price_type: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface GCalEvent {
  google_event_id: string;
  summary: string;
  start_time: string;
  end_time: string;
}

const inputCls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

export function GCalConvertModal({
  event,
  businessId,
  token,
  onClose,
  onCreated,
}: {
  event: GCalEvent;
  businessId: string;
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");

  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Service[] | { categories: unknown[]; services: Service[] }>(
      `/api/businesses/${businessId}/services`, {}, token
    )
      .then((r) => setServices(Array.isArray(r) ? r : (r.services || [])))
      .catch(() => {});
  }, [businessId, token]);

  useEffect(() => {
    if (customerSearch.length < 2) { setCustomers([]); return; }
    const timeout = setTimeout(() => {
      apiFetch<Customer[] | { customers: Customer[] }>(
        `/api/businesses/${businessId}/customers?search=${encodeURIComponent(customerSearch)}`, {}, token
      )
        .then((r) => setCustomers(Array.isArray(r) ? r : (r.customers || [])))
        .catch(() => setCustomers([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [customerSearch, businessId, token]);

  const startLabel = new Date(event.start_time).toLocaleString("he-IL", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let customerId = selectedCustomer?.id;
      if (!customerId) {
        const c = await apiFetch<{ id: string }>(
          `/api/businesses/${businessId}/customers`,
          { method: "POST", body: JSON.stringify({ phone: newPhone, name: newName, language_preference: "he" }) },
          token
        );
        customerId = c.id;
      }
      await apiFetch(
        `/api/businesses/${businessId}/appointments`,
        { method: "POST", body: JSON.stringify({ service_id: selectedServiceId, customer_id: customerId, start_time: event.start_time, notes: notes || null, created_via: "manual", status: "confirmed" }) },
        token
      );
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת התור");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">📅 {event.summary || "Google Calendar"}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{startLabel}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{error}</div>
          )}

          {/* Service */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("selectService")}</label>
            <select required value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_he} ({s.duration_minutes} {t("min")}{s.price_type === "discuss" ? " • לשיחה" : ` • ₪${s.price}`})
                </option>
              ))}
            </select>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("selectCustomer")}</label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
                <span className="text-foreground">{selectedCustomer.name} ({selectedCustomer.phone})</span>
                <button type="button" onClick={() => setSelectedCustomer(null)} className="text-primary hover:underline text-xs">
                  {tCommon("edit")}
                </button>
              </div>
            ) : showNewCustomer ? (
              <div className="space-y-2">
                <input type="text" required placeholder={t("customerName")} value={newName}
                  onChange={(e) => setNewName(e.target.value)} className={inputCls} />
                <input type="tel" required placeholder={t("customerPhone")} value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)} className={inputCls} dir="ltr" />
                <button type="button" onClick={() => setShowNewCustomer(false)} className="text-xs text-primary hover:underline">
                  {tCommon("back")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input type="text" placeholder={t("searchCustomer")} value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)} className={inputCls} />
                {customers.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-background">
                    {customers.map((c) => (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); setCustomers([]); }}
                        className="w-full px-3 py-2 text-start text-sm text-foreground hover:bg-accent border-b border-border last:border-0"
                      >
                        {c.name} <span className="text-muted-foreground" dir="ltr">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setShowNewCustomer(true)} className="text-xs text-primary hover:underline">
                  + {t("createNewCustomer")}
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t("notes")}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !selectedServiceId || (!selectedCustomer && (!newName || !newPhone))}
              className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "..." : t("bookAppointment")}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-md border border-border px-4 py-2.5 text-sm text-foreground hover:bg-accent"
            >
              {tCommon("cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
