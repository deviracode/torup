"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
import { toast } from "sonner";
import {
  FormSection,
  SettingRow,
  Switch,
  Button,
  Skeleton,
} from "@torup/ui";

export default function BookingTab() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const { businessId } = useBusiness();
  const api = useApi();
  const [allowMultipleBookings, setAllowMultipleBookings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    api<{ allow_multiple_bookings: boolean }>(
      `/api/businesses/${businessId}`
    ).then((r) => {
      if (r) setAllowMultipleBookings(r.allow_multiple_bookings ?? false);
      setLoading(false);
    });
  }, [businessId]);

  const saveBooking = async () => {
    setSaving(true);
    try {
      await api(`/api/businesses/${businessId}`, {
        method: "PATCH",
        body: JSON.stringify({ allow_multiple_bookings: allowMultipleBookings }),
      });
      toast.success(t("saved"));
    } catch {
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-md" data-testid="booking-skeleton">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-24" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md">
      <FormSection title={t("bookingGeneralTitle")}>
        <SettingRow
          title={t("allowMultipleBookings")}
          description={t("allowMultipleBookingsDesc")}
        >
          <Switch
            checked={allowMultipleBookings}
            onCheckedChange={setAllowMultipleBookings}
          />
        </SettingRow>
      </FormSection>

      <Button onClick={saveBooking} loading={saving}>
        {tCommon("save")}
      </Button>
    </div>
  );
}
