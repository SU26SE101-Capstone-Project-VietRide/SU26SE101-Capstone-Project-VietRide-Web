// Cache theo phiên (sessionStorage) kiểu stale-while-revalidate cho dữ liệu danh mục
// ít thay đổi. Hàm thuần, không phụ thuộc React. Entry lưu dạng { ts, data }.
import { isRecord } from "./typeGuards";

type SessionCacheEntry<T> = {
  ts: number;
  data: T;
};

function removeEntry(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // sessionStorage bị chặn — bỏ qua, cache chỉ là tối ưu.
  }
}

// Đọc cache: entry thiếu/hỏng/parse lỗi/quá hạn → trả null và xoá entry.
export function readSessionCache<T>(key: string, maxAgeMs: number): T | null {
  let raw: string | null;

  try {
    raw = sessionStorage.getItem(key);
  } catch {
    return null;
  }

  if (raw === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removeEntry(key);
    return null;
  }

  if (!isRecord(parsed) || typeof parsed.ts !== "number" || !("data" in parsed)) {
    removeEntry(key);
    return null;
  }

  if (Date.now() - parsed.ts > maxAgeMs) {
    removeEntry(key);
    return null;
  }

  return parsed.data as T;
}

// Ghi cache kèm timestamp hiện tại. Lỗi ghi (đầy quota, bị chặn) được nuốt im lặng.
export function writeSessionCache<T>(key: string, data: T): void {
  const entry: SessionCacheEntry<T> = { ts: Date.now(), data };

  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Cache chỉ là tối ưu — không được làm vỡ luồng chính.
  }
}
