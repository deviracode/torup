const ILS_FORMATTER = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

export function formatILS(amount: number): string {
  return ILS_FORMATTER.format(amount);
}
