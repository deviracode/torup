"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api";

interface Service {
  id: string;
  name_he: string;
  duration_minutes: number;
  price: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface TimeSlot {
  start: string;
  end: string;
  available_capacity: number;
}

export function NewAppointmentForm({
  businessId,
  onClose,
  onCreated,
}: {
  businessId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { session } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = session?.access_token || "";

  useEffect(() => {
    apiFetch<{ services: Service[] }>(
      `/api/businesses/${businessId}/services`,
      {},
      token
    )
      .then((r) => setServices(r.services || []))
      .catch(() => {});
  }, [businessId, token]);

  useEffect(() => {
    if (!selectedServiceId || !date) return;
    apiFetch<{ slots: TimeSlot[] }>(
      `/api/businesses/${businessId}/availability?service_id=${selectedServiceId}&date=${date}`,
      {},
      token
    )
      .then((r) => setSlots(r.slots || []))
      .catch(() => setSlots([]));
  }, [selectedServiceId, date, businessId, token]);

  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomers([]);
      return;
    }
    const timeout = setTimeout(() => {
      apiFetch<{ customers: Customer[] }>(
        `/api/businesses/${businessId}/customers?search=${encodeURIComponent(customerSearch)}`,
        {},
        token
      )
        .then((r) => setCustomers(r.customers || []))
        .catch(() => setCustomers([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [customerSearch, businessId, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let customerId = selectedCustomer?.id;

      if (!customerId) {
        const c = await apiFetch<{ id: string }>(
          `/api/businesses/${businessId}/customers`,
          {
            method: "POST",
            body: JSON.stringify({ phone: newPhone, name: newName, language_preference: "he" }),
          },
          token
        );
        customerId = c.id;
      }

      await apiFetch(
        `/api/businesses/${businessId}/appointments`,
        {
          method: "POST",
          body: JSON.stringify({
            service_id: selectedServiceId,
            customer_id: customerId,
            start_time: selectedSlot,
            notes: notes || null,
            created_via: "manual",
          }),
        },
        token
      );

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create appointment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold">{t("newAppointment")}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          {/* Service */}
          <div>
            <label className="block text-sm font-medium mb-1">{t("selectService")}</label>
            <select
              required
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">—</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_he} ({s.duration_minutes} {t("min")} • ₪{s.price})
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-1">{t("selectDate")}</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => { setDate(e.target.value); setSelectedSlot(""); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Time Slot */}
          {selectedServiceId && date && (
            <div>
              <label className="block text-sm font-medium mb-1">{t("selectTime")}</label>
              {slots.length === 0 ? (
                <p className="text-sm text-gray-400">{t("noResults")}</p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                  {slots.map((slot) => {
                    const time = new Date(slot.start).toLocaleTimeString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    });
                    const isSelected = selectedSlot === slot.start;
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlot(slot.start)}
                        className={`rounded border px-2 py-1.5 text-sm ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                            : "border-gray-200 hover:border-blue-300"
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Customer Search */}
          <div>
            <label className="block text-sm font-medium mb-1">{t("selectCustomer")}</label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm">
                <span>{selectedCustomer.name} ({selectedCustomer.phone})</span>
                <button type="button" onClick={() => setSelectedCustomer(null)} className="text-blue-600 hover:underline text-xs">
                  {tCommon("edit")}
                </button>
              </div>
            ) : showNewCustomer ? (
              <div className="space-y-2">
                <input
                  type="text"
                  required
                  placeholder={t("customerName")}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="tel"
                  required
                  placeholder={t("customerPhone")}
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  dir="ltr"
                />
                <button type="button" onClick={() => setShowNewCustomer(false)} className="text-xs text-blue-600 hover:underline">
                  {tCommon("back")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder={t("searchCustomer")}
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                {customers.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-md border border-gray-200">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}
                        className="w-full px-3 py-2 text-start text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        {c.name} <span className="text-gray-400" dir="ltr">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setShowNewCustomer(true)} className="text-xs text-blue-600 hover:underline">
                  + {t("createNewCustomer")}
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">{t("notes")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !selectedServiceId || !selectedSlot || (!selectedCustomer && (!newName || !newPhone))}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {t("bookAppointment")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50"
            >
              {tCommon("cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
