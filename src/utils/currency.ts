const currencyNumberFormatter = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export type CurrencyValue = number | string | null | undefined;

function parseCurrencyValue(value: CurrencyValue) {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || value.trim() === "") return Number.NaN;

  const trimmed = value.trim();
  const normalized = /^-?\d{1,3}(\.\d{3})+$/.test(trimmed)
    ? trimmed.replace(/\./g, "")
    : trimmed;

  return Number(normalized);
}

export function formatCurrency(value: CurrencyValue, fallback = "-") {
  const amount = parseCurrencyValue(value);
  if (!Number.isFinite(amount)) return fallback;

  return `${currencyNumberFormatter.format(Math.round(amount))} ₫`;
}
