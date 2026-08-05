import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiXCircle,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import { ApiRequestError } from "../../../api/client";
import {
  approveOperatorRouteChangeProposal,
  getOperatorRouteChangeProposal,
  getOperatorRouteChangeProposals,
  rejectOperatorRouteChangeProposal,
  type RouteChangeProposal,
  type RouteChangeProposalStatus,
} from "../../../api/vietride";

const pageSize = 50;

const statusStyles: Record<RouteChangeProposalStatus, string> = {
  PENDING: "bg-orange-100 text-orange-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  SUPERSEDED: "bg-gray-100 text-gray-600",
  EXPIRED: "bg-gray-100 text-gray-600",
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

export default function RouteETAPage() {
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
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  const pending = requests.filter((request) => request.status === "PENDING").length;
  const approved = requests.filter((request) => request.status === "APPROVED").length;

  async function openDetails(request: RouteChangeProposal) {
    setSelectedRequest(request);
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
      setSelectedRequest(null);
      setMessage(t("routeEta.proposalNoLongerPending"));
      await loadRequests();
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
      setSelectedRequest(null);
      setMessage(t("routeEta.approvedMessage"));
      await loadRequests();
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
      setRejectReason("");
      setSelectedRequest(null);
      setMessage(t("routeEta.rejectedMessage"));
      await loadRequests();
    } catch (err) {
      if (!(await handleTerminalConflict(err))) {
        setError(err instanceof Error ? err.message : t("routeEta.actionFailed"));
      }
    } finally {
      setActionId("");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("routeEta.title")}</h1>
          <p className="mt-1 text-sm text-gray-600">{t("routeEta.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadRequests()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          {tc("refresh")}
        </button>
      </div>

      {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">{tc("pending")}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{pending}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">{t("routeEta.approvedToday")}</p>
          <p className="mt-2 text-3xl font-bold text-green-600">{approved}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">{t("routeEta.total")}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{requests.length}</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col items-end gap-3 sm:flex-row">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("routeEta.searchPlaceholder")}
              className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-3 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <FiFilter />
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as RouteChangeProposalStatus | "ALL")
              }
              className="rounded-lg border border-gray-200 px-3 py-2"
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
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">{tc("loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">{t("routeEta.empty")}</div>
        ) : (
          filtered.map((request) => (
            <article key={request.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-4">
                <div className="pt-1">
                  {request.status === "PENDING" ? <FiAlertCircle className="text-orange-500" /> : request.status === "APPROVED" ? <FiCheckCircle className="text-green-500" /> : <FiXCircle className="text-gray-400" />}
                </div>
                <button type="button" onClick={() => void openDetails(request)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-gray-900">{request.snapshot.name}</span>
                    <span className="font-mono text-xs text-gray-500">{request.tripId}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[request.status]}`}>{t(`routeEta.status.${request.status}`)}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">{request.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                    <span><FiClock className="mr-1 inline" />{formatDate(request.createdAt)}</span>
                    <span>{request.type}</span>
                    <span>{request.snapshot.stops.length} {t("routeEta.stops")}</span>
                  </div>
                </button>
                {request.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => void openDetails(request)}
                    className="rounded-lg bg-vr-500 px-3 py-2 text-sm font-semibold text-white"
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
        onClose={() => setSelectedRequest(null)}
        title={selectedRequest?.snapshot.name ?? ""}
        subtitle={selectedRequest ? selectedRequest.tripId : ""}
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4 text-sm">
              <p className="font-medium text-gray-900">{selectedRequest.reason}</p>
              <p className="mt-2 text-gray-600">{selectedRequest.snapshot.description || "-"}</p>
              <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                <div><dt className="text-gray-500">{t("routeEta.type")}</dt><dd className="font-semibold">{selectedRequest.type}</dd></div>
                <div><dt className="text-gray-500">{t("routeEta.createdAt")}</dt><dd className="font-semibold">{formatDate(selectedRequest.createdAt)}</dd></div>
                <div><dt className="text-gray-500">{t("routeEta.distance")}</dt><dd className="font-semibold">{selectedRequest.snapshot.totalDistanceKm ?? "-"} km</dd></div>
                <div><dt className="text-gray-500">{t("routeEta.duration")}</dt><dd className="font-semibold">{selectedRequest.snapshot.estimatedDurationMinutes ?? "-"} phút</dd></div>
                <div>
                  <dt className="text-gray-500">{tc("status")}</dt>
                  <dd>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[selectedRequest.status]}`}>
                      {t(`routeEta.status.${selectedRequest.status}`)}
                    </span>
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
            {selectedRequest.status === "PENDING" && (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">{t("routeEta.rejectReason")}</span>
                  <textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} maxLength={500} className="min-h-24 w-full rounded-lg border border-gray-200 p-3" />
                </label>
                <div className="flex gap-2">
                  <button type="button" disabled={Boolean(actionId)} onClick={() => void approve(selectedRequest)} className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-60">{actionId ? tc("processing") : t("routeEta.approve")}</button>
                  <button type="button" disabled={Boolean(actionId)} onClick={() => void reject(selectedRequest)} className="flex-1 rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-700 disabled:opacity-60">{t("routeEta.reject")}</button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
