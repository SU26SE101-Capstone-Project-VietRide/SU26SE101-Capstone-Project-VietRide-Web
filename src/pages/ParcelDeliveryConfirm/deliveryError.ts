import { ApiRequestError } from "../../api/client";

/**
 * Phân loại lỗi của 3 endpoint public `/v1/parcels/delivery/*`.
 *
 * - `blocked`: bấm lại cũng không đổi kết quả (token hỏng/hết hạn/thu hồi, đơn
 *   không còn chờ xác nhận) → khoá hành động, hướng người nhận liên hệ nhà xe.
 * - `retryable`: lỗi tạm (mạng, rate limit, idempotency đang xử lý, upstream)
 *   → cho thử lại với NGUYÊN key idempotency cũ.
 */
export type DeliveryErrorKind = "blocked" | "retryable";

export type DeliveryErrorInfo = {
  kind: DeliveryErrorKind;
  /** Key trong namespace i18n `parcelDelivery`. */
  messageKey: string;
  code?: string;
};

const BLOCKED_MESSAGE_KEYS: Record<string, string> = {
  PARCEL_DELIVERY_TOKEN_INVALID: "errors.tokenInvalid",
  PARCEL_DELIVERY_TOKEN_EXPIRED: "errors.tokenExpired",
  PARCEL_DELIVERY_TOKEN_REVOKED: "errors.tokenRevoked",
  PARCEL_NOT_PENDING_CONFIRM: "errors.notPendingConfirm",
  PARCEL_DELIVERY_REJECTED_WINDOW_EXPIRED: "errors.undoWindowExpired",
  VALIDATION_ERROR: "errors.validation",
};

const RETRYABLE_MESSAGE_KEYS: Record<string, string> = {
  RATE_LIMITED: "errors.rateLimited",
  RATE_LIMIT_EXCEEDED: "errors.rateLimited",
  IDEMPOTENCY_REQUEST_PENDING: "errors.requestPending",
  IDEMPOTENCY_REQUEST_IN_PROGRESS: "errors.requestPending",
  IDEMPOTENCY_KEY_REQUIRED: "errors.idempotency",
  IDEMPOTENCY_KEY_MISMATCH: "errors.idempotency",
  RACE_LOST: "errors.raceLost",
  RESOURCE_CONFLICT: "errors.raceLost",
  UPSTREAM_UNAVAILABLE: "errors.upstream",
  SERVICE_UNAVAILABLE: "errors.upstream",
  INTERNAL_ERROR: "errors.generic",
};

export function classifyDeliveryError(error: unknown): DeliveryErrorInfo {
  if (!(error instanceof ApiRequestError)) {
    // Fetch ném khi mất mạng / CORS / timeout — đáng thử lại.
    return { kind: "retryable", messageKey: "errors.network" };
  }

  const code = error.code ?? "";

  const blockedKey = BLOCKED_MESSAGE_KEYS[code];
  if (blockedKey) {
    return { kind: "blocked", messageKey: blockedKey, code };
  }

  const retryableKey = RETRYABLE_MESSAGE_KEYS[code];
  if (retryableKey) {
    return { kind: "retryable", messageKey: retryableKey, code };
  }

  // 4xx lạ: request sai từ phía client, thử lại y hệt cũng vậy. 5xx: cho retry.
  const kind: DeliveryErrorKind =
    error.status >= 400 && error.status < 500 ? "blocked" : "retryable";
  return { kind, messageKey: "errors.generic", code: code || undefined };
}
