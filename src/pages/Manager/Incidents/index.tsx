// Danh sách sự cố do tài xế/phụ xe báo về, phạm vi nhà xe lấy từ JWT.
//
// `OPERATOR_ADMIN` đóng được sự cố qua modal chi tiết; `OPERATOR_STAFF` chỉ đọc.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiEye,
  FiMapPin,
  FiRefreshCw,
  FiUser,
} from "react-icons/fi";
import {
  getOperatorIncident,
  getOperatorIncidents,
  INCIDENT_CATEGORIES,
  type IncidentCategory,
  type IncidentStatus,
  type OperatorIncident,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import CustomSelect from "../../../components/CustomSelect";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import Pagination from "../../../components/Pagination";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { formatDateTime } from "../../../utils/date";
import IncidentDetailModal from "./IncidentDetailModal";
import {
  badgeClassFor,
  categoryBadgeClass,
  inputClass,
  labelClass,
  reporterLabel,
  statusBadgeClass,
} from "./incidentHelpers";

const PAGE_SIZE = 10;

export default function ManagerIncidents() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const [searchParams] = useSearchParams();
  // Deep-link từ Trung tâm vận hành: lọc sẵn theo chuyến
  const linkedTripId = searchParams.get("tripId") ?? "";

  const [items, setItems] = useState<OperatorIncident[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<IncidentCategory | "">("");
  const [status, setStatus] = useState<IncidentStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<OperatorIncident | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [resolveMessage, setResolveMessage] = useState("");

  // Chỉ OPERATOR_ADMIN được đóng sự cố; Staff gọi vào sẽ ăn 403 FORBIDDEN
  const canResolve = getAuthUser()?.role === "OPERATOR_ADMIN";

  useToastFeedback({ message: resolveMessage, error: loadError });

  // Search đi thẳng lên BE nên phải debounce; đổi từ khoá thì về trang 1.
  // Bỏ qua lượt chạy đầu: effect này cũng chạy lúc mount và sau đó gọi
  // `setPage(1)` dù người dùng chưa gõ gì — ai bấm sang trang trong khoảng
  // debounce đầu tiên sẽ bị đá ngược về trang 1. Giá trị debounce lúc mount vốn
  // đã bằng ô nhập nên bỏ lượt này không làm lệch state.
  const hasFilterChanged = useRef(false);
  useEffect(() => {
    if (!hasFilterChanged.current) {
      hasFilterChanged.current = true;
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
      setLoadError("");

      try {
        const result = await getOperatorIncidents({
          page,
          pageSize: PAGE_SIZE,
          // Enum gửi dạng chuỗi; BE từ chối giá trị số/ghép
          ...(category ? { category } : {}),
          ...(status ? { status } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(linkedTripId ? { tripId: linkedTripId } : {}),
          // BE hỏi Identity để khớp tên người báo — 503 UPSTREAM_UNAVAILABLE
          // KHÔNG có nghĩa là không có sự cố nào.
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          sortBy: "reportedAt",
          sortDir: "desc",
        });
        if (ignore) return;
        setItems(result.items);
        setTotalItems(result.totalItems);
      } catch (error) {
        if (ignore) return;
        setItems([]);
        setTotalItems(0);
        setLoadError(
          error instanceof Error
            ? error.message
            : tRef.current("incidents.loadFailed"),
        );
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, [category, debouncedSearch, from, linkedTripId, page, reloadKey, status, to]);

  const openDetail = useCallback(async (incident: OperatorIncident) => {
    // Hiện ngay bản ghi của danh sách rồi thay bằng bản chi tiết khi về
    setSelected(incident);
    setIsLoadingDetail(true);
    try {
      const detail = await getOperatorIncident(incident.incidentId);
      setSelected(detail);
    } catch {
      // Danh sách và chi tiết cùng shape — lỗi tải chi tiết thì giữ bản đang có
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  // Thay bản ghi bằng đúng object BE trả về sau khi resolve — không tự dựng
  // `resolvedAt`/`resolvedByUserId` ở client.
  const handleResolved = useCallback((resolved: OperatorIncident) => {
    setSelected(resolved);
    setItems((current) =>
      current.map((item) =>
        item.incidentId === resolved.incidentId ? resolved : item,
      ),
    );
    setResolveMessage(tRef.current("incidents.resolveSuccess"));
  }, []);

  // 409 INCIDENT_ALREADY_RESOLVED: admin khác vừa đóng. Tải lại chi tiết rồi
  // làm mới danh sách để bộ lọc theo trạng thái khớp dữ liệu mới.
  const handleAlreadyResolved = useCallback(async (incidentId: string) => {
    setResolveMessage(tRef.current("incidents.resolveAlreadyResolved"));
    try {
      const detail = await getOperatorIncident(incidentId);
      setSelected(detail);
    } catch {
      // Không tải lại được thì vẫn refresh danh sách bên dưới
    }
    setReloadKey((current) => current + 1);
  }, []);

  function resetFilters() {
    setCategory("");
    setStatus("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("incidents.title")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            {t("incidents.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((current) => current + 1)}
          disabled={isLoading}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw
            size={16}
            className={isLoading ? "animate-spin" : ""}
            aria-hidden="true"
          />
          {tc("refresh")}
        </button>
      </header>

      {linkedTripId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-vr-200 bg-vr-50 px-4 py-3 text-sm text-vr-900">
          <span>{t("incidents.filteredByTrip")}</span>
          <Link
            to={`/manager/operations?tripId=${linkedTripId}`}
            className="font-semibold text-vr-800 hover:underline"
          >
            {t("incidents.viewOnOperations")}
          </Link>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="grid gap-3 border-b border-gray-100 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="lg:col-span-5">
            <span className={labelClass}>{t("incidents.searchLabel")}</span>
            <input
              type="search"
              aria-label={t("incidents.searchLabel")}
              className={inputClass}
              placeholder={t("incidents.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span className={labelClass}>{t("incidents.category")}</span>
            <CustomSelect
              aria-label={t("incidents.category")}
              className={inputClass}
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as IncidentCategory | "");
                setPage(1);
              }}
            >
              <option value="">{tc("all")}</option>
              {INCIDENT_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {t(`incidents.categories.${value}`)}
                </option>
              ))}
            </CustomSelect>
          </label>

          <label>
            <span className={labelClass}>{tc("status")}</span>
            <CustomSelect
              aria-label={tc("status")}
              className={inputClass}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as IncidentStatus | "");
                setPage(1);
              }}
            >
              <option value="">{tc("all")}</option>
              <option value="OPEN">{t("incidents.statuses.OPEN")}</option>
              <option value="RESOLVED">
                {t("incidents.statuses.RESOLVED")}
              </option>
            </CustomSelect>
          </label>

          <label>
            <span className={labelClass}>{t("incidents.from")}</span>
            <CustomDateTimeInput
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            />
          </label>

          <label>
            <span className={labelClass}>{t("incidents.to")}</span>
            <CustomDateTimeInput
              type="date"
              value={to}
              onChange={(event) => {
                // BE bắt to >= from; chặn ngay ở input để khỏi ăn 422
                if (from && event.target.value < from) return;
                setTo(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-11 w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              {tc("reset")}
            </button>
          </div>
        </div>

        {isLoading && items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-500" role="status">
            {tc("loading")}
          </p>
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <FiAlertTriangle
              className="mx-auto text-gray-300"
              size={32}
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium text-gray-700">
              {t("incidents.empty")}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((incident) => (
              <li key={incident.incidentId} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassFor(
                          categoryBadgeClass,
                          incident.category,
                          "bg-gray-100 text-gray-700",
                        )}`}
                      >
                        {t(`incidents.categories.${incident.category}`, {
                          defaultValue: incident.category,
                        })}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClassFor(
                          statusBadgeClass,
                          incident.status,
                          "bg-gray-100 text-gray-700",
                        )}`}
                      >
                        {t(`incidents.statuses.${incident.status}`, {
                          defaultValue: incident.status,
                        })}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(incident.reportedAt)}
                      </span>
                    </div>

                    <p className="mt-2 flex items-start gap-1.5 font-semibold text-gray-900">
                      <FiMapPin
                        className="mt-0.5 shrink-0 text-vr-600"
                        aria-hidden="true"
                      />
                      {incident.trip.route.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                      {incident.description?.trim() ||
                        t("incidents.noDescription")}
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-gray-500">
                      <FiUser size={12} aria-hidden="true" />
                      {reporterLabel(incident, t("incidents.unknownReporter"))}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void openDetail(incident)}
                    className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    <FiEye aria-hidden="true" /> {tc("details")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      </section>

      <IncidentDetailModal
        incident={selected}
        isLoading={isLoadingDetail}
        onClose={() => {
          setSelected(null);
          setResolveMessage("");
        }}
        canResolve={canResolve}
        onResolved={handleResolved}
        onAlreadyResolved={(incidentId) => {
          void handleAlreadyResolved(incidentId);
        }}
      />
    </div>
  );
}
