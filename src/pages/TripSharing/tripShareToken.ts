/**
 * Capability token for public trip sharing.
 *
 * Security rules:
 * - Read token only from URL hash (`#token=…`). Never from query/search.
 * - Never write the raw token to localStorage, sessionStorage, cookies, or logs.
 * - Hash is not sent on subsequent document/navigation requests (unlike query).
 */

/** Matches BE: v1.<grant UUID>.<base64url HMAC-SHA256> (~43 chars). */
export const TRIP_SHARE_TOKEN_PATTERN =
  /^v1\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/i;

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

