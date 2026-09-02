// Duyệt cho chuyến rời điểm dừng còn kiện chưa đối soát (§9 playbook Parcel
// Reliability v2).
//
// KHÔNG có endpoint list/queue cho loại yêu cầu này, nên màn không phải hàng
// đợi mà là màn TRA CỨU theo mã yêu cầu. Mã đó chỉ có hai nguồn hợp lệ:
// - `departureOverrideRequest.requestId` mà app phụ xe nhận được sau khi
//   reconcile điểm dừng, hoặc
// - `error.fields.approvalRequestId` khi chuyến bị chặn rời bến với
//   `409 PARCEL_STOP_RECONCILIATION_REQUIRED`.
//
// Vì vậy đường vào chính là DEEP LINK `?requestId=...` (dán từ thông báo của
// crew); ô nhập chỉ là lối vào dự phòng và chặn chuỗi không phải UUID ngay tại
// chỗ. Tuyệt đối không dùng incident ID ở đây, và duyệt ở đây KHÔNG có nghĩa
// kiện đã mất — không được tạo claim từ màn này.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiPackage,
  FiSearch,
  FiTruck,
  FiXCircle,
} from "react-icons/fi";
import {
  getOperatorParcel,
  getParcelStopDepartureApproval,
  getPublicTrip,
  type ParcelStopDepartureApproval,
  type PublicTrip,
} from "../../../api/vietride";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { formatDateTime } from "../../../utils/date";
import { isUsableUuid } from "../../../utils/parcelReliability";
import DepartureDecisionModal from "./DepartureDecisionModal";
import {
  departureApprovalTone,
  departureErrorTranslationKey,
} from "./departureHelpers";
import { hasIncidentAction } from "../ParcelIncidents/incidentHelpers";

/**
 * Trần số kiện được nạp thêm để hiện mã kiện thay cho UUID. Một điểm dừng chỉ
 * sót vài kiện; đặt trần để một request hỏng dữ liệu không kéo theo hàng trăm
 * lượt gọi.
 */
const MAX_PARCEL_LOOKUPS = 20;

type ParcelLabel = { parcelId: string; parcelCode: string; status: string };

export default function StopDepartureApprovalsPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [searchParams, setSearchParams] = useSearchParams();
  const linkedRequestId = searchParams.get("requestId")?.trim() ?? "";

  const [requestIdInput, setRequestIdInput] = useState(linkedRequestId);
  // Ô nhập bám theo mã trên URL, nhưng người dùng vẫn sửa được. Đồng bộ ngay
  // trong lượt render (pattern có sẵn ở ClaimDecisionModal) chứ không bằng
  // effect: effect chạy SAU render đầu nên có đúng một frame ô nhập còn mã cũ.
  const [syncedRequestId, setSyncedRequestId] = useState(linkedRequestId);
  const [approval, setApproval] = useState<ParcelStopDepartureApproval | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const [parcelLabels, setParcelLabels] = useState<ParcelLabel[]>([]);
  const [tripContext, setTripContext] = useState<{
    tripId: string;
    trip: PublicTrip | null;
  }>({ tripId: "", trip: null });

  // Bấm lại "Tra cứu" với đúng mã đang xem vẫn phải nạp lại — URL không đổi nên
  // effect sẽ không tự chạy lần nữa nếu không có mốc này.
  const [reloadVersion, setReloadVersion] = useState(0);

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useToastFeedback({ message, error });

  if (linkedRequestId !== syncedRequestId) {
    setSyncedRequestId(linkedRequestId);
    setRequestIdInput(linkedRequestId);
  }

  // URL là nguồn sự thật DUY NHẤT của mã đang tra cứu: deep link do crew gửi
  // sang và nút "Tra cứu" đi qua cùng một đường, nên không có hai lối nạp lệch
  // nhau. Lượt nạp cũ bị `ignore` chặn khi mã đổi giữa chừng.
  useEffect(() => {
    if (!linkedRequestId || !isUsableUuid(linkedRequestId)) return;

    let ignore = false;

    async function load(requestId: string) {
      setIsLoading(true);
      setError("");
      setApproval(null);
      setParcelLabels([]);

      try {
        const result = await getParcelStopDepartureApproval(requestId);
        if (!ignore) setApproval(result);
      } catch (err) {
        if (!ignore) {
          setError(
            tRef.current(
              departureErrorTranslationKey(
                err,
                "stopDepartureApprovals.loadFailed",
              ),
            ),
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    void load(linkedRequestId);
    return () => {
      ignore = true;
    };
  }, [linkedRequestId, reloadVersion]);

  // Kiện chưa đối soát chỉ về dưới dạng UUID. Người điều độ không đối chiếu
  // được bằng UUID, nên nạp thêm mã kiện — best-effort, hỏng thì vẫn hiện ID.
  useEffect(() => {
    const ids = approval?.unresolvedParcelIds ?? [];
    if (ids.length === 0) return;

    let ignore = false;

    async function loadParcelLabels(parcelIds: string[]) {
      const results = await Promise.allSettled(
        parcelIds.slice(0, MAX_PARCEL_LOOKUPS).map((id) => getOperatorParcel(id)),
      );
      if (ignore) return;

      setParcelLabels(
        results.flatMap((result) =>
          result.status === "fulfilled"
            ? [
                {
                  parcelId: result.value.parcelId,
                  parcelCode: result.value.parcelCode,
                  status: result.value.status,
                },
              ]
            : [],
        ),
      );
    }

    void loadParcelLabels(ids);
    return () => {
      ignore = true;
    };
  }, [approval]);

  useEffect(() => {
    const tripId = approval?.tripId ?? "";
    if (!tripId) return;

    let ignore = false;
    void getPublicTrip(tripId)
      .then((trip) => {
        if (!ignore) setTripContext({ tripId, trip });
      })
      .catch(() => {
        if (!ignore) setTripContext({ tripId, trip: null });
      });

    return () => {
      ignore = true;
    };
  }, [approval?.tripId]);

  function handleLookup() {
    const requestId = requestIdInput.trim();
    if (!isUsableUuid(requestId)) {
      setApproval(null);
      setError(t("stopDepartureApprovals.invalidRequestId"));
      return;
    }

    // Giữ mã trên URL để tra cứu này chia sẻ/tải lại được; effect ở trên lo
    // phần nạp.
    setSearchParams({ requestId }, { replace: true });
    setReloadVersion((current) => current + 1);
  }

  const canDecide =
    approval !== null &&
    (hasIncidentAction(approval.availableActions, "APPROVE") ||
      hasIncidentAction(approval.availableActions, "REJECT"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t("stopDepartureApprovals.title")}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          {t("stopDepartureApprovals.subtitle")}
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="block" htmlFor="departure-request-id">
          <span className={labelClass}>
            {t("stopDepartureApprovals.requestIdLabel")}
          </span>
        </label>
        {/* `sm:items-center` + nút bậc `lg`: ô nhập cao 50px còn nút mặc định
            `md` chỉ 40px và bị canh mép trên, để thừa 10px hụt ở đáy. `pill`
            cho khớp bo góc viên thuốc của ô nhập đứng ngay cạnh. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="departure-request-id"
            value={requestIdInput}
            onChange={(event) => {
              setRequestIdInput(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleLookup();
            }}
            placeholder={t("stopDepartureApprovals.requestIdPlaceholder")}
            className={inputClass}
          />
          <Button
            variant="primary"
            size="lg"
            pill
            leadingIcon={<FiSearch size={15} />}
            onClick={handleLookup}
            disabled={isLoading}
          >
            {isLoading ? tc("loading") : t("stopDepartureApprovals.lookup")}
          </Button>
        </div>
        {/* Nói rõ mã lấy ở đâu: không có hàng đợi nên người dùng phải biết
            nguồn hợp lệ, thay vì đoán bằng ID sự cố. */}
        <p className="mt-2 text-xs text-gray-600">
          {t("stopDepartureApprovals.requestIdHint")}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {!approval && !error && !isLoading && (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center text-sm text-gray-500">
          <FiTruck
            className="mx-auto mb-3 text-gray-300"
            size={28}
            aria-hidden="true"
          />
          {t("stopDepartureApprovals.empty")}
        </p>
      )}

      {approval && (
        <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <FiTruck className="text-vr-900" aria-hidden="true" />
                {t("stopDepartureApprovals.requestLabel")}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {t("stopDepartureApprovals.requestedBy", {
                  role: t(`parcelIncidents.actorRoles.${approval.requestedByRole}`, {
                    defaultValue: t("stopDepartureApprovals.unknownRole"),
                  }),
                  at: formatDateTime(approval.requestedAt),
                })}
              </p>
            </div>
            <Badge tone={departureApprovalTone(approval.status)}>
              {t(`stopDepartureApprovals.status.${approval.status}`, {
                defaultValue: t("stopDepartureApprovals.unknownStatus"),
              })}
            </Badge>
          </div>

          <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <h2 className="text-sm font-bold text-amber-900">
              {t("stopDepartureApprovals.reasonTitle")}
            </h2>
            <p className="mt-1 whitespace-pre-line text-sm text-amber-900">
              {approval.departureOverrideReason?.trim() ||
                t("stopDepartureApprovals.noReason")}
            </p>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <FiPackage aria-hidden="true" />
              {t("stopDepartureApprovals.unresolvedTitle", {
                count: approval.unresolvedParcelIds.length,
              })}
            </h2>
            {approval.unresolvedParcelIds.length === 0 ? (
              <p className="mt-2 rounded-lg bg-gray-50 px-4 py-4 text-sm text-gray-500">
                {t("stopDepartureApprovals.unresolvedEmpty")}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {approval.unresolvedParcelIds.map((parcelId) => {
                  const label = parcelLabels.find(
                    (item) => item.parcelId === parcelId,
                  );

                  return (
                    <li
                      key={parcelId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <span className="font-semibold text-gray-900">
                        {label?.parcelCode ??
                          t("stopDepartureApprovals.unknownParcel", {
                            index:
                              approval.unresolvedParcelIds.indexOf(parcelId) + 1,
                          })}
                      </span>
                      {label && (
                        <Badge tone="neutral">
                          {/* Trạng thái Parcel dùng từ điển chung
                              `common:enumLabels`, giống màn Hàng hoá. */}
                          {tc(`enumLabels.${label.status}`, {
                            defaultValue: t(
                              "stopDepartureApprovals.unknownStatus",
                            ),
                          })}
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {approval.unresolvedParcelIds.length > MAX_PARCEL_LOOKUPS && (
              <p className="mt-2 text-xs text-gray-500">
                {t("stopDepartureApprovals.parcelLookupLimit", {
                  max: MAX_PARCEL_LOOKUPS,
                })}
              </p>
            )}
          </section>

          <dl className="grid gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm sm:grid-cols-2">
            <DetailItem
              label={t("stopDepartureApprovals.tripLabel")}
              value={
                tripContext.tripId === approval.tripId
                  ? tripContext.trip?.tripCode ||
                    t("stopDepartureApprovals.tripUnavailable")
                  : t("stopDepartureApprovals.loadingTrip")
              }
            />
            <DetailItem
              label={t("stopDepartureApprovals.routeLabel")}
              value={
                tripContext.tripId === approval.tripId && tripContext.trip
                  ? `${tripContext.trip.originStation.name} → ${tripContext.trip.destinationStation.name}`
                  : t("stopDepartureApprovals.tripUnavailable")
              }
            />
            <DetailItem
              label={t("stopDepartureApprovals.departureTimeLabel")}
              value={
                tripContext.tripId === approval.tripId && tripContext.trip
                  ? formatDateTime(tripContext.trip.departureTime)
                  : "-"
              }
            />
            <DetailItem
              label={t("stopDepartureApprovals.stopLabel")}
              value={
                tripContext.tripId === approval.tripId
                  ? tripContext.trip?.stops.find(
                      (stop) => stop.stopId === approval.stopId,
                    )?.name || t("stopDepartureApprovals.unknownStop")
                  : t("stopDepartureApprovals.loadingTrip")
              }
            />
          </dl>

          {approval.reviewedAt && (
            <section className="rounded-lg border border-gray-200 px-4 py-3">
              <h2 className="text-sm font-bold text-gray-900">
                {t("stopDepartureApprovals.reviewTitle")}
              </h2>
              <p className="mt-1 text-sm text-gray-700">
                {t("stopDepartureApprovals.reviewedBy", {
                  role: t(
                    `parcelIncidents.actorRoles.${approval.reviewedByRole}`,
                    {
                      defaultValue: t(
                        "stopDepartureApprovals.unknownRole",
                      ),
                    },
                  ),
                  at: formatDateTime(approval.reviewedAt),
                })}
              </p>
              {approval.reviewNote?.trim() && (
                <p className="mt-1 text-sm text-gray-600">
                  {approval.reviewNote}
                </p>
              )}
            </section>
          )}

          {/* Ranh giới nghiệp vụ quan trọng nhất của màn: duyệt = cho chuyến đi
              tiếp, KHÔNG phải kết luận kiện mất và KHÔNG mở claim (§9). */}
          <p className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <FiAlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" />
            {t("stopDepartureApprovals.scopeNote")}
          </p>

          {canDecide && (
            <div className="flex flex-wrap justify-end gap-2">
              {hasIncidentAction(approval.availableActions, "REJECT") && (
                <Button
                  variant="danger"
                  leadingIcon={<FiXCircle size={15} />}
                  onClick={() => setDecision("REJECT")}
                >
                  {t("stopDepartureApprovals.reject")}
                </Button>
              )}
              {hasIncidentAction(approval.availableActions, "APPROVE") && (
                <Button
                  variant="primary"
                  leadingIcon={<FiCheckCircle size={15} />}
                  onClick={() => setDecision("APPROVE")}
                >
                  {t("stopDepartureApprovals.approve")}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* `key` theo quyết định: đổi APPROVE↔REJECT là thao tác nghiệp vụ KHÁC
          nên form được dựng lại cùng một idempotency key mới. */}
      <DepartureDecisionModal
        key={`${approval?.requestId ?? ""}-${decision ?? ""}`}
        decision={decision}
        approval={approval}
        onClose={() => setDecision(null)}
        onDecided={(next, decisionMessage) => {
          setDecision(null);
          setApproval(next);
          setMessage(decisionMessage);
        }}
      />
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-gray-800" title={value}>
        {value}
      </dd>
    </div>
  );
}
