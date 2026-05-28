import { useState } from "react";
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Đổi lộ trình & cập nhật ETA
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Yêu cầu thay đổi lộ trình xe và điều hành — duyệt để cập nhật cho
          khách hàng.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-medium">Chờ duyệt</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{pending}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-medium">Đã duyệt hôm nay</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{approved}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 font-medium">
            Trung bình ETA delay
          </p>
          <p className="text-3xl font-bold text-orange-600 mt-2">
            +{avgDelay} phút
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
              placeholder="Tìm theo mã chuyến, tuyến, vị trí..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-vr-500"
            />
          </div>
          <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <FiFilter size={16} /> Bộ lọc
          </button>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-500">Không có yêu cầu nào.</p>
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
                      {request.status === "pending"
                        ? "Chờ duyệt"
                        : request.status === "approved"
                          ? "Đã duyệt"
                          : "Từ chối"}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-gray-700">
                    <p className="font-medium">{request.reason}</p>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
                    <div>
                      <span className="text-gray-500">ETA điều chỉnh:</span>{" "}
                      <span className="font-semibold text-orange-600">
                        +{request.etaDelay} phút
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Ảnh hưởng:</span>{" "}
                      <span className="font-semibold">
                        {request.seatsAffected} khách
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Yêu cầu bổ sung:</span>{" "}
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
                      Duyệt & thông báo
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
                        ? "✓ Đã duyệt"
                        : "✗ Từ chối"}
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
                  Lý do yêu cầu
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  {selectedRequest.reason}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  ETA điều chỉnh
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  +{selectedRequest.etaDelay} phút
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  Khách hàng ảnh hưởng
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  {selectedRequest.seatsAffected} khách
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  Yêu cầu bổ sung
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
                ✓ Duyệt & gửi thông báo
              </button>
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition"
              >
                ✗ Từ chối
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
