/**
 * WhatsApp message templates for reminders, confirmations, cancellations.
 * Variables: {customer_name}, {business_name}, {service_name}, {date}, {time}
 */

interface TemplateVars {
  customer_name: string;
  business_name: string;
  service_name: string;
  date: string;
  time: string;
}

function fillTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/{customer_name}/g, vars.customer_name)
    .replace(/{business_name}/g, vars.business_name)
    .replace(/{service_name}/g, vars.service_name)
    .replace(/{date}/g, vars.date)
    .replace(/{time}/g, vars.time);
}

const templates = {
  booking_confirmation: {
    he: "שלום {customer_name} 👋\nהתור שלך ב-{business_name} אושר!\n\n📋 {service_name}\n📅 {date}\n⏰ {time}\n\nנתראה!",
    ar: "أهلين {customer_name} 👋\nتأكد دورك عند {business_name}!\n\n📋 {service_name}\n📅 {date}\n⏰ {time}\n\nنشوفك! 😊",
    en: "Hi {customer_name} 👋\nYour appointment at {business_name} is confirmed!\n\n📋 {service_name}\n📅 {date}\n⏰ {time}\n\nSee you there!",
  },
  reminder_24h: {
    he: "תזכורת 📅\nיש לך תור מחר ב-{business_name}\n\n📋 {service_name}\n⏰ {time}\n\nלביטול או שינוי, שלח/י הודעה.",
    ar: "تذكير 📅\nعندك دور بكرا عند {business_name}\n\n📋 {service_name}\n⏰ {time}\n\nإذا بدك تلغي أو تغير، ابعتلنا رسالة.",
    en: "Reminder 📅\nYou have an appointment tomorrow at {business_name}\n\n📋 {service_name}\n⏰ {time}\n\nTo cancel or reschedule, send a message.",
  },
  reminder_2h: {
    he: "תזכורת ⏰\nהתור שלך ב-{business_name} בעוד שעתיים!\n\n📋 {service_name}\n⏰ {time}",
    ar: "تذكير ⏰\nدورك عند {business_name} بعد ساعتين!\n\n📋 {service_name}\n⏰ {time}",
    en: "Reminder ⏰\nYour appointment at {business_name} is in 2 hours!\n\n📋 {service_name}\n⏰ {time}",
  },
  cancellation: {
    he: "התור שלך ב-{business_name} בוטל.\n\n📋 {service_name}\n📅 {date}\n⏰ {time}\n\nלקביעת תור חדש, שלח/י הודעה.",
    ar: "اتلغى دورك عند {business_name}.\n\n📋 {service_name}\n📅 {date}\n⏰ {time}\n\nإذا بدك تحجزي دور جديد، ابعتيلنا رسالة.",
    en: "Your appointment at {business_name} has been cancelled.\n\n📋 {service_name}\n📅 {date}\n⏰ {time}\n\nTo book a new appointment, send a message.",
  },
  reschedule: {
    he: "התור שלך ב-{business_name} שונה.\n\n📋 {service_name}\n📅 {date} (חדש)\n⏰ {time} (חדש)\n\nנתראה!",
    ar: "اتغير دورك عند {business_name}.\n\n📋 {service_name}\n📅 {date} (جديد)\n⏰ {time} (جديد)\n\nنشوفك! 😊",
    en: "Your appointment at {business_name} has been rescheduled.\n\n📋 {service_name}\n📅 {date} (new)\n⏰ {time} (new)\n\nSee you there!",
  },
} as const;

type TemplateName = keyof typeof templates;
type Language = "he" | "ar" | "en";

export function getTemplate(
  name: TemplateName,
  language: Language,
  vars: TemplateVars
): string {
  const tmpl = templates[name]?.[language] || templates[name]?.he;
  return fillTemplate(tmpl, vars);
}

export { type TemplateName, type TemplateVars };
