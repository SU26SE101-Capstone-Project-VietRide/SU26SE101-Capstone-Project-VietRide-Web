import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  FiAlertTriangle,
  FiGitBranch,
  FiRefreshCw,
  FiRepeat,
  FiTruck,
} from "react-icons/fi";
import {
  changeOperatorTripRoute,
  disruptOperatorTripNoSubstitution,
  getAlternativeRoutes,
  getOperatorTripCargoCapacity,
  substituteOperatorTripVehicle,
  type AlternativeRoute,
  type CargoCapacity,
  type OperatorTripListItem,
  type OperatorUser,
  type OperatorVehicle,
} from "../../../api/vietride";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import { ConfirmModal } from "../../../components/ConfirmModal";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { toDatetimeLocalValue } from "../../../utils/date";
import Checkbox from "../../../components/form/Checkbox";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";

function vehicleId(vehicle: OperatorVehicle) {
  return vehicle.id ?? vehicle.vehicleId ?? "";
}

function userId(user: OperatorUser) {
  return user.userId || user.id || "";
}

function getDefaultRecoveryDeparture() {
  const recoveryDeparture = new Date(Date.now() + 30 * 60_000);
  recoveryDeparture.setSeconds(0, 0);
  return toDatetimeLocalValue(recoveryDeparture);
}

type TripActionsPanelProps = {
  /** Chuyến do map/list của Trung tâm vận hành chọn — panel không tự chọn chuyến */
  tripId: string;
  /** Chi tiết chuyến đang chọn (nếu có) — dùng để lọc xe thay thế và cờ canSubstituteVehicle */
  trip?: OperatorTripListItem | null;
  // Danh sách xe và nhân sự do trang cha tải sẵn, tránh gọi API trùng lặp
  vehicles: OperatorVehicle[];
  staff: OperatorUser[];
  /** Chỉ OPERATOR_ADMIN được thay xe / huỷ chuyến / đổi lộ trình */
  canMutate: boolean;
  /**
   * Sau khi thay xe thành công — trang cha chuyển selection sang chuyến mới.
   * Đổi lộ trình cũng gọi callback này (cùng tripId) để trang cha tải lại
   * geometry của chuyến + danh sách fleet.
   */
  onTripReplaced: (newTripId: string) => void;
};

export default function TripActionsPanel({
  tripId,
  trip = null,
  vehicles,
  staff,
  canMutate,
  onTripReplaced,
}: TripActionsPanelProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [capacity, setCapacity] = useState<CargoCapacity | null>(null);
  const [newVehicleId, setNewVehicleId] = useState("");
  const [newDriverUserId, setNewDriverUserId] = useState("");
  const [newAssistantUserId, setNewAssistantUserId] = useState("");
  const [reason, setReason] = useState("");
  const [estimatedRecoveryDepartureAt, setEstimatedRecoveryDepartureAt] =
    useState(getDefaultRecoveryDeparture);
  const [notifyPassengers, setNotifyPassengers] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // Section "Đổi lộ trình": null = chưa tải danh sách tuyến thay thế
  const [isChangeRouteOpen, setIsChangeRouteOpen] = useState(false);
  const [alternatives, setAlternatives] = useState<AlternativeRoute[] | null>(
    null,
  );
  const [isAlternativesLoading, setIsAlternativesLoading] = useState(false);
  const [selectedAlternativeRouteId, setSelectedAlternativeRouteId] =
    useState("");
  const [routeChangeMessage, setRouteChangeMessage] = useState("");
  const [routeChangeError, setRouteChangeError] = useState("");
  const [pendingAction, setPendingAction] = useState<"substitute" | "disrupt" | "route" | null>(null);
  useToastFeedback({ message: message || routeChangeMessage, error: error || routeChangeError });

  const drivers = useMemo(
    () =>
      staff.filter(
        (user) =>
          user.role === "DRIVER" &&
          (user.status === "ACTIVE" || user.status === "APPROVED"),
      ),
    [staff],
  );
  const assistants = useMemo(
    () =>
      staff.filter(
        (user) =>
          user.role === "ASSISTANT" &&
          (user.status === "ACTIVE" || user.status === "APPROVED"),
      ),
    [staff],
  );
  const replacementVehicles = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          (vehicle.status === "ACTIVE" || vehicle.status === "AVAILABLE") &&
          vehicleId(vehicle) !== trip?.vehicle.vehicleId,
      ),
    [trip, vehicles],
  );

  async function loadCapacity() {
    const normalizedTripId = tripId.trim();
    if (!normalizedTripId) {
      setError(t("tripOperations.tripRequired"));
      return;
    }

    setIsLoading(true);
    setError("");
    setMessage("");
    try {
      setCapacity(await getOperatorTripCargoCapacity(normalizedTripId));
    } catch (loadError) {
      setCapacity(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("tripOperations.capacityFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function substituteVehicle() {
    if (
      !tripId.trim() ||
      !newVehicleId ||
      !newDriverUserId ||
      !estimatedRecoveryDepartureAt ||
      !reason.trim()
    ) {
      setError(t("tripOperations.substituteRequired"));
      return;
    }

    const recoveryDeparture = new Date(estimatedRecoveryDepartureAt);
    if (
      Number.isNaN(recoveryDeparture.getTime()) ||
      recoveryDeparture.getTime() <= Date.now()
    ) {
      setError(t("tripOperations.recoveryDepartureFuture"));
      return;
    }

    if (pendingAction !== "substitute") {
      setPendingAction("substitute");
      return;
    }

    setIsMutating(true);
    setError("");
    setMessage("");
    try {
      const result = await substituteOperatorTripVehicle(tripId.trim(), {
        replacementVehicleId: newVehicleId,
        estimatedRecoveryDepartureAt: recoveryDeparture.toISOString(),
        reason: reason.trim(),
        notifyPassengers,
        replacementCrew: {
          driverId: newDriverUserId,
          assistantId: newAssistantUserId || null,
        },
      });
      const newTripId = result.newTripId ?? result.tripId;
      setMessage(t("tripOperations.substituteSuccess", { tripId: newTripId }));
      // Trang cha chuyển selection + URL sang chuyến mới
      if (newTripId) {
        onTripReplaced(newTripId);
      }
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : t("tripOperations.substituteFailed"),
      );
    } finally {
      setIsMutating(false);
      setPendingAction(null);
    }
  }

  async function disruptTrip() {
    if (!tripId.trim() || !reason.trim()) {
      setError(t("tripOperations.disruptRequired"));
      return;
    }

    if (pendingAction !== "disrupt") {
      setPendingAction("disrupt");
      return;
    }

    setIsMutating(true);
    setError("");
    setMessage("");
    try {
      const result = await disruptOperatorTripNoSubstitution(tripId.trim(), {
        reason: reason.trim(),
      });
      setMessage(
        t("tripOperations.disruptSuccess", {
          status: result.status ?? result.tripId,
        }),
      );
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : t("tripOperations.disruptFailed"),
      );
    } finally {
      setIsMutating(false);
      setPendingAction(null);
    }
  }

  async function loadAlternatives() {
    const routeId = trip?.route.routeId;
    if (!routeId) {
      setRouteChangeError(t("tripOperations.alternativesFailed"));
      return;
    }

    setIsAlternativesLoading(true);
    setRouteChangeError("");
    try {
      const result = await getAlternativeRoutes(routeId, {
        page: 1,
        pageSize: 2,
      });
      // Chỉ cho đổi sang tuyến thay thế đang active
      setAlternatives(result.items.filter((route) => route.isActive));
    } catch (loadError) {
      setAlternatives(null);
      setRouteChangeError(
        loadError instanceof Error
          ? loadError.message
          : t("tripOperations.alternativesFailed"),
      );
    } finally {
      setIsAlternativesLoading(false);
    }
  }

  function toggleChangeRoute() {
    const nextOpen = !isChangeRouteOpen;
    setIsChangeRouteOpen(nextOpen);
    // Mở lần đầu mới tải — đóng/mở lại không gọi API lần nữa
    if (nextOpen && alternatives === null && !isAlternativesLoading) {
      void loadAlternatives();
    }
  }

  async function changeRoute() {
    if (!tripId.trim() || !selectedAlternativeRouteId) {
      setRouteChangeError(t("tripOperations.changeRouteRequired"));
      return;
    }

    // Confirm 2 bước như pattern huỷ chuyến — đổi lộ trình ảnh hưởng booking đang chạy
    if (pendingAction !== "route") {
      setPendingAction("route");
      return;
    }

    setIsMutating(true);
    setRouteChangeError("");
    setRouteChangeMessage("");
    try {
      const result = await changeOperatorTripRoute(tripId.trim(), {
        alternativeRouteId: selectedAlternativeRouteId,
      });
      setRouteChangeMessage(
        t("tripOperations.changeRouteSuccess", { status: result.status }),
      );
      // Cùng tripId — trang cha re-select để tải lại geometry lộ trình mới + fleet
      onTripReplaced(result.tripId ?? tripId.trim());
    } catch (mutationError) {
      setRouteChangeError(
        mutationError instanceof Error
          ? mutationError.message
          : t("tripOperations.changeRouteFailed"),
      );
    } finally {
      setIsMutating(false);
      setPendingAction(null);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <FiTruck className="text-vr-700" />
            {t("tripOperations.title")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("operations.actionsSubtitle")}
          </p>
        </div>
        {!canMutate && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {t("tripOperations.readOnly")}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => void loadCapacity()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          <FiRefreshCw className={isLoading ? "animate-spin" : ""} />
          {t("tripOperations.loadCapacity")}
        </button>
      </div>

      {capacity && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <CapacityMetric
            label={t("tripOperations.maxWeight")}
            value={`${capacity.maxCargoWeightKg.toLocaleString("vi-VN")} kg`}
          />
          <CapacityMetric
            label={t("tripOperations.reservedWeight")}
            value={`${(
              capacity.reservedCargoWeightKg ??
              capacity.reservedWeightKg ??
              0
            ).toLocaleString("vi-VN")} kg`}
          />
          <CapacityMetric
            label={t("tripOperations.loadedWeight")}
            value={`${(capacity.loadedWeightKg ?? 0).toLocaleString("vi-VN")} kg`}
          />
          <CapacityMetric
            label={t("tripOperations.percentFull")}
            value={`${(capacity.percentFull ?? 0).toLocaleString("vi-VN")}%`}
          />
        </div>
      )}

      {canMutate && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                {t("tripOperations.vehicle")}
              </span>
              <CustomSelect
                value={newVehicleId}
                onChange={(event) => setNewVehicleId(event.target.value)}
                className={inputClass}
              >
                <option value="">{t("tripOperations.selectVehicle")}</option>
                {replacementVehicles.map((vehicle) => (
                  <option key={vehicleId(vehicle)} value={vehicleId(vehicle)}>
                    {vehicle.licensePlate}
                  </option>
                ))}
              </CustomSelect>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                {t("tripOperations.driver")}
              </span>
              <CustomSelect
                value={newDriverUserId}
                onChange={(event) => setNewDriverUserId(event.target.value)}
                className={inputClass}
              >
                <option value="">{t("tripOperations.selectDriver")}</option>
                {drivers.map((driver) => (
                  <option key={userId(driver)} value={userId(driver)}>
                    {driver.displayName}
                  </option>
                ))}
              </CustomSelect>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                {t("tripOperations.assistant")}
              </span>
              <CustomSelect
                value={newAssistantUserId}
                onChange={(event) => setNewAssistantUserId(event.target.value)}
                className={inputClass}
              >
                <option value="">{t("tripOperations.noAssistant")}</option>
                {assistants.map((assistant) => (
                  <option key={userId(assistant)} value={userId(assistant)}>
                    {assistant.displayName}
                  </option>
                ))}
              </CustomSelect>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                {t("tripOperations.reason")}
              </span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={inputClass}
                maxLength={500}
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                {t("tripOperations.recoveryDeparture")}
              </span>
              <CustomDateTimeInput
                value={estimatedRecoveryDepartureAt}
                onChange={(event) =>
                  setEstimatedRecoveryDepartureAt(event.target.value)
                }
                className={inputClass}
                type="datetime-local"
                aria-label={t("tripOperations.recoveryDeparture")}
              />
            </label>
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <Checkbox
              className="mt-0.5"
              checked={notifyPassengers}
              onChange={setNotifyPassengers}
            />
            <span>
              <span className="block text-sm font-semibold text-gray-800">
                {t("tripOperations.notifyPassengers")}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {t("tripOperations.notifyPassengersHint")}
              </span>
            </span>
          </label>
          {trip?.canSubstituteVehicle === false && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t("tripOperations.substituteUnavailable")}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isMutating || trip?.canSubstituteVehicle === false}
              onClick={() => void substituteVehicle()}
              className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              <FiRepeat />
              {t("tripOperations.substitute")}
            </button>
            <button
              type="button"
              disabled={isMutating}
              onClick={() => void disruptTrip()}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-60"
            >
              <FiAlertTriangle />
              {t("tripOperations.disrupt")}
            </button>
          </div>
        </div>
      )}

      {canMutate && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <button
            type="button"
            onClick={toggleChangeRoute}
            aria-expanded={isChangeRouteOpen}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <FiGitBranch className="text-vr-700" />
            {t("tripOperations.changeRoute")}
          </button>

          {isChangeRouteOpen && (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-sm text-gray-500">
                {t("tripOperations.changeRouteHint")}
              </p>

              {isAlternativesLoading ? (
                <p className="text-sm text-gray-500">
                  {t("tripOperations.alternativesLoading")}
                </p>
              ) : alternatives !== null && alternatives.length === 0 ? (
                // Tuyến chưa có tuyến thay thế active — dẫn sang màn Routes để khai báo
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p>{t("tripOperations.noAlternatives")}</p>
                  {trip?.route.routeId && (
                    <Link
                      to={`/manager/routes?routeId=${trip.route.routeId}&tab=alternatives`}
                      className="mt-1 inline-block font-semibold text-vr-800 hover:underline"
                    >
                      {t("tripOperations.declareAlternatives")}
                    </Link>
                  )}
                </div>
              ) : alternatives !== null ? (
                <>
                  <div className="flex flex-col gap-2">
                    {alternatives.map((alternative) => (
                      <label
                        key={alternative.id}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 px-4 py-3 transition hover:border-vr-500"
                      >
                        <input
                          type="radio"
                          name="alternative-route"
                          checked={
                            selectedAlternativeRouteId === alternative.id
                          }
                          onChange={() =>
                            setSelectedAlternativeRouteId(alternative.id)
                          }
                          className="mt-1 h-4 w-4 border-gray-300 text-vr-600 focus:ring-vr-500"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-gray-800">
                            {alternative.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-gray-500">
                            {t("tripOperations.alternativeMeta", {
                              km: alternative.totalDistanceKm,
                              minutes: alternative.estimatedDurationMinutes,
                            })}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <button
                      type="button"
                      disabled={isMutating || !selectedAlternativeRouteId}
                      onClick={() => void changeRoute()}
                      className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      <FiGitBranch />
                      {t("tripOperations.changeRouteApply")}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
      <ConfirmModal
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={() => { if (pendingAction === "substitute") void substituteVehicle(); else if (pendingAction === "disrupt") void disruptTrip(); else if (pendingAction === "route") void changeRoute(); }}
        title={tc("confirm")}
        message={pendingAction === "substitute" ? t("tripOperations.substituteConfirm") : pendingAction === "disrupt" ? t("tripOperations.disruptConfirm") : t("tripOperations.changeRouteConfirm")}
        confirmLabel={tc("confirm")}
        cancelLabel={tc("cancel")}
        tone={pendingAction === "disrupt" ? "danger" : "warning"}
        busy={isMutating}
      />
    </section>
  );
}

function CapacityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}



