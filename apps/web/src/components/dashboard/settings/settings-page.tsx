"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useBusiness } from "@/components/auth/business-provider";
import { useApi } from "@/lib/use-api";
import { Card, CardContent, FadeIn } from "@torup/ui";
import {
  Clock,
  Coffee,
  Bell,
  ShieldCheck,
  Users,
  Building2,
  CalendarCheck,
  Calendar,
  Scissors,
  MessageCircle,
} from "lucide-react";
import { SettingsTabs, type Tab, type TabDef } from "./settings-tabs";
import WorkingHoursTab from "./working-hours-tab";
import BreaksTab from "./breaks-tab";
import RemindersTab from "./reminders-tab";
import BookingRulesTab from "./booking-rules-tab";
import StaffTab from "./staff-tab";
import ProfileTab from "./profile-tab";
import BookingTab from "./booking-tab";
import GcalTab from "./gcal-tab";
import ServicesTab from "./services-tab";
import WhatsAppTab from "./whatsapp-tab";

interface SettingsPageProps {
  initialTab?: Tab;
  gcalCode?: string | null;
}

export function SettingsPage({ initialTab, gcalCode }: SettingsPageProps) {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");
  const { businessId } = useBusiness();
  const api = useApi();
  const [tab, setTab] = useState<Tab>(initialTab ?? "hours");
  const [gcalRefreshKey, setGcalRefreshKey] = useState(0);

  // Auto-handle OAuth redirect: if gcalCode is present, connect and switch to gcal
  useEffect(() => {
    if (gcalCode && businessId) {
      if (tab !== "gcal") {
        setTab("gcal");
      }
      api(
        `/api/businesses/${businessId}/google-calendar/connect`,
        {
          method: "POST",
          body: JSON.stringify({ code: gcalCode }),
        }
      )
        .then(() => {
          // Remove code from URL without full reload
          const url = new URL(window.location.href);
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          url.searchParams.delete("scope");
          window.history.replaceState({}, "", url.toString());
          // Refresh gcal tab by incrementing key (triggers remount)
          setGcalRefreshKey((k) => k + 1);
        })
        .catch(() => {}); // ignore errors
    }
  }, [gcalCode, businessId]);

  const tabs: TabDef[] = [
    { key: "hours", label: t("workingHours"), icon: Clock },
    { key: "breaks", label: t("breaks"), icon: Coffee },
    { key: "reminders", label: t("reminders"), icon: Bell },
    { key: "rules", label: t("bookingRules"), icon: ShieldCheck },
    { key: "staff", label: t("staffManagement"), icon: Users },
    { key: "profile", label: t("businessProfile"), icon: Building2 },
    { key: "booking", label: t("booking"), icon: CalendarCheck },
    { key: "gcal", label: "Google Calendar", icon: Calendar },
    { key: "services", label: t("services"), icon: Scissors },
    { key: "whatsapp", label: t("whatsapp"), icon: MessageCircle },
  ];

  const renderTab = () => {
    switch (tab) {
      case "hours":
        return <WorkingHoursTab />;
      case "breaks":
        return <BreaksTab />;
      case "reminders":
        return <RemindersTab />;
      case "rules":
        return <BookingRulesTab />;
      case "staff":
        return <StaffTab />;
      case "profile":
        return <ProfileTab />;
      case "booking":
        return <BookingTab />;
      case "gcal":
        return <GcalTab key={gcalRefreshKey} />;
      case "services":
        return <ServicesTab />;
      case "whatsapp":
        return <WhatsAppTab />;
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{tNav("settings")}</h1>
      <SettingsTabs tabs={tabs} active={tab} onChange={setTab} />
      <Card className="mt-6">
        <CardContent className="p-6">
          <FadeIn key={tab}>{renderTab()}</FadeIn>
        </CardContent>
      </Card>
    </div>
  );
}
