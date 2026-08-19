import { useCallback, useSyncExternalStore } from "react";

/**
 * Theo dõi một media query của CSS từ phía JS.
 *
 * Dùng `useSyncExternalStore` chứ không phải `useState` + `useEffect`:
 * `matchMedia` đúng là external store, và cách này không có frame nào render
 * bằng giá trị cũ trước khi effect kịp đồng bộ.
 *
 * `fallback` dùng cho môi trường không có `matchMedia` (jsdom trong test, SSR).
 * Mặc định `true` — nơi gọi nên chọn giá trị "an toàn" là giá trị KHÔNG khoá
 * tương tác, vì đoán sai theo hướng khoá sẽ làm người dùng không thao tác được.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  const hasMatchMedia =
    typeof window !== "undefined" && typeof window.matchMedia === "function";

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!hasMatchMedia) return () => undefined;

      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onStoreChange);
      return () => mediaQueryList.removeEventListener("change", onStoreChange);
    },
    [hasMatchMedia, query],
  );

  const getSnapshot = useCallback(
    () => (hasMatchMedia ? window.matchMedia(query).matches : fallback),
    [hasMatchMedia, query, fallback],
  );

  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Breakpoint `lg` của Tailwind — mốc sidebar chuyển từ drawer sang cột cố định. */
export const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";
