"use client";

import { useTranslations } from "next-intl";

/**
 * Placeholder date/slot picker for the "request change" flow.
 * TODO: replace with real availability picking UI (separate task).
 */
export function DateTimePicker({
  onCancel,
}: {
  businessId: string;
  onSelect: (isoStart: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("appointmentLink");

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center space-y-3">
      <p className="text-sm text-gray-500">{t("pickerComingSoon")}</p>
      <button
        onClick={onCancel}
        className="w-full rounded-lg border border-gray-300 text-gray-700 py-2 text-sm font-medium"
      >
        {t("back")}
      </button>
    </div>
  );
}
