// Hàng đợi kiện hàng chưa định danh tại bến (§10 API-Parcel-Operator-2026-08-21.md).
//
// Kiện không có tem/mã đến bến được đăng ký ở đây với một mã tạm, rồi ghép với
// Parcel thật qua danh sách ứng viên do BE đề xuất.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiEye, FiHelpCircle, FiPlus, FiRefreshCw } from "react-icons/fi";
import {
  getUnidentifiedPackage,
  getUnidentifiedPackages,
  UNIDENTIFIED_PACKAGE_STATUSES,
  type UnidentifiedPackage,
  type UnidentifiedPackageListParams,
  type UnidentifiedPackageStatus,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Pagination from "../../../components/Pagination";
import { TableSkeletonRows } from "../../../components/TableSkeletonRows";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { SearchInput } from "../../../components/ui/SearchInput";
import { inputClass } from "../../../components/form/formClasses";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { formatDateTime } from "../../../utils/date";
import PackageDetailModal from "./PackageDetailModal";
import RegisterPackageModal from "./RegisterPackageModal";
import { packageStatusTone } from "./unidentifiedHelpers";

const PAGE_SIZE = 20;

const COLUMN_COUNT = 5;

export default function UnidentifiedPackagesPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [items, setItems] = useState<UnidentifiedPackage[]>([]);
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

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [detail, setDetail] = useState<UnidentifiedPackage | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const detailRequestRef = useRef("");

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useToastFeedback({ message, error });

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

      const params: UnidentifiedPackageListParams = {
        page,
        pageSize: PAGE_SIZE,
        ...(status ? { status: status as UnidentifiedPackageStatus } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      };

      try {
        const result = await getUnidentifiedPackages(params);
        if (ignore) return;

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
              : tRef.current("unidentifiedPackages.loadFailed"),
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
  }, [debouncedSearch, page, refreshVersion, status]);

  const openDetail = useCallback(async (packageId: string) => {
    detailRequestRef.current = packageId;
    setIsLoadingDetail(true);
    setDetailError("");
    setDetail(null);

    try {
      const result = await getUnidentifiedPackage(packageId);
      if (detailRequestRef.current !== packageId) return;
      setDetail(result);
    } catch (err) {
      if (detailRequestRef.current !== packageId) return;
      setDetailError(
        err instanceof Error
          ? err.message
          : tRef.current("unidentifiedPackages.detailLoadFailed"),
      );
    } finally {
      if (detailRequestRef.current === packageId) {
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

  const activeFilterCount = useMemo(
    () => (status ? 1 : 0),
    [status],
  );

  const isDetailOpen =
    isLoadingDetail || detail !== null || Boolean(detailError);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("unidentifiedPackages.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            {t("unidentifiedPackages.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <Button variant="primary" onClick={() => setIsRegisterOpen(true)}>
            <FiPlus size={15} />
            {t("unidentifiedPackages.registerAction")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_200px]">
        <SearchInput
          label={t("unidentifiedPackages.searchLabel")}
          placeholder={t("unidentifiedPackages.searchPlaceholder")}
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
        />
        <CustomSelect
          aria-label={t("unidentifiedPackages.statusFilter")}
          className={inputClass}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("unidentifiedPackages.statusFilter")}</option>
          {UNIDENTIFIED_PACKAGE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`unidentifiedPackages.status.${value}`)}
            </option>
          ))}
        </CustomSelect>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto" aria-busy={isLoading}>
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3 text-left">
                  {t("unidentifiedPackages.tagColumn")}
                </th>
                <th className="px-5 py-3 text-left">
                  {t("unidentifiedPackages.locationColumn")}
                </th>
                <th className="px-5 py-3 text-center">
                  {t("unidentifiedPackages.statusColumn")}
                </th>
                <th className="px-5 py-3 text-left">
                  {t("unidentifiedPackages.createdAtColumn")}
                </th>
                <th className="px-5 py-3 text-center">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && items.length === 0 && (
                <TableSkeletonRows
                  columns={COLUMN_COUNT}
                  testId="unidentified-packages-table-skeleton"
                  cellClassName="px-5 py-4"
                />
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMN_COUNT}
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                    <FiHelpCircle
                      className="mx-auto mb-3 text-gray-300"
                      size={28}
                      aria-hidden="true"
                    />
                    {activeFilterCount > 0 || debouncedSearch
                      ? t("unidentifiedPackages.filteredEmpty")
                      : t("unidentifiedPackages.empty")}
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <PackageRow
                  key={item.packageId}
                  packageItem={item}
                  onOpenDetail={() => void openDetail(item.packageId)}
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

      <RegisterPackageModal
        open={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onRegistered={(created, successMessage) => {
          setIsRegisterOpen(false);
          setMessage(successMessage);
          setRefreshVersion((current) => current + 1);
          void openDetail(created.packageId);
        }}
      />

      <PackageDetailModal
        open={isDetailOpen}
        packageItem={detail}
        isLoading={isLoadingDetail}
        error={detailError}
        onClose={closeDetail}
        onPackageChange={(next) => {
          // Mutation match trả về package đã cập nhật nhưng CHƯA enrich lại
          // trip/matchedParcel/availableActions (§10.5) — nạp lại detail để
          // người dùng thấy đúng kiện đã ghép thay vì một bản thiếu dữ liệu.
          setDetail(next);
          setRefreshVersion((current) => current + 1);
          void openDetail(next.packageId);
        }}
        onMessage={setMessage}
      />
    </div>
  );
}

function PackageRow({
  packageItem,
  onOpenDetail,
}: {
  packageItem: UnidentifiedPackage;
  onOpenDetail: () => void;
}) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
      <td className="px-5 py-4">
        <p className="font-semibold text-gray-900">
          {packageItem.temporaryExceptionTag}
        </p>
        <p className="mt-0.5 text-xs text-gray-600">
          {packageItem.description?.trim() ||
            t("unidentifiedPackages.noDescription")}
        </p>
        {packageItem.matchedParcel && (
          <p className="mt-0.5 text-xs text-emerald-700">
            {packageItem.matchedParcel.parcelCode}
          </p>
        )}
      </td>
      <td className="px-5 py-4 text-gray-600">
        <p className="font-medium text-gray-800">
          {packageItem.locationSnapshot?.trim() ||
            t(`parcelIncidents.locationTypes.${packageItem.locationType}`, {
              defaultValue: packageItem.locationType,
            })}
        </p>
        <p className="mt-0.5 text-xs">
          {packageItem.observedWeightKg == null
            ? "-"
            : `${packageItem.observedWeightKg} kg`}
        </p>
      </td>
      <td className="px-5 py-4 text-center">
        <Badge tone={packageStatusTone(packageItem.status)}>
          {t(`unidentifiedPackages.status.${packageItem.status}`, {
            defaultValue: packageItem.status,
          })}
        </Badge>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-gray-600">
        {formatDateTime(packageItem.createdAt)}
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
