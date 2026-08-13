import { apiRequest } from "./client";
import { createIdempotencyKey } from "./idempotency";
import type { AdminUserActionResult } from "./vietride";

export function lockOperatorUser(
  userId: string,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<AdminUserActionResult>(`/v1/operator/users/${userId}/lock`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function unlockOperatorUser(
  userId: string,
  idempotencyKey = createIdempotencyKey(),
) {
  return apiRequest<AdminUserActionResult>(`/v1/operator/users/${userId}/unlock`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });
}
