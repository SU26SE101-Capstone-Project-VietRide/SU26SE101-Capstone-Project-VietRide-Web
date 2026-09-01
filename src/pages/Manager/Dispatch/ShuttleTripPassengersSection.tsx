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
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiLock,
  FiPhone,
  FiRefreshCw,
  FiUserMinus,
  FiUsers,
} from "react-icons/fi";
import {
  getOperatorShuttleTripPassengers,
  unassignOperatorShuttleBooking,
  type OperatorShuttleTripStatus,
  type ShuttleTripPassengerGroup,
  type UnassignShuttleBookingResult,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import { createIdempotencyKey } from "../../../api/idempotency";
import { displayBusinessCode } from "../../../utils/businessCode";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import UnassignShuttleBookingModal from "./UnassignShuttleBookingModal";

export type ShuttleBookingMutationEvent =
  | { result: UnassignShuttleBookingResult; errorCode?: never }
  | { result?: never; errorCode?: string };

type ShuttleTripPassengersSectionProps = {
  shuttleTripId: string;
  tripStatus: OperatorShuttleTripStatus;
  canUnassignBooking: boolean;
  onMutationSettled?: (event: ShuttleBookingMutationEvent) => void | Promise<void>;
};

export default function ShuttleTripPassengersSection({
  shuttleTripId,
  tripStatus,
  canUnassignBooking,
  onMutationSettled,
}: ShuttleTripPassengersSectionProps) {
  const { t } = useTranslation("manager");
  const tRef = useRef(t);
  const [groups, setGroups] = useState<ShuttleTripPassengerGroup[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [unassignTarget, setUnassignTarget] =
    useState<ShuttleTripPassengerGroup | null>(null);
  const [unassignReason, setUnassignReason] = useState("");
  const [unassignError, setUnassignError] = useState("");
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [mutationFeedback, setMutationFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [unassignLocked, setUnassignLocked] = useState(false);
  const unassigningRef = useRef(false);
  const unassignKeyRef = useRef<string | null>(null);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

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
              ? tRef.current("dispatch.passengersUnavailable")
              : loadError instanceof Error
                ? loadError.message
                : tRef.current("dispatch.passengersLoadFailed"),
          );
        })
        .finally(() => {
          if (!ignore) setIsLoading(false);
        });
    });

    return () => {
      ignore = true;
    };
  }, [loadVersion, shuttleTripId]);

  const isUnassignAvailable =
    canUnassignBooking && tripStatus === "SCHEDULED" && !unassignLocked;

  function openUnassign(group: ShuttleTripPassengerGroup) {
    if (!group.bookingId || !isUnassignAvailable) return;

    setMutationFeedback(null);
    setUnassignReason("");
    setUnassignError("");
    unassignKeyRef.current = createIdempotencyKey();
    setUnassignTarget(group);
  }

  function closeUnassign() {
    if (unassigningRef.current) return;

    setUnassignTarget(null);
    setUnassignReason("");
    setUnassignError("");
    unassignKeyRef.current = null;
  }

  async function handleUnassign() {
    if (
      !unassignTarget?.bookingId ||
      unassigningRef.current ||
      !isUnassignAvailable
    ) {
      return;
    }

    const reason = unassignReason.trim();
    if (!reason) {
      setUnassignError(t("dispatch.unassignBookingReasonRequired"));
      return;
    }

    // Một hộp thoại là một thao tác logic: response có thể bị mất sau khi BE đã
    // xử lý, nên mọi lần bấm thử lại phải dùng đúng key đã tạo lúc mở modal.
    const idempotencyKey =
      unassignKeyRef.current ?? createIdempotencyKey();
    unassignKeyRef.current = idempotencyKey;
    unassigningRef.current = true;
    setIsUnassigning(true);
    setUnassignError("");

    try {
      const result = await unassignOperatorShuttleBooking(
        shuttleTripId,
        unassignTarget.bookingId,
        { reason },
        idempotencyKey,
      );

      setMutationFeedback({
        kind: "success",
        message: result.shuttleTripCancelled
          ? t("dispatch.unassignBookingLastSuccess", {
              count: result.unassignedPassengerCount,
            })
          : t("dispatch.unassignBookingSuccess", {
              count: result.unassignedPassengerCount,
              remaining: result.remainingPassengerCount,
            }),
      });
      setUnassignTarget(null);
      setUnassignReason("");
      unassignKeyRef.current = null;

      // Không cập nhật manifest lạc quan. Kích hoạt bốn nguồn refetch ngay sau
      // response 200; component này chịu trách nhiệm nguồn manifest.
      setLoadVersion((current) => current + 1);
      void onMutationSettled?.({ result });
    } catch (submitError: unknown) {
      const requestError =
        submitError instanceof ApiRequestError ? submitError : null;
      const message =
        requestError?.code === "SHUTTLE_TRIP_NOT_FOUND"
          ? t("dispatch.unassignErrors.tripNotFound")
          : requestError?.code === "SHUTTLE_BOOKING_NOT_FOUND"
            ? t("dispatch.unassignErrors.bookingNotFound")
            : requestError?.code === "SHUTTLE_TRIP_INVALID_STATE"
              ? t("dispatch.unassignErrors.invalidState")
              : requestError?.code === "SHUTTLE_BOOKING_NOT_UNASSIGNABLE"
                ? t("dispatch.unassignErrors.notUnassignable")
                : submitError instanceof Error
                  ? submitError.message
                  : t("dispatch.unassignBookingFailed");

      setUnassignError(message);
      if (requestError?.code === "SHUTTLE_TRIP_INVALID_STATE") {
        setUnassignLocked(true);
      }

      if (
        requestError?.code === "SHUTTLE_TRIP_NOT_FOUND" ||
        requestError?.code === "SHUTTLE_BOOKING_NOT_FOUND"
      ) {
        setMutationFeedback({ kind: "error", message });
        setUnassignTarget(null);
        setUnassignReason("");
        unassignKeyRef.current = null;
      }

      // Giữ nguyên dữ liệu đang hiển thị tới khi refetch hoàn tất. Mọi lỗi
      // nghiệp vụ/resource/upstream đều có thể đồng nghĩa dữ liệu đã đổi ở BE.
      setLoadVersion((current) => current + 1);
      void onMutationSettled?.({ errorCode: requestError?.code });
    } finally {
      unassigningRef.current = false;
      setIsUnassigning(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <FiUsers size={16} className="text-vr-800" aria-hidden="true" />
        {t("dispatch.passengersTitle")}
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        {t("dispatch.passengersHint")}
      </p>

      {canUnassignBooking && tripStatus !== "SCHEDULED" && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
          <FiLock className="mt-0.5 shrink-0" aria-hidden="true" />
          {t("dispatch.unassignBookingLocked")}
        </p>
      )}

      {mutationFeedback && (
        <p
          role={mutationFeedback.kind === "error" ? "alert" : "status"}
          className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
            mutationFeedback.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {mutationFeedback.message}
        </p>
      )}

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
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                    {t("dispatch.passengersCount", {
                      count:
                        group.passengerCount ?? group.passengers?.length ?? 0,
                    })}
                  </span>
                  {canUnassignBooking && group.bookingId && (
                    <button
                      type="button"
                      onClick={() => openUnassign(group)}
                      disabled={!isUnassignAvailable}
                      title={
                        isUnassignAvailable
                          ? t("dispatch.unassignBooking")
                          : t("dispatch.unassignBookingLocked")
                      }
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
                    >
                      <FiUserMinus size={13} aria-hidden="true" />
                      {t("dispatch.unassignBooking")}
                    </button>
                  )}
                </div>
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

      <UnassignShuttleBookingModal
        open={unassignTarget !== null}
        group={unassignTarget}
        reason={unassignReason}
        error={unassignError}
        busy={isUnassigning}
        locked={!isUnassignAvailable}
        onReasonChange={(reason) => {
          setUnassignError("");
          setUnassignReason(reason);
        }}
        onClose={closeUnassign}
        onConfirm={() => void handleUnassign()}
      />
    </section>
  );
}
