export const locales = ["he", "ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "he";

export function isRtl(locale: Locale): boolean {
  return locale === "he" || locale === "ar";
}

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return isRtl(locale) ? "rtl" : "ltr";
}
