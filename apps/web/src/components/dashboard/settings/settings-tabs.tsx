"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@torup/ui";
import type { LucideIcon } from "lucide-react";

export type Tab =
  | "hours"
  | "breaks"
  | "reminders"
  | "rules"
  | "staff"
  | "profile"
  | "booking"
  | "gcal"
  | "services"
  | "whatsapp";

export interface TabDef {
  key: Tab;
  label: string;
  icon: LucideIcon;
}

export function SettingsTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[];
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <Tabs
      value={active}
      onValueChange={(v) => onChange(v as Tab)}
      className="w-full"
    >
      <TabsList className="w-full justify-start">
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
