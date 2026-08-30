// Hàng đợi sự cố kiện hàng (§6 API-Parcel-Operator-2026-08-21.md).
//
// Danh sách là screen-ready: BE đã enrich Parcel/trip/custody/reporter/SLA và
// `availableActions` cho từng dòng, nên màn KHÔNG gọi detail cho mỗi row (§11.4).
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertOctagon,
  FiAlertTriangle,
  FiEye,
  FiPackage,
  FiRefreshCw,
} from "react-icons/fi";
import {
  getOperatorParcelIncident,
  getOperatorParcelIncidents,
  INCIDENT_SLA_STATES,
  PARCEL_INCIDENT_STATUSES,
  PARCEL_INCIDENT_TYPES,
  type ParcelIncidentDetail,
  type ParcelIncidentListItem,
  type ParcelIncidentListParams,
  type ParcelIncidentStatus,
  type ParcelIncidentType,
} from "../../../api/vietride";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import Pagination from "../../../components/Pagination";
import { TableSkeletonRows } from "../../../components/TableSkeletonRows";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { SearchInput } from "../../../components/ui/SearchInput";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { formatDateTime } from "../../../utils/date";
import IncidentDetailModal from "./IncidentDetailModal";
import {
  locationLabel,
  slaTone,
  splitRemainingMinutes,
} from "../../../utils/parcelReliability";
import { incidentStatusTone, isPendingCustodyApproval } from "./incidentHelpers";

const PAGE_SIZE = 20;

const COLUMN_COUNT = 7;

export default function ParcelIncidentsPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  const [items, setItems] = useState<ParcelIncidentListItem[]>([]);
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
  const [type, setType] = useState("");
  const [slaState, setSlaState] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Lọc "chờ duyệt báo cáo" chạy Ở SERVER qua `approvalStatus=PENDING_APPROVAL`
  // (§3 playbook Reliability v2). Trước đây bộ lọc này chạy trên trang đang mở
  // nên số đếm và bảng chỉ đúng trong phạm vi 20 dòng — giờ phân trang và tổng
  // số đều là con số thật của BE.
  const [pendingApprovalOnly, setPendingApprovalOnly] = useState(false);
  // Tổng số báo cáo chờ duyệt của TOÀN hàng đợi, không phải của trang hiện tại.
  // Đếm bằng một request pageSize=1 vì BE không trả badge count riêng.
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  const [detail, setDetail] = useState<ParcelIncidentDetail | null>(null);
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

      const params: ParcelIncidentListParams = {
        page,
        pageSize: PAGE_SIZE,
        // Hàng đợi chờ duyệt được siết Ở SERVER. Không kèm `status` nữa:
        // ràng buộc "pending approval luôn là OPEN" là luật của BE, lặp lại ở
        // đây là dựng lại state machine lần hai.
        ...(pendingApprovalOnly
          ? { approvalStatus: "PENDING_APPROVAL" as const }
          : status
            ? { status: status as ParcelIncidentStatus }
            : {}),
        ...(type ? { type: type as ParcelIncidentType } : {}),
        // §3: sự cố chờ duyệt có `searchDeadline = null` nên mọi filter SLA
        // khác `NOT_STARTED` đều loại nó ra — gửi kèm là bảo đảm bảng rỗng.
        ...(slaState && !pendingApprovalOnly ? { slaState } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      };

      try {
        const result = await getOperatorParcelIncidents(params);
        if (ignore) return;

        // Sự cố được xử lý xong có thể làm trang cuối biến mất — lùi về trang
        // cuối theo `totalPages` của BE thay vì hiện bảng rỗng.
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
              : tRef.current("parcelIncidents.loadFailed"),
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
  }, [
    debouncedSearch,
    from,
    page,
    pendingApprovalOnly,
    refreshVersion,
    slaState,
    status,
    to,
    type,
  ]);

  // Badge "chờ duyệt" phải là tổng của cả hàng đợi, nên đếm bằng một request
  // riêng `pageSize=1` và chỉ đọc `totalItems`. Lỗi ở đây KHÔNG được đẩy lên
  // `error` của bảng: badge sai số là chuyện nhỏ, che mất danh sách mới là to.
  useEffect(() => {
    let ignore = false;

    async function loadPendingCount() {
      try {
        const result = await getOperatorParcelIncidents({
          page: 1,
          pageSize: 1,
          approvalStatus: "PENDING_APPROVAL",
        });
        if (!ignore) setPendingApprovalCount(result.totalItems);
      } catch {
        if (!ignore) setPendingApprovalCount(0);
      }
    }

    void loadPendingCount();
    return () => {
      ignore = true;
    };
  }, [refreshVersion]);

  const openDetail = useCallback(async (incidentId: string) => {
    detailRequestRef.current = incidentId;
    setIsLoadingDetail(true);
    setDetailError("");
    setDetail(null);

    try {
      const result = await getOperatorParcelIncident(incidentId);
      if (detailRequestRef.current !== incidentId) return;
      setDetail(result);
    } catch (err) {
      if (detailRequestRef.current !== incidentId) return;
      setDetailError(
        err instanceof Error
          ? err.message
          : tRef.current("parcelIncidents.detailLoadFailed"),
      );
    } finally {
      if (detailRequestRef.current === incidentId) {
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
    () =>
      [status, type, slaState, from, to].filter((value) => Boolean(value))
        .length + (pendingApprovalOnly ? 1 : 0),
    [from, pendingApprovalOnly, slaState, status, to, type],
  );


  function clearFilters() {
    setStatus("");
    setType("");
    setSlaState("");
    setFrom("");
    setTo("");
    setPendingApprovalOnly(false);
    setPage(1);
  }

  const isDetailOpen = isLoadingDetail || detail !== null || Boolean(detailError);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("parcelIncidents.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            {t("parcelIncidents.subtitle")}
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
        {/* Cùng quy ước với màn Báo cáo sự cố: mỗi ô lọc có nhãn nổi phía trên,
            option rỗng là "Tất cả". Placeholder không thay được nhãn — nó biến
            mất ngay khi chọn giá trị nên nhìn một select đang là "Đang tìm"
            không biết nó lọc theo trạng thái hay theo loại. */}
        <div className="border-b border-gray-100 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <SearchInput
              wrapperClassName="min-w-0 sm:col-span-2 lg:col-span-6"
              labelClassName={labelClass}
              inputClassName={`${inputClass} min-h-11 pl-10`}
              label={t("parcelIncidents.searchLabel")}
              placeholder={t("parcelIncidents.searchPlaceholder")}
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
            />

            <label className="min-w-0">
              <span className={labelClass}>{t("parcelIncidents.statusFilter")}</span>
              <CustomSelect
                aria-label={t("parcelIncidents.statusFilter")}
                className={inputClass}
                // Chờ duyệt luôn là OPEN — để người dùng chọn trạng thái khác
                // chỉ tạo ra một hàng đợi chắc chắn rỗng.
                disabled={pendingApprovalOnly}
                value={pendingApprovalOnly ? "OPEN" : status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{tc("all")}</option>
                {PARCEL_INCIDENT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {t(`parcelIncidents.status.${value}`)}
                  </option>
                ))}
              </CustomSelect>
            </label>
            <label className="min-w-0">
              <span className={labelClass}>{t("parcelIncidents.typeFilter")}</span>
              <CustomSelect
                aria-label={t("parcelIncidents.typeFilter")}
                className={inputClass}
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{tc("all")}</option>
                {PARCEL_INCIDENT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`parcelIncidents.type.${value}`)}
                  </option>
                ))}
              </CustomSelect>
            </label>
            <label className="min-w-0">
              <span className={labelClass}>{t("parcelIncidents.slaFilter")}</span>
              <CustomSelect
                aria-label={t("parcelIncidents.slaFilter")}
                className={inputClass}
                // §5: pending approval bị loại khỏi mọi filter SLA
                disabled={pendingApprovalOnly}
                value={pendingApprovalOnly ? "" : slaState}
                onChange={(event) => {
                  setSlaState(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{tc("all")}</option>
                {INCIDENT_SLA_STATES.map((value) => (
                  <option key={value} value={value}>
                    {t(`parcelIncidents.sla.${value}`)}
                  </option>
                ))}
              </CustomSelect>
            </label>

            {/* `from`/`to` ở endpoint này là DATETIME, không phải date như list
                Parcel — gửi nguyên giá trị `datetime-local` của trình duyệt. */}
            <label className="min-w-0">
              <span className={labelClass}>{t("parcelIncidents.fromLabel")}</span>
              <CustomDateTimeInput
                type="datetime-local"
                aria-label={t("parcelIncidents.fromLabel")}
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
              <span className={labelClass}>{t("parcelIncidents.toLabel")}</span>
              <CustomDateTimeInput
                type="datetime-local"
                aria-label={t("parcelIncidents.toLabel")}
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
                  {t("parcelIncidents.clearFilters", { count: activeFilterCount })}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* "Chờ duyệt" KHÔNG phải một ô lọc nữa mà là một bộ chuyển phạm vi:
            bật nó lên là khoá luôn ô trạng thái và ô hạn xử lý (§5), nên để nó
            đứng lẫn trong khối lọc thì vừa đọc sai nghĩa vừa chiếm trọn một
            hàng. Đặt ngay trên bảng, dạng segmented, thì nó nói đúng việc nó
            làm: đang xem danh sách nào. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-100 px-4 py-3">
          <div
            role="group"
            aria-label={t("parcelIncidents.scopeLabel")}
            className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1"
          >
            <ScopeTab
              active={!pendingApprovalOnly}
              onClick={() => {
                if (!pendingApprovalOnly) return;
                setPendingApprovalOnly(false);
                setPage(1);
              }}
            >
              {t("parcelIncidents.allScope")}
            </ScopeTab>
            <ScopeTab
              active={pendingApprovalOnly}
              onClick={() => {
                if (pendingApprovalOnly) return;
                setPendingApprovalOnly(true);
                setPage(1);
              }}
            >
              <FiAlertOctagon
                size={16}
                className={pendingApprovalCount > 0 ? "text-amber-600" : undefined}
                aria-hidden="true"
              />
              {t("parcelIncidents.approval.pendingFilter")}
              {pendingApprovalCount > 0 && (
                <Badge tone="warning">{pendingApprovalCount}</Badge>
              )}
            </ScopeTab>
          </div>
          {pendingApprovalOnly && (
            <p className="min-w-0 text-xs text-gray-500">
              {t("parcelIncidents.approval.pendingFilterHint")}
            </p>
          )}
        </div>

        <div className="overflow-x-auto" aria-busy={isLoading}>
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3 text-left">
                  {t("parcelIncidents.parcelColumn")}
                </th>
                <th className="px-5 py-3 text-center">
                  {t("parcelIncidents.typeColumn")}
                </th>
                <th className="px-5 py-3 text-left">
                  {t("parcelIncidents.tripColumn")}
                </th>
                <th className="px-5 py-3 text-left">
                  {t("parcelIncidents.custodyColumn")}
                </th>
                <th className="px-5 py-3 text-center">
                  {t("parcelIncidents.tasksColumn")}
                </th>
                <th className="px-5 py-3 text-center">
                  {t("parcelIncidents.slaColumn")}
                </th>
                <th className="px-5 py-3 text-center">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && items.length === 0 && (
                <TableSkeletonRows
                  columns={COLUMN_COUNT}
                  testId="parcel-incidents-table-skeleton"
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
                    {/* Rỗng vì lọc khác hẳn rỗng vì không có sự cố nào. Từ khi
                        lọc chờ duyệt chạy ở server, "rỗng" ở phạm vi chờ duyệt
                        nghĩa là CẢ hàng đợi không còn báo cáo nào phải duyệt. */}
                    {pendingApprovalOnly
                      ? t("parcelIncidents.approval.pendingEmpty")
                      : activeFilterCount > 0 || debouncedSearch
                        ? t("parcelIncidents.filteredEmpty")
                        : t("parcelIncidents.empty")}
                  </td>
                </tr>
              )}
              {items.map((incident) => (
                <IncidentRow
                  key={incident.incidentId}
                  incident={incident}
                  onOpenDetail={() => void openDetail(incident.incidentId)}
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

      <IncidentDetailModal
        open={isDetailOpen}
        detail={detail}
        isLoading={isLoadingDetail}
        error={detailError}
        onClose={closeDetail}
        onDetailChange={(next) => {
          // Mutation trả detail mới — thay thẳng vào state, không refetch
          // (§11.1 mục 4). Danh sách vẫn phải tải lại vì trạng thái/SLA của
          // dòng đó đã đổi.
          setDetail(next);
          setRefreshVersion((current) => current + 1);
        }}
        onMessage={setMessage}
        onIncidentGone={(incidentGoneMessage) => {
          // Sự cố không còn tồn tại: đóng chi tiết rồi nạp lại hàng đợi thay vì
          // để người dùng nhìn một bản chụp đã chết (§9).
          closeDetail();
          setError(incidentGoneMessage);
          setRefreshVersion((current) => current + 1);
        }}
      />
    </div>
  );
}

/**
 * Một nút trong bộ chuyển phạm vi danh sách.
 *
 * Dùng `aria-pressed` chứ không phải `role="tab"`: cặp nút này không lái hai
 * tabpanel riêng mà chỉ đổi tập dòng của cùng một bảng, và role tab còn kéo
 * theo cả hợp đồng điều hướng bằng phím mũi tên mà ở đây không có.
 */
function ScopeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
        active
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-600 hover:bg-white/70 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

function IncidentRow({
  incident,
  onOpenDetail,
}: {
  incident: ParcelIncidentListItem;
  onOpenDetail: () => void;
}) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const sla = incident.sla;
  const remaining =
    sla?.remainingMinutes == null
      ? null
      : splitRemainingMinutes(sla.remainingMinutes);
  // §5: dòng chờ duyệt vẫn mang `status = OPEN`, chỉ `availableActions` phân
  // biệt được. `sla` và `searchDeadline` đều `null` vì SLA chưa bắt đầu chạy.
  const isPendingApproval = isPendingCustodyApproval(incident.availableActions);
  const taskSummary = incident.taskSummary;

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
      <td className="px-5 py-4">
        <p className="font-semibold text-gray-900">
          {incident.parcel?.parcelCode || t("parcelIncidents.unknownParcel")}
        </p>
        <p className="mt-0.5 text-xs text-gray-600">
          {incident.parcel?.description?.trim() ||
            t("parcelIncidents.noDescription")}
        </p>
        {/* Vi phạm quy trình nội bộ: kiện đi tiếp mà không có scan bàn giao —
            nhà xe phải thấy ngay ở hàng đợi chứ không phải mở chi tiết. */}
        {incident.operatorProcessBreach && (
          <Badge tone="danger" className="mt-1.5">
            {t("parcelIncidents.processBreach")}
          </Badge>
        )}
      </td>
      <td className="px-5 py-4 text-center">
        <Badge tone="neutral">
          {t(`parcelIncidents.type.${incident.type}`, {
            defaultValue: incident.type,
          })}
        </Badge>
        <div className="mt-1.5">
          <Badge tone={incidentStatusTone(incident.status)}>
            {t(`parcelIncidents.status.${incident.status}`, {
              defaultValue: incident.status,
            })}
          </Badge>
        </div>
        {isPendingApproval && (
          <div className="mt-1.5">
            <Badge tone="warning">
              {t("parcelIncidents.approval.pendingBadge")}
            </Badge>
          </div>
        )}
      </td>
      <td className="px-5 py-4 text-gray-600">
        <p className="font-medium text-gray-800">
          {incident.trip?.route?.name || t("parcelIncidents.unknownRoute")}
        </p>
        <p className="mt-0.5 text-xs">
          {incident.trip?.vehicle?.licensePlate ||
            t("parcelIncidents.unknownVehicle")}
        </p>
        <p className="mt-0.5 text-xs">
          {t("parcelIncidents.expectedDropoff", {
            location: locationLabel(
              incident.expectedDropoff,
              t("parcelIncidents.unknownLocation"),
            ),
          })}
        </p>
      </td>
      <td className="px-5 py-4 text-gray-600">
        <p className="text-xs font-medium text-gray-800">
          {locationLabel(
            incident.lastCustody?.lastConfirmedLocation,
            incident.lastKnownLocation?.trim() ||
              t("parcelIncidents.unknownLocation"),
          )}
        </p>
        <p className="mt-0.5 text-xs">
          {incident.lastCustody?.lastConfirmedAt
            ? formatDateTime(incident.lastCustody.lastConfirmedAt)
            : "-"}
        </p>
        {/* Đứt mạch scan nghĩa là vị trí đang hiện chỉ là suy đoán */}
        {incident.lastCustody?.hasTrackingGap && (
          <Badge tone="warning" className="mt-1.5">
            {t("parcelIncidents.trackingGap")}
          </Badge>
        )}
      </td>
      <td className="px-5 py-4 text-center tabular-nums text-gray-700">
        {/* `total = 0` nghĩa là backend CHƯA tạo nhiệm vụ nào (chờ duyệt), chứ
            không phải "0/0 chưa hoàn thành" — hiện số ở đây đọc như một lỗi. */}
        {taskSummary && taskSummary.total > 0
          ? t("parcelIncidents.taskProgress", {
              completed: taskSummary.completed,
              total: taskSummary.total,
            })
          : "-"}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-center">
        {/* Chờ duyệt thì KHÔNG có countdown và không tự tính SLA (§5): đồng hồ
            chỉ bắt đầu chạy sau khi báo cáo được duyệt. */}
        {isPendingApproval ? (
          <p className="text-xs text-gray-500">
            {t("parcelIncidents.approval.slaNotStarted")}
          </p>
        ) : (
          <>
            <Badge tone={slaTone(sla?.state)}>
              {t(`parcelIncidents.sla.${sla?.state ?? "UNKNOWN"}`, {
                defaultValue: sla?.state ?? "-",
              })}
            </Badge>
            {remaining && (
              <p className="mt-1 text-xs text-gray-600">
                {remaining.overdue
                  ? t("parcelIncidents.slaOverdue", {
                      hours: remaining.hours,
                      minutes: remaining.minutes,
                    })
                  : t("parcelIncidents.slaRemaining", {
                      hours: remaining.hours,
                      minutes: remaining.minutes,
                    })}
              </p>
            )}
          </>
        )}
      </td>
      <td className="px-5 py-4 text-center">
        <div className="flex items-center justify-center gap-2">
          {/* CTA của dòng chờ duyệt vẫn là "mở chi tiết" — quyết định chỉ được
              đưa ra sau khi xem bằng chứng, không bao giờ ngay tại hàng đợi. */}
          {isPendingApproval ? (
            <Button size="sm" variant="primary" onClick={onOpenDetail}>
              {t("parcelIncidents.approval.reviewCta")}
            </Button>
          ) : (
            <button
              type="button"
              onClick={onOpenDetail}
              title={tc("details")}
              aria-label={tc("details")}
              className="rounded-lg p-1.5 text-vr-900 transition hover:bg-vr-50"
            >
              <FiEye size={16} />
            </button>
          )}
          {incident.claimSummary && (
            <span
              title={t("parcelIncidents.hasClaim")}
              className="inline-flex items-center text-amber-600"
            >
              <FiAlertTriangle size={16} aria-label={t("parcelIncidents.hasClaim")} />
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
