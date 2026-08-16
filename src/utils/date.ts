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

/**
 * `yyyy-MM-dd HH:mm` — đúng thứ tự mà `CustomDateTimeInput` hiện giá trị
 * datetime-local. Chỉ dùng cho giá trị đứng NGAY CẠNH một ô nhập ngày giờ trong
 * cùng form: hai ô để hai thứ tự khác nhau (`2026-08-17 01:30` cạnh
 * `17-08-2026 04:00`) khiến người dùng phải đọc lại mới biết cái nào là ngày.
 * Bảng và danh sách vẫn dùng `formatDateTime` (dd-MM-yyyy, quy ước hiển thị của
 * cả console).
 */
export function formatDateTimeYmd(value?: string | null) {
  const date = parseDate(value);
  if (!date) return value || "-";

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Đổi Date sang giá trị cho input datetime-local (giờ địa phương, cắt giây).
export function toDatetimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

// Ngày lọc trên UI là ngày lịch Việt Nam (Asia/Ho_Chi_Minh, +07:00), không
// phải ngày UTC — vd "2026-08-10" phải đổi thành mốc UTC 2026-08-09T17:00:00Z
// (xem API-timezone-consistency.md §5.5). Ghép thẳng "T00:00:00.000Z" vào
// chuỗi ngày (bug cũ) coi ngày đó là UTC, lệch 7 giờ và làm rơi mất giao dịch
// diễn ra 00:00–07:00 giờ Việt Nam ở đầu khoảng.
const VIETNAM_UTC_OFFSET_MINUTES = 7 * 60;

export function toUtcDayStart(dateValue: string) {
  if (!dateValue) {
    return undefined;
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day) - VIETNAM_UTC_OFFSET_MINUTES * 60_000,
  ).toISOString();
}

export function toExclusiveUtcDayEnd(dateValue: string) {
  if (!dateValue) {
    return undefined;
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day + 1) - VIETNAM_UTC_OFFSET_MINUTES * 60_000,
  ).toISOString();
}
