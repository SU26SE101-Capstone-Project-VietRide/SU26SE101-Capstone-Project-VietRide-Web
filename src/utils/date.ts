function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDate(value?: string | null) {
  if (!value) return null;

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateOnly(value?: string | null) {
  const date = parseDate(value);
  if (!date) return value || "-";

  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export function formatDateTime(value?: string | null) {
  const date = parseDate(value);
  if (!date) return value || "-";

  return `${formatDateOnly(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
