// Hàng đợi khiếu nại bồi thường kiện hàng (§7 API-Parcel-Operator-2026-08-21.md).
//
// Danh sách là screen-ready: BE đã enrich parcel/sender/incident/trip, số chứng
// từ, mức đền và `availableActions` cho từng dòng, nên màn KHÔNG gọi detail cho
// mỗi row (§11.4).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiEye, FiPackage, FiRefreshCw } from "react-icons/fi";
import {
  getOperatorParcelClaim,
  getOperatorParcelClaims,
  PARCEL_CLAIM_STATUSES,
  SLA_STATES,
  type ParcelClaimDetail,
  type ParcelClaimListItem,
  type ParcelClaimListParams,
  type ParcelClaimStatus,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import Pagination from "../../../components/Pagination";
import { TableSkeletonRows } from "../../../components/TableSkeletonRows";
import { Badge } from "../../../components/ui/Badge";
import { SearchInput } from "../../../components/ui/SearchInput";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { formatCurrency } from "../../../utils/currency";
import { formatDateTime } from "../../../utils/date";
import { slaTone } from "../../../utils/parcelReliability";
import {
  CANONICAL_DATA_REFRESH_EVENT,
  notifyCanonicalDataRefresh,
} from "../../../utils/canonicalDataRefresh";
import ClaimDetailModal from "./ClaimDetailModal";
import {
  claimErrorTranslationKey,
  claimStatusTone,
  fundingStatusTone,
} from "./claimHelpers";

const PAGE_SIZE = 20;

const COLUMN_COUNT = 6;

export default function ClaimsPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  // Endpoint decision chỉ nhận OPERATOR_ADMIN; staff vào được hàng đợi nhưng
  // không được thấy nút duyệt.
  const canDecide = getAuthUser()?.role === "OPERATOR_ADMIN";

  const [items, setItems] = useState<ParcelClaimListItem[]>([]);
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

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [slaState, setSlaState] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [detail, setDetail] = useState<ParcelClaimDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  // Mở nhanh hai dòng liên tiếp: lượt nạp về sau không được ghi đè cái đang mở
  const detailRequestRef = useRef("");

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useToastFeedback({ message, error });

  // Search đi thẳng lên BE nên phải debounce. Bỏ qua lượt chạy đầu để người
  // dùng bấm sang trang trong khoảng debounce đầu tiên không bị đá về trang 1.
  const hasSearchChanged = useRef(false);
  useEffect(() => {
    if (!hasSearchChanged.current) {
      hasSearchChanged.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setIsLoading(true);
      setError("");

      const params: ParcelClaimListParams = {
        page,
        pageSize: PAGE_SIZE,
        ...(status ? { status: status as ParcelClaimStatus } : {}),
        ...(slaState ? { slaState } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      };

      try {
        const result = await getOperatorParcelClaims(params);
        if (ignore) return;

        // Claim xử lý xong có thể làm trang cuối biến mất — lùi về trang cuối
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
            tRef.current(
              claimErrorTranslationKey(err, "claims.loadFailed"),
            ),
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
  }, [debouncedSearch, from, page, refreshVersion, slaState, status, to]);

  const openDetail = useCallback(async (claimId: string) => {
    detailRequestRef.current = claimId;
    setIsLoadingDetail(true);
    setDetailError("");
    setDetail(null);

    try {
      const result = await getOperatorParcelClaim(claimId);
      if (detailRequestRef.current !== claimId) return;
      setDetail(result);
    } catch (err) {
      if (detailRequestRef.current !== claimId) return;
      setDetailError(
        tRef.current(
          claimErrorTranslationKey(err, "claims.detailLoadFailed"),
        ),
      );
    } finally {
      if (detailRequestRef.current === claimId) {
        setIsLoadingDetail(false);
      }
    }
  }, []);

  useEffect(() => {
    function refreshCanonicalData() {
      setRefreshVersion((current) => current + 1);

      const openClaimId = detailRequestRef.current;
      if (!openClaimId) return;
      void getOperatorParcelClaim(openClaimId)
        .then((fresh) => {
          if (detailRequestRef.current === openClaimId) setDetail(fresh);
        })
        .catch(() => {
          // Giữ detail đang xem khi lượt làm mới nền tạm lỗi; list load phía
          // trên vẫn đưa lỗi qua toast và người dùng có thể refresh lại.
        });
    }

    window.addEventListener(
      CANONICAL_DATA_REFRESH_EVENT,
      refreshCanonicalData,
    );
    return () =>
      window.removeEventListener(
        CANONICAL_DATA_REFRESH_EVENT,
        refreshCanonicalData,
      );
  }, []);

  function closeDetail() {
    detailRequestRef.current = "";
    setDetail(null);
    setDetailError("");
    setIsLoadingDetail(false);
  }

  const activeFilterCount = useMemo(
    () => [status, slaState, from, to].filter((value) => Boolean(value)).length,
    [from, slaState, status, to],
  );

  function clearFilters() {
    setStatus("");
    setSlaState("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  const isDetailOpen =
    isLoadingDetail || detail !== null || Boolean(detailError);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("claims.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            {t("claims.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessage("");
            notifyCanonicalDataRefresh();
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
        {/* Cùng quy ước nhãn nổi với màn Báo cáo sự cố và hàng đợi sự cố kiện. */}
        <div className="border-b border-gray-100 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SearchInput
              wrapperClassName="min-w-0 sm:col-span-2 lg:col-span-5"
              labelClassName={labelClass}
              inputClassName={`${inputClass} min-h-11 pl-10`}
              label={t("claims.searchLabel")}
              placeholder={t("claims.searchPlaceholder")}
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
            />

            <label className="min-w-0">
              <span className={labelClass}>{t("claims.statusFilter")}</span>
              <CustomSelect
                aria-label={t("claims.statusFilter")}
                className={inputClass}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{tc("all")}</option>
                {PARCEL_CLAIM_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {t(`claims.status.${value}`)}
                  </option>
                ))}
              </CustomSelect>
            </label>
            <label className="min-w-0">
              <span className={labelClass}>{t("claims.slaFilter")}</span>
              <CustomSelect
                aria-label={t("claims.slaFilter")}
                className={inputClass}
                value={slaState}
                onChange={(event) => {
                  setSlaState(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{tc("all")}</option>
                {SLA_STATES.map((value) => (
                  <option key={value} value={value}>
                    {t(`parcelIncidents.sla.${value}`)}
                  </option>
                ))}
              </CustomSelect>
            </label>

            {/* `from`/`to` ở endpoint này là DATETIME giống hàng đợi sự cố. */}
            <label className="min-w-0">
              <span className={labelClass}>{t("claims.fromLabel")}</span>
              <CustomDateTimeInput
                type="datetime-local"
                aria-label={t("claims.fromLabel")}
                value={from}
                max={to || undefined}
                placeholder={tc("dateTimePicker.selectDateTime")}
                onChange={(event) => {
                  if (to && event.target.value > to) return;
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="min-w-0">
              <span className={labelClass}>{t("claims.toLabel")}</span>
              <CustomDateTimeInput
                type="datetime-local"
                aria-label={t("claims.toLabel")}
                value={to}
                min={from || undefined}
                placeholder={tc("dateTimePicker.selectDateTime")}
                onChange={(event) => {
                  if (from && event.target.value < from) return;
                  setTo(event.target.value);
                  setPage(1);
                }}
              />
            </label>

            {activeFilterCount > 0 && (
              <div className="flex min-w-0 items-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  {t("claims.clearFilters", { count: activeFilterCount })}
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
                  {t("claims.parcelColumn")}
                </th>
                <th className="px-5 py-3 text-left">
                  {t("claims.senderColumn")}
                </th>
                <th className="px-5 py-3 text-center">
                  {t("claims.statusColumn")}
                </th>
                <th className="px-5 py-3 text-right">
                  {t("claims.awardColumn")}
                </th>
                <th className="px-5 py-3 text-center">
                  {t("claims.deadlineColumn")}
                </th>
                <th className="px-5 py-3 text-center">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && items.length === 0 && (
                <TableSkeletonRows
                  columns={COLUMN_COUNT}
                  testId="claims-table-skeleton"
                  cellClassName="px-5 py-4"
                />
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMN_COUNT}
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                    <FiPackage
                      className="mx-auto mb-3 text-gray-300"
                      size={28}
                      aria-hidden="true"
                    />
                    {/* Rỗng vì lọc khác hẳn rỗng vì chưa có khiếu nại nào */}
                    {activeFilterCount > 0 || debouncedSearch
                      ? t("claims.filteredEmpty")
                      : t("claims.empty")}
                  </td>
                </tr>
              )}
              {items.map((claim) => (
                <ClaimRow
                  key={claim.claimId}
                  claim={claim}
                  onOpenDetail={() => void openDetail(claim.claimId)}
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

      <ClaimDetailModal
        open={isDetailOpen}
        detail={detail}
        isLoading={isLoadingDetail}
        error={detailError}
        canDecide={canDecide}
        onClose={closeDetail}
        onDetailChange={(next) => {
          // Mutation trả detail mới — thay thẳng vào state, không refetch.
          // Danh sách vẫn phải tải lại vì trạng thái/mức đền của dòng đã đổi.
          setDetail(next);
          setRefreshVersion((current) => current + 1);
        }}
        onMessage={setMessage}
      />
    </div>
  );
}

function ClaimRow({
  claim,
  onOpenDetail,
}: {
  claim: ParcelClaimListItem;
  onOpenDetail: () => void;
}) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
      <td className="px-5 py-4">
        <p className="font-semibold text-gray-900">
          {claim.parcel?.parcelCode || t("claims.unknownParcel")}
        </p>
        <p className="mt-0.5 text-xs text-gray-600">
          {claim.parcel?.description?.trim() || t("claims.noDescription")}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {t("claims.evidenceBadge", { count: claim.evidenceCount })}
        </p>
      </td>
      <td className="px-5 py-4 text-gray-600">
        <p className="font-medium text-gray-800">
          {claim.sender?.displayName?.trim() || t("claims.unknownPerson")}
        </p>
        <p className="mt-0.5 text-xs">
          {claim.trip?.route?.name || t("claims.unknownRoute")}
        </p>
      </td>
      <td className="px-5 py-4 text-center">
        <Badge tone={claimStatusTone(claim.status)}>
          {t(`claims.status.${claim.status}`, {
            defaultValue: t("claims.status.UNKNOWN"),
          })}
        </Badge>
        <div className="mt-1.5">
          <Badge tone={fundingStatusTone(claim.fundingStatus)}>
            {t(`claims.funding.${claim.fundingStatus}`, {
              defaultValue: t("claims.funding.UNKNOWN"),
            })}
          </Badge>
        </div>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums">
        <p className="font-semibold text-gray-900">
          {formatCurrency(claim.totalAwardVnd)}
        </p>
        <p className="mt-0.5 text-xs text-gray-600">
          {t("claims.awardBreakdown", {
            cargo: formatCurrency(claim.cargoAwardVnd),
            freight: formatCurrency(claim.freightRefundVnd),
          })}
        </p>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-center">
        {claim.slaState && (
          <Badge tone={slaTone(claim.slaState)}>
            {t(`parcelIncidents.sla.${claim.slaState}`, {
              defaultValue: t("parcelIncidents.sla.UNKNOWN"),
            })}
          </Badge>
        )}
        <p className="mt-1 text-xs text-gray-600">
          {claim.deadline ? formatDateTime(claim.deadline) : "-"}
        </p>
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
