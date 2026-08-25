// Hàng đợi yêu cầu gói riêng của nhà xe: bảng + hai modal duyệt/từ chối.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCheck, FiEye, FiX } from "react-icons/fi";
import CustomSelect from "../../../components/CustomSelect";
import { SearchInput } from "../../../components/ui/SearchInput";
import Pagination from "../../../components/Pagination";
import { TableSkeletonRows } from "../../../components/TableSkeletonRows";
import { Badge, type BadgeTone } from "../../../components/ui/Badge";
import { inputClass } from "../../../components/form/formClasses";
import { formatDateTime } from "../../../utils/date";
import {
  getAdminSubscriptionPlans,
  type CustomPlanRequestStatus,
  type SubscriptionBillingPeriod,
  type SubscriptionPlan,
} from "../../../api/vietride";
import {
  operatorLabel,
  type CustomPlanRequestView,
} from "../../../utils/customPlanRequest";
import ApproveCustomPlanModal from "./ApproveCustomPlanModal";
import CustomRequestDetailModal from "./CustomRequestDetailModal";
import RejectRequestModal from "./RejectRequestModal";
import type { UseCustomPlanRequestsResult } from "./useCustomPlanRequests";

const statusTones: Record<CustomPlanRequestStatus, BadgeTone> = {
  PENDING_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

const STATUS_FILTERS: CustomPlanRequestStatus[] = [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
];

const PERIOD_FILTERS: SubscriptionBillingPeriod[] = ["MONTHLY", "YEARLY"];

// `GET /v1/admin/subscription-plans/custom-requests` trả mảng thuần, không phải
// `PagedResult` và không nhận query nào — nên lọc/phân trang chạy ở client.
// Hàng đợi duyệt vốn ngắn nên đổi contract BE cho việc này là quá tay; nếu sau
// này danh sách phình ra thì mới xin BE chuyển sang paged như các list admin khác.
const PAGE_SIZE = 10;

const COLUMN_COUNT = 7;

type CustomRequestsTabProps = {
  queue: UseCustomPlanRequestsResult;
};

export default function CustomRequestsTab({ queue }: CustomRequestsTabProps) {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [approving, setApproving] = useState<CustomPlanRequestView | null>(
    null,
  );
  const [rejecting, setRejecting] = useState<CustomPlanRequestView | null>(
    null,
  );
  const [viewing, setViewing] = useState<CustomPlanRequestView | null>(null);
  // Gói tiêu chuẩn dùng làm MỐC GIÁ trong modal duyệt. Tải một lần khi mở tab;
  // lỗi thì bỏ qua — mất bảng tham chiếu chứ không chặn việc duyệt.
  const [standardPlans, setStandardPlans] = useState<SubscriptionPlan[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  const { load } = queue;
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void getAdminSubscriptionPlans({ includeInactive: false })
      .then(setStandardPlans)
      .catch(() => setStandardPlans([]));
  }, []);

  // Endpoint trả mảng thuần và không nhận query nào, nên tìm/lọc chạy ở client
  // trên đúng những field có trong response: tên nhà xe, mã yêu cầu, trạng
  // thái, kỳ mong muốn.
  const filteredRequests = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return queue.requests.filter((request) => {
      if (statusFilter && request.status !== statusFilter) return false;
      if (periodFilter && request.preferredBillingPeriod !== periodFilter) {
        return false;
      }
      if (!keyword) return true;

      // Tìm cả theo mã yêu cầu: khi trao đổi với BE hay hỗ trợ nhà xe, admin có
      // sẵn UUID trong tay và cần dán vào để mở đúng dòng.
      return (
        request.operatorName.toLowerCase().includes(keyword) ||
        request.requestId.toLowerCase().includes(keyword)
      );
    });
  }, [periodFilter, queue.requests, searchTerm, statusFilter]);

  const hasActiveFilter = Boolean(
    statusFilter || periodFilter || searchTerm.trim(),
  );

  const pagedRequests = useMemo(
    () => filteredRequests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRequests, page],
  );

  const isEmpty = !queue.isLoading && filteredRequests.length === 0;

  return (
    <div>
      {/* Thanh lọc nằm TRONG cùng khung với bảng, giống PersonnelTable ở các màn
          admin khác — tách thành hai card rời làm hàng lọc trông như một khối
          không liên quan tới bảng bên dưới. */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Bề rộng hai ô lọc đặt theo nhãn DÀI NHẤT của chúng ("Tất cả kỳ mong
            muốn" / "All preferred periods") — 190px cắt cụt mất chữ. Ô tìm kiếm
            nhận phần còn lại nên co lại được mà vẫn đủ rộng để gõ. */}
        <div className="grid gap-3 border-b border-gray-100 p-4 md:grid-cols-[minmax(200px,1fr)_200px_230px]">
          <SearchInput
            label={t("customPlans.searchPlaceholder")}
            placeholder={t("customPlans.searchPlaceholder")}
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
          />
          <CustomSelect
            aria-label={t("customPlans.filterStatus")}
            className={inputClass}
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("customPlans.filterStatus")}</option>
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {t(`customPlans.status.${status}`)}
              </option>
            ))}
          </CustomSelect>
          <CustomSelect
            aria-label={t("customPlans.filterPeriod")}
            className={inputClass}
            value={periodFilter}
            onChange={(event) => {
              setPeriodFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("customPlans.filterPeriod")}</option>
            {PERIOD_FILTERS.map((period) => (
              <option key={period} value={period}>
                {t(`customPlans.billing.${period}`)}
              </option>
            ))}
          </CustomSelect>
        </div>

          <div className="overflow-x-auto" aria-busy={queue.isLoading} tabIndex={0}>
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3 text-left">
                    {t("customPlans.operatorColumn")}
                  </th>
                  <th className="px-5 py-3 text-center">
                    {t("customPlans.sentAtColumn")}
                  </th>
                  <th className="px-5 py-3 text-left">
                    {t("customPlans.scaleColumn")}
                  </th>
                  <th className="px-5 py-3 text-left">
                    {t("customPlans.modulesColumn")}
                  </th>
                  <th className="px-5 py-3 text-center">
                    {t("customPlans.periodColumn")}
                  </th>
                  <th className="px-5 py-3 text-center">
                    {t("customPlans.statusColumn")}
                  </th>
                  <th className="px-5 py-3 text-center">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {/* Skeleton nằm TRONG bảng: mẫu cũ return sớm một dòng chữ nên cả
                    bảng biến mất rồi hiện lại mỗi lượt tải, khác hẳn các màn khác. */}
                {queue.isLoading && queue.requests.length === 0 && (
                  <TableSkeletonRows
                    columns={COLUMN_COUNT}
                    testId="custom-requests-table-skeleton"
                    cellClassName="px-5 py-4"
                  />
                )}
                {isEmpty && (
                  <tr>
                    <td
                      colSpan={COLUMN_COUNT}
                      className="px-5 py-12 text-center text-sm text-gray-500"
                    >
                      {/* Rỗng vì lọc khác hẳn rỗng vì chưa ai gửi yêu cầu */}
                      {hasActiveFilter
                        ? t("customPlans.filteredEmpty")
                        : t("customPlans.empty")}
                    </td>
                  </tr>
                )}
                {pagedRequests.map((request) => (
                  <tr
                    key={request.requestId}
                    data-testid={`custom-request-row-${request.requestId}`}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">
                        {operatorLabel(request)}
                      </p>
                      {/* Chỉ hiện dòng "mã nhà xe" khi phải lùi về id — có tên
                          thật rồi thì nhãn đó chỉ làm rối */}
                      {!request.operatorName ? (
                        <p className="text-xs text-gray-400">
                          {t("customPlans.operatorIdFallback")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-center text-gray-600">
                      {formatDateTime(request.createdAt)}
                    </td>
                    {/* Ba con số quyết định nhất khi duyệt: xe, tuyến, chuyến/tháng */}
                    <td className="px-5 py-4 text-gray-600 tabular-nums">
                      {t("customPlans.scaleSummary", {
                        vehicles: request.quota.maxVehicles.toLocaleString("vi-VN"),
                        routes: request.quota.maxRoutes.toLocaleString("vi-VN"),
                        trips: request.quota.maxTripsPerMonth.toLocaleString("vi-VN"),
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            ["enableParcel", "packages.parcelModule"],
                            ["enableShuttle", "packages.shuttleModule"],
                            ["enableRag", "packages.ragModule"],
                          ] as const
                        )
                          .filter(([key]) => request.quota[key])
                          .map(([key, labelKey]) => (
                            <Badge key={key} tone="brand">
                              {t(labelKey)}
                            </Badge>
                          ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center text-gray-600">
                      {request.preferredBillingPeriod
                        ? t(`customPlans.billing.${request.preferredBillingPeriod}`)
                        : "-"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-center">
                      <Badge tone={statusTones[request.status]}>
                        {t(`customPlans.status.${request.status}`)}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          data-testid={`view-${request.requestId}`}
                          onClick={() => setViewing(request)}
                          title={t("customPlans.viewAction")}
                          aria-label={t("customPlans.viewAction")}
                          className="rounded-lg p-1.5 text-vr-900 transition hover:bg-vr-50"
                        >
                          <FiEye size={16} />
                        </button>
                        {request.status === "PENDING_REVIEW" ? (
                          <>
                            <button
                              type="button"
                              data-testid={`approve-${request.requestId}`}
                              onClick={() => setApproving(request)}
                              title={t("customPlans.approveAction")}
                              aria-label={t("customPlans.approveAction")}
                              className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50"
                            >
                              <FiCheck size={16} />
                            </button>
                            <button
                              type="button"
                              data-testid={`reject-${request.requestId}`}
                              onClick={() => setRejecting(request)}
                              title={t("customPlans.rejectAction")}
                              aria-label={t("customPlans.rejectAction")}
                              className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                            >
                              <FiX size={16} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={filteredRequests.length}
            onPageChange={setPage}
          />
      </section>

      {viewing ? (
        <CustomRequestDetailModal
          key={viewing.requestId}
          request={viewing}
          onClose={() => setViewing(null)}
          onApprove={() => {
            setApproving(viewing);
            setViewing(null);
          }}
          onReject={() => {
            setRejecting(viewing);
            setViewing(null);
          }}
        />
      ) : null}

      {approving ? (
        <ApproveCustomPlanModal
          key={approving.requestId}
          request={approving}
          standardPlans={standardPlans}
          isSaving={queue.isSaving}
          fieldErrors={queue.fieldErrors}
          onClose={() => {
            setApproving(null);
            queue.clearFieldErrors();
          }}
          onSubmit={(payload) => {
            void queue.approve(approving.requestId, payload).then((ok) => {
              // Lỗi theo ô thì GIỮ modal mở để admin sửa đúng chỗ bị đánh dấu
              if (ok) setApproving(null);
            });
          }}
        />
      ) : null}

      {rejecting ? (
        <RejectRequestModal
          key={rejecting.requestId}
          request={rejecting}
          isSaving={queue.isSaving}
          onClose={() => setRejecting(null)}
          onSubmit={(reason) => {
            void queue.reject(rejecting.requestId, reason).then((ok) => {
              if (ok) setRejecting(null);
            });
          }}
        />
      ) : null}
    </div>
  );
}
