// Hàng đợi khiếu nại lại (§12 playbook Parcel Reliability v2).
//
// Ba luật của tài liệu quyết định màn này:
// - Appeal là AGGREGATE RIÊNG, có queue/detail/status riêng. Không duyệt hàng
//   đợi khiếu nại để tìm appeal, và không đổi claim gốc thành `APPEALED`.
// - Chỉ `OPERATOR_ADMIN` thấy nút quyết định; staff chỉ đọc.
// - Payload appeal CHỈ có tiền và ID. Ngữ cảnh kiện/khách nằm ở claim gốc và
//   được nạp trong màn chi tiết, không nạp cho từng dòng.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiEye, FiInbox, FiRefreshCw } from "react-icons/fi";
import {
  getOperatorParcelClaimAppeal,
  getOperatorParcelClaimAppeals,
  PARCEL_CLAIM_APPEAL_STATUSES,
  type ParcelClaimAppeal,
  type ParcelClaimAppealListParams,
  type ParcelClaimAppealStatus,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import CustomSelect from "../../../components/CustomSelect";
import Pagination from "../../../components/Pagination";
import { TableSkeletonRows } from "../../../components/TableSkeletonRows";
import { Badge } from "../../../components/ui/Badge";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { formatCurrency } from "../../../utils/currency";
import { formatDateTime } from "../../../utils/date";
import AppealDetailModal from "./AppealDetailModal";
import { appealStatusTone } from "./appealHelpers";

const PAGE_SIZE = 20;

const COLUMN_COUNT = 6;

export default function ClaimAppealsPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  // Endpoint decision chỉ nhận OPERATOR_ADMIN; staff vào được hàng đợi nhưng
  // không được thấy nút quyết định.
  const canDecide = getAuthUser()?.role === "OPERATOR_ADMIN";

  const [items, setItems] = useState<ParcelClaimAppeal[]>([]);
  const [pageMeta, setPageMeta] = useState({
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  // Allow-list của endpoint chỉ có `status`, `page`, `pageSize` — không có
  // search/slaState/from/to như hai hàng đợi kia. Đừng bày ô lọc mà BE bỏ qua.
  const [status, setStatus] = useState("");

  const [detail, setDetail] = useState<ParcelClaimAppeal | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  // Mở nhanh hai dòng liên tiếp: lượt nạp về sau không được ghi đè cái đang mở
  const detailRequestRef = useRef("");

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useToastFeedback({ message, error });

  useEffect(() => {
    let ignore = false;

    async function load() {
      setIsLoading(true);
      setError("");

      const params: ParcelClaimAppealListParams = {
        page,
        pageSize: PAGE_SIZE,
        ...(status ? { status: status as ParcelClaimAppealStatus } : {}),
      };

      try {
        const result = await getOperatorParcelClaimAppeals(params);
        if (ignore) return;

        // Appeal xử lý xong có thể làm trang cuối biến mất — lùi về trang cuối
        // theo `totalPages` của BE thay vì hiện bảng rỗng.
        const lastPage = Math.max(1, result.totalPages);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }

        setItems(result.items);
        setPageMeta({
          totalItems: result.totalItems,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        });
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : tRef.current("claimAppeals.loadFailed"),
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, [page, refreshVersion, status]);

  const openDetail = useCallback(async (appealId: string) => {
    detailRequestRef.current = appealId;
    setIsLoadingDetail(true);
    setDetailError("");
    setDetail(null);

    try {
      const result = await getOperatorParcelClaimAppeal(appealId);
      if (detailRequestRef.current !== appealId) return;
      setDetail(result);
    } catch (err) {
      if (detailRequestRef.current !== appealId) return;
      setDetailError(
        err instanceof Error
          ? err.message
          : tRef.current("claimAppeals.detailLoadFailed"),
      );
    } finally {
      if (detailRequestRef.current === appealId) {
        setIsLoadingDetail(false);
      }
    }
  }, []);

  function closeDetail() {
    detailRequestRef.current = "";
    setDetail(null);
    setDetailError("");
    setIsLoadingDetail(false);
  }

  const isDetailOpen =
    isLoadingDetail || detail !== null || Boolean(detailError);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("claimAppeals.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            {t("claimAppeals.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessage("");
            setRefreshVersion((current) => current + 1);
          }}
          disabled={isLoading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw
            size={18}
            className={isLoading ? "animate-spin" : ""}
            aria-hidden="true"
          />
          {tc("refresh")}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="min-w-0">
              <span className={labelClass}>
                {t("claimAppeals.statusFilter")}
              </span>
              <CustomSelect
                aria-label={t("claimAppeals.statusFilter")}
                className={inputClass}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{tc("all")}</option>
                {PARCEL_CLAIM_APPEAL_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {t(`claimAppeals.status.${value}`)}
                  </option>
                ))}
              </CustomSelect>
            </label>

            {status && (
              <div className="flex min-w-0 items-end">
                <button
                  type="button"
                  onClick={() => {
                    setStatus("");
                    setPage(1);
                  }}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  {t("claimAppeals.clearFilters", { count: 1 })}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto" aria-busy={isLoading}>
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3 text-left">
                  {t("claimAppeals.appealColumn")}
                </th>
                <th className="px-5 py-3 text-left">
                  {t("claimAppeals.reasonColumn")}
                </th>
                <th className="px-5 py-3 text-center">
                  {t("claimAppeals.statusColumn")}
                </th>
                <th className="px-5 py-3 text-right">
                  {t("claimAppeals.awardColumn")}
                </th>
                <th className="px-5 py-3 text-center">
                  {t("claimAppeals.payoutColumn")}
                </th>
                <th className="px-5 py-3 text-center">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && items.length === 0 && (
                <TableSkeletonRows
                  columns={COLUMN_COUNT}
                  testId="claim-appeals-table-skeleton"
                  cellClassName="px-5 py-4"
                />
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMN_COUNT}
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                    <FiInbox
                      className="mx-auto mb-3 text-gray-300"
                      size={28}
                      aria-hidden="true"
                    />
                    {status
                      ? t("claimAppeals.filteredEmpty")
                      : t("claimAppeals.empty")}
                  </td>
                </tr>
              )}
              {items.map((appeal) => (
                <AppealRow
                  key={appeal.appealId}
                  appeal={appeal}
                  onOpenDetail={() => void openDetail(appeal.appealId)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={pageMeta.totalItems}
          totalPages={pageMeta.totalPages}
          hasNextPage={pageMeta.hasNextPage}
          hasPreviousPage={pageMeta.hasPreviousPage}
          onPageChange={setPage}
        />
      </div>

      <AppealDetailModal
        open={isDetailOpen}
        appeal={detail}
        isLoading={isLoadingDetail}
        error={detailError}
        canDecide={canDecide}
        onClose={closeDetail}
        onAppealChange={(next) => {
          // Decision trả về chính object appeal đã cập nhật — thay thẳng vào
          // state, không refetch. Danh sách vẫn phải tải lại vì trạng thái và
          // số tiền của dòng đã đổi.
          setDetail(next);
          setRefreshVersion((current) => current + 1);
        }}
        onMessage={setMessage}
      />
    </div>
  );
}

function AppealRow({
  appeal,
  onOpenDetail,
}: {
  appeal: ParcelClaimAppeal;
  onOpenDetail: () => void;
}) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
      <td className="px-5 py-4">
        {/* Payload appeal không có mã kiện — hiện 8 ký tự đầu của ID để đối
            chiếu nhanh, phần còn lại nằm ở màn chi tiết cùng dữ liệu claim. */}
        <p className="font-semibold text-gray-900">
          {t("claimAppeals.appealRef", {
            ref: appeal.appealId.slice(0, 8).toUpperCase(),
          })}
        </p>
        <p className="mt-0.5 text-xs text-gray-600">
          {formatDateTime(appeal.submittedAt)}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {t("claimAppeals.originalClaimStatus", {
            status: t(`claims.status.${appeal.originalClaimStatus}`, {
              defaultValue: appeal.originalClaimStatus,
            }),
          })}
        </p>
      </td>
      <td className="max-w-xs px-5 py-4 text-gray-700">
        <p className="line-clamp-3">{appeal.reason}</p>
      </td>
      <td className="px-5 py-4 text-center">
        <Badge tone={appealStatusTone(appeal.status)}>
          {t(`claimAppeals.status.${appeal.status}`, {
            defaultValue: appeal.status,
          })}
        </Badge>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums">
        {/* Con số đáng chú ý là KHOẢN BỔ SUNG — đó là phần duy nhất được đẩy
            sang Payment; tổng gốc/điều chỉnh chỉ để đối chiếu. */}
        <p className="font-semibold text-gray-900">
          {formatCurrency(appeal.supplementaryAwardVnd)}
        </p>
        <p className="mt-0.5 text-xs text-gray-600">
          {t("claimAppeals.awardBreakdown", {
            original: formatCurrency(appeal.originalTotalAwardVnd),
            revised: formatCurrency(appeal.revisedTotalAwardVnd),
          })}
        </p>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-center text-xs text-gray-600">
        {appeal.paidAt ? formatDateTime(appeal.paidAt) : "-"}
      </td>
      <td className="px-5 py-4 text-center">
        <button
          type="button"
          onClick={onOpenDetail}
          title={tc("details")}
          aria-label={tc("details")}
          className="rounded-lg p-1.5 text-vr-900 transition hover:bg-vr-50"
        >
          <FiEye size={16} />
        </button>
      </td>
    </tr>
  );
}
