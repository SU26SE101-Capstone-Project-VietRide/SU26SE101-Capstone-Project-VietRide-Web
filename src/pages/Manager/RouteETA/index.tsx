import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiMoreVertical,
  FiSearch,
  FiFilter,
} from "react-icons/fi";
import Modal from "../../../components/Modal";

type RouteETARequest = {
  id: string;
  code: string;
  route: string;
  status: "pending" | "approved" | "rejected";
  etaDelay: number; // in minutes
  seatsAffected: number;
  location: string;
  time: string;
  reason: string;
};

const mockRequests: RouteETARequest[] = [
  {
    id: "1",
    code: "VR-2401",
    route: "HCM → Đà Lạt",
    status: "pending",
    etaDelay: 45,
    seatsAffected: 38,
    location: "Yêu cầu dừng tại Tài xế Nguyễn Văn An",
    time: "10:24",
    reason:
      "Gặp sự cố giao thông trên tuyến QL1, phải chuyển lộ trình qua QL27",
  },
  {
    id: "2",
    code: "VR-2402",
    route: "HCM → Nha Trang",
    status: "approved",
    etaDelay: 25,
    seatsAffected: 32,
    location: "Yêu cầu dừng tại Trạm dừng Trần Minh Quân",
    time: "09:48",
    reason: "Điều chỉnh lộ trình do công trình đường cao tốc",
  },
  {
    id: "3",
    code: "VR-2403",
    route: "HCM → Sapa",
    status: "pending",
    etaDelay: 10,
    seatsAffected: 28,
    location: "Đặc biệt dành cho khách hàng VIP",
    time: "08:12",
    reason: "Yêu cầu phục vụ khách VIP, cần dừng thêm điểm",
  },
];

export default function RouteETAPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] =
    useState<RouteETARequest | null>(null);
  const [requests, setRequests] = useState<RouteETARequest[]>(mockRequests);

  const pending = requests.filter((r) => r.status === "pending").length;
  const approved = requests.filter((r) => r.status === "approved").length;
  const avgDelay = requests.length
    ? Math.round(
        requests.reduce((sum, r) => sum + r.etaDelay, 0) / requests.length,
      )
    : 0;

  const filtered = requests.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.code.toLowerCase().includes(q) ||
      r.route.toLowerCase().includes(q) ||
      r.location.toLowerCase().includes(q)
    );
  });

  const handleApprove = () => {
    if (selectedRequest) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id ? { ...r, status: "approved" } : r,
        ),
      );
      setSelectedRequest(null);
    }
  };

  const handleReject = () => {
    if (selectedRequest) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id ? { ...r, status: "rejected" } : r,
        ),
      );
      setSelectedRequest(null);
    }
  };

  const statusLabel = (status: RouteETARequest["status"]) => {
    if (status === "pending") return tc("pending");
    if (status === "approved") return tc("approved");
    return t("routeEta.rejected");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("routeEta.title")}
        </h1>
        <p className="text-sm text-gray-600 mt-1">{t("routeEta.subtitle")}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-medium">{tc("pending")}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{pending}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-medium">
            {t("routeEta.approvedToday")}
          </p>
          <p className="text-3xl font-bold text-green-600 mt-2">{approved}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-medium">
            {t("routeEta.avgDelay")}
          </p>
          <p className="text-3xl font-bold text-orange-600 mt-2">
            {t("routeEta.minutes", { n: avgDelay })}
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t("routeEta.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-vr-500"
            />
          </div>
          <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <FiFilter size={16} /> {tc("filter")}
          </button>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-500">{t("routeEta.empty")}</p>
          </div>
        ) : (
          filtered.map((request) => (
            <div
              key={request.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 pt-1">
                  {request.status === "pending" && (
                    <FiAlertCircle className="w-5 h-5 text-orange-500" />
                  )}
                  {request.status === "approved" && (
                    <FiCheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {request.status === "rejected" && (
                    <FiAlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-gray-900">
                      {request.code}
                    </span>
                    <span className="text-sm text-gray-500">
                      {request.route}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        request.status === "pending"
                          ? "bg-orange-100 text-orange-700"
                          : request.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {statusLabel(request.status)}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-gray-700">
                    <p className="font-medium">{request.reason}</p>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
                    <div>
                      <span className="text-gray-500">
                        {t("routeEta.adjustedEta")}
                      </span>{" "}
                      <span className="font-semibold text-orange-600">
                        {t("routeEta.minutes", { n: request.etaDelay })}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("routeEta.impact")}
                      </span>{" "}
                      <span className="font-semibold">
                        {t("routeEta.passengers", {
                          n: request.seatsAffected,
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("routeEta.extraRequest")}
                      </span>{" "}
                      <span className="font-semibold">{request.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FiClock size={14} />
                      <span>{request.time}</span>
                    </div>
                  </div>
                </div>

                {request.status === "pending" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="px-3 py-2 bg-vr-500 hover:bg-vr-600 text-white text-sm font-medium rounded-lg transition"
                    >
                      {t("routeEta.approveNotify")}
                    </button>
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <FiMoreVertical size={18} />
                    </button>
                  </div>
                )}

                {request.status !== "pending" && (
                  <div className="flex-shrink-0">
                    <span
                      className={`text-sm font-medium ${
                        request.status === "approved"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {request.status === "approved"
                        ? t("routeEta.approvedMark")
                        : t("routeEta.rejectedMark")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        open={selectedRequest !== null}
        onClose={() => setSelectedRequest(null)}
        title={selectedRequest ? selectedRequest.code : ""}
        subtitle={selectedRequest ? selectedRequest.route : ""}
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  {t("routeEta.reasonLabel")}
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  {selectedRequest.reason}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  {t("routeEta.adjustedEtaLabel")}
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  {t("routeEta.minutes", { n: selectedRequest.etaDelay })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  {t("routeEta.affectedPassengers")}
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  {t("routeEta.passengers", {
                    n: selectedRequest.seatsAffected,
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  {t("routeEta.extraRequestLabel")}
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  {selectedRequest.location}
                </p>
              </div>
            </div>

            <div className="border-t pt-4 flex gap-2">
              <button
                onClick={handleApprove}
                className="flex-1 px-4 py-2 bg-vr-500 hover:bg-vr-600 text-white font-medium rounded-lg transition"
              >
                {t("routeEta.approveAndSend")}
              </button>
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition"
              >
                {t("routeEta.rejectedMark")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
