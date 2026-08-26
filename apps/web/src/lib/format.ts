const ILS_FORMATTER = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

export function formatILS(amount: number): string {
  return ILS_FORMATTER.format(amount);
}

/**
 * Formats a Date as "YYYY-MM-DD" using its local calendar date.
 * Use this instead of `date.toISOString().split("T")[0]`, which converts
 * to UTC first and shifts the date by a day for timezones ahead of UTC
 * (e.g. Israel, UTC+3) during the first hours of the local day.
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes a local Israeli number (e.g. "050-1234567") to wa.me's
 * required international format ("972501234567") — strips formatting,
 * and swaps a leading 0 for the 972 country code. Numbers already given
 * with a country code (no leading 0) pass through unchanged.
 */
export function toInternationalPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
}
