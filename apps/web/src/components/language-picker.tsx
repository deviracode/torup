"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";

const locales = [
  { code: "he", label: "עברית" },
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
] as const;

export function LanguagePicker() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  };

  return (
    <div className="flex items-center gap-1">
      {locales.map((l) => (
        <button
          key={l.code}
          onClick={() => handleChange(l.code)}
          className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
            locale === l.code
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          title={l.label}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
