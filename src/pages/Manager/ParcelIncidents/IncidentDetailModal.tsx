// Chi tiết một sự cố kiện hàng: thông tin kiện/chuyến, nhiệm vụ tìm kiếm, lịch
// sử bàn giao và các thao tác.
//
// Hai luật của tài liệu được giữ nghiêm ở đây:
// - Nút mutation CHỈ hiện theo `availableActions` của BE (§11.1 mục 3).
// - Mutation trả detail mới → thay thẳng vào state, không refetch (§11.1 mục 4).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiNavigation,
  FiPackage,
  FiSearch,
  FiShield,
  FiUser,
} from "react-icons/fi";
import {
  getOperatorParcelIncident,
  type ParcelCustodyEvent,
  type ParcelIncidentDetail,
  type ParcelIncidentSearchTask,
} from "../../../api/vietride";
import Modal from "../../../components/Modal";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatCurrency } from "../../../utils/currency";
import { formatDateTime } from "../../../utils/date";
import { parcelReasonLabel } from "../../../utils/parcelReason";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import CustodyApprovalPanel from "./CustodyApprovalPanel";
import CustodyDecisionModal from "./CustodyDecisionModal";
import ForwardingOptionsModal from "./ForwardingOptionsModal";
import IncidentActionModal, {
  type IncidentActionKind,
} from "./IncidentActionModal";
import {
  locationLabel,
  locationRefLabel,
  slaTone,
} from "../../../utils/parcelReliability";
import {
  getCustodyApprovalUi,
  hasIncidentAction,
  incidentStatusTone,
  mergeCustodyEvents,
  oldestSequence,
  type IncidentErrorOutcome,
} from "./incidentHelpers";

type IncidentDetailModalProps = {
  open: boolean;
  detail: ParcelIncidentDetail | null;
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onDetailChange: (detail: ParcelIncidentDetail) => void;
  onMessage: (message: string) => void;
  /** Sự cố không còn tồn tại/không thuộc tenant → đóng chi tiết, làm mới queue */
  onIncidentGone: (message: string) => void;
};

// BE cho tối đa 100 event mỗi lượt; 50 là default của endpoint.
const HISTORY_PAGE_SIZE = 50;

const TASK_ACTIONABLE_STATUSES = ["OPEN", "IN_PROGRESS"];

export default function IncidentDetailModal({
  open,
  detail,
  isLoading,
  error,
  onClose,
  onDetailChange,
  onMessage,
  onIncidentGone,
}: IncidentDetailModalProps) {
  const { t } = useTranslation("manager");
  // Loại địa điểm dùng chung cho ba chỗ BE ghi dạng `"<LOẠI>:<uuid>"`
  const locationTypeLabel = (type: string) =>
    t(`parcelIncidents.locationTypes.${type}`, {
      defaultValue: type.replaceAll("_", " "),
    });
  // Một số kết quả hệ thống do BE ghi bằng tiếng Anh rồi dùng lại ở cả
  // search task và resolutionNote. Chỉ dịch các câu hệ thống đã biết; ghi chú
  // do người dùng nhập vẫn phải được giữ nguyên.
  const systemMessageLabel = (message: string) => {
    const trimmed = message.trim();

    if (trimmed === "Search SLA expired without a verified found event.") {
      return t(
        "parcelIncidents.searchTaskResults.searchSlaExpiredWithoutVerifiedFound",
      );
    }

    return trimmed;
  };
  const { t: tc } = useTranslation("common");

  const [action, setAction] = useState<IncidentActionKind | null>(null);
  const [actionTask, setActionTask] = useState<ParcelIncidentSearchTask | null>(
    null,
  );
  const [isForwardingOpen, setIsForwardingOpen] = useState(false);
  const [custodyDecision, setCustodyDecision] = useState<
    "APPROVE" | "REJECT" | null
  >(null);
  // Thao tác bị BE chặn vì báo cáo chưa được duyệt (§9). Hiện một lần ngay
  // trên panel duyệt để người dùng biết phải làm gì trước.
  const [approvalRequiredNotice, setApprovalRequiredNotice] = useState("");

  // Lịch sử tải thêm buộc phải đi kèm id của sự cố đã tải nó.
  //
  // Trước đây đây là ba state rời + một effect dọn khi `incidentId` đổi. Effect
  // đó chạy SAU render đầu tiên của sự cố mới, nên có đúng một frame lịch sử
  // của sự cố cũ nằm trong dòng thời gian của sự cố mới. Gắn id vào chính state
  // rồi bỏ qua khi lệch thì không còn khoảng hở đó.
  const [history, setHistory] = useState<{
    incidentId: string;
    events: ParcelCustodyEvent[];
    exhausted: boolean;
    error: string;
  }>({ incidentId: "", events: [], exhausted: false, error: "" });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const incidentId = detail?.incident.incidentId ?? "";
  const isHistoryForCurrentIncident = history.incidentId === incidentId;
  const olderEvents = isHistoryForCurrentIncident ? history.events : [];
  const historyError = isHistoryForCurrentIncident ? history.error : "";
  const historyExhausted = isHistoryForCurrentIncident
    ? history.exhausted
    : detail?.custodyTimeline.nextCursor == null;

  if (!open) return null;

  const incident = detail?.incident;
  // Detail trả `availableActions` ở CẢ hai chỗ: trong `incident` (nguyên văn
  // item của list) và ở cấp detail. Handler luôn dựng bản ở cấp detail (§5.3)
  // nên nó mới là bản phản ánh trạng thái sau mutation — bản trong `incident`
  // có thể là ảnh chụp cũ.
  const availableActions =
    detail?.availableActions ?? incident?.availableActions;
  const timelineItems = detail
    ? mergeCustodyEvents(detail.custodyTimeline.items, olderEvents)
    : [];
  const approvalUi = getCustodyApprovalUi(detail);
  const isAwaitingApproval = approvalUi.kind === "REVIEW_REQUIRED";

  async function loadOlderHistory() {
    if (!detail || isLoadingHistory) return;

    const cursor = oldestSequence({
      items: timelineItems,
      nextCursor: detail.custodyTimeline.nextCursor,
    });
    if (cursor == null) return;

    const targetIncidentId = detail.incident.incidentId;
    setIsLoadingHistory(true);

    try {
      const older = await getOperatorParcelIncident(targetIncidentId, {
        beforeSequence: cursor,
        limit: HISTORY_PAGE_SIZE,
      });
      const items = older.custodyTimeline.items;

      setHistory((current) => {
        const events =
          current.incidentId === targetIncidentId ? current.events : [];

        return {
          incidentId: targetIncidentId,
          events: mergeCustodyEvents(events, items),
          // Hết dữ liệu khi BE trả về rỗng hoặc không còn cursor
          exhausted:
            items.length === 0 || older.custodyTimeline.nextCursor == null,
          error: "",
        };
      });
    } catch (err) {
      const messageText =
        err instanceof Error
          ? err.message
          : t("parcelIncidents.historyLoadFailed");

      setHistory((current) => ({
        incidentId: targetIncidentId,
        events: current.incidentId === targetIncidentId ? current.events : [],
        exhausted:
          current.incidentId === targetIncidentId ? current.exhausted : false,
        error: messageText,
      }));
    } finally {
      setIsLoadingHistory(false);
    }
  }

  function applyMutation(next: ParcelIncidentDetail, successMessage: string) {
    onDetailChange(next);
    onMessage(successMessage);
    setAction(null);
    setActionTask(null);
    setIsForwardingOpen(false);
    setCustodyDecision(null);
    setApprovalRequiredNotice("");
  }

  /**
   * Lỗi cho biết `availableActions` trên tay đã cũ (§9): báo cáo chưa duyệt,
   * sự cố đã đóng, hoặc sự cố không còn tồn tại. Đóng form thao tác rồi nạp
   * lại detail để bộ nút được dựng lại đúng — không bao giờ tự gửi lại request.
   */
  async function handleRecoverableError(
    outcome: IncidentErrorOutcome,
    message: string,
  ) {
    if (outcome === "SHOW" || !incidentId) return;

    setAction(null);
    setActionTask(null);
    setIsForwardingOpen(false);

    // Sự cố biến mất khỏi tenant: nạp lại chi tiết cũng vô nghĩa.
    if (outcome === "GONE") {
      onIncidentGone(message);
      return;
    }

    setApprovalRequiredNotice(
      outcome === "NEEDS_APPROVAL"
        ? t("parcelIncidents.approval.approvalRequired")
        : t("parcelIncidents.approval.stateChanged"),
    );

    try {
      onDetailChange(await getOperatorParcelIncident(incidentId));
    } catch {
      // Nạp lại hỏng thì vẫn giữ nguyên detail cũ kèm cảnh báo phía trên
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        wide
        icon={<FiAlertTriangle size={20} />}
        title={t("parcelIncidents.detailTitle")}
        subtitle={incident?.parcel?.parcelCode}
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {/* Chỉ những hành động BE cho phép mới hiện — không suy từ status.
                Khi báo cáo còn chờ duyệt, `availableActions` chỉ có
                APPROVE/REJECT nên toàn bộ nhóm nút bên dưới tự tắt: đó đúng là
                luật "không cho search/mark-found/forward/declare-lost trước
                approval" (§2 mục 7), FE không cần thêm điều kiện riêng. */}
            {/* ASSIGN bị ẩn có chủ đích: dù `availableActions` của BE còn trả
                về, màn chi tiết không bày nút giao nhiệm vụ tìm nữa. */}
            {hasIncidentAction(availableActions, "MARK_FOUND") && (
              <Button
                variant="secondary"
                onClick={() => setAction("MARK_FOUND")}
              >
                {t("parcelIncidents.actions.MARK_FOUND")}
              </Button>
            )}
            {hasIncidentAction(availableActions, "FORWARD") && (
              <Button
                variant="secondary"
                leadingIcon={<FiNavigation size={15} />}
                onClick={() => setIsForwardingOpen(true)}
              >
                {t("parcelIncidents.actions.FORWARD")}
              </Button>
            )}
            {hasIncidentAction(availableActions, "DECLARE_LOST") && (
              <Button
                variant="danger"
                onClick={() => setAction("DECLARE_LOST")}
              >
                {t("parcelIncidents.actions.DECLARE_LOST")}
              </Button>
            )}
            {hasIncidentAction(availableActions, "RESOLVE") && (
              <Button variant="primary" onClick={() => setAction("RESOLVE")}>
                {t("parcelIncidents.actions.RESOLVE")}
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              {tc("close")}
            </Button>
          </div>
        }
      >
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : isLoading || !detail || !incident ? (
          <p className="rounded-lg bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
            {tc("loading")}
          </p>
        ) : (
          <div className="space-y-5">
            {approvalRequiredNotice && (
              <p
                role="alert"
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                {approvalRequiredNotice}
              </p>
            )}

            {/* Panel duyệt đứng ĐẦU chi tiết: khi còn chờ duyệt thì đây là việc
                duy nhất làm được, mọi phần bên dưới chỉ là dữ liệu đối chiếu. */}
            {approvalUi.kind !== "NONE" && (
              <CustodyApprovalPanel
                ui={approvalUi}
                detail={detail}
                disabled={custodyDecision !== null}
                onDecide={setCustodyDecision}
              />
            )}

            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-lg font-bold text-gray-900">
                    <FiPackage className="text-vr-900" aria-hidden="true" />
                    {incident.parcel?.parcelCode ||
                      t("parcelIncidents.unknownParcel")}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {incident.parcel?.description?.trim() ||
                      t("parcelIncidents.noDescription")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="neutral">
                    {t(`parcelIncidents.type.${incident.type}`, {
                      defaultValue: incident.type,
                    })}
                  </Badge>
                  <Badge tone={incidentStatusTone(incident.status)}>
                    {t(`parcelIncidents.status.${incident.status}`, {
                      defaultValue: incident.status,
                    })}
                  </Badge>
                  {incident.sla?.state && (
                    <Badge tone={slaTone(incident.sla.state)}>
                      {t(`parcelIncidents.sla.${incident.sla.state}`, {
                        defaultValue: incident.sla.state,
                      })}
                    </Badge>
                  )}
                </div>
              </div>

              <dl className="mt-4 grid gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm sm:grid-cols-3">
                <DetailItem
                  label={t("parcelIncidents.createdAt")}
                  value={formatDateTime(incident.createdAt)}
                />
                {/* Chờ duyệt thì SLA tìm kiếm CHƯA chạy: `searchDeadline` là
                    `null` và chỉ bắt đầu sau khi approve (§2 mục 7, §5). Hiện
                    "-" ở đây làm người dùng tưởng dữ liệu lỗi. */}
                <DetailItem
                  label={t("parcelIncidents.searchDeadline")}
                  value={
                    isAwaitingApproval
                      ? t("parcelIncidents.approval.slaNotStarted")
                      : incident.searchDeadline
                        ? formatDateTime(incident.searchDeadline)
                        : "-"
                  }
                />
                <DetailItem
                  label={t("parcelIncidents.routeLabel")}
                  value={
                    incident.trip?.route?.name ||
                    t("parcelIncidents.unknownRoute")
                  }
                />
                <DetailItem
                  label={t("parcelIncidents.vehicleLabel")}
                  value={
                    incident.trip?.vehicle?.licensePlate ||
                    t("parcelIncidents.unknownVehicle")
                  }
                />
                <DetailItem
                  label={t("parcelIncidents.expectedDropoffLabel")}
                  value={locationLabel(
                    detail.expectedDropoff ?? incident.expectedDropoff,
                    t("parcelIncidents.unknownLocation"),
                  )}
                />
                {/* Chuỗi mô tả nơi kiện ĐÁNG LẼ phải ở, do BE dựng sẵn. Khác
                    `expectedDropoff` (điểm trả theo vận đơn) nên hiện riêng. */}
                {detail.expectedLocation?.trim() && (
                  <DetailItem
                    label={t("parcelIncidents.expectedLocationLabel")}
                    value={locationRefLabel(
                      detail.expectedLocation,
                      locationTypeLabel,
                      t("parcelIncidents.unknownLocation"),
                    )}
                  />
                )}
                <DetailItem
                  label={t("parcelIncidents.declaredValue")}
                  value={
                    incident.parcel?.declaredValueVnd == null
                      ? "-"
                      : `${incident.parcel.declaredValueVnd.toLocaleString("vi-VN")} ₫`
                  }
                />
              </dl>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <PersonCard
                  label={t("parcelIncidents.sender")}
                  displayName={detail.sender?.displayName}
                  phone={detail.sender?.phone}
                />
                <PersonCard
                  label={t("parcelIncidents.recipient")}
                  displayName={detail.recipient?.displayName}
                  phone={detail.recipient?.phone}
                />
                <PersonCard
                  label={t("parcelIncidents.reporter")}
                  displayName={detail.reporter?.displayName}
                  phone={detail.reporter?.phone}
                />
              </div>
            </section>

            {/* Vị trí xác nhận gần nhất — shape ở detail là PHẲNG, khác list */}
            {detail.currentCustody && (
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="text-base font-semibold text-gray-900">
                  {t("parcelIncidents.currentCustodyTitle")}
                </h3>
                <dl className="mt-3 grid gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm sm:grid-cols-3">
                  <DetailItem
                    label={t("parcelIncidents.lastEventType")}
                    value={t(
                      `parcelIncidents.custodyEvents.${detail.currentCustody.lastEventType}`,
                      { defaultValue: detail.currentCustody.lastEventType },
                    )}
                  />
                  <DetailItem
                    label={t("parcelIncidents.lastLocation")}
                    value={locationRefLabel(
                      detail.currentCustody.lastLocationSnapshot,
                      locationTypeLabel,
                      t("parcelIncidents.unknownLocation"),
                    )}
                  />
                  <DetailItem
                    label={t("parcelIncidents.lastConfirmedAt")}
                    value={
                      detail.currentCustody.lastConfirmedAt
                        ? formatDateTime(detail.currentCustody.lastConfirmedAt)
                        : "-"
                    }
                  />
                  <DetailItem
                    label={t("parcelIncidents.trackingConfidence")}
                    value={t(
                      `parcelIncidents.trackingConfidences.${detail.currentCustody.trackingConfidence}`,
                      {
                        defaultValue: detail.currentCustody.trackingConfidence,
                      },
                    )}
                  />
                </dl>
              </section>
            )}

            {/* Trạng thái bàn giao hàng sang chuyến mới — crew xác nhận ở app
                tài xế, màn này chỉ theo dõi (§11.1 mục 7). */}
            {detail.forwardingOperation && (
              <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <FiNavigation aria-hidden="true" />
                  {t("parcelIncidents.forwardingOperationTitle")}
                </h3>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <DetailItem
                    label={t("parcelIncidents.targetTrip")}
                    value={
                      detail.forwardingOperation.targetTrip?.route?.name ||
                      detail.forwardingOperation.targetTrip?.vehicle
                        ?.licensePlate ||
                      t("parcelIncidents.unknownRoute")
                    }
                  />
                  <DetailItem
                    label={t("parcelIncidents.cargoTransferStatus")}
                    value={t(
                      `parcelIncidents.cargoTransferStatuses.${detail.forwardingOperation.cargoTransferStatus}`,
                      {
                        defaultValue:
                          detail.forwardingOperation.cargoTransferStatus ?? "-",
                      },
                    )}
                  />
                  <DetailItem
                    label={t("parcelIncidents.nextHandoffAction")}
                    value={t(
                      `parcelIncidents.handoffActions.${detail.forwardingOperation.nextHandoffAction}`,
                      {
                        defaultValue:
                          detail.forwardingOperation.nextHandoffAction ?? "-",
                      },
                    )}
                  />
                </dl>
              </section>
            )}

            {/* Khiếu nại bồi thường mở cho kiện này. Đây là ĐỌC, không phải
                nơi ra quyết định: quyết định nằm ở hàng đợi Khiếu nại và chỉ
                OPERATOR_ADMIN mới gọi được endpoint decision (§10). */}
            {detail.claim && (
              <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <FiShield aria-hidden="true" />
                  {t("parcelIncidents.claimTitle")}
                </h3>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <DetailItem
                    label={t("parcelIncidents.claimStatus")}
                    value={t(`claims.status.${detail.claim.status}`, {
                      defaultValue: detail.claim.status,
                    })}
                  />
                  <DetailItem
                    label={t("parcelIncidents.claimAward")}
                    value={formatCurrency(detail.claim.totalAwardVnd)}
                  />
                  <DetailItem
                    label={t("parcelIncidents.claimDecisionDeadline")}
                    value={
                      detail.claim.decisionDeadline
                        ? formatDateTime(detail.claim.decisionDeadline)
                        : "-"
                    }
                  />
                </dl>
                {/* Appeal là aggregate RIÊNG: claim gốc vẫn giữ PAID/REJECTED,
                    trạng thái dưới đây là của chính đơn khiếu nại lại (§12). */}
                {detail.claim.appeal && (
                  <p className="mt-3 rounded-lg border border-amber-300 bg-white/70 px-3 py-2 text-sm text-amber-900">
                    {t("parcelIncidents.claimAppealNote", {
                      status: t(
                        `claimAppeals.status.${detail.claim.appeal.status}`,
                        { defaultValue: detail.claim.appeal.status },
                      ),
                      amount: formatCurrency(
                        detail.claim.appeal.supplementaryAwardVnd,
                      ),
                    })}
                  </p>
                )}
                <p className="mt-2 text-xs text-amber-800">
                  {t("parcelIncidents.claimHint")}
                </p>
              </section>
            )}

            {/* Chưa duyệt thì backend chưa tạo task nào — hiện khối rỗng
                "chưa có nhiệm vụ" đọc như một lỗi dữ liệu (§5). Hai task mặc
                định chỉ xuất hiện sau khi approve. */}
            {!isAwaitingApproval && (
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <FiSearch aria-hidden="true" />
                  {t("parcelIncidents.searchTasksTitle")}
                </h3>

                {detail.searchTasks.length === 0 ? (
                  <p className="mt-3 rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                    {t("parcelIncidents.searchTasksEmpty")}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {detail.searchTasks.map((task) => (
                      <li
                        key={task.taskId}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {t(`parcelIncidents.taskTypes.${task.taskType}`, {
                              defaultValue: task.taskType,
                            })}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-600">
                            {locationRefLabel(
                              task.location,
                              locationTypeLabel,
                              t("parcelIncidents.unknownLocation"),
                            )}
                          </p>
                          {task.assignee?.displayName && (
                            <p className="mt-0.5 text-xs text-gray-500">
                              {t("parcelIncidents.assignedTo", {
                                name: task.assignee.displayName,
                              })}
                            </p>
                          )}
                          {task.result?.trim() && (
                            <p className="mt-1 text-xs text-gray-700">
                              {systemMessageLabel(task.result)}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge
                            tone={
                              task.status === "COMPLETED"
                                ? "success"
                                : task.status === "FAILED"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {t(`parcelIncidents.taskStatuses.${task.status}`, {
                              defaultValue: task.status,
                            })}
                          </Badge>
                          {/* Task đã đóng mà ghi lại là 500 ở BE (§6.4) — chỉ mở
                            nút cho task còn đang mở. */}
                          {hasIncidentAction(
                            availableActions,
                            "RECORD_SEARCH",
                          ) &&
                            TASK_ACTIONABLE_STATUSES.includes(task.status) && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setActionTask(task);
                                  setAction("RECORD_SEARCH");
                                }}
                              >
                                {t("parcelIncidents.recordSearchShort")}
                              </Button>
                            )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <FiClock aria-hidden="true" />
                {t("parcelIncidents.custodyTimelineTitle")}
              </h3>

              {timelineItems.length === 0 ? (
                <p className="mt-3 rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  {t("parcelIncidents.custodyTimelineEmpty")}
                </p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {timelineItems.map((event) => (
                    <li
                      key={event.eventId}
                      className="rounded-lg border border-gray-100 px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {t(
                            `parcelIncidents.custodyEvents.${event.eventType}`,
                            {
                              defaultValue: event.eventType,
                            },
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(event.occurredAt)}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-600">
                        {locationRefLabel(
                          event.locationSnapshot,
                          locationTypeLabel,
                          t("parcelIncidents.unknownLocation"),
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {t("parcelIncidents.recordedBy", {
                          role: t(
                            `parcelIncidents.actorRoles.${event.actorRole}`,
                            { defaultValue: event.actorRole },
                          ),
                          source: t(
                            `parcelIncidents.custodySources.${event.source}`,
                            { defaultValue: event.source },
                          ),
                        })}
                      </p>
                      {event.reason?.trim() && (
                        <p className="mt-0.5 text-xs text-amber-700">
                          {/* Cùng đường dịch với timeline ở màn Hàng hóa: mã và
                              câu tiếng Anh của BE ra tiếng Việt, ghi chú nhân sự
                              tự nhập giữ nguyên. */}
                          {parcelReasonLabel(t, event.reason)}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {historyError && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {historyError}
                </p>
              )}

              {timelineItems.length > 0 && !historyExhausted && (
                <div className="mt-3 flex justify-center">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void loadOlderHistory()}
                    disabled={isLoadingHistory}
                  >
                    {isLoadingHistory
                      ? tc("loading")
                      : t("parcelIncidents.loadOlderHistory")}
                  </Button>
                </div>
              )}
            </section>

            {detail.resolvedAt && (
              <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                  <FiCheckCircle aria-hidden="true" />
                  {t("parcelIncidents.resolutionTitle")}
                </h3>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <DetailItem
                    label={t("parcelIncidents.resolutionCodeLabel")}
                    value={t(
                      `parcelIncidents.resolutionCodes.${detail.resolutionCode}`,
                      { defaultValue: detail.resolutionCode ?? "-" },
                    )}
                  />
                  <DetailItem
                    label={t("parcelIncidents.resolvedAt")}
                    value={formatDateTime(detail.resolvedAt)}
                  />
                  <DetailItem
                    label={tc("note")}
                    value={
                      detail.resolutionNote?.trim()
                        ? systemMessageLabel(detail.resolutionNote)
                        : "-"
                    }
                  />
                </dl>
              </section>
            )}
          </div>
        )}
      </Modal>

      {/* `key` theo thao tác + nhiệm vụ: đổi thao tác là form được dựng lại
          sạch, không cần effect dọn state. */}
      <IncidentActionModal
        key={`${incidentId}-${action ?? ""}-${actionTask?.taskId ?? ""}`}
        action={action}
        incidentId={incidentId}
        task={actionTask}
        onClose={() => {
          setAction(null);
          setActionTask(null);
        }}
        onDone={applyMutation}
        onRecoverableError={(outcome, message) =>
          void handleRecoverableError(outcome, message)
        }
      />

      <ForwardingOptionsModal
        open={isForwardingOpen}
        incidentId={incidentId}
        onClose={() => setIsForwardingOpen(false)}
        onDone={applyMutation}
        onRecoverableError={(outcome, message) =>
          void handleRecoverableError(outcome, message)
        }
      />

      {/* `key` theo quyết định: đổi APPROVE↔REJECT là thao tác nghiệp vụ KHÁC
          (§10) nên form được dựng lại cùng một idempotency key mới. */}
      <CustodyDecisionModal
        key={`${incidentId}-${custodyDecision ?? ""}`}
        decision={custodyDecision}
        incidentId={incidentId}
        approval={detail?.custodyExceptionApproval ?? null}
        onClose={() => setCustodyDecision(null)}
        onDecided={applyMutation}
        onIncidentGone={(message) => {
          setCustodyDecision(null);
          onIncidentGone(message);
        }}
      />
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-gray-800" title={value}>
        {value}
      </dd>
    </div>
  );
}

function PersonCard({
  label,
  displayName,
  phone,
}: {
  label: string;
  displayName?: string | null;
  phone?: string | null;
}) {
  const { t } = useTranslation("manager");
  const trimmedPhone = phone?.trim();

  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-gray-500">
        <FiUser size={12} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">
        {displayName?.trim() || t("parcelIncidents.unknownPerson")}
      </p>
      {trimmedPhone ? (
        <a
          href={`tel:${trimmedPhone}`}
          className="mt-0.5 inline-block text-xs font-medium text-vr-900 hover:underline"
        >
          {formatVietnamPhoneForDisplay(trimmedPhone)}
        </a>
      ) : (
        <p className="mt-0.5 text-xs text-gray-500">
          {t("parcelIncidents.noPhone")}
        </p>
      )}
    </div>
  );
}
