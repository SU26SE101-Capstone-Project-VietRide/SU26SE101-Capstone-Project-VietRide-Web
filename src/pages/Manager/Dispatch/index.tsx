import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  FiPlus,
  FiSearch,
  FiDownload,
  FiEye,
  FiXCircle,
  FiCheck,
  FiClock,
  FiTrendingUp,
  FiPhone,
  FiMapPin,
  FiUser,
  FiTruck,
} from "react-icons/fi";
import Modal from "../../../components/Modal";

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
  customerName: string;
  phone: string;
  trip: string;
  type: RequestType;
  address: string;
  note?: string;
  time: string;
  assignedDriver?: string;
  assignedPlate?: string;
  assignedCap?: string;
  status: RequestStatus;
};

type ShuttleVehicle = {
  plate: string;
  vehicleModel: string;
  capacity: number;
  driver: string;
  status: VehicleStatus;
  currentPickups?: number;
};

const tableActionClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-vr-200 hover:bg-vr-50 hover:text-vr-700";

const INITIAL_REQUESTS: ShuttleRequest[] = [
  {
    id: "SH-9001",
    customerName: "Nguyễn Thu Hà",
    phone: "0901 234 567",
    trip: "VR-2401",
    type: "Đón",
    address: "123 Nguyễn Trãi, Q.5, TP.HCM",
    note: "Có 1 vali lớn",
    time: "05:10",
    status: "pending",
  },
  {
    id: "SH-9002",
    customerName: "Trần Đức Long",
    phone: "0912 345 678",
    trip: "VR-2401",
    type: "Đón",
    address: "45 Lê Lợi, Q.1, TP.HCM",
    time: "05:25",
    assignedDriver: "Phạm Văn Tài",
    assignedPlate: "51A-77821",
    assignedCap: "Limo 9 chỗ",
    status: "assigned",
  },
  {
    id: "SH-9003",
    customerName: "Lê Mai Anh",
    phone: "0987 654 321",
    trip: "VR-2451",
    type: "Trả",
    address: "78 Pasteur, Q.3, TP.HCM",
    time: "21:55",
    status: "pending",
  },
  {
    id: "SH-9004",
    customerName: "Phạm Quang Huy",
    phone: "0934 567 890",
    trip: "VR-2402",
    type: "Đón",
    address: "210 CMT8, Q.10, TP.HCM",
    note: "Gọi trước 10 phút",
    time: "06:50",
    assignedDriver: "Vũ Minh Hải",
    assignedPlate: "51A-66110",
    assignedCap: "Limo 7 chỗ",
    status: "picking",
  },
  {
    id: "SH-9005",
    customerName: "Đặng Lan Phương",
    phone: "0945 678 901",
    trip: "VR-2405",
    type: "Trả",
    address: "Bến Ninh Kiều, Cần Thơ",
    time: "12:35",
    assignedDriver: "Trần Văn Phú",
    assignedPlate: "65A-12039",
    status: "completed",
  },
];

const VEHICLES: ShuttleVehicle[] = [
  {
    plate: "51A-77821",
    vehicleModel: "Ford Transit Limo 9",
    capacity: 9,
    driver: "Phạm Văn Tài",
    status: "active",
  },
  {
    plate: "51A-66110",
    vehicleModel: "Toyota Hiace 7",
    capacity: 7,
    driver: "Vũ Minh Hải",
    status: "picking",
  },
  {
    plate: "51A-99230",
    vehicleModel: "Mercedes Sprinter 11",
    capacity: 11,
    driver: "Đỗ Tuấn Anh",
    status: "active",
  },
  {
    plate: "65A-12039",
    vehicleModel: "Toyota Innova",
    capacity: 7,
    driver: "Trần Văn Phú",
    status: "idle",
  },
];

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

export default function DispatchPanel() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">(
    "all",
  );

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
    notes: "",
  });

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
      ready: VEHICLES.filter((v) => v.status === "active").length,
    }),
    [requests],
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
      ...newRequestForm,
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

  const handleAssignVehicle = () => {
    if (!selectedRequest || !assignForm.vehicleId) return;
    const vehicle = VEHICLES.find((v) => v.plate === assignForm.vehicleId);
    if (!vehicle) return;

    setRequests(
      requests.map((r) =>
        r.id === selectedRequest.id
          ? {
              ...r,
              status: "assigned" as RequestStatus,
              assignedDriver: vehicle.driver,
              assignedPlate: vehicle.plate,
              assignedCap: vehicle.vehicleModel,
            }
          : r,
      ),
    );
    setOpenAssignVehicle(false);
    setAssignForm({ vehicleId: "", notes: "" });
    alert(t("dispatch.assignSuccess"));
  };

  const openDetail = (request: ShuttleRequest) => {
    setSelectedRequest(request);
    setOpenRequestDetail(true);
  };

  const handleCancelRequest = (requestId: string) => {
    if (confirm(t("dispatch.confirmCancelRequest"))) {
      setRequests(
        requests.map((r) =>
          r.id === requestId ? { ...r, status: "cancelled" } : r,
        ),
      );
    }
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
          onClick={() => setOpenCreateRequest(true)}
          className="flex items-center gap-2 px-4 py-2 bg-vr-500 hover:bg-vr-600 text-white font-medium rounded-lg transition"
        >
          <FiPlus size={18} /> {t("dispatch.create")}
        </button>
      </div>

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
            value: `${stats.ready}/${VEHICLES.length}`,
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
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("dispatch.searchPlaceholder")}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-vr-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as RequestStatus | "all")
              }
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-vr-500"
            >
              <option value="all">{tc("all")}</option>
              <option value="pending">{t("dispatch.filterPending")}</option>
              <option value="assigned">{t("dispatch.filterAssigned")}</option>
              <option value="picking">{t("dispatch.statusPicking")}</option>
              <option value="completed">{t("dispatch.statusCompleted")}</option>
              <option value="cancelled">{t("dispatch.filterCancelled")}</option>
            </select>
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
                {filtered.map((r) => (
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
                        {r.status === "pending" && (
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
                        {r.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => handleCancelRequest(r.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                            title={tc("cancel")}
                            aria-label={tc("cancel")}
                          >
                            <FiXCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <div>
              {t("dispatch.showingRequests", {
                count: filtered.length,
                total: requests.length,
              })}
            </div>
            <div className="flex gap-1">
              <button className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                {tc("previous")}
              </button>
              <button className="px-3 py-1.5 bg-vr-500 text-white rounded-lg font-semibold">
                1
              </button>
              <button className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                {tc("next")}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t("dispatch.shuttleFleet")}
          </h3>
          <div className="space-y-3">
            {VEHICLES.map((v) => (
              <div
                key={v.plate}
                className="p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {v.plate}
                    </p>
                    <p className="text-xs text-gray-600">{v.vehicleModel}</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                      <FiUser size={12} /> {v.driver}
                    </p>
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
              <select
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
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tc("time")}
              </label>
              <input
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
              <select
                value={assignForm.vehicleId}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, vehicleId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-vr-500"
              >
                <option value="">{t("dispatch.selectVehiclePlaceholder")}</option>
                {VEHICLES.filter((v) => v.status !== "idle").map((v) => (
                  <option key={v.plate} value={v.plate}>
                    {t("dispatch.vehicleOption", {
                      plate: v.plate,
                      model: v.vehicleModel,
                      capacity: v.capacity,
                      driver: v.driver,
                    })}
                  </option>
                ))}
              </select>
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  {t("dispatch.requestCodeLabel")}
                </p>
                <p className="font-mono font-semibold text-gray-900">
                  {selectedRequest.id}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">{tc("status")}</p>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[selectedRequest.status]}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                  {statusLabel(selectedRequest.status)}
                </span>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-900 mb-3">
                {t("dispatch.customerInfo")}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">{t("dispatch.customerName")}</p>
                  <p className="font-medium text-gray-900">
                    {selectedRequest.customerName}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">{tc("phone")}</p>
                  <p className="font-medium text-gray-900">
                    {selectedRequest.phone}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-900 mb-3">
                {t("dispatch.tripInfo")}
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">{t("dispatch.tripCode")}</p>
                  <p className="font-medium text-gray-900">
                    {selectedRequest.trip}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">{t("dispatch.type")}</p>
                  <p className="font-medium text-gray-900">
                    {requestTypeLabel(selectedRequest.type)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">{tc("time")}</p>
                  <p className="font-medium text-gray-900">
                    {selectedRequest.time}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-900 mb-3">
                {t("dispatch.addressAndNotes")}
              </h4>
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p className="text-gray-600">{t("dispatch.address")}</p>
                <p className="font-medium text-gray-900 flex items-start gap-2 mt-1">
                  <FiMapPin className="mt-0.5 shrink-0" />{" "}
                  {selectedRequest.address}
                </p>
              </div>
              {selectedRequest.note && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm mt-2">
                  <p className="text-blue-700">{selectedRequest.note}</p>
                </div>
              )}
            </div>

            {selectedRequest.assignedDriver && (
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-900 mb-3">
                  {t("dispatch.assignedVehicle")}
                </h4>
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-sm">
                  <p>
                    <span className="text-gray-600">
                      {t("dispatch.driverLabel")}
                    </span>{" "}
                    <span className="font-medium text-gray-900">
                      {selectedRequest.assignedDriver}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-600">
                      {t("dispatch.plateLabel")}
                    </span>{" "}
                    <span className="font-medium text-gray-900">
                      {selectedRequest.assignedPlate}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-600">
                      {t("dispatch.vehicleLabel")}
                    </span>{" "}
                    <span className="font-medium text-gray-900">
                      {selectedRequest.assignedCap}
                    </span>
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 border-t pt-4">
              <button
                onClick={() => setOpenRequestDetail(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                {tc("close")}
              </button>
              {selectedRequest.status === "pending" && (
                <>
                  <button
                    onClick={() => {
                      setOpenRequestDetail(false);
                      setOpenAssignVehicle(true);
                    }}
                    className="flex-1 px-4 py-2 bg-vr-500 hover:bg-vr-600 text-white font-medium rounded-lg transition"
                  >
                    {t("dispatch.assignVehicle")}
                  </button>
                  <button
                    onClick={() => {
                      handleCancelRequest(selectedRequest.id);
                      setOpenRequestDetail(false);
                    }}
                    className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition"
                  >
                    {tc("cancel")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
