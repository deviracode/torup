"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface Template {
  id: string;
  name: string;
  type: string;
  body_he: string;
  body_ar: string;
  body_en: string;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "booking_confirmation",
    name: "Booking Confirmation",
    type: "whatsapp",
    body_he: "שלום {customer_name}, התור שלך ב-{business_name} אושר.\nשירות: {service_name}\nתאריך: {date}\nשעה: {time}",
    body_ar: "مرحبا {customer_name}، تم تأكيد موعدك في {business_name}.\nالخدمة: {service_name}\nالتاريخ: {date}\nالوقت: {time}",
    body_en: "Hi {customer_name}, your appointment at {business_name} is confirmed.\nService: {service_name}\nDate: {date}\nTime: {time}",
  },
  {
    id: "reminder_24h",
    name: "24h Reminder",
    type: "whatsapp",
    body_he: "תזכורת: יש לך תור מחר ב-{business_name} בשעה {time}.\nשירות: {service_name}",
    body_ar: "تذكير: لديك موعد غدا في {business_name} الساعة {time}.\nالخدمة: {service_name}",
    body_en: "Reminder: You have an appointment tomorrow at {business_name} at {time}.\nService: {service_name}",
  },
  {
    id: "cancellation",
    name: "Cancellation",
    type: "whatsapp",
    body_he: "התור שלך ב-{business_name} בתאריך {date} בשעה {time} בוטל.",
    body_ar: "تم إلغاء موعدك في {business_name} بتاريخ {date} الساعة {time}.",
    body_en: "Your appointment at {business_name} on {date} at {time} has been cancelled.",
  },
];

export default function AdminTemplatesPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLang, setEditLang] = useState<"he" | "ar" | "en">("he");

  const editingTemplate = templates.find((t) => t.id === editingId);

  const handleBodyChange = (value: string) => {
    if (!editingId) return;
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === editingId ? { ...t, [`body_${editLang}`]: value } : t
      )
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("notificationTemplates")}</h1>

      <div className="space-y-4">
        {templates.map((template) => (
          <div key={template.id} className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-medium">{template.name}</h3>
                <span className="text-xs text-gray-400">{template.type} • {template.id}</span>
              </div>
              <button
                onClick={() => setEditingId(editingId === template.id ? null : template.id)}
                className="text-xs text-blue-600 hover:underline"
              >
                {editingId === template.id ? tCommon("close") : tCommon("edit")}
              </button>
            </div>

            {editingId === template.id && editingTemplate && (
              <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                {/* Language tabs */}
                <div className="flex gap-1">
                  {(["he", "ar", "en"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setEditLang(lang)}
                      className={`px-3 py-1 text-xs font-medium rounded ${
                        editLang === lang ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>

                <textarea
                  value={editingTemplate[`body_${editLang}`]}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  rows={4}
                  dir={editLang === "en" ? "ltr" : "rtl"}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-red-500 focus:outline-none"
                />

                <div className="text-xs text-gray-400">
                  Variables: {"{customer_name}"}, {"{business_name}"}, {"{service_name}"}, {"{date}"}, {"{time}"}
                </div>

                <button className="rounded-md bg-red-600 px-4 py-2 text-sm text-white font-medium hover:bg-red-700">
                  {tCommon("save")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
