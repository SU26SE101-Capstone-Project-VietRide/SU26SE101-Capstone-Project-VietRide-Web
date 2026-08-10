import { useEffect, useState } from "react";

const DEFAULT_INTERVAL_MS = 30_000;

/**
 * Mốc thời gian hiện tại, tự cập nhật theo chu kỳ.
 *
 * Dùng cho các màn so sánh hạn chót với "bây giờ". Chụp `Date.now()` một lần
 * lúc mount là sai với màn trực ban mở cả buổi: hạn đã trôi qua nhưng UI vẫn
 * tính theo thời điểm mở trang, nút vẫn bấm được rồi server mới trả lỗi.
 */
export function useNowTicker(intervalMs = DEFAULT_INTERVAL_MS) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timerId);
  }, [intervalMs]);

  return now;
}
