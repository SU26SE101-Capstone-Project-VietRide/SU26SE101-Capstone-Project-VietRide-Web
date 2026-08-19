export function localDateToUtcStart(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}

export function localDateToUtcExclusiveEnd(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}
