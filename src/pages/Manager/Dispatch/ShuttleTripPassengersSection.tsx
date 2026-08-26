// Danh sách hành khách của một chuyến trung chuyển, gom theo điểm đón.
//
// Nguồn: `GET /v1/operator/shuttle-trips/{id}/passengers` — endpoint DUY NHẤT
// trả tên + SĐT từng khách. `operator-context` của Tracking cố tình không trả
// hai field này (nó dựng cho bản đồ), còn `GET /v1/operator/shuttle-requests`
// chỉ có yêu cầu CHƯA xếp xe.
//
// Tự nạp dữ liệu thay vì nhận qua props như `ShuttleTripDetailModal`: trang cha
// (`Dispatch/index.tsx`) đã 1.3k dòng và đang nằm trong danh sách vượt ngưỡng
// của CODE_CONVENTIONS — thêm một luồng tải nữa vào đó chỉ làm nặng thêm.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiPhone, FiRefreshCw, FiUsers } from "react-icons/fi";
import {
  getOperatorShuttleTripPassengers,
  type ShuttleTripPassengerGroup,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import { displayBusinessCode } from "../../../utils/businessCode";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";

export default function ShuttleTripPassengersSection({
  shuttleTripId,
}: {
  shuttleTripId: string;
}) {
  const { t } = useTranslation("manager");
  const [groups, setGroups] = useState<ShuttleTripPassengerGroup[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!shuttleTripId) return;

    let ignore = false;

    // `queueMicrotask` để thoả rule `react-hooks/set-state-in-effect` — cùng
    // pattern với `TripSeatMapPanel`.
    queueMicrotask(() => {
      if (ignore) return;
      setIsLoading(true);
      setError("");

      getOperatorShuttleTripPassengers(shuttleTripId)
        .then((result) => {
          if (ignore) return;
          // Sắp theo `pickupOrder` chứ không tin thứ tự mảng BE trả — cùng lý
          // do với danh sách điểm đón ở `ShuttleTripDetailModal`.
          setGroups(
            [...(result.groups ?? [])].sort(
              (left, right) => left.pickupOrder - right.pickupOrder,
            ),
          );
        })
        .catch((loadError: unknown) => {
          if (ignore) return;
          setGroups(null);
          setError(
            // 503 nghĩa là Trip service chưa lấy được snapshot booking, KHÔNG
            // phải hỏng cấu hình hay hết quyền — nói đúng như vậy để điều độ
            // viên biết chỉ cần thử lại.
            loadError instanceof ApiRequestError && loadError.status === 503
              ? t("dispatch.passengersUnavailable")
              : loadError instanceof Error
                ? loadError.message
                : t("dispatch.passengersLoadFailed"),
          );
        })
        .finally(() => {
          if (!ignore) setIsLoading(false);
        });
    });

    return () => {
      ignore = true;
    };
  }, [shuttleTripId, t]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <FiUsers size={16} className="text-vr-800" aria-hidden="true" />
        {t("dispatch.passengersTitle")}
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        {t("dispatch.passengersHint")}
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </p>
      ) : isLoading ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-gray-500">
          <FiRefreshCw className="animate-spin" size={14} />
          {t("dispatch.loading")}
        </p>
      ) : !groups || groups.length === 0 ? (
        <p className="mt-3 rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          {t("dispatch.passengersEmpty")}
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {groups.map((group) => (
            <li
              key={`${group.pickupOrder}-${group.bookingId ?? "group"}`}
              className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-vr-900 ring-1 ring-vr-100">
                    {group.pickupOrder}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {group.pickupAddress?.trim() ||
                        t("dispatch.pickupOrderValue", {
                          order: group.pickupOrder,
                        })}
                    </p>
                    <p className="mt-0.5 font-mono text-xs tabular-nums text-gray-500">
                      {displayBusinessCode(group.bookingCode)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                  {t("dispatch.passengersCount", {
                    count: group.passengerCount ?? group.passengers?.length ?? 0,
                  })}
                </span>
              </div>

              {group.passengers && group.passengers.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-gray-200 pt-2">
                  {group.passengers.map((passenger, index) => (
                    <li
                      key={
                        passenger.passengerUserId ??
                        `${group.pickupOrder}-${index}`
                      }
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-gray-800">
                        {passenger.displayName?.trim() ||
                          t("dispatch.passengerUnnamed")}
                      </span>
                      {passenger.phone ? (
                        // Số điện thoại là thứ điều độ viên cần bấm gọi ngay khi
                        // khách không ra điểm đón — để dạng link `tel:` chứ
                        // không phải chữ chết.
                        <a
                          href={`tel:${passenger.phone}`}
                          className="inline-flex shrink-0 items-center gap-1.5 font-medium text-vr-800 hover:underline"
                        >
                          <FiPhone size={12} aria-hidden="true" />
                          {formatVietnamPhoneForDisplay(passenger.phone)}
                        </a>
                      ) : (
                        <span className="shrink-0 text-xs text-gray-400">
                          {t("dispatch.passengerNoPhone")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
