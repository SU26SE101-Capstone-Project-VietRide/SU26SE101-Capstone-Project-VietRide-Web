import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiFilter,
  FiMap,
  FiRefreshCw,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import GoogleMapCanvas from "../../../components/GoogleMapCanvas";
import { ApiRequestError } from "../../../api/client";
import {
  approveOperatorRouteChangeProposal,
  getOperatorRouteChangeProposal,
  getOperatorRouteChangeProposals,
  getTrackingTripRouteGeometry,
  rejectOperatorRouteChangeProposal,
  type RouteChangeProposal,
  type RouteChangeProposalStatus,
} from "../../../api/vietride";
import type { GoogleMapCoordinate } from "../../../lib/googleMaps";
import { decodeGooglePolyline, routeGeometryPath } from "./gpsHelpers";
import { SearchInput } from "../../../components/ui/SearchInput";
import { Badge } from "../../../components/ui/Badge";
import type { BadgeTone } from "../../../components/ui/Badge";

const pageSize = 50;

// Màu path trên bản đồ so sánh: đề xuất = xanh vr (vr-800), hiện tại = xám
const proposedPathColor = "#2d8282";
const currentPathColor = "#9ca3af";

const defaultMapCenter: GoogleMapCoordinate = { lat: 10.7769, lng: 106.7009 };

// SUPERSEDED và EXPIRED vốn đã chung màu xám nên gộp về `neutral` không mất gì.
const statusStyles: Record<RouteChangeProposalStatus, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  SUPERSEDED: "neutral",
  EXPIRED: "neutral",
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

type ProposalsPanelProps = {
  // Đóng panel, quay về trạng thái trước đó của cột phải
  onClose: () => void;
  // "Xem trên bản đồ": chọn chuyến tương ứng trong Operations (đóng panel do index xử lý)
  onViewTrip: (tripId: string) => void;
  // Gọi sau mỗi lần approve/reject/conflict thành công để index cập nhật badge count
  onProposalsChanged?: () => void;
};

export default function ProposalsPanel({
  onClose,
  onViewTrip,
  onProposalsChanged,
}: ProposalsPanelProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [requests, setRequests] = useState<RouteChangeProposal[]>([]);
  const [selectedRequest, setSelectedRequest] =
    useState<RouteChangeProposal | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RouteChangeProposalStatus | "ALL">(
    "PENDING",
  );
  const [rejectReason, setRejectReason] = useState("");
  // Đang ở bước nhập lý do từ chối (bước 2 của luồng duyệt)
  const [rejecting, setRejecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useToastFeedback({ message, error });
  // Lộ trình hiện tại của chuyến (màu xám), lưu kèm tripId để không vẽ nhầm sang đề xuất khác
  const [currentRoute, setCurrentRoute] = useState<{
    tripId: string;
    path: GoogleMapCoordinate[];
  } | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getOperatorRouteChangeProposals({
        page: 1,
        pageSize,
        status: status === "ALL" ? undefined : status,
      });
      setRequests(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("routeEta.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [status, t]);

  useEffect(() => {
    const task = queueMicrotask(() => void loadRequests());
    return () => { void task; };
  }, [loadRequests]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((request) =>
      [request.id, request.tripId, request.reason, request.snapshot.name]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [requests, search]);

  // Path đề xuất decode từ polyline trong snapshot (màu xanh vr)
  const proposedPath = useMemo<GoogleMapCoordinate[]>(() => {
    const encoded = selectedRequest?.snapshot.pathPolyline;
    return encoded ? decodeGooglePolyline(encoded) : [];
  }, [selectedRequest]);

  // Tải lộ trình hiện tại của chuyến để so sánh — chỉ khi đề xuất có polyline
  useEffect(() => {
    const tripId = selectedRequest?.tripId;
    if (!tripId || !selectedRequest?.snapshot.pathPolyline) return;

    let ignore = false;
    void getTrackingTripRouteGeometry(tripId)
      .then((geometry) => {
        if (!ignore) setCurrentRoute({ tripId, path: routeGeometryPath(geometry) });
      })
      .catch(() => {
        // Không có geometry hiện tại thì chỉ vẽ path đề xuất
      });
    return () => {
      ignore = true;
    };
  }, [selectedRequest]);

  // Chỉ dùng path hiện tại khi nó thuộc đúng chuyến của đề xuất đang xem
  const currentPath = useMemo<GoogleMapCoordinate[]>(
    () =>
      currentRoute && currentRoute.tripId === selectedRequest?.tripId
        ? currentRoute.path
        : [],
    [currentRoute, selectedRequest],
  );

  const comparisonPolylines = useMemo(() => {
    const lines: Array<{
      id: string;
      path: GoogleMapCoordinate[];
      color: string;
      opacity: number;
      weight: number;
    }> = [];
    if (currentPath.length > 1) {
      lines.push({
        id: "current-route",
        path: currentPath,
        color: currentPathColor,
        opacity: 0.85,
        weight: 4,
      });
    }
    if (proposedPath.length > 1) {
      lines.push({
        id: "proposed-route",
        path: proposedPath,
        color: proposedPathColor,
        opacity: 0.95,
        weight: 5,
      });
    }
    return lines;
  }, [currentPath, proposedPath]);

  const fitPoints = useMemo(
    () => [...proposedPath, ...currentPath],
    [currentPath, proposedPath],
  );

  // Đóng modal về đúng trạng thái ban đầu — mở đề xuất khác không kế thừa
  // bước từ chối dở dang của đề xuất trước.
  function closeDetails() {
    setSelectedRequest(null);
    setRejecting(false);
    setRejectReason("");
  }

  async function openDetails(request: RouteChangeProposal) {
    setSelectedRequest(request);
    setRejecting(false);
    setRejectReason("");
    setError("");
    try {
      const detail = await getOperatorRouteChangeProposal(request.id);
      setSelectedRequest(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("routeEta.loadFailed"));
    }
  }

  // Theo docs BE: STALE/NOT_PENDING là trạng thái terminal — không retry với key mới,
  // đóng modal và tải lại danh sách vì nhiều proposal có thể đã đổi trạng thái.
  async function handleTerminalConflict(err: unknown) {
    if (
      err instanceof ApiRequestError &&
      (err.code === "ROUTE_CHANGE_PROPOSAL_STALE" ||
        err.code === "ROUTE_CHANGE_PROPOSAL_NOT_PENDING")
    ) {
      closeDetails();
      setMessage(t("routeEta.proposalNoLongerPending"));
      await loadRequests();
      onProposalsChanged?.();
      return true;
    }
    return false;
  }

  async function approve(request: RouteChangeProposal) {
    if (request.status !== "PENDING") return;
    setActionId(request.id);
    setError("");
    setMessage("");
    try {
      await approveOperatorRouteChangeProposal(request.id);
      closeDetails();
      setMessage(t("routeEta.approvedMessage"));
      await loadRequests();
      onProposalsChanged?.();
    } catch (err) {
      if (!(await handleTerminalConflict(err))) {
        setError(err instanceof Error ? err.message : t("routeEta.actionFailed"));
      }
    } finally {
      setActionId("");
    }
  }

  async function reject(request: RouteChangeProposal) {
    if (request.status !== "PENDING") return;
    setActionId(request.id);
    setError("");
    setMessage("");
    try {
      await rejectOperatorRouteChangeProposal(request.id, {
        reason: rejectReason.trim() || null,
      });
      closeDetails();
      setMessage(t("routeEta.rejectedMessage"));
      await loadRequests();
      onProposalsChanged?.();
    } catch (err) {
      if (!(await handleTerminalConflict(err))) {
        setError(err instanceof Error ? err.message : t("routeEta.actionFailed"));
      }
    } finally {
      setActionId("");
    }
  }

  return (
    <section className="flex min-h-0 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t("routeEta.title")}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{t("routeEta.subtitle")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void loadRequests()}
            disabled={loading}
            aria-label={tc("refresh")}
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={tc("close")}
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600"
          >
            <FiX />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SearchInput
          label={t("routeEta.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("routeEta.searchPlaceholder")}
          inputClassName="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm"
          wrapperClassName="relative"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <FiFilter />
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as RouteChangeProposalStatus | "ALL")
            }
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2"
          >
            <option value="PENDING">{tc("pending")}</option>
            <option value="APPROVED">{tc("approved")}</option>
            <option value="REJECTED">{t("routeEta.rejected")}</option>
            <option value="SUPERSEDED">{t("routeEta.superseded")}</option>
            <option value="EXPIRED">{t("routeEta.expired")}</option>
            <option value="ALL">{tc("all")}</option>
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">{tc("loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">{t("routeEta.empty")}</div>
        ) : (
          filtered.map((request) => (
            <article key={request.id} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-start gap-3">
                <div className="pt-1">
                  {request.status === "PENDING" ? <FiAlertCircle className="text-orange-500" /> : request.status === "APPROVED" ? <FiCheckCircle className="text-green-500" /> : <FiXCircle className="text-gray-500" />}
                </div>
                <button type="button" onClick={() => void openDetails(request)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-gray-900">{request.snapshot.name}</span>
                    <Badge tone={statusStyles[request.status]}>{t(`routeEta.status.${request.status}`)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">{request.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span><FiClock className="mr-1 inline" />{formatDate(request.createdAt)}</span>
                    <span>{request.type}</span>
                    <span>{request.snapshot.stops.length} {t("routeEta.stops")}</span>
                  </div>
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onViewTrip(request.tripId)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-vr-800 hover:underline"
                >
                  <FiMap />
                  {t("operations.viewOnMap")}
                  <span className="font-mono font-normal text-gray-500">{request.tripId}</span>
                </button>
                {request.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => void openDetails(request)}
                    className="rounded-lg bg-vr-800 px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    {t("routeEta.review")}
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      <Modal
        open={selectedRequest !== null}
        onClose={closeDetails}
        title={selectedRequest?.snapshot.name ?? ""}
        subtitle={selectedRequest ? selectedRequest.tripId : ""}
        wide
      >
        {selectedRequest && (
          <div className="space-y-4">
            {/* Bản đồ so sánh: đề xuất (xanh vr) vs lộ trình hiện tại (xám) */}
            <div>
              <GoogleMapCanvas
                ariaLabel={t("operations.comparisonMapAria")}
                center={proposedPath[0] ?? defaultMapCenter}
                className="h-64 w-full rounded-lg border border-gray-200"
                emptyState={t("operations.proposalNoPolyline")}
                fitPoints={fitPoints}
                polylines={comparisonPolylines}
                zoom={11}
              />
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-1 w-5 rounded-full"
                    style={{ backgroundColor: proposedPathColor }}
                    aria-hidden="true"
                  />
                  {t("operations.proposedPathLegend")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-1 w-5 rounded-full"
                    style={{ backgroundColor: currentPathColor }}
                    aria-hidden="true"
                  />
                  {t("operations.currentPathLegend")}
                </span>
                <button
                  type="button"
                  onClick={() => onViewTrip(selectedRequest.tripId)}
                  className="ml-auto inline-flex items-center gap-1 font-semibold text-vr-800 hover:underline"
                >
                  <FiMap />
                  {t("operations.viewOnMap")}
                </button>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 text-sm">
              <p className="font-medium text-gray-900">{selectedRequest.reason}</p>
              <p className="mt-2 text-gray-600">{selectedRequest.snapshot.description || "-"}</p>
              <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                <div><dt className="text-gray-500">{t("routeEta.type")}</dt><dd className="font-semibold">{selectedRequest.type}</dd></div>
                <div><dt className="text-gray-500">{t("routeEta.createdAt")}</dt><dd className="font-semibold">{formatDate(selectedRequest.createdAt)}</dd></div>
                <div><dt className="text-gray-500">{t("routeEta.distance")}</dt><dd className="font-semibold">{selectedRequest.snapshot.totalDistanceKm ?? "-"} km</dd></div>
                <div><dt className="text-gray-500">{t("routeEta.duration")}</dt><dd className="font-semibold">{t("routeEta.durationMinutes", { value: selectedRequest.snapshot.estimatedDurationMinutes ?? "-" })}</dd></div>
                <div>
                  <dt className="text-gray-500">{tc("status")}</dt>
                  <dd>
                    <Badge tone={statusStyles[selectedRequest.status]}>
                      {t(`routeEta.status.${selectedRequest.status}`)}
                    </Badge>
                  </dd>
                </div>
                {selectedRequest.decidedAt && (
                  <div><dt className="text-gray-500">{t("routeEta.decidedAt")}</dt><dd className="font-semibold">{formatDate(selectedRequest.decidedAt)}</dd></div>
                )}
              </dl>
              {selectedRequest.rejectionReason && (
                <p className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3 text-red-700">
                  <span className="font-semibold">{t("routeEta.rejectReason")}:</span>{" "}
                  {selectedRequest.rejectionReason}
                </p>
              )}
              {selectedRequest.resolutionCode && (
                <p className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-gray-700">
                  <span className="font-semibold">{t("routeEta.resolutionLabel")}:</span>{" "}
                  {t(`routeEta.resolution.${selectedRequest.resolutionCode}`, {
                    defaultValue: selectedRequest.resolutionCode,
                  })}
                </p>
              )}
            </div>
            {/* Duyệt và từ chối tách làm hai bước: trước đây ô "Lý do từ chối"
                luôn hiện ngay cạnh nút Duyệt, khiến người duyệt tưởng phải điền
                lý do mới bấm được. Giờ chỉ khi chọn Từ chối mới mở ô lý do. */}
            {selectedRequest.status === "PENDING" && (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                {rejecting ? (
                  <div className="space-y-3">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-gray-700">
                        {t("routeEta.rejectReason")}
                      </span>
                      <span className="mb-1.5 block text-xs text-gray-500">
                        {t("routeEta.rejectReasonHint")}
                      </span>
                      <textarea
                        autoFocus
                        value={rejectReason}
                        onChange={(event) => setRejectReason(event.target.value)}
                        maxLength={500}
                        placeholder={t("routeEta.rejectReasonPlaceholder")}
                        className="min-h-24 w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={Boolean(actionId)}
                        onClick={() => void reject(selectedRequest)}
                        className="flex-1 cursor-pointer rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionId ? tc("processing") : t("routeEta.confirmReject")}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(actionId)}
                        onClick={() => {
                          setRejecting(false);
                          setRejectReason("");
                        }}
                        className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        {tc("cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-gray-600">
                      {t("routeEta.decisionHint")}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={Boolean(actionId)}
                        onClick={() => void approve(selectedRequest)}
                        className="flex-1 cursor-pointer rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionId ? tc("processing") : t("routeEta.approve")}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(actionId)}
                        onClick={() => setRejecting(true)}
                        className="flex-1 cursor-pointer rounded-lg border border-red-200 px-4 py-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {t("routeEta.reject")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
