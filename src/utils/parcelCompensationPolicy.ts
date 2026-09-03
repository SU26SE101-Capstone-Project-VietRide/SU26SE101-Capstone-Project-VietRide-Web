import type {
  ParcelCompensationPolicy,
  ParcelCompensationPolicyDefaults,
  UpdateParcelCompensationPolicyRequest,
} from "../api/vietride";

/**
 * Bản nháp form của chính sách bồi thường kiện hàng. Giữ ở dạng chuỗi để ô số
 * xoá trắng được (number state sẽ nhảy về 0 ngay khi người dùng xoá ký tự cuối).
 */
export type ParcelCompensationDraft = {
  compensationRatePercent: string;
  maxCompensationVnd: string;
  noProofFallbackMultiplier: string;
  claimWindowDays: string;
  searchSlaHours: string;
  decisionSlaBusinessDays: string;
  payoutSlaBusinessDays: string;
  belowDefaultAcknowledged: boolean;
};

export type ParcelCompensationNumericField = Exclude<
  keyof ParcelCompensationDraft,
  "belowDefaultAcknowledged"
>;

/**
 * Range lấy từ `ParcelCompensationPolicy.Update` của Parcel service. Chặn tại FE
 * để người dùng thấy lỗi ngay thay vì ăn 422 VALIDATION_ERROR sau một vòng mạng.
 * `maxCompensationVnd` BE chỉ yêu cầu > 0 (int64) — trần dưới đây là giới hạn an
 * toàn của `Number`, không phải luật nghiệp vụ.
 */
export const PARCEL_COMPENSATION_RANGES: Record<
  ParcelCompensationNumericField,
  { min: number; max: number }
> = {
  compensationRatePercent: { min: 1, max: 100 },
  maxCompensationVnd: { min: 1, max: 999_999_999_999 },
  noProofFallbackMultiplier: { min: 1, max: 2 },
  claimWindowDays: { min: 1, max: 365 },
  searchSlaHours: { min: 1, max: 720 },
  decisionSlaBusinessDays: { min: 1, max: 90 },
  payoutSlaBusinessDays: { min: 1, max: 90 },
};

/**
 * Field này chỉ còn tồn tại để tương thích contract PUT, không tham gia tính
 * award mới và không được hiện thành control. Policy/snapshot legacy có thể
 * còn giá trị 4, nhưng BE mới chỉ chấp nhận 1..2 khi ghi lại policy.
 */
function compatibleNoProofMultiplier(value: number) {
  return String(Math.min(2, Math.max(1, Math.trunc(value))));
}

export const PARCEL_COMPENSATION_NUMERIC_FIELDS = Object.keys(
  PARCEL_COMPENSATION_RANGES,
) as ParcelCompensationNumericField[];

export type ParcelCompensationParseError =
  | "empty-field"
  | "invalid-number"
  | "out-of-range"
  | "ack-required";

export type ParcelCompensationParseResult =
  | { ok: true; value: UpdateParcelCompensationPolicyRequest }
  | {
      ok: false;
      error: ParcelCompensationParseError;
      field?: ParcelCompensationNumericField;
    };

export function draftFromParcelCompensationPolicy(
  policy: ParcelCompensationPolicy,
): ParcelCompensationDraft {
  return {
    compensationRatePercent: String(policy.compensationRatePercent),
    maxCompensationVnd: String(policy.maxCompensationVnd),
    noProofFallbackMultiplier: compatibleNoProofMultiplier(
      policy.noProofFallbackMultiplier,
    ),
    claimWindowDays: String(policy.claimWindowDays),
    searchSlaHours: String(policy.searchSlaHours),
    decisionSlaBusinessDays: String(policy.decisionSlaBusinessDays),
    payoutSlaBusinessDays: String(policy.payoutSlaBusinessDays),
    belowDefaultAcknowledged: policy.belowDefaultAcknowledged,
  };
}

export function draftFromParcelCompensationDefaults(
  defaults: ParcelCompensationPolicyDefaults,
): ParcelCompensationDraft {
  return {
    compensationRatePercent: String(defaults.compensationRatePercent),
    maxCompensationVnd: String(defaults.maxCompensationVnd),
    noProofFallbackMultiplier: compatibleNoProofMultiplier(
      defaults.noProofFallbackMultiplier,
    ),
    claimWindowDays: String(defaults.claimWindowDays),
    searchSlaHours: String(defaults.searchSlaHours),
    decisionSlaBusinessDays: String(defaults.decisionSlaBusinessDays),
    payoutSlaBusinessDays: String(defaults.payoutSlaBusinessDays),
    // Bằng đúng mức nền tảng thì không còn là "dưới mặc định" nữa
    belowDefaultAcknowledged: false,
  };
}

function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * BE (`ParcelCompensationPolicy.Update`) bắt buộc `belowDefaultAcknowledged`
 * khi rate HOẶC trần thấp hơn mức nền tảng — nếu không thì 422
 * `POLICY_BELOW_DEFAULT_ACK_REQUIRED`.
 */
export function isBelowPlatformDefault(
  draft: ParcelCompensationDraft,
  defaults: ParcelCompensationPolicyDefaults,
) {
  const rate = parsePositiveInt(draft.compensationRatePercent);
  const cap = parsePositiveInt(draft.maxCompensationVnd);

  return (
    (rate !== null && rate < defaults.compensationRatePercent) ||
    (cap !== null && cap < defaults.maxCompensationVnd)
  );
}

export function parseParcelCompensationDraft(
  draft: ParcelCompensationDraft,
  defaults: ParcelCompensationPolicyDefaults,
): ParcelCompensationParseResult {
  const parsed = {} as Record<ParcelCompensationNumericField, number>;

  for (const field of PARCEL_COMPENSATION_NUMERIC_FIELDS) {
    const raw = draft[field].trim();
    if (!raw) {
      return { ok: false, error: "empty-field", field };
    }

    const value = parsePositiveInt(raw);
    if (value === null) {
      return { ok: false, error: "invalid-number", field };
    }

    const range = PARCEL_COMPENSATION_RANGES[field];
    if (value < range.min || value > range.max) {
      return { ok: false, error: "out-of-range", field };
    }

    parsed[field] = value;
  }

  if (isBelowPlatformDefault(draft, defaults) && !draft.belowDefaultAcknowledged) {
    return { ok: false, error: "ack-required" };
  }

  return {
    ok: true,
    value: {
      ...parsed,
      // Gửi đúng thứ BE cần: chỉ xác nhận khi thật sự dưới mặc định, tránh cờ
      // "đã chấp nhận hạ mức" dính lại trên policy đã kéo về bằng nền tảng.
      belowDefaultAcknowledged:
        isBelowPlatformDefault(draft, defaults) &&
        draft.belowDefaultAcknowledged,
    },
  };
}
