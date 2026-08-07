"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SettingsPage } from "@/components/dashboard/settings/settings-page";

function SettingsRoute() {
  const params = useSearchParams();
  const code = params.get("code");
  return <SettingsPage initialTab={code ? "gcal" : undefined} gcalCode={code} />;
}

export default function Settings() {
  return (
    <Suspense fallback={null}>
      <SettingsRoute />
    </Suspense>
  );
}
