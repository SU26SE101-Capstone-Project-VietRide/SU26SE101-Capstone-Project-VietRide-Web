/**
 * Capability token for public trip sharing.
 *
 * Function first, then conceal:
 * - Map/socket auth uses the token from memory. Hiding the URL must never
 *   drop a token we already accepted.
 * - Read new tokens only from URL hash (`#token=…`). Never from query/search.
 * - After a valid read: remember in-module + sessionStorage, then strip the
 *   hash. Empty hash (F5 / Strict remount) restores memory, then session.
 * - sessionStorage is best-effort. Private mode / quota must not break the
 *   live page — memory still holds the token until the tab is gone.
 * - Never localStorage, cookies, or logs.
 */

/** Matches BE: v1.<grant UUID>.<base64url HMAC-SHA256> (~43 chars). */
export const TRIP_SHARE_TOKEN_PATTERN =
  /^v1\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i;

/** Tab-only stash so F5 still works after the hash is stripped. */
export const TRIP_SHARE_TOKEN_SESSION_KEY = "vietride.public.trip-share-token";

/** Survives React remount in the same JS realm even if sessionStorage is blocked. */
let inMemoryToken: string | null = null;

export function isTripShareToken(value: string): boolean {
  return TRIP_SHARE_TOKEN_PATTERN.test(value.trim());
}

/**
 * Parse `#token=<capability>` from a hash string (with or without leading #).
 * Returns null if missing or malformed.
 */
export function parseTripShareTokenFromHash(hash: string): string | null {
  // Reject query-string shapes — capability must live in the fragment only.
  if (!hash || hash.startsWith("?")) {
    return null;
  }

  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw || raw.startsWith("?")) {
    return null;
  }

  const params = new URLSearchParams(raw);
  const entries = [...params.entries()];
  // The BE issues exactly `#token=...`. Reject duplicate/extra fields so a
  // capability link cannot be made ambiguous by a third party.
  if (entries.length !== 1 || entries[0]?.[0] !== "token") {
    return null;
  }

  const token = entries[0][1].trim();
  if (!token || !isTripShareToken(token)) {
    return null;
  }
  return token;
}

/** Live location hash (browser). Prefer this over reading full URL strings. */
export function readTripShareTokenFromWindow(
  locationLike: Pick<Location, "hash"> = window.location,
): string | null {
  return parseTripShareTokenFromHash(locationLike.hash);
}

/**
 * Remove a valid `#token=…` capability from the address bar without adding a
 * history entry. Leaves unrelated hashes untouched.
 */
type HistoryLike = Pick<History, "replaceState"> & { state?: History["state"] };

export function stripTripShareTokenFromUrl(
  historyLike: HistoryLike = window.history,
  locationLike: Pick<Location, "pathname" | "search" | "hash"> = window.location,
): void {
  if (!parseTripShareTokenFromHash(locationLike.hash)) {
    return;
  }

  historyLike.replaceState(
    historyLike.state ?? null,
    "",
    `${locationLike.pathname}${locationLike.search}`,
  );
}

export function readTripShareTokenFromSession(
  storage: Pick<Storage, "getItem" | "removeItem"> | null = getSessionStorage(),
): string | null {
  if (inMemoryToken && isTripShareToken(inMemoryToken)) {
    return inMemoryToken;
  }
  inMemoryToken = null;
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(TRIP_SHARE_TOKEN_SESSION_KEY);
  } catch {
    return null;
  }

  if (raw == null) return null;
  const token = raw.trim();
  if (!isTripShareToken(token)) {
    clearTripShareTokenSession(storage);
    return null;
  }
  inMemoryToken = token;
  return token;
}

export function writeTripShareTokenToSession(
  token: string,
  storage: Pick<Storage, "setItem"> | null = getSessionStorage(),
): void {
  if (!isTripShareToken(token)) return;
  inMemoryToken = token;
  if (!storage) return;
  try {
    storage.setItem(TRIP_SHARE_TOKEN_SESSION_KEY, token);
  } catch {
    // Quota / privacy mode — live page still has inMemoryToken.
  }
}

export function clearTripShareTokenSession(
  storage: Pick<Storage, "removeItem"> | null = getSessionStorage(),
): void {
  inMemoryToken = null;
  if (!storage) return;
  try {
    storage.removeItem(TRIP_SHARE_TOKEN_SESSION_KEY);
  } catch {
    // Ignore blocked storage.
  }
}

/**
 * Conceal the hash only after the token is stashed. A later empty hash
 * (strip already ran, F5, Strict remount) must restore the same grant so
 * the live map/socket keep working.
 */
export function captureTripShareTokenFromWindow(
  historyLike: HistoryLike = window.history,
  locationLike: Pick<Location, "pathname" | "search" | "hash"> = window.location,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = getSessionStorage(),
): string | null {
  const fromHash = parseTripShareTokenFromHash(locationLike.hash);
  if (fromHash) {
    writeTripShareTokenToSession(fromHash, storage);
    stripTripShareTokenFromUrl(historyLike, locationLike);
    return fromHash;
  }

  return readTripShareTokenFromSession(storage);
}

export function redactTripShareToken(value: string): string {
  if (!value) return "";
  return isTripShareToken(value) ? "[trip-share-token]" : "[invalid-token]";
}

function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

