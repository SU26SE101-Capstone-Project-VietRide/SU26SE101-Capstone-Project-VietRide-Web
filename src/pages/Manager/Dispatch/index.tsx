import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  FiSearch,
  FiDownload,
  FiEye,
  FiCheck,
  FiClock,
  FiTrendingUp,
  FiPhone,
  FiMapPin,
  FiTruck,
  FiRefreshCw,
} from "react-icons/fi";
import { DetailItem, DetailSection } from "../../../components/DetailLayout";
import Modal from "../../../components/Modal";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import Pagination from "../../../components/Pagination";
import { getAuthUser } from "../../../auth";
import {
  createOperatorShuttleTrip,
  getOperatorShuttleRequests,
  getOperatorUsers,
  getOperatorVehicles,
  type AdminUserRole,
  type OperatorUser,
  type OperatorVehicle,
  type ShuttleBookingGroup,
  type ShuttleRequestGroup,
} from "../../../api/vietride";

type RequestType = "Đón" | "Trả";
type RequestStatus =
  | "pending"
  | "assigned"
  | "picking"
  | "completed"
  | "cancelled";
type VehicleStatus = "active" | "picking" | "idle";

type ShuttleRequest = {
  id: string;
  mainTripId: string;
  bookingId: string;
  customerName: string;
  phone: string;
  trip: string;
  type: RequestType;
  address: string;
  note?: string;
  time: string;
  hardCutoffAt?: string;
  passengerCount: number;
  pickupLat?: number;
  pickupLng?: number;
  stationName?: string;
  assignedDriver?: string;
  assignedPlate?: string;
  assignedCap?: string;
  status: RequestStatus;
};

type ShuttleVehicle = {
  id: string;
  plate: string;
  vehicleModel: string;
  capacity: number;
  status: VehicleStatus;
  currentPickups?: number;
};

type ShuttleDriver = {
  id: string;
  name: string;
  phone?: string;
  status: string;
};

const tableActionClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700";

const INITIAL_REQUESTS: ShuttleRequest[] = [];
const INITIAL_VEHICLES: ShuttleVehicle[] = [];

const STATUS_CLASS: Record<RequestStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  assigned: "bg-blue-50 text-blue-600",
  picking: "bg-teal-50 text-teal-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

const V_STATUS_CLASS: Record<VehicleStatus, string> = {
  active: "text-teal-600",
  picking: "text-blue-500",
  idle: "text-gray-400",
};
const V_DOT_CLASS: Record<VehicleStatus, string> = {
  active: "bg-teal-500",
  picking: "bg-blue-500",
  idle: "bg-gray-300",
};

function formatTime(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toRequestRows(group: ShuttleRequestGroup): ShuttleRequest[] {
  const orderMap = new Map(
    group.suggestedBookingOrder.map((bookingId, index) => [bookingId, index]),
  );

  return [...group.bookingGroups]
    .sort((left, right) => {
      const leftOrder = orderMap.get(left.bookingId) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = orderMap.get(right.bookingId) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    })
    .map((booking) => toRequestRow(group, booking));
}

function toRequestRow(
  group: ShuttleRequestGroup,
  booking: ShuttleBookingGroup,
): ShuttleRequest {
  return {
    id: booking.bookingId,
    mainTripId: group.mainTripId,
    bookingId: booking.bookingId,
    customerName: booking.bookingId,
    phone: "-",
    trip: group.mainTripId,
    type: "Đón",
    address: booking.pickupAddress,
    note: `${group.stationName} - ${booking.distanceToStationMeters}m`,
    time: formatTime(group.departureDateTime),
    hardCutoffAt: group.hardCutoffAt,
    passengerCount: booking.passengerCount,
    pickupLat: booking.pickupLat,
    pickupLng: booking.pickupLng,
    stationName: group.stationName,
    status: "pending",
  };
}

function toVehicleOption(vehicle: OperatorVehicle): ShuttleVehicle {
  return {
    id: vehicle.vehicleId || vehicle.id || "",
    plate: vehicle.licensePlate,
    vehicleModel: vehicle.vehicleTypeName || vehicle.vehicleTypeCode || "-",
    capacity: vehicle.totalSeats,
    status: vehicle.status === "ACTIVE" ? "active" : "idle",
  };
}

function toDriverOption(user: OperatorUser): ShuttleDriver {
  return {
    id: user.userId || user.id || "",
    name: user.displayName || user.email,
    phone: user.phone,
    status: user.status,
  };
}

function isDriverRole(role: AdminUserRole) {
  return role === "DRIVER" || role === "driver";
}

export default function DispatchPanel() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
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

  const [requests, setRequests] = useState<ShuttleRequest[]>(INITIAL_REQUESTS);
  const [vehicles, setVehicles] = useState<ShuttleVehicle[]>(INITIAL_VEHICLES);
  const [drivers, setDrivers] = useState<ShuttleDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">(
    "all",
  );
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [openCreateRequest, setOpenCreateRequest] = useState(false);
  const [openAssignVehicle, setOpenAssignVehicle] = useState(false);
  const [openRequestDetail, setOpenRequestDetail] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ShuttleRequest | null>(
    null,
  );

  const [newRequestForm, setNewRequestForm] = useState({
    customerName: "",
    phone: "",
    trip: "",
    type: "Đón" as RequestType,
    address: "",
    note: "",
    time: "",
  });

  const [assignForm, setAssignForm] = useState({
    vehicleId: "",
    driverId: "",
    scheduledDepartureTime: "",
    scheduledEndTime: "",
    notes: "",
  });

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
      setError(err instanceof Error ? err.message : "Failed to load shuttle requests");
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

  const handleCreateRequest = () => {
    if (
      !newRequestForm.customerName ||
      !newRequestForm.phone ||
      !newRequestForm.trip
    ) {
      alert(t("dispatch.fillRequired"));
      return;
    }
    const newReq: ShuttleRequest = {
      id: `SH-${Date.now()}`,
      mainTripId: newRequestForm.trip,
      bookingId: `SH-${Date.now()}`,
      ...newRequestForm,
      passengerCount: 1,
      status: "pending",
    };
    setRequests([newReq, ...requests]);
    setNewRequestForm({
      customerName: "",
      phone: "",
      trip: "",
      type: "Đón",
      address: "",
      note: "",
      time: "",
    });
    setOpenCreateRequest(false);
    alert(t("dispatch.createSuccess"));
  };

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
      await loadDispatchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign shuttle");
    }
  };

  const openDetail = (request: ShuttleRequest) => {
    setSelectedRequest(request);
    setOpenRequestDetail(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
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
            <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
              <FiDownload size={16} /> {tc("exportCsv")}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    {t("dispatch.code")}
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    {t("dispatch.customer")}
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    {t("dispatch.trip")}
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    {t("dispatch.type")}
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    {t("dispatch.vehicleDriver")}
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    {tc("status")}
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-700">
                    {tc("actions")}
                  </th>
                </tr>
            </thead>
            <tbody>
              {paginatedRequests.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-3 py-3 text-xs font-mono text-gray-500">
                      {r.id}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-gray-900">
                        {r.customerName}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <FiPhone size={12} /> {r.phone}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-700">{r.trip}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${r.type === "Đón" ? "bg-blue-600" : "bg-teal-600"}`}
                      >
                        {requestTypeLabel(r.type)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {r.assignedDriver ? (
                        <div className="text-xs">
                          <div className="font-medium text-gray-900">
                            {r.assignedDriver}
                          </div>
                          <div className="text-gray-500">{r.assignedPlate}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[r.status]}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        {r.status === "pending" && canDispatchShuttle && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRequest(r);
                              setOpenAssignVehicle(true);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-vr-600 text-white hover:bg-vr-700"
                            title={t("dispatch.assignVehicle")}
                            aria-label={t("dispatch.assignVehicle")}
                          >
                            <FiTruck size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openDetail(r)}
                          className={tableActionClass}
                          title={tc("details")}
                          aria-label={tc("details")}
                        >
                          <FiEye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedRequests.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-sm text-gray-500"
                    >
                      {isLoading ? t("dispatch.loading") : t("dispatch.noRequests")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

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
                <div className="flex items-start justify-between gap-2">
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

      <Modal
        open={openCreateRequest}
        onClose={() => setOpenCreateRequest(false)}
        title={t("dispatch.createTitle")}
        wide
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("dispatch.customerName")}
              </label>
              <input
                type="text"
                value={newRequestForm.customerName}
                onChange={(e) =>
                  setNewRequestForm({
                    ...newRequestForm,
                    customerName: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tc("phone")}
              </label>
              <input
                type="tel"
                value={newRequestForm.phone}
                onChange={(e) =>
                  setNewRequestForm({
                    ...newRequestForm,
                    phone: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("dispatch.tripCode")}
              </label>
              <input
                type="text"
                value={newRequestForm.trip}
                onChange={(e) =>
                  setNewRequestForm({ ...newRequestForm, trip: e.target.value })
                }
                placeholder={t("dispatch.tripCodePlaceholder")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("dispatch.type")}
              </label>
              <CustomSelect
                value={newRequestForm.type}
                onChange={(e) =>
                  setNewRequestForm({
                    ...newRequestForm,
                    type: e.target.value as RequestType,
                  })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
              >
                <option value="Đón">{t("dispatch.pickup")}</option>
                <option value="Trả">{t("dispatch.dropoff")}</option>
              </CustomSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tc("time")}
              </label>
              <CustomDateTimeInput
                type="time"
                value={newRequestForm.time}
                onChange={(e) =>
                  setNewRequestForm({ ...newRequestForm, time: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("dispatch.address")}
            </label>
            <input
              type="text"
              value={newRequestForm.address}
              onChange={(e) =>
                setNewRequestForm({
                  ...newRequestForm,
                  address: e.target.value,
                })
              }
              placeholder={t("dispatch.addressPlaceholder")}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tc("note")}
            </label>
            <textarea
              value={newRequestForm.note}
              onChange={(e) =>
                setNewRequestForm({ ...newRequestForm, note: e.target.value })
              }
              placeholder={t("dispatch.notePlaceholder")}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setOpenCreateRequest(false)}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              onClick={handleCreateRequest}
              className="flex-1 px-4 py-2 bg-vr-500 hover:bg-vr-600 text-white font-medium rounded-lg transition"
            >
              {t("dispatch.createRequest")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openAssignVehicle}
        onClose={() => setOpenAssignVehicle(false)}
        title={t("dispatch.assignTitle")}
        wide
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="bg-vr-50 border border-vr-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900">
                {t("dispatch.requestInfo")}
              </h4>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                <div>
                  <span className="text-gray-600">
                    {t("dispatch.requestCode")}
                  </span>{" "}
                  {selectedRequest.id}
                </div>
                <div>
                  <span className="text-gray-600">
                    {t("dispatch.customerLabel")}
                  </span>{" "}
                  {selectedRequest.customerName}
                </div>
                <div>
                  <span className="text-gray-600">
                    {t("dispatch.tripLabel")}
                  </span>{" "}
                  {selectedRequest.trip}
                </div>
                <div>
                  <span className="text-gray-600">
                    {t("dispatch.typeLabel")}
                  </span>{" "}
                  {requestTypeLabel(selectedRequest.type)}
                </div>
                <div>
                  <span className="text-gray-600">
                    {t("dispatch.addressLabel")}
                  </span>{" "}
                  {selectedRequest.address}
                </div>
                <div>
                  <span className="text-gray-600">
                    {t("dispatch.timeLabel")}
                  </span>{" "}
                  {selectedRequest.time}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("dispatch.selectVehicle")}
              </label>
              <CustomSelect
                value={assignForm.vehicleId}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, vehicleId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
              >
                <option value="">{t("dispatch.selectVehiclePlaceholder")}</option>
                {vehicles.filter((v) => v.status !== "idle").map((v) => (
                  <option key={v.id} value={v.id}>
                    {t("dispatch.vehicleOption", {
                      plate: v.plate,
                      model: v.vehicleModel,
                      capacity: v.capacity,
                      driver: "",
                    })}
                  </option>
                ))}
              </CustomSelect>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("dispatch.driverLabel")}
              </label>
              <CustomSelect
                value={assignForm.driverId}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, driverId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
              >
                <option value="">{t("dispatch.selectDriverPlaceholder")}</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} {driver.phone ? `- ${driver.phone}` : ""}
                  </option>
                ))}
              </CustomSelect>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("dispatch.scheduledDeparture")}
                </label>
              <CustomDateTimeInput
                type="datetime-local"
                value={assignForm.scheduledDepartureTime}
                onChange={(e) =>
                  setAssignForm({
                      ...assignForm,
                      scheduledDepartureTime: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("dispatch.scheduledEnd")}
                </label>
              <CustomDateTimeInput
                type="datetime-local"
                value={assignForm.scheduledEndTime}
                onChange={(e) =>
                  setAssignForm({
                      ...assignForm,
                      scheduledEndTime: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tc("note")}
              </label>
              <textarea
                value={assignForm.notes}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, notes: e.target.value })
                }
                placeholder={t("dispatch.driverNotesPlaceholder")}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setOpenAssignVehicle(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                {tc("cancel")}
              </button>
              <button
                onClick={handleAssignVehicle}
                className="flex-1 px-4 py-2 bg-vr-500 hover:bg-vr-600 text-white font-medium rounded-lg transition"
              >
                {t("dispatch.assignVehicle")}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={openRequestDetail}
        onClose={() => setOpenRequestDetail(false)}
        title={t("dispatch.detailTitle")}
        wide
      >
        {selectedRequest && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem
                label={t("dispatch.requestCodeLabel")}
                value={<span className="font-mono">{selectedRequest.id}</span>}
              />
              <DetailItem
                label={tc("status")}
                value={
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[selectedRequest.status]}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                    {statusLabel(selectedRequest.status)}
                  </span>
                }
              />
            </div>

            <DetailSection title={t("dispatch.customerInfo")}>
              <DetailItem
                label={t("dispatch.customerName")}
                value={selectedRequest.customerName}
              />
              <DetailItem label={tc("phone")} value={selectedRequest.phone} />
            </DetailSection>

            <DetailSection title={t("dispatch.tripInfo")} columns="three">
              <DetailItem
                label={t("dispatch.tripCode")}
                value={selectedRequest.trip}
              />
              <DetailItem
                label={t("dispatch.type")}
                value={requestTypeLabel(selectedRequest.type)}
              />
              <DetailItem label={tc("time")} value={selectedRequest.time} />
            </DetailSection>

            <DetailSection title={t("dispatch.addressAndNotes")}>
              <DetailItem
                label={t("dispatch.address")}
                value={
                  <span className="flex items-start gap-2">
                    <FiMapPin className="mt-0.5 shrink-0" />
                    {selectedRequest.address}
                  </span>
                }
              />
              {selectedRequest.note && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
                  <p className="text-blue-700">{selectedRequest.note}</p>
                </div>
              )}
            </DetailSection>

            {selectedRequest.assignedDriver && (
              <DetailSection title={t("dispatch.assignedVehicle")} columns="three">
                <DetailItem
                  label={t("dispatch.driverLabel")}
                  value={selectedRequest.assignedDriver}
                />
                <DetailItem
                  label={t("dispatch.plateLabel")}
                  value={selectedRequest.assignedPlate}
                />
                <DetailItem
                  label={t("dispatch.vehicleLabel")}
                  value={selectedRequest.assignedCap}
                />
              </DetailSection>
            )}

            <div className="flex gap-3 border-t pt-4">
              <button
                onClick={() => setOpenRequestDetail(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                {tc("close")}
              </button>
              {selectedRequest.status === "pending" && canDispatchShuttle && (
                <button
                  onClick={() => {
                    setOpenRequestDetail(false);
                    setOpenAssignVehicle(true);
                  }}
                  className="flex-1 px-4 py-2 bg-vr-500 hover:bg-vr-600 text-white font-medium rounded-lg transition"
                >
                  {t("dispatch.assignVehicle")}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
