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
