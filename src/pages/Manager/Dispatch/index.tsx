import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ApiRequestError } from "../../../api/client";
import {
  FiSearch,
  FiDownload,
  FiCheck,
  FiClock,
  FiTrendingUp,
  FiTruck,
  FiRefreshCw,
} from "react-icons/fi";
import CustomSelect from "../../../components/CustomSelect";
import Pagination from "../../../components/Pagination";
import { downloadCsv } from "../../../utils/csv";
import { addRecentShuttleTrip } from "../../../utils/shuttleTrackingHistory";
import { getAuthUser } from "../../../auth";
import {
  createOperatorShuttleTrip,
  getOperatorShuttleRequests,
  getOperatorUsers,
  getOperatorVehicles,
  getShuttleTripEta,
  getShuttleTripLatest,
} from "../../../api/vietride";
import AssignVehicleModal, { type AssignVehicleForm } from "./AssignVehicleModal";
import RequestDetailModal from "./RequestDetailModal";
import RequestTable from "./RequestTable";
import ShuttleTrackingCard from "./ShuttleTrackingCard";
import {
  V_DOT_CLASS,
  V_STATUS_CLASS,
  isDriverRole,
  toDriverOption,
  toRequestRows,
  toVehicleOption,
  type RequestStatus,
  type RequestType,
  type ShuttleDriver,
  type ShuttleRequest,
  type ShuttleVehicle,
  type TrackedShuttleTrip,
  type VehicleStatus,
} from "./dispatchHelpers";

export default function DispatchPanel() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  // Giữ tham chiếu t mới nhất để callback tải dữ liệu không refetch khi đổi ngôn ngữ
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const authUser = getAuthUser();
  const canDispatchShuttle = authUser?.role === "OPERATOR_ADMIN";

  const statusLabel = useCallback(
    (status: RequestStatus) => {
      const map: Record<RequestStatus, string> = {
        pending: t("dispatch.statusPending"),
        assigned: t("dispatch.statusAssigned"),
        picking: t("dispatch.statusPicking"),
        completed: t("dispatch.statusCompleted"),
        cancelled: t("dispatch.statusCancelled"),
      };
      return map[status];
    },
    [t],
  );

  const vehicleStatusLabel = useCallback(
    (status: VehicleStatus) => {
      const map: Record<VehicleStatus, string> = {
        active: t("dispatch.vehicleActive"),
        picking: t("dispatch.vehiclePicking"),
        idle: t("dispatch.vehicleIdle"),
      };
      return map[status];
    },
    [t],
  );

  const requestTypeLabel = useCallback(
    (type: RequestType) =>
      type === "Đón" ? t("dispatch.pickup") : t("dispatch.dropoff"),
    [t],
  );

  const [requests, setRequests] = useState<ShuttleRequest[]>([]);
  const [vehicles, setVehicles] = useState<ShuttleVehicle[]>([]);
  const [drivers, setDrivers] = useState<ShuttleDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [openAssignVehicle, setOpenAssignVehicle] = useState(false);
  const [openRequestDetail, setOpenRequestDetail] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ShuttleRequest | null>(
    null,
  );

  const [assignForm, setAssignForm] = useState<AssignVehicleForm>({
    vehicleId: "",
    driverId: "",
    scheduledDepartureTime: "",
    scheduledEndTime: "",
    notes: "",
  });

  const [trackedShuttleTrips, setTrackedShuttleTrips] = useState<
    TrackedShuttleTrip[]
  >([]);

  const loadDispatchData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [requestResult, vehicleResult, userResult] = await Promise.all([
        getOperatorShuttleRequests({ page: 1, pageSize: 100 }),
        getOperatorVehicles({ page: 1, pageSize: 100 }),
        getOperatorUsers({ page: 1, pageSize: 100 }),
      ]);

      const nextRequests = requestResult.items.flatMap(toRequestRows);
      const nextVehicles = vehicleResult.items.map(toVehicleOption).filter((vehicle) => vehicle.id);
      const nextDrivers = userResult.items
        .filter((user) => isDriverRole(user.role))
        .map(toDriverOption)
        .filter((driver) => driver.id);

      setRequests(nextRequests);
      setVehicles(nextVehicles);
      setDrivers(nextDrivers);
      setAssignForm((current) => ({
        ...current,
        vehicleId: current.vehicleId || nextVehicles[0]?.id || "",
        driverId: current.driverId || nextDrivers[0]?.id || "",
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tRef.current("dispatch.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDispatchData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDispatchData]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const q = query.toLowerCase();
      const statusMatch = statusFilter === "all" || r.status === statusFilter;
      const queryMatch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.trip.toLowerCase().includes(q);
      return statusMatch && queryMatch;
    });
  }, [requests, query, statusFilter]);

  function handleExportCsv() {
    downloadCsv(
      "dispatch-requests.csv",
      [
        t("dispatch.code"),
        t("dispatch.csvCustomer"),
        t("dispatch.trip"),
        t("dispatch.type"),
        t("dispatch.csvAddress"),
        tc("status"),
      ],
      filtered.map((request) => [
        request.id,
        request.customerName,
        request.trip,
        request.type,
        request.address,
        request.status,
      ]),
    );
  }

  const stats = useMemo(
    () => ({
      pending: requests.filter((r) => r.status === "pending").length,
      assigned: requests.filter(
        (r) => r.status === "assigned" || r.status === "picking",
      ).length,
      completed: requests.filter((r) => r.status === "completed").length,
      ready: vehicles.filter((v) => v.status === "active").length,
    }),
    [requests, vehicles],
  );

  const paginatedRequests = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  const refreshShuttleTracking = useCallback(async (shuttleTripId: string) => {
    setTrackedShuttleTrips((current) =>
      current.map((item) =>
        item.shuttleTripId === shuttleTripId
          ? { ...item, isRefreshing: true, error: undefined }
          : item,
      ),
    );

    try {
      const [latest, eta] = await Promise.all([
        getShuttleTripLatest(shuttleTripId),
        getShuttleTripEta(shuttleTripId),
      ]);
      setTrackedShuttleTrips((current) =>
        current.map((item) =>
          item.shuttleTripId === shuttleTripId
            ? { ...item, latest, eta, isRefreshing: false }
            : item,
        ),
      );
    } catch (err) {
      setTrackedShuttleTrips((current) =>
        current.map((item) =>
          item.shuttleTripId === shuttleTripId
            ? {
                ...item,
                isRefreshing: false,
                error:
                  err instanceof ApiRequestError && err.code === "TRACKING_ACCESS_DENIED"
                    ? t("dispatch.operatorTrackingDenied")
                    : err instanceof Error
                      ? err.message
                      : t("dispatch.trackingFailed"),
              }
            : item,
        ),
      );
    }
  }, [t]);

  const removeShuttleTracking = useCallback((shuttleTripId: string) => {
    setTrackedShuttleTrips((current) =>
      current.filter((item) => item.shuttleTripId !== shuttleTripId),
    );
  }, []);

  const handleAssignVehicle = async () => {
    if (
      !selectedRequest ||
      !assignForm.vehicleId ||
      !assignForm.driverId ||
      !assignForm.scheduledDepartureTime ||
      !assignForm.scheduledEndTime
    ) {
      setError(t("dispatch.fillRequired"));
      return;
    }

    try {
      const result = await createOperatorShuttleTrip({
        mainTripId: selectedRequest.mainTripId,
        vehicleId: assignForm.vehicleId,
        driverUserId: assignForm.driverId,
        scheduledDepartureTime: new Date(assignForm.scheduledDepartureTime).toISOString(),
        scheduledEndTime: new Date(assignForm.scheduledEndTime).toISOString(),
        orderedBookingIds: [selectedRequest.bookingId],
        notes: assignForm.notes || undefined,
      });

      setOpenAssignVehicle(false);
      setAssignForm({
        vehicleId: vehicles[0]?.id || "",
        driverId: drivers[0]?.id || "",
        scheduledDepartureTime: "",
        scheduledEndTime: "",
        notes: "",
      });
      setMessage(
        `${t("dispatch.assignSuccess")} ${result.shuttleTripId} (${result.assignedPassengerCount})`,
      );
      const createdAt = new Date().toISOString();
      setTrackedShuttleTrips((current) => [
        {
          shuttleTripId: result.shuttleTripId,
          mainTripId: result.mainTripId,
          createdAt,
          isRefreshing: false,
        },
        ...current,
      ]);
      addRecentShuttleTrip({
        shuttleTripId: result.shuttleTripId,
        mainTripId: result.mainTripId,
        createdAt,
      });
      await loadDispatchData();
      await refreshShuttleTracking(result.shuttleTripId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("dispatch.assignFailed"),
      );
    }
  };

  const openDetail = (request: ShuttleRequest) => {
    setSelectedRequest(request);
    setOpenRequestDetail(true);
  };

  const openAssign = (request: ShuttleRequest) => {
    setSelectedRequest(request);
    setOpenAssignVehicle(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("dispatch.title")}
          </h1>
          <p className="text-gray-600 mt-1 text-sm">{t("dispatch.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadDispatchData()}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <FiRefreshCw size={18} /> {tc("refresh")}
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: t("dispatch.awaiting"),
            value: stats.pending,
            icon: FiClock,
            color: "text-amber-600",
          },
          {
            label: t("dispatch.processing"),
            value: stats.assigned,
            icon: FiTrendingUp,
            color: "text-blue-600",
          },
          {
            label: t("dispatch.completed"),
            value: stats.completed,
            icon: FiCheck,
            color: "text-green-600",
          },
          {
            label: t("dispatch.vehiclesReady"),
            value: `${stats.ready}/${vehicles.length}`,
            icon: FiTruck,
            color: "text-vr-600",
          },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-600 font-medium">
                  {stat.label}
                </p>
                <Icon className={`${stat.color}`} size={18} />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={t("dispatch.searchPlaceholder")}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-vr-500"
              />
            </div>
            <CustomSelect
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as RequestStatus | "all");
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-vr-500"
            >
              <option value="all">{tc("all")}</option>
              <option value="pending">{t("dispatch.filterPending")}</option>
              <option value="assigned">{t("dispatch.filterAssigned")}</option>
              <option value="picking">{t("dispatch.statusPicking")}</option>
              <option value="completed">{t("dispatch.statusCompleted")}</option>
              <option value="cancelled">{t("dispatch.filterCancelled")}</option>
            </CustomSelect>
            <button type="button" onClick={handleExportCsv} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
              <FiDownload size={16} /> {tc("exportCsv")}
            </button>
          </div>

          <RequestTable
            requests={paginatedRequests}
            isLoading={isLoading}
            canDispatchShuttle={canDispatchShuttle}
            onAssign={openAssign}
            onOpenDetail={openDetail}
            statusLabel={statusLabel}
            requestTypeLabel={requestTypeLabel}
          />

          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t("dispatch.shuttleFleet")}
          </h3>
          <div className="space-y-3">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {v.plate}
                    </p>
                    <p className="text-xs text-gray-600">{v.vehicleModel}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t("dispatch.capacity", { n: v.capacity })}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <span
                      className={`flex items-center gap-1 text-xs font-medium ${V_STATUS_CLASS[v.status]}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${V_DOT_CLASS[v.status]}`}
                      />
                      {vehicleStatusLabel(v.status)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {vehicles.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
                {isLoading ? t("dispatch.loading") : t("dispatch.noVehicles")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {t("dispatch.shuttleTracking")}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {t("dispatch.shuttleTrackingHint")}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {trackedShuttleTrips.map((item) => (
            <ShuttleTrackingCard
              key={item.shuttleTripId}
              item={item}
              onRefresh={(shuttleTripId) =>
                void refreshShuttleTracking(shuttleTripId)
              }
              onRemove={removeShuttleTracking}
            />
          ))}
          {trackedShuttleTrips.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500 sm:col-span-2 xl:col-span-3">
              {t("dispatch.shuttleTrackingEmpty")}
            </p>
          )}
        </div>
      </div>

      <AssignVehicleModal
        open={openAssignVehicle}
        onClose={() => setOpenAssignVehicle(false)}
        request={selectedRequest}
        vehicles={vehicles}
        drivers={drivers}
        form={assignForm}
        onFormChange={setAssignForm}
        onSubmit={handleAssignVehicle}
        requestTypeLabel={requestTypeLabel}
      />

      <RequestDetailModal
        open={openRequestDetail}
        onClose={() => setOpenRequestDetail(false)}
        request={selectedRequest}
        canDispatchShuttle={canDispatchShuttle}
        onAssign={() => {
          setOpenRequestDetail(false);
          setOpenAssignVehicle(true);
        }}
        statusLabel={statusLabel}
        requestTypeLabel={requestTypeLabel}
      />
    </div>
  );
}
