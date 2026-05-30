import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Button } from "@queue/ui";

export default function HomePage() {
  const t = useTranslations("common");
  const locale = useLocale();

  const features = [
    { icon: "📅", titleHe: "ניהול תורים חכם", titleEn: "Smart Scheduling", descHe: "לוח זמנים אוטומטי, ניהול זמינות וחלונות זמן", descEn: "Automated calendar, availability management and time slots" },
    { icon: "💬", titleHe: "בוט WhatsApp", titleEn: "WhatsApp Bot", descHe: "קביעת תורים אוטומטית דרך WhatsApp עם בינה מלאכותית", descEn: "AI-powered appointment booking via WhatsApp" },
    { icon: "📊", titleHe: "אנליטיקס", titleEn: "Analytics", descHe: "מעקב ביצועים, הכנסות ודוחות מפורטים", descEn: "Track performance, revenue and detailed reports" },
    { icon: "🌍", titleHe: "רב-שפתי", titleEn: "Multilingual", descHe: "תמיכה בעברית, ערבית ואנגלית עם RTL מלא", descEn: "Hebrew, Arabic and English with full RTL support" },
  ];

  const isHe = locale === "he" || locale === "ar";

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center gap-8 px-6 py-24 text-center bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
            Queue<span className="text-primary">Pro</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            {t("tagline")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link href={`/${locale}/register`}>
              <Button size="lg" className="text-base px-8">
                {t("register")}
              </Button>
            </Link>
            <Link href={`/${locale}/login`}>
              <Button variant="outline" size="lg" className="text-base px-8">
                {t("login")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-8 sm:grid-cols-2">
          {features.map((f, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 text-4xl">{f.icon}</div>
              <h3 className="mb-2 text-lg font-semibold">
                {isHe ? f.titleHe : f.titleEn}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isHe ? f.descHe : f.descEn}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/40 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-6 px-6 text-sm text-muted-foreground">
          <Link href={`/${locale}/terms`} className="hover:text-foreground">
            {isHe ? "תנאי שימוש" : "Terms"}
          </Link>
          <Link href={`/${locale}/privacy`} className="hover:text-foreground">
            {isHe ? "מדיניות פרטיות" : "Privacy"}
          </Link>
          <Link href={`/${locale}/data-deletion`} className="hover:text-foreground">
            {isHe ? "מחיקת מידע" : "Data Deletion"}
          </Link>
          <span>&copy; {new Date().getFullYear()} TorUp</span>
        </div>
      </footer>
    </main>
  );
}
