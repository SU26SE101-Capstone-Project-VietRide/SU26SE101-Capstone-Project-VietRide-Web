import type { TFunction } from "i18next";
import type { TripOperationResult } from "../../../api/vietride";
import { formatDateTime } from "../../../utils/date";

/**
 * Biển số xe mới và tên kíp mới KHÔNG có trong response `substitute-vehicle` —
 * BE chỉ trả id. Panel giữ lại đúng lựa chọn người vận hành vừa gửi và đưa
 * xuống đây, nhờ vậy banner nói được "xe nào, ai lái" mà không phải gọi thêm
 * API chỉ để đọc lại thứ mình vừa gửi lên.
 */
export type SubstitutionSummary = {
  oldTripLabel?: string | null;
  oldVehiclePlate?: string | null;
  newTripLabel?: string | null;
  newVehiclePlate?: string | null;
  newDriverName?: string | null;
  newAssistantName?: string | null;
};

/**
 * Kết quả một lần thay xe — khối "sau khi đổi" của handoff 2026-08-30.
 *
 * Tách khỏi `TripActionsPanel` vì panel bị remount (`key={tripId}`) ngay khi
 * trang cha chuyển selection sang chuyến thay thế — state trong panel biến mất
 * đúng lúc nhà xe cần đọc. Trang cha giữ kết quả và render card này ở tầng của
 * nó; panel vẫn render được cho những chỗ nhúng không đổi tripId.
 */
export function SubstitutionResultCard({
  result,
  summary = null,
  t,
  tc,
}: {
  result: TripOperationResult;
  summary?: SubstitutionSummary | null;
  t: TFunction<"manager">;
  /** Namespace `common` để dịch enum trạng thái chuyến/xe */
  tc?: TFunction<"common">;
}) {
  // Nhóm khách chưa có ghế là VIỆC PHẢI LÀM TIẾP, không phải số liệu tổng kết:
  // BE không bắn event nào cho nhóm này và cũng không có API xếp ghế bổ sung,
  // nên nếu con số ở đây chìm đi thì không còn chỗ nào khác báo nữa.
  const pending = result.pendingSeatAssignmentCount ?? 0;
  const hasPending = pending > 0;

  const enumLabel = (value?: string | null, fallback = "-") =>
    value
      ? (tc?.(`enumLabels.${value}`, { defaultValue: value }) ?? value)
      : fallback;

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        hasPending ? "border-red-200 bg-red-50" : "border-vr-200 bg-vr-50"
      }`}
      role="status"
    >
      <p
        className={`text-sm font-semibold ${
          hasPending ? "text-red-900" : "text-vr-900"
        }`}
      >
        {t("tripOperations.substitutionResultTitle")}
      </p>

      {/* Chuyến cũ -> DISRUPTED, xe cũ -> MAINTENANCE. Handoff bắt Web nói rõ
          hai chuyển trạng thái này chứ không chỉ báo "đã đổi xong". */}
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 rounded-lg border border-white/70 bg-white/70 px-3 py-2.5 sm:grid-cols-2">
        <ResultRow
          label={t("tripOperations.resultOldTrip")}
          value={`${summary?.oldTripLabel ?? result.oldTripId ?? "-"} → ${enumLabel(
            result.oldTripStatus,
            "DISRUPTED",
          )}`}
        />
        <ResultRow
          label={t("tripOperations.resultOldVehicle")}
          value={`${summary?.oldVehiclePlate ?? "-"} → ${enumLabel("MAINTENANCE")}`}
        />
        <ResultRow
          label={t("tripOperations.resultNewTrip")}
          value={`${summary?.newTripLabel ?? result.newTripId ?? "-"} → ${enumLabel(
            result.newTripStatus,
            "BOARDING",
          )}`}
        />
        <ResultRow
          label={t("tripOperations.resultNewVehicle")}
          value={summary?.newVehiclePlate ?? "-"}
        />
        <ResultRow
          label={t("tripOperations.resultNewDriver")}
          value={summary?.newDriverName ?? "-"}
        />
        <ResultRow
          label={t("tripOperations.resultNewAssistant")}
          value={summary?.newAssistantName ?? "-"}
        />
        <ResultRow
          label={t("tripOperations.resultDeparture")}
          value={formatDateTime(result.newTripDepartureDateTime) || "-"}
        />
        <ResultRow
          label={t("tripOperations.resultRoute")}
          value={t("tripOperations.resultRouteKept")}
        />
      </dl>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
        <Stat
          label={t("tripOperations.substitutionResultBookings")}
          value={result.affectedBookingCount}
        />
        <Stat
          label={t("tripOperations.substitutionResultPassengers")}
          value={result.affectedPassengerCount}
        />
        <Stat
          label={t("tripOperations.substitutionResultPending")}
          value={result.pendingSeatAssignmentCount}
          emphasis={hasPending}
        />
      </dl>
      <p
        className={`mt-2 text-xs ${
          hasPending ? "font-medium text-red-800" : "text-gray-600"
        }`}
      >
        {hasPending
          ? t("tripOperations.substitutionResultPendingHint")
          : t("tripOperations.substitutionResultAllSeated")}
      </p>

      {/* `transferStatus = QUEUED` chỉ là "đang chờ crew xác nhận". Handoff cấm
          hiển thị hàng đã sang xe mới tại thời điểm này. */}
      <p className="mt-2 text-xs text-amber-800">
        {t("tripOperations.resultTransferPending", {
          status: enumLabel(result.transferStatus, "QUEUED"),
        })}
      </p>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-gray-600">{label}</dt>
      <dd className="text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value?: number;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-600">{label}</dt>
      {/* `?? "-"` chứ không `|| "-"`: 0 khách chưa có ghế là tin TỐT và phải
          hiện ra số 0, không được rơi xuống gạch ngang như thể thiếu dữ liệu. */}
      <dd
        className={`text-lg font-semibold tabular-nums ${
          emphasis ? "text-red-700" : "text-gray-900"
        }`}
      >
        {value ?? "-"}
      </dd>
    </div>
  );
}
