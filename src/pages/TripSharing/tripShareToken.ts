/**
 * Capability token for public trip sharing.
 *
 * Security rules:
 * - Read token only from URL hash (`#token=…`). Never from query/search.
 * - After reading, strip the hash so the address bar / history / screenshots
 *   no longer show the capability. Refresh in the same tab restores from
 *   sessionStorage only (tab-scoped; never localStorage, cookies, or logs).
 * - Hash is not sent on subsequent document/navigation requests (unlike query).
 */

/** Matches BE: v1.<grant UUID>.<base64url HMAC-SHA256> (~43 chars). */
export const TRIP_SHARE_TOKEN_PATTERN =
  /^v1\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i;

/** Tab-only stash so F5 still works after the hash is stripped. */
export const TRIP_SHARE_TOKEN_SESSION_KEY = "vietride.public.trip-share-token";

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
export function stripTripShareTokenFromUrl(
  historyLike: Pick<History, "replaceState"> = window.history,
  locationLike: Pick<Location, "pathname" | "search" | "hash"> = window.location,
): void {
  if (!parseTripShareTokenFromHash(locationLike.hash)) {
    return;
  }

  historyLike.replaceState(
    null,
    "",
    `${locationLike.pathname}${locationLike.search}`,
  );
}

export function readTripShareTokenFromSession(
  storage: Pick<Storage, "getItem" | "removeItem"> | null = getSessionStorage(),
): string | null {
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
  return token;
}

export function writeTripShareTokenToSession(
  token: string,
  storage: Pick<Storage, "setItem"> | null = getSessionStorage(),
): void {
  if (!storage || !isTripShareToken(token)) return;
  try {
    storage.setItem(TRIP_SHARE_TOKEN_SESSION_KEY, token);
  } catch {
    // Quota / privacy mode — page still works until the next refresh.
  }
}

export function clearTripShareTokenSession(
  storage: Pick<Storage, "removeItem"> | null = getSessionStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(TRIP_SHARE_TOKEN_SESSION_KEY);
  } catch {
    // Ignore blocked storage.
  }
}

/**
 * Take the capability off the URL (if present), stash it for same-tab refresh,
 * and return the token to keep in memory. URL hash wins over a leftover session
 * so opening a new share link in the same tab replaces the previous grant.
 */
export function captureTripShareTokenFromWindow(
  historyLike: Pick<History, "replaceState"> = window.history,
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

