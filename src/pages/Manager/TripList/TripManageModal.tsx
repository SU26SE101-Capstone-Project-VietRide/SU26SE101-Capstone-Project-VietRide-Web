import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertOctagon,
  FiEdit3,
  FiGrid,
  FiPhone,
  FiSave,
  FiSettings,
  FiUser,
} from "react-icons/fi";
import {
  cancelOperatorTrip,
  getOperatorRoutes,
  getOperatorVehicles,
  previewOperatorTripCancel,
  updateOperatorTrip,
  type OperatorRoute,
  type OperatorTripCancelPreview,
  type OperatorTripListItem,
  type OperatorVehicle,
  type UpdateOperatorTripRequest,
} from "../../../api/vietride";
import { createIdempotencyKey } from "../../../api/idempotency";
import { ConfirmModal } from "../../../components/ConfirmModal";
import CustomSelect from "../../../components/CustomSelect";
import InlineAlert from "../../../components/InlineAlert";
import Modal from "../../../components/Modal";
import TripSeatMapPanel from "../../../components/TripSeatMapPanel";
import { inputClass, labelClass, textareaClass } from "../../../components/form/formClasses";
import { displayBusinessCode } from "../../../utils/businessCode";
import { formatCurrency } from "../../../utils/currency";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";

/**
 * Chuyến đã chạy hoặc đã kết thúc thì không sửa/huỷ được nữa — BE trả `409
 * TRIP_NOT_EDITABLE`. Khoá sẵn ở FE để nhà xe không sửa một form rồi mới biết
 * là vô ích; sơ đồ ghế vẫn xem được ở mọi trạng thái.
 */
const EDITABLE_STATUSES = new Set(["SCHEDULED", "BOARDING"]);

/** Trạng thái mà `POST /cancel` còn chấp nhận. */
const CANCELLABLE_STATUSES = new Set(["SCHEDULED", "BOARDING"]);

type TripManageModalProps = {
  trip: OperatorTripListItem | null;
  /** Chỉ OPERATOR_ADMIN mới sửa/huỷ/khoá ghế được; STAFF chỉ xem. */
  canMutate: boolean;
  onClose: () => void;
  /** Bắn sau mọi thay đổi thành công để màn cha tải lại danh sách. */
  onChanged: (message: string) => void;
};

type TripDraft = {
  baseFare: string;
  notes: string;
  vehicleId: string;
  routeId: string;
};

function vehicleValue(vehicle: OperatorVehicle) {
  return vehicle.id ?? vehicle.vehicleId ?? "";
}

/**
 * Chỉ gửi field ĐÃ ĐỔI. BE nhận partial nên gửi cả form là tự nguyện ghi đè
 * những giá trị mình chưa từng nhìn — đặc biệt nguy hiểm với `notes` khi hai
 * người cùng mở một chuyến.
 */
function buildTripPatch(
  draft: TripDraft,
  initial: TripDraft,
): UpdateOperatorTripRequest {
  const patch: UpdateOperatorTripRequest = {};

  if (draft.baseFare !== initial.baseFare) {
    const parsed = Number(draft.baseFare);
    // Ô trống = xoá giá riêng của chuyến, quay về giá gốc của tuyến.
    patch.baseFare = draft.baseFare.trim() === "" ? null : parsed;
  }
  if (draft.notes !== initial.notes) {
    patch.notes = draft.notes.trim() === "" ? null : draft.notes.trim();
  }
  if (draft.vehicleId !== initial.vehicleId) {
    patch.vehicleId = draft.vehicleId || null;
  }
  if (draft.routeId !== initial.routeId) {
    patch.routeId = draft.routeId || null;
  }

  return patch;
}

/**
 * Bảng điều khiển một chuyến: sửa thông tin, khoá/mở ghế, huỷ chuyến.
 *
 * Gom vào MỘT modal thay vì thêm ba nút vào cột thao tác của bảng: cột đó đã
 * ghim `sticky right-0` và bề rộng từng cột được canh theo số đo thật (xem
 * `columnClasses` trong `index.tsx`), nhét thêm nút vào là vỡ bố cục ở 1200px.
 */
export default function TripManageModal({
  trip,
  canMutate,
  onClose,
  onChanged,
}: TripManageModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const initialDraft = useMemo<TripDraft>(
    () => ({
      baseFare: "",
      notes: "",
      vehicleId: trip?.vehicle.vehicleId ?? "",
      routeId: trip?.route.routeId ?? "",
    }),
    [trip],
  );
  const [draft, setDraft] = useState<TripDraft>(initialDraft);
  const [vehicles, setVehicles] = useState<OperatorVehicle[]>([]);
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<OperatorTripCancelPreview | null>(
    null,
  );
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  /**
   * Một key cho MỘT lần huỷ, giữ nguyên qua các lần retry của cùng chuyến đó:
   * huỷ hai lần bằng hai key khác nhau là hai lệnh khác nhau với BE.
   */
  const cancelKey = useRef("");

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  // Không có effect reset form: trang cha remount modal theo `key={tripId}` nên
  // mọi state ở đây tự khai sinh lại cho đúng chuyến. Reset bằng effect vừa
  // thừa vừa tạo một lượt render trung gian mang dữ liệu chuyến cũ.

  const tripId = trip?.tripId ?? "";
  const isEditable = Boolean(trip && EDITABLE_STATUSES.has(trip.status));
  const isCancellable = Boolean(trip && CANCELLABLE_STATUSES.has(trip.status));
  const canEdit = canMutate && isEditable;

  // Xe + tuyến chỉ cần khi thực sự sửa được; STAFF hoặc chuyến đã chạy thì bỏ
  // qua hai request này.
  useEffect(() => {
    if (!tripId || !canEdit) return;

    let ignore = false;
    void (async () => {
      const [vehicleResult, routeResult] = await Promise.allSettled([
        // Chỉ xe đang hoạt động: xe vừa bị đổi do sự cố nằm ở `MAINTENANCE` và
        // không được phân phối cho chuyến nào nữa (handoff "đổi xe do sự cố",
        // 2026-08-30). Xe hiện tại của chuyến vẫn luôn có mặt trong ô chọn —
        // nó được render riêng bên dưới, không lấy từ danh sách này.
        getOperatorVehicles({ page: 1, pageSize: 100, status: "ACTIVE" }),
        getOperatorRoutes({ page: 1, pageSize: 100 }),
      ]);
      if (ignore) return;
      if (vehicleResult.status === "fulfilled") {
        setVehicles(vehicleResult.value.items);
      }
      if (routeResult.status === "fulfilled") {
        // Tuyến ngừng hoạt động không gán được cho chuyến mới.
        setRoutes(routeResult.value.items.filter((route) => route.isActive));
      }
    })();

    return () => {
      ignore = true;
    };
  }, [canEdit, tripId]);

  const patch = buildTripPatch(draft, initialDraft);
  const hasChanges = Object.keys(patch).length > 0;

  async function saveTrip() {
    if (!tripId || !hasChanges) return;

    setIsSaving(true);
    setError("");
    try {
      await updateOperatorTrip(tripId, patch);
      onChanged(t("tripList.manage.saveSuccess"));
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("tripList.manage.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const loadPreview = useCallback(async () => {
    if (!tripId) return;

    setIsPreviewLoading(true);
    setError("");
    try {
      setPreview(await previewOperatorTripCancel(tripId));
    } catch (previewError) {
      setPreview(null);
      setError(
        previewError instanceof Error
          ? previewError.message
          : tRef.current("tripList.manage.previewFailed"),
      );
    } finally {
      setIsPreviewLoading(false);
    }
  }, [tripId]);

  async function cancelTrip() {
    if (!tripId) return;

    cancelKey.current = cancelKey.current || createIdempotencyKey();
    setIsCancelling(true);
    setError("");
    try {
      await cancelOperatorTrip(
        tripId,
        cancelReason.trim() || null,
        cancelKey.current,
      );
      setIsCancelConfirmOpen(false);
      onChanged(t("tripList.manage.cancelSuccess"));
      onClose();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : t("tripList.manage.cancelFailed"),
      );
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <>
      <Modal
        open={Boolean(trip)}
        onClose={onClose}
        extraWide
        icon={<FiSettings size={20} />}
        title={t("tripList.manage.title")}
        subtitle={
          trip
            ? `${displayBusinessCode(trip.tripCode)} · ${trip.route.originName} → ${trip.route.destinationName}`
            : undefined
        }
        footer={
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tc("close")}
          </button>
        }
      >
        {trip && (
          <div className="space-y-6">
            {error && <InlineAlert tone="error">{error}</InlineAlert>}

            <section>
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <FiEdit3 aria-hidden="true" className="text-vr-800" />
                {t("tripList.manage.detailsTitle")}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {canEdit
                  ? t("tripList.manage.detailsHint")
                  : t("tripList.manage.detailsLocked")}
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                      <FiUser aria-hidden="true" className="text-vr-700" />
                      {t("tripList.manage.driver")}
                    </div>
                    <div className="mt-2 flex items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {trip.driver?.displayName || t("tripList.noDriver")}
                        </p>
                        {trip.driver?.phone && (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-600">
                            <FiPhone aria-hidden="true" size={12} />
                            {formatVietnamPhoneForDisplay(trip.driver.phone)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
                      <FiUser aria-hidden="true" className="text-vr-700" />
                      {t("tripList.manage.assistant")}
                    </div>
                    <div className="mt-2 flex items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {trip.assistant?.displayName ||
                            t("tripList.manage.noAssistant")}
                        </p>
                        {trip.assistant?.phone && (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-600">
                            <FiPhone aria-hidden="true" size={12} />
                            {formatVietnamPhoneForDisplay(trip.assistant.phone)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <label>
                  <span className={labelClass}>
                    {t("tripList.manage.baseFare")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    disabled={!canEdit}
                    value={draft.baseFare}
                    placeholder={t("tripList.manage.baseFarePlaceholder")}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        baseFare: event.target.value,
                      }))
                    }
                    className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-500`}
                  />
                </label>
                <label>
                  <span className={labelClass}>
                    {t("tripList.manage.vehicle")}
                  </span>
                  <CustomSelect
                    disabled={!canEdit}
                    value={draft.vehicleId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        vehicleId: event.target.value,
                      }))
                    }
                    className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-500`}
                  >
                    {/* Xe hiện tại luôn có mặt kể cả khi không nằm trong 100 xe
                        đầu tiên — nếu không, mở modal ra là ô rỗng và bấm Lưu
                        sẽ gửi `vehicleId: null`. */}
                    <option value={trip.vehicle.vehicleId}>
                      {trip.vehicle.licensePlate ||
                        t("tripList.manage.currentVehicle")}
                    </option>
                    {vehicles
                      .filter(
                        (vehicle) =>
                          vehicleValue(vehicle) !== trip.vehicle.vehicleId,
                      )
                      .map((vehicle) => (
                        <option
                          key={vehicleValue(vehicle)}
                          value={vehicleValue(vehicle)}
                        >
                          {vehicle.licensePlate}
                        </option>
                      ))}
                  </CustomSelect>
                </label>
                <label>
                  <span className={labelClass}>
                    {t("tripList.manage.route")}
                  </span>
                  <CustomSelect
                    disabled={!canEdit}
                    value={draft.routeId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        routeId: event.target.value,
                      }))
                    }
                    className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-500`}
                  >
                    <option value={trip.route.routeId}>
                      {trip.route.name}
                    </option>
                    {routes
                      .filter((route) => route.id !== trip.route.routeId)
                      .map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.name}
                        </option>
                      ))}
                  </CustomSelect>
                </label>
                <label className="sm:col-span-2">
                  <span className={labelClass}>
                    {t("tripList.manage.notes")}
                  </span>
                  <textarea
                    rows={2}
                    disabled={!canEdit}
                    value={draft.notes}
                    placeholder={t("tripList.manage.notesPlaceholder")}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    className={`${textareaClass} disabled:bg-gray-50 disabled:text-gray-500`}
                  />
                </label>
              </div>

              {canEdit && (
                <button
                  type="button"
                  disabled={!hasChanges || isSaving}
                  onClick={() => void saveTrip()}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-vr-800 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiSave aria-hidden="true" size={15} />
                  {isSaving ? tc("processing") : tc("save")}
                </button>
              )}
            </section>

            <section>
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <FiGrid aria-hidden="true" className="text-vr-800" />
                {t("tripList.manage.seatsTitle")}
              </h3>
              <div className="mt-3">
                <TripSeatMapPanel
                  tripId={trip.tripId}
                  manageable={canMutate && isEditable}
                />
              </div>
            </section>

            {canMutate && isCancellable && (
              <section className="rounded-xl border border-red-100 bg-red-50/40 p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-red-900">
                  <FiAlertOctagon aria-hidden="true" />
                  {t("tripList.manage.cancelTitle")}
                </h3>
                <p className="mt-1 text-xs text-red-800">
                  {t("tripList.manage.cancelHint")}
                </p>

                {preview ? (
                  <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                    <PreviewStat
                      label={t("tripList.manage.previewBookings")}
                      value={String(preview.affectedBookingIds?.length ?? 0)}
                    />
                    <PreviewStat
                      label={t("tripList.manage.previewParcels")}
                      value={String(preview.affectedParcelIds?.length ?? 0)}
                    />
                    <PreviewStat
                      label={t("tripList.manage.previewRefund")}
                      value={formatCurrency(preview.grandTotal)}
                      emphasis
                    />
                  </dl>
                ) : (
                  <button
                    type="button"
                    disabled={isPreviewLoading}
                    onClick={() => void loadPreview()}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPreviewLoading
                      ? t("tripList.manage.previewLoading")
                      : t("tripList.manage.previewAction")}
                  </button>
                )}

                {preview && (
                  <>
                    <label className="mt-3 block">
                      <span className={labelClass}>
                        {t("tripList.manage.cancelReason")}
                      </span>
                      <input
                        value={cancelReason}
                        maxLength={500}
                        onChange={(event) =>
                          setCancelReason(event.target.value)
                        }
                        placeholder={t(
                          "tripList.manage.cancelReasonPlaceholder",
                        )}
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={isCancelling}
                      onClick={() => setIsCancelConfirmOpen(true)}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiAlertOctagon aria-hidden="true" size={15} />
                      {t("tripList.manage.cancelAction")}
                    </button>
                  </>
                )}
              </section>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        onConfirm={() => void cancelTrip()}
        title={t("tripList.manage.cancelTitle")}
        message={t("tripList.manage.cancelConfirm", {
          refund: formatCurrency(preview?.grandTotal),
        })}
        confirmLabel={t("tripList.manage.cancelAction")}
        cancelLabel={tc("cancel")}
        tone="danger"
        busy={isCancelling}
      />
    </>
  );
}

function PreviewStat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg border border-red-100 bg-white px-3 py-2">
      <dt className="text-xs text-gray-600">{label}</dt>
      <dd
        className={`mt-0.5 text-base font-bold tabular-nums ${
          emphasis ? "text-red-700" : "text-gray-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
