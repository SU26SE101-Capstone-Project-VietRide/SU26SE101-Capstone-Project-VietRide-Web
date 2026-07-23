import { describe, expect, it } from "vitest";
import {
  addIdempotencyHeader,
  createIdempotencyKey,
} from "./idempotency";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("idempotency", () => {
  it("creates secure UUID v4 operation keys", () => {
    expect(createIdempotencyKey()).toMatch(UUID_V4_PATTERN);
  });

  it("adds an idempotency key to mutations but not reads", () => {
    expect(
      addIdempotencyHeader("/v1/operator/routes", "POST"),
    ).toEqual({
      "Idempotency-Key": expect.stringMatching(UUID_V4_PATTERN),
    });
    expect(addIdempotencyHeader("/v1/operator/routes", "GET")).toBeUndefined();
  });

  it("preserves an explicit operation key case-insensitively", () => {
    const headers = {
      "idempotency-key": "11111111-1111-4111-8111-111111111111",
    };

    expect(
      addIdempotencyHeader("/v1/operator/routes", "POST", headers),
    ).toBe(headers);
  });

  it.each([
    "/v1/auth/login",
    "/v1/auth/google",
    "/v1/auth/refresh",
    "/v1/firebase/custom-token",
    "/v1/admin/rag-config/reload",
    "/v1/payments/vnpay-ipn",
    "/v1/payments/vnpay-topup-ipn",
    "/v1/payments/subscription-vnpay-ipn",
    "/internal/v1/operators/summaries/batch",
    "/internal/v1/vouchers/validate",
  ])("does not add a key to exempt operation %s", (path) => {
    expect(addIdempotencyHeader(`${path}?source=test`, "POST")).toBeUndefined();
  });
});
