import { useCallback, useEffect, useRef } from "react";

/**
 * Chống response về trễ (out-of-order) cho các loader dùng chung giữa effect và
 * mutation. Đổi filter/trang nhanh trên mạng chậm thì request cũ có thể trả về
 * SAU request mới và ghi đè danh sách đang đúng — `let ignore` trong effect không
 * chặn được vì loader còn được gọi lại sau mỗi thao tác tạo/sửa/xoá.
 *
 * Cách dùng: gọi `startRequest()` ngay đầu loader, rồi kiểm tra trước mỗi setState.
 *
 * ```ts
 * const startRequest = useLatestRequest();
 * const load = useCallback(async () => {
 *   const isLatest = startRequest();
 *   try {
 *     const result = await getSomething(params);
 *     if (!isLatest()) return;
 *     setItems(result.items);
 *   } finally {
 *     if (isLatest()) setIsLoading(false);
 *   }
 * }, [params, startRequest]);
 * ```
 */
export function useLatestRequest() {
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback(() => {
    const requestId = (requestIdRef.current += 1);

    return () => isMountedRef.current && requestId === requestIdRef.current;
  }, []);
}
