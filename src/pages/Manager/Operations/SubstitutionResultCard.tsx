import type { TFunction } from "i18next";
import type { TripOperationResult } from "../../../api/vietride";

/**
 * Kết quả một lần thay xe.
 *
 * Tách khỏi `TripActionsPanel` vì panel bị remount (`key={tripId}`) ngay khi
 * trang cha chuyển selection sang chuyến thay thế — state trong panel biến mất
 * đúng lúc nhà xe cần đọc. Trang cha giữ kết quả và render card này ở tầng của
 * nó; panel vẫn render được cho những chỗ nhúng không đổi tripId.
 */
export function SubstitutionResultCard({
  result,
  t,
}: {
  result: TripOperationResult;
  t: TFunction<"manager">;
}) {
  // Nhóm khách chưa có ghế là VIỆC PHẢI LÀM TIẾP, không phải số liệu tổng kết:
  // BE không bắn event nào cho nhóm này và cũng không có API xếp ghế bổ sung,
  // nên nếu con số ở đây chìm đi thì không còn chỗ nào khác báo nữa.
  const pending = result.pendingSeatAssignmentCount ?? 0;
  const hasPending = pending > 0;

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        hasPending
          ? "border-red-200 bg-red-50"
          : "border-vr-200 bg-vr-50"
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
      <dl className="mt-2 grid grid-cols-3 gap-3 text-center">
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
