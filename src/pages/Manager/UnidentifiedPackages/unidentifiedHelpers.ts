import type { BadgeTone } from "../../../components/ui/Badge";
import type {
  RegisterUnidentifiedPackageRequest,
  UnidentifiedPackageAction,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import { isUsableUuid } from "../../../utils/parcelReliability";

/** Trả về khóa dịch an toàn, không để message/mã lỗi kỹ thuật rơi ra UI. */
export function unidentifiedErrorTranslationKey(
  error: unknown,
  fallbackKey: string,
) {
  if (!(error instanceof ApiRequestError)) return fallbackKey;

  if (error.status === 403) return "unidentifiedPackages.errors.noPermission";
  if (error.status === 404) return "unidentifiedPackages.errors.notFound";
  if (error.status >= 500) {
    return "unidentifiedPackages.errors.systemUnavailable";
  }
  return fallbackKey;
}

/**
 * `availableActions` là nguồn quyền duy nhất. Quan trọng hơn bình thường ở màn
 * này: match lại một package không còn `UNIDENTIFIED` làm BE ném raw exception
 * thành `500 INTERNAL_ERROR` (§10.5), nên nút phải tắt đúng chứ không thể dựa
 * vào thông báo lỗi.
 */
export function hasPackageAction(
  actions: UnidentifiedPackageAction[] | undefined | null,
  action: UnidentifiedPackageAction,
) {
  return (actions ?? []).includes(action);
}

export function packageStatusTone(status: string): BadgeTone {
  switch (status) {
    case "MATCHED":
      return "success";
    case "FORWARDED":
      return "info";
    case "RETURNED":
      return "neutral";
    case "UNIDENTIFIED":
      return "warning";
    default:
      return "neutral";
  }
}

export type RegisterPackageDraft = {
  temporaryExceptionTag: string;
  tripId: string;
  locationType: string;
  locationId: string;
  locationSnapshot: string;
  description: string;
  observedWeightKg: string;
  /** URL ảnh đã tải lên Firebase, do `EvidenceUploader` trả về. */
  evidenceReferences: string[];
};

export type RegisterPackageParseError =
  | "tag-required"
  | "description-required"
  | "location-id-invalid"
  | "trip-id-invalid"
  | "weight-invalid"
  | "evidence-required";

export type RegisterPackageParseResult =
  | { ok: true; value: RegisterUnidentifiedPackageRequest }
  | { ok: false; error: RegisterPackageParseError };

/**
 * Chặn tại FE đúng các guard của Domain (`UnidentifiedParcelPackage.Create`).
 * Domain ném `ArgumentException` không coded, nên vi phạm ở đây rơi ra
 * `500 INTERNAL_ERROR` chứ không phải một `422` đọc được.
 *
 * Lưu ý khác custody scan: `locationId` bắt buộc với MỌI loại địa điểm, kể cả
 * `VEHICLE`.
 */
export function parseRegisterPackageDraft(
  draft: RegisterPackageDraft,
): RegisterPackageParseResult {
  const temporaryExceptionTag = draft.temporaryExceptionTag.trim();
  if (!temporaryExceptionTag) {
    return { ok: false, error: "tag-required" };
  }

  const description = draft.description.trim();
  if (!description) {
    return { ok: false, error: "description-required" };
  }

  if (!isUsableUuid(draft.locationId)) {
    return { ok: false, error: "location-id-invalid" };
  }

  const tripIdText = draft.tripId.trim();
  if (tripIdText && !isUsableUuid(tripIdText)) {
    return { ok: false, error: "trip-id-invalid" };
  }

  const weightText = draft.observedWeightKg.trim();
  let observedWeightKg: number | undefined;
  if (weightText) {
    const parsed = Number(weightText);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { ok: false, error: "weight-invalid" };
    }
    observedWeightKg = parsed;
  }

  const evidenceReferences = draft.evidenceReferences.filter(Boolean);
  if (evidenceReferences.length === 0) {
    return { ok: false, error: "evidence-required" };
  }

  return {
    ok: true,
    value: {
      temporaryExceptionTag,
      ...(tripIdText ? { tripId: tripIdText.trim() } : {}),
      locationType:
        draft.locationType as RegisterUnidentifiedPackageRequest["locationType"],
      locationId: draft.locationId.trim(),
      ...(draft.locationSnapshot.trim()
        ? { locationSnapshot: draft.locationSnapshot.trim() }
        : {}),
      description,
      ...(observedWeightKg === undefined ? {} : { observedWeightKg }),
      evidenceReferences,
    },
  };
}
