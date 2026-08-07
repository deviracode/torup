"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@torup/ui";
import { SettingsPage } from "@/components/dashboard/settings/settings-page";

function SettingsRoute() {
  const params = useSearchParams();
  const code = params.get("code");
  return <SettingsPage initialTab={code ? "gcal" : undefined} gcalCode={code} />;
}

function SettingsFallback() {
  return (
    <div>
      <Skeleton className="h-8 w-40 mb-6" />
      <Skeleton className="h-10 w-full mb-6" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function Settings() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsRoute />
    </Suspense>
  );
}
