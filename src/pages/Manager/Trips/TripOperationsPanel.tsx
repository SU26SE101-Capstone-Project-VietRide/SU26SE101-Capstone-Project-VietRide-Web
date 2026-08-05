import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiRefreshCw,
  FiRepeat,
  FiSearch,
  FiTruck,
} from "react-icons/fi";
import {
  disruptOperatorTripNoSubstitution,
  getOperatorTripCargoCapacity,
  getOperatorTrips,
  substituteOperatorTripVehicle,
  type CargoCapacity,
  type OperatorUser,
  type OperatorVehicle,
  type OperatorTripListItem,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import { formatDateTime, toDatetimeLocalValue } from "../../../utils/date";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-vr-500 focus:ring-2 focus:ring-vr-100";

function vehicleId(vehicle: OperatorVehicle) {
  return vehicle.id ?? vehicle.vehicleId ?? "";
}

function userId(user: OperatorUser) {
  return user.userId || user.id || "";
}

function tripLabel(trip: OperatorTripListItem) {
  return `${trip.route.name} · ${trip.vehicle.licensePlate} · ${formatDateTime(trip.departureAt)}`;
}

function getDefaultRecoveryDeparture() {
  const recoveryDeparture = new Date(Date.now() + 30 * 60_000);
  recoveryDeparture.setSeconds(0, 0);
  return toDatetimeLocalValue(recoveryDeparture);
}

type TripOperationsPanelProps = {
  // Danh sách xe và nhân sự do trang cha tải sẵn, tránh gọi API trùng lặp
  vehicles: OperatorVehicle[];
  staff: OperatorUser[];
};

export default function TripOperationsPanel({
  vehicles,
  staff,
}: TripOperationsPanelProps) {
  const { t } = useTranslation("manager");
  // Giữ tham chiếu t mới nhất để effect không refetch khi đổi ngôn ngữ
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const canMutate = getAuthUser()?.role === "OPERATOR_ADMIN";
  const [tripId, setTripId] = useState("");
  const [trips, setTrips] = useState<OperatorTripListItem[]>([]);
  const [tripSearch, setTripSearch] = useState("");
  const [tripStatus, setTripStatus] = useState("");
  const [isTripsLoading, setIsTripsLoading] = useState(false);
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
  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.tripId === tripId),
    [tripId, trips],
  );
  const replacementVehicles = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          (vehicle.status === "ACTIVE" || vehicle.status === "AVAILABLE") &&
          vehicleId(vehicle) !== selectedTrip?.vehicle.vehicleId,
      ),
    [selectedTrip, vehicles],
  );

  async function loadTrips() {
    if (!canMutate) return;

    setIsTripsLoading(true);
    setError("");
    try {
      const result = await getOperatorTrips({
        page: 1,
        pageSize: 100,
        search: tripSearch.trim() || undefined,
        status: tripStatus || undefined,
        sortBy: "departureAt",
        sortDir: "asc",
      });
      setTrips(result.items);
      if (result.items.length === 1) {
        setTripId(result.items[0].tripId);
      }
    } catch (loadError) {
      setTrips([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("tripOperations.tripsFailed"),
      );
    } finally {
      setIsTripsLoading(false);
    }
  }

  useEffect(() => {
    if (!canMutate) return;

    let ignore = false;
    void getOperatorTrips({
      page: 1,
      pageSize: 100,
      sortBy: "departureAt",
      sortDir: "asc",
    })
      .then((tripResult) => {
        if (!ignore) {
          setTrips(tripResult.items);
        }
      })
      .catch((loadError: unknown) => {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : tRef.current("tripOperations.resourcesFailed"),
          );
        }
      });

    return () => {
      ignore = true;
    };
  }, [canMutate]);

  async function loadCapacity() {
    const normalizedTripId = tripId.trim();
    if (!normalizedTripId) {
      setError(
        t("tripOperations.tripRequired"),
      );
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
      setError(
        t("tripOperations.substituteRequired"),
      );
      return;
    }

    const recoveryDeparture = new Date(estimatedRecoveryDepartureAt);
    if (
      Number.isNaN(recoveryDeparture.getTime()) ||
      recoveryDeparture.getTime() <= Date.now()
    ) {
      setError(
        t("tripOperations.recoveryDepartureFuture"),
      );
      return;
    }

    if (
      !window.confirm(
        t("tripOperations.substituteConfirm"),
      )
    ) {
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
      setMessage(
        t("tripOperations.substituteSuccess", {
          tripId: result.newTripId ?? result.tripId,
        }),
      );
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : t("tripOperations.substituteFailed"),
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function disruptTrip() {
    if (!tripId.trim() || !reason.trim()) {
      setError(
        t("tripOperations.disruptRequired"),
      );
      return;
    }

    if (
      !window.confirm(
        t("tripOperations.disruptConfirm"),
      )
    ) {
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
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <FiTruck className="text-vr-700" />
            {t("tripOperations.title")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("tripOperations.subtitle")}
          </p>
        </div>
        {!canMutate && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {t("tripOperations.readOnly")}
          </span>
        )}
      </div>

      <div
        className="mt-4 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-sky-950"
        role="note"
      >
        <p className="font-semibold">{t("tripOperations.scopeTitle")}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sky-900">
          <li>{t("tripOperations.scopeExistingTrip")}</li>
          <li>{t("tripOperations.scopeSubstitute")}</li>
          <li>{t("tripOperations.scopeDisrupt")}</li>
        </ul>
      </div>

      {canMutate && (
        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <label className="relative block">
            <span className="sr-only">
              {t("tripOperations.searchTrips")}
            </span>
            <FiSearch className="pointer-events-none absolute left-3 top-3.5 text-gray-400" />
            <input
              value={tripSearch}
              onChange={(event) => setTripSearch(event.target.value)}
              className={`${inputClass} pl-9`}
              placeholder={t("tripOperations.searchPlaceholder")}
            />
          </label>
          <CustomSelect
            value={tripStatus}
            onChange={(event) => setTripStatus(event.target.value)}
            className={inputClass}
            aria-label={t("tripOperations.statusFilter")}
          >
            <option value="">{t("tripOperations.allStatuses")}</option>
            {[
              "SCHEDULED",
              "BOARDING",
              "IN_PROGRESS",
              "COMPLETED",
              "CANCELLED",
              "DISRUPTED",
            ].map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </CustomSelect>
          <button
            type="button"
            disabled={isTripsLoading}
            onClick={() => void loadTrips()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-vr-200 px-4 py-2.5 text-sm font-semibold text-vr-700 disabled:opacity-60"
          >
            <FiRefreshCw className={isTripsLoading ? "animate-spin" : ""} />
            {t("tripOperations.search")}
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        {canMutate ? (
          <CustomSelect
            value={tripId}
            onChange={(event) => {
              setTripId(event.target.value);
              setCapacity(null);
            }}
            className={inputClass}
            aria-label={t("tripOperations.tripSelect")}
          >
            <option value="">
              {isTripsLoading
                ? t("tripOperations.loadingTrips")
                : t("tripOperations.selectTrip")}
            </option>
            {trips.map((trip) => (
              <option key={trip.tripId} value={trip.tripId}>
                {tripLabel(trip)}
              </option>
            ))}
          </CustomSelect>
        ) : (
          <input
            value={tripId}
            onChange={(event) => {
              setTripId(event.target.value);
              setCapacity(null);
            }}
            className={inputClass}
            placeholder={t("tripOperations.tripPlaceholder")}
          />
        )}
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                {t("tripOperations.vehicle")}
              </span>
              <CustomSelect
                value={newVehicleId}
                onChange={(event) => setNewVehicleId(event.target.value)}
                className={inputClass}
              >
                <option value="">
                  {t("tripOperations.selectVehicle")}
                </option>
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
                <option value="">
                  {t("tripOperations.selectDriver")}
                </option>
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
                <option value="">
                  {t("tripOperations.noAssistant")}
                </option>
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
            <label>
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
            <input
              type="checkbox"
              checked={notifyPassengers}
              onChange={(event) => setNotifyPassengers(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-vr-600 focus:ring-vr-500"
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
          {selectedTrip?.canSubstituteVehicle === false && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t("tripOperations.substituteUnavailable")}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={
                isMutating || selectedTrip?.canSubstituteVehicle === false
              }
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

      {message && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
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



