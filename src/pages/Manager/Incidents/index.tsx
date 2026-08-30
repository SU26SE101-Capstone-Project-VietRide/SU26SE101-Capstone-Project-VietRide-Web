// Danh sách sự cố do tài xế/phụ xe báo về, phạm vi nhà xe lấy từ JWT.
//
// `OPERATOR_ADMIN` đóng được sự cố qua modal chi tiết. Console không còn phục
// vụ `OPERATOR_STAFF` nên đây là vai trò duy nhất mở được màn này.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiEye,
  FiMapPin,
  FiRefreshCw,
  FiUser,
  FiX,
} from "react-icons/fi";
import {
  getOperatorIncident,
  getOperatorIncidents,
  getOperatorUsers,
  getOperatorVehicles,
  INCIDENT_CATEGORIES,
  type IncidentCategory,
  type IncidentStatus,
  type OperatorIncident,
  type OperatorUser,
  type OperatorVehicle,
} from "../../../api/vietride";
import { fetchAllPages } from "../../../api/pagination";
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
import { Button } from "../../../components/ui/Button";

const PAGE_SIZE = 10;

/** `?page=` nguoi dung sua duoc — so rac thi ve trang 1 thay vi gui NaN len BE */
function pageFromParam(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default function ManagerIncidents() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const [searchParams, setSearchParams] = useSearchParams();

  // URL là nguồn sự thật của cả bộ lọc lẫn sự cố đang mở. Trước đây chúng nằm
  // trong useState nên rời màn để xử lý (bấm "Xem trên Trung tâm vận hành") rồi
  // back về là mất sạch ngữ cảnh: lọc lại từ đầu, tụt về trang 1, modal đóng và
  // phải tự mò lại đúng sự cố vừa xử lý.
  const linkedTripId = searchParams.get("tripId") ?? "";
  const category = (searchParams.get("category") ?? "") as
    | IncidentCategory
    | "";
  const status = (searchParams.get("status") ?? "") as IncidentStatus | "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const debouncedSearch = searchParams.get("search") ?? "";
  const openIncidentId = searchParams.get("incidentId") ?? "";
  const page = pageFromParam(searchParams.get("page"));

  // `setSearchParams` của react-router đổi identity sau mỗi lần URL đổi. Đưa
  // thẳng nó vào deps thì `updateParams` cũng đổi theo, kéo mọi effect nhận nó
  // chạy lại sau từng thao tác lọc — kể cả effect tải chi tiết sự cố. Giữ qua
  // ref để `updateParams` ổn định suốt vòng đời màn.
  const setSearchParamsRef = useRef(setSearchParams);
  useEffect(() => {
    setSearchParamsRef.current = setSearchParams;
  });

  // Ghi vào URL. Mặc định `replace` để back không phải lùi qua từng lần gõ/lọc;
  // `push` khi mở chi tiết để back đóng đúng modal.
  const updateParams = useCallback(
    (changes: Record<string, string | null>, push = false) => {
      setSearchParamsRef.current(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: !push },
      );
    },
    [],
  );

  const [items, setItems] = useState<OperatorIncident[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  // Ô nhập giữ state riêng để gõ cho mượt; giá trị chốt mới đẩy lên `?search=`
  const [search, setSearch] = useState(debouncedSearch);
  const [syncedSearch, setSyncedSearch] = useState(debouncedSearch);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<OperatorIncident | null>(null);
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [resolveMessage, setResolveMessage] = useState("");

  // Xe + nhân sự cho form thay xe trong modal. Gắn với sự cố nào thì lưu kèm id
  // đó để đổi sang sự cố khác là gợi ý ghi chú cũ tự hết hiệu lực.
  const [operatorVehicles, setOperatorVehicles] = useState<OperatorVehicle[]>(
    [],
  );
  const [operatorStaff, setOperatorStaff] = useState<OperatorUser[]>([]);
  const [fleetFailed, setFleetFailed] = useState(false);
  const [tripActionNote, setTripActionNote] = useState<{
    incidentId: string;
    message: string;
  } | null>(null);

  // Đọc trong nhánh catch bất đồng bộ của effect chi tiết — không đưa `selected`
  // vào deps ở đó vì mỗi lần tải xong lại kích hoạt một lượt tải nữa.
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  });

  // Chỉ OPERATOR_ADMIN được đóng sự cố; Staff gọi vào sẽ ăn 403 FORBIDDEN
  const canResolve = getAuthUser()?.role === "OPERATOR_ADMIN";

  useToastFeedback({ message: resolveMessage, error: loadError });

  // Search đi thẳng lên BE nên phải debounce; đổi từ khoá thì về trang 1.
  // So sánh với giá trị đang nằm trên URL thay cho cờ "bỏ qua lượt đầu": lúc
  // mount hai bên vốn đã bằng nhau nên effect tự đứng yên, và ai bấm sang trang
  // trong khoảng debounce đầu tiên cũng không bị đá ngược về trang 1.
  useEffect(() => {
    const next = search.trim();
    if (next === debouncedSearch) return;

    const timer = window.setTimeout(() => {
      updateParams({ search: next || null, page: null });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [debouncedSearch, search, updateParams]);

  // Back/forward hoặc deep-link đổi `?search=` thì ô nhập phải chạy theo, nếu
  // không effect trên sẽ ghi ngược từ khoá cũ và huỷ luôn thao tác back. Chỉnh
  // ngay trong lúc render (React tính lại trước khi vẽ) thay vì trong effect để
  // ô nhập không nháy qua một lượt hiển thị giá trị cũ.
  if (syncedSearch !== debouncedSearch) {
    setSyncedSearch(debouncedSearch);
    if (search.trim() !== debouncedSearch) setSearch(debouncedSearch);
  }

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
  }, [
    category,
    debouncedSearch,
    from,
    linkedTripId,
    page,
    reloadKey,
    status,
    to,
  ]);

  // Chỉ hiện ngay bản ghi của danh sách rồi đẩy id lên URL; effect bên dưới lo
  // phần tải chi tiết cho cả trường hợp vào thẳng bằng `?incidentId=`.
  const openDetail = useCallback(
    (incident: OperatorIncident) => {
      setSelected(incident);
      updateParams({ incidentId: incident.incidentId }, true);
    },
    [updateParams],
  );

  // `?incidentId=` là nguồn sự thật của modal: back từ Trung tâm vận hành, mở
  // link từ thông báo và F5 đều bật lại đúng sự cố thay vì bắt tìm lại tay.
  useEffect(() => {
    if (!openIncidentId) return;

    let ignore = false;
    getOperatorIncident(openIncidentId)
      .then((detail) => {
        if (!ignore) setSelected(detail);
      })
      .catch((error: unknown) => {
        if (ignore) return;
        // Bấm từ danh sách thì đã có sẵn bản ghi cùng shape — giữ nguyên. Vào
        // thẳng bằng id hỏng thì không có gì để hiện: báo lỗi và bỏ id khỏi URL
        // thay vì để một modal rỗng đứng im.
        if (selectedRef.current?.incidentId === openIncidentId) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : tRef.current("incidents.loadFailed"),
        );
        updateParams({ incidentId: null });
      });

    return () => {
      ignore = true;
    };
  }, [detailReloadKey, openIncidentId, updateParams]);

  // Suy ra từ URL, không giữ thêm state: đóng modal chỉ cần xoá `?incidentId=`.
  // Còn `selected` của sự cố cũ thì tự hết hiệu lực vì id không còn khớp.
  const detailIncident =
    selected?.incidentId === openIncidentId ? selected : null;
  const isLoadingDetail = openIncidentId !== "" && detailIncident === null;

  const suggestedNote =
    tripActionNote?.incidentId === openIncidentId ? tripActionNote.message : "";

  // Chỉ nạp khi admin thật sự mở một sự cố chưa xử lý. Vào màn xem danh sách
  // không việc gì phải kéo về toàn bộ xe và nhân sự của nhà xe; và nạp một lần
  // rồi dùng lại cho mọi sự cố mở sau đó.
  const needsFleet = canResolve && detailIncident?.status === "OPEN";
  const hasRequestedFleet = useRef(false);

  /**
   * Nạp xe + nhân sự cho form thay xe. Gọi lại được vì BE trả `422
   * VEHICLE_NOT_ACTIVE` khi xe thay vừa rời `ACTIVE` — handoff 2026-08-30 bắt
   * Web tải lại danh sách rồi yêu cầu chọn xe khác.
   */
  const loadFleetResources = useCallback(async () => {
    try {
      const [vehicleItems, userItems] = await Promise.all([
        fetchAllPages((params) => getOperatorVehicles(params)),
        fetchAllPages((params) => getOperatorUsers(params)),
      ]);
      setOperatorVehicles(vehicleItems);
      setOperatorStaff(userItems);
      setFleetFailed(false);
    } catch {
      // Chỉ hỏng form thay xe — đổi lộ trình và ghi nhận gián đoạn vẫn chạy,
      // nên báo tại chỗ trong modal chứ không chặn cả màn.
      setFleetFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!needsFleet || hasRequestedFleet.current) return;
    hasRequestedFleet.current = true;
    void loadFleetResources();
  }, [loadFleetResources, needsFleet]);

  // Thay xe tạo CHUYẾN MỚI và sự cố vẫn gắn chuyến cũ; đổi lộ trình thì giữ
  // nguyên tripId. Không hành động nào tự đóng sự cố — chỉ điền sẵn câu tổng kết
  // vào ghi chú để người dùng xác nhận, rồi tải lại vì trạng thái chuyến đã đổi.
  const handleTripActionCompleted = useCallback(
    (message: string) => {
      if (!openIncidentId) return;
      setTripActionNote({ incidentId: openIncidentId, message });
      setDetailReloadKey((current) => current + 1);
      setReloadKey((current) => current + 1);
    },
    [openIncidentId],
  );

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
    // Vá tại chỗ ở trên chỉ để khỏi nháy; vẫn phải tải lại danh sách vì bản ghi
    // vừa đóng có thể không còn khớp bộ lọc (`status=OPEN`) và `totalItems` dùng
    // cho phân trang thì đã lệch mất một.
    setReloadKey((current) => current + 1);
  }, []);

  // 409 INCIDENT_ALREADY_RESOLVED: admin khác vừa đóng. Tải lại chi tiết rồi
  // làm mới danh sách để bộ lọc theo trạng thái khớp dữ liệu mới.
  const handleAlreadyResolved = useCallback(() => {
    setResolveMessage(tRef.current("incidents.resolveAlreadyResolved"));
    // Effect theo `?incidentId=` lo phần tải lại chi tiết
    setDetailReloadKey((current) => current + 1);
    setReloadKey((current) => current + 1);
  }, []);

  function resetFilters() {
    // Ô tìm kiếm cũng là bộ lọc: bỏ sót nó thì bấm "Đặt lại" xong danh sách vẫn
    // bị lọc theo từ khoá cũ mà không có gì trên màn giải thích tại sao.
    setSearch("");
    updateParams({
      category: null,
      status: null,
      from: null,
      to: null,
      search: null,
      page: null,
    });
  }

  // Bỏ deep-link `?tripId=` (vào từ thông báo sự cố hoặc Trung tâm vận hành).
  // Không có nút này thì người dùng phải tự sửa URL mới xem được toàn bộ sự cố.
  function clearTripFilter() {
    updateParams({ tripId: null, page: null });
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
        <Button
          variant="secondary"
          onClick={() => setReloadKey((current) => current + 1)}
          disabled={isLoading}
        >
          <FiRefreshCw
            size={16}
            className={isLoading ? "animate-spin" : ""}
            aria-hidden="true"
          />
          {tc("refresh")}
        </Button>
      </header>

      {linkedTripId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-vr-200 bg-vr-50 px-4 py-3 text-sm text-vr-900">
          <span>{t("incidents.filteredByTrip")}</span>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={clearTripFilter}
              className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-vr-800 hover:underline"
            >
              <FiX size={14} aria-hidden="true" />
              {t("incidents.clearTripFilter")}
            </button>
            <Link
              to={`/manager/operations?tripId=${linkedTripId}`}
              className="font-semibold text-vr-800 hover:underline"
            >
              {t("incidents.viewOnOperations")}
            </Link>
          </div>
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
                updateParams({
                  category: event.target.value || null,
                  page: null,
                });
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
                updateParams({
                  status: event.target.value || null,
                  page: null,
                });
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
                updateParams({ from: event.target.value || null, page: null });
              }}
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
                updateParams({ to: event.target.value || null, page: null });
              }}
            />
          </label>

          <div className="flex items-end">
            <Button
              variant="secondary"
              className="!h-12 !w-full !rounded-[9999px] !border-[#bfe1ec] !bg-white !text-[15px] !text-slate-700 !shadow-[0_0_0_1px_rgba(175,219,234,0.18)] hover:bg-gray-50"
              onClick={resetFilters}
            >
              {tc("reset")}
            </Button>
          </div>
        </div>

        {isLoading && items.length === 0 ? (
          <p
            className="px-5 py-12 text-center text-sm text-gray-500"
            role="status"
          >
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
                        className="mt-0.5 shrink-0 text-vr-900"
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

                  <Button
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => openDetail(incident)}
                  >
                    <FiEye aria-hidden="true" /> {tc("details")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={totalItems}
          onPageChange={(next) =>
            updateParams({ page: next > 1 ? String(next) : null })
          }
        />
      </section>

      <IncidentDetailModal
        incident={detailIncident}
        isLoading={isLoadingDetail}
        onClose={() => {
          setResolveMessage("");
          updateParams({ incidentId: null });
        }}
        canResolve={canResolve}
        onResolved={handleResolved}
        onAlreadyResolved={handleAlreadyResolved}
        vehicles={operatorVehicles}
        staff={operatorStaff}
        fleetFailed={fleetFailed}
        onResourcesStale={() => void loadFleetResources()}
        suggestedNote={suggestedNote}
        onTripActionCompleted={handleTripActionCompleted}
      />
    </div>
  );
}
