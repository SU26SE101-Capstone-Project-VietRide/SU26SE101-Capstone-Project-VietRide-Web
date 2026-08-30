// Bảng đối chiếu ghế cũ → ghế mới khi thay xe (handoff "FE đồng bộ ghế sau khi
// thay xe").
//
// Ba luật của tài liệu quyết định toàn bộ file này:
// - Chỉ khách có `requiresAdminSelection = true` mới hiện bộ chọn. Khách giữ
//   được ghế cũ là kết quả của BE, không phải thứ Admin sửa được.
// - Không cho hai khách chọn trùng ghế, và không cho chọn ghế BE đã giữ cho
//   người khác.
// - Hành khách KHÔNG duyệt việc đổi ghế: đây là màn của Admin nhà xe, sau khi
//   xác nhận thì khách chỉ nhận thông báo. Không có trạng thái "chờ khách đồng ý".
import type { TFunction } from "i18next";
import { FiCheckCircle, FiRefreshCw } from "react-icons/fi";
import type { SubstituteVehiclePreviewResult } from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import { Badge } from "../../../components/ui/Badge";
import {
  keptSeatCount,
  missingSeatSelections,
  seatOptionsFor,
  type SeatSelectionMap,
} from "../../../utils/seatReassignment";

type SeatReassignmentPanelProps = {
  /** `null` = chưa chọn xe thay thế hoặc preview chưa chạy */
  preview: SubstituteVehiclePreviewResult | null;
  selections: SeatSelectionMap;
  isLoading: boolean;
  /** Preview hỏng — câu lỗi đã dịch của BE */
  error: string;
  /** Bảng bị BE từ chối (`fieldErrors` có `seats`) → viền cảnh báo */
  invalid: boolean;
  disabled: boolean;
  onSelect: (passengerId: string, seatNumber: string) => void;
  onRetry: () => void;
  t: TFunction<"manager">;
};

export default function SeatReassignmentPanel({
  preview,
  selections,
  isLoading,
  error,
  invalid,
  disabled,
  onSelect,
  onRetry,
  t,
}: SeatReassignmentPanelProps) {
  if (isLoading) {
    return (
      <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
        {t("tripOperations.seatPreviewLoading")}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
      >
        <p>{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50"
        >
          <FiRefreshCw size={14} aria-hidden="true" />
          {t("tripOperations.seatPreviewRetry")}
        </button>
      </div>
    );
  }

  if (!preview) return null;

  const passengers = preview.passengers;
  const missing = missingSeatSelections(preview, selections);
  const kept = keptSeatCount(preview);

  // Chuyến không còn khách nào phải chuyển: nói thẳng ra, đừng bày một bảng rỗng.
  if (passengers.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
        {t("tripOperations.seatPreviewNoPassengers")}
      </div>
    );
  }

  return (
    <div
      className={`mt-4 overflow-hidden rounded-lg border bg-white ${
        invalid ? "border-red-300" : "border-gray-200"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {t("tripOperations.seatPreviewTitle")}
          </p>
          {/* Con số trấn an: phần lớn khách giữ nguyên ghế, chỉ nhóm nhỏ phải
              chọn lại. Không có nó thì bảng dài trông như phải xử lý cả chuyến. */}
          <p className="mt-0.5 text-xs text-gray-600">
            {t("tripOperations.seatPreviewSummary", {
              kept,
              total: passengers.length,
              pending: missing.length,
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <FiRefreshCw size={14} aria-hidden="true" />
          {t("tripOperations.seatPreviewRefresh")}
        </button>
      </div>

      {missing.length > 0 && (
        <p
          className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"
          role="alert"
        >
          {t("tripOperations.seatPreviewPending", { count: missing.length })}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2.5">
                {t("tripOperations.seatPreviewPassengerColumn")}
              </th>
              <th className="px-4 py-2.5">
                {t("tripOperations.seatPreviewOldSeatColumn")}
              </th>
              <th className="px-4 py-2.5">
                {t("tripOperations.seatPreviewNewSeatColumn")}
              </th>
            </tr>
          </thead>
          <tbody>
            {passengers.map((passenger) => {
              const selected = selections[passenger.passengerId] ?? "";
              const options = seatOptionsFor(preview, passenger, selections);

              return (
                <tr
                  key={passenger.passengerId}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-2.5">
                    {/* Payload preview KHÔNG có tên khách — chỉ id. Hiện 8 ký
                        tự đầu để đối chiếu với booking, không bịa ra tên. */}
                    <p className="font-mono text-xs text-gray-700">
                      {passenger.passengerId.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-gray-400">
                      {t("tripOperations.seatPreviewBookingRef", {
                        ref: passenger.bookingId.slice(0, 8).toUpperCase(),
                      })}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">
                    {passenger.originalSeatNumber ?? "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    {passenger.requiresAdminSelection ? (
                      <>
                        <CustomSelect
                          value={selected}
                          onChange={(event) =>
                            onSelect(passenger.passengerId, event.target.value)
                          }
                          invalid={invalid && !selected}
                          disabled={disabled || options.length === 0}
                          aria-label={t("tripOperations.seatPreviewSelectLabel", {
                            seat:
                              passenger.originalSeatNumber ??
                              passenger.passengerId.slice(0, 8).toUpperCase(),
                          })}
                        >
                          <option value="">
                            {t("tripOperations.seatPreviewSelectPlaceholder")}
                          </option>
                          {/* Ghế đang chọn phải luôn còn trong danh sách kể cả
                              khi `seatOptionsFor` vừa loại nó — bằng không
                              select rơi về rỗng và người dùng tưởng mình chưa
                              chọn. */}
                          {(selected && !options.includes(selected)
                            ? [selected, ...options]
                            : options
                          ).map((seat) => (
                            <option key={seat} value={seat}>
                              {seat}
                            </option>
                          ))}
                        </CustomSelect>
                        {options.length === 0 && !selected && (
                          <p className="mt-1 text-xs text-red-700">
                            {t("tripOperations.seatPreviewNoOption")}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <FiCheckCircle
                          size={14}
                          className="text-emerald-600"
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-gray-800">
                          {passenger.proposedSeatNumber ?? "-"}
                        </span>
                        <Badge tone="success">
                          {t("tripOperations.seatPreviewKept")}
                        </Badge>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Ranh giới nghiệp vụ: khách KHÔNG duyệt ghế, và `PENDING_CONFIRM` ở chỗ
          khác là việc nhân sự trên xe xác nhận lên xe — không liên quan tới đây. */}
      <p className="border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 text-xs text-gray-600">
        {t("tripOperations.seatPreviewNotice")}
      </p>
    </div>
  );
}
