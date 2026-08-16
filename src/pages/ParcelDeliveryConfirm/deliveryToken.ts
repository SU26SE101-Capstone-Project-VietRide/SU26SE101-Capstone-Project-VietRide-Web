/**
 * Capability token của link xác nhận giao hàng gửi qua email người nhận.
 *
 * Luật bảo mật (token này đủ quyền xác nhận/từ chối một kiện hàng):
 * - KHÔNG ghi token vào localStorage, cookie, log hay analytics.
 * - Ưu tiên chức năng: tẩy URL chỉ sau khi đã cất token. Mất sessionStorage
 *   (private mode) không được làm mất nút xác nhận trong lần mở trang đó.
 * - sessionStorage chỉ dùng trong cùng tab, sau khi đã tẩy URL, để F5 không
 *   mất quyền xác nhận. Đóng tab là hết. Memory module giữ token qua remount.
 * - Đọc xong thì xoá khỏi thanh địa chỉ để không đọng lại trong lịch sử trình
 *   duyệt, ảnh chụp màn hình hay Referer khi người dùng bấm link khác.
 * - BE parse token thành `Guid` (contract `POST /v1/parcels/delivery/confirm`),
 *   nên token sai định dạng thì kết luận "link không hợp lệ" tại FE, không gọi API
 *   (tránh đốt quota rate limit 5 lần/giờ của BE cho một link vô nghĩa).
 */

/** UUID chuẩn 8-4-4-4-12 — BE phát hành UUID v4 và tự chuẩn hoá hoa/thường. */
export const PARCEL_DELIVERY_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tab-only stash so F5 still works after `?token=` / `#token=` is stripped. */
export const PARCEL_DELIVERY_TOKEN_SESSION_KEY =
  "vietride.public.parcel-delivery-token";

/** Survives React remount in the same JS realm even if sessionStorage is blocked. */
let inMemoryToken: string | null = null;

export function isParcelDeliveryToken(value: string): boolean {
  return PARCEL_DELIVERY_TOKEN_PATTERN.test(value.trim());
}

/**
 * Parse `?token=<uuid>` từ query string (có hoặc không có dấu `?`).
 * Trả null nếu thiếu, sai định dạng, hoặc bị lặp `token` (link mập mờ).
 */
export function parseParcelDeliveryToken(search: string): string | null {
  if (!search) {
    return null;
  }

  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw) {
    return null;
  }

  const values = new URLSearchParams(raw).getAll("token");
  if (values.length !== 1) {
    return null;
  }

  const token = values[0].trim();
  return isParcelDeliveryToken(token) ? token : null;
}

/** Đọc token từ query hiện tại. Hash / session đi qua `captureParcelDeliveryTokenFromWindow`. */
export function readParcelDeliveryTokenFromWindow(
  locationLike: Pick<Location, "search"> = window.location,
): string | null {
  return parseParcelDeliveryToken(locationLike.search);
}

/**
 * Parse `#token=<uuid>` — cùng luật với query: đúng một field `token`, đúng UUID.
 * Dùng khi link sạch hơn (không qua email rewrite) đặt token trong fragment.
 */
export function parseParcelDeliveryTokenFromHash(hash: string): string | null {
  if (!hash || hash.startsWith("?")) {
    return null;
  }

  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw || raw.startsWith("?")) {
    return null;
  }

  const entries = [...new URLSearchParams(raw).entries()];
  if (entries.length !== 1 || entries[0]?.[0] !== "token") {
    return null;
  }

  const token = entries[0][1].trim();
  return isParcelDeliveryToken(token) ? token : null;
}

/**
 * Xoá `token` khỏi query và hash sau khi đã đọc vào bộ nhớ, giữ path + query
 * khác + hash không phải token. Dùng `replaceState` để không thêm lịch sử.
 */
type HistoryLike = Pick<History, "replaceState"> & { state?: History["state"] };

export function stripParcelDeliveryTokenFromUrl(
  historyLike: HistoryLike = window.history,
  locationLike: Pick<Location, "pathname" | "search" | "hash"> = window.location,
): void {
  const params = new URLSearchParams(locationLike.search);
  const hadQueryToken = params.has("token");
  if (hadQueryToken) {
    params.delete("token");
  }

  const hashIsDeliveryToken = parseParcelDeliveryTokenFromHash(locationLike.hash) != null;
  if (!hadQueryToken && !hashIsDeliveryToken) {
    return;
  }

  const query = params.toString();
  const hash = hashIsDeliveryToken ? "" : locationLike.hash;
  historyLike.replaceState(
    historyLike.state ?? null,
    "",
    `${locationLike.pathname}${query ? `?${query}` : ""}${hash}`,
  );
}

export function readParcelDeliveryTokenFromSession(
  storage: Pick<Storage, "getItem" | "removeItem"> | null = getSessionStorage(),
): string | null {
  if (inMemoryToken && isParcelDeliveryToken(inMemoryToken)) {
    return inMemoryToken;
  }
  inMemoryToken = null;
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(PARCEL_DELIVERY_TOKEN_SESSION_KEY);
  } catch {
    return null;
  }

  if (raw == null) return null;
  const token = raw.trim();
  if (!isParcelDeliveryToken(token)) {
    clearParcelDeliveryTokenSession(storage);
    return null;
  }
  inMemoryToken = token;
  return token;
}

export function writeParcelDeliveryTokenToSession(
  token: string,
  storage: Pick<Storage, "setItem"> | null = getSessionStorage(),
): void {
  if (!isParcelDeliveryToken(token)) return;
  inMemoryToken = token;
  if (!storage) return;
  try {
    storage.setItem(PARCEL_DELIVERY_TOKEN_SESSION_KEY, token);
  } catch {
    // Quota / privacy mode — live page still has inMemoryToken.
  }
}

export function clearParcelDeliveryTokenSession(
  storage: Pick<Storage, "removeItem"> | null = getSessionStorage(),
): void {
  inMemoryToken = null;
  if (!storage) return;
  try {
    storage.removeItem(PARCEL_DELIVERY_TOKEN_SESSION_KEY);
  } catch {
    // Ignore blocked storage.
  }
}

/**
 * Ưu tiên query (contract email `?token=`), rồi hash, rồi memory/session.
 * Query có `token` hợp lệ thì cất rồi mới tẩy URL — confirm phải còn token.
 * Query có `token` nhưng sai/mập mờ → không fallback (tránh confirm nhầm đơn cũ).
 */
export function captureParcelDeliveryTokenFromWindow(
  historyLike: HistoryLike = window.history,
  locationLike: Pick<Location, "pathname" | "search" | "hash"> = window.location,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = getSessionStorage(),
): string | null {
  const search = locationLike.search;
  const queryHasToken = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  ).has("token");

  if (queryHasToken) {
    const fromQuery = parseParcelDeliveryToken(search);
    if (!fromQuery) return null;
    writeParcelDeliveryTokenToSession(fromQuery, storage);
    stripParcelDeliveryTokenFromUrl(historyLike, locationLike);
    return fromQuery;
  }

  const fromHash = parseParcelDeliveryTokenFromHash(locationLike.hash);
  if (fromHash) {
    writeParcelDeliveryTokenToSession(fromHash, storage);
    stripParcelDeliveryTokenFromUrl(historyLike, locationLike);
    return fromHash;
  }

  return readParcelDeliveryTokenFromSession(storage);
}

function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Che token cho mọi payload log/analytics lỡ đi qua đây. */
export function redactParcelDeliveryToken(value: string): string {
  if (!value) return "";
  return isParcelDeliveryToken(value) ? "[delivery-token]" : "[invalid-token]";
}
