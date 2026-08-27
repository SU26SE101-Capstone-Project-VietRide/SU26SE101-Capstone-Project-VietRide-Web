// Màn "Chuyến xe": liệt kê TOÀN BỘ chuyến của nhà xe đang đăng nhập qua
// `GET /v1/operator/trips` (operatorId lấy từ JWT claim — không truyền lên).
//
// Khác với màn "Lịch chạy" (`pages/Manager/Trips`): màn kia quản lý LỊCH chạy
// định kỳ (DriverSchedule) — tạo/sửa/gán tài xế; màn này chỉ ĐỌC các chuyến đã
// sinh ra từ lịch đó, để tra cứu theo trạng thái / khoảng ngày / biển số.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiActivity,
  FiAlertTriangle,
  FiCalendar,
  FiUserCheck,
  FiRefreshCw,
  FiSearch,
  FiSettings,
  FiTruck,
} from "react-icons/fi";
import {
  getOperatorTrips,
  openOperatorTripBoarding,
  type OperatorTripListItem,
  type OperatorTripStatus,
  type PagedResult,
} from "../../../api/vietride";
import { ApiRequestError } from "../../../api/client";
import { createIdempotencyKey } from "../../../api/idempotency";
import { getAuthUser } from "../../../auth";
import { ConfirmModal } from "../../../components/ConfirmModal";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import Pagination from "../../../components/Pagination";
import { StatCard } from "../../../components/StatCard";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { formatVietnamPhoneForDisplay } from "../../../utils/phone";
import { formatDateTime } from "../../../utils/date";
import { displayBusinessCode } from "../../../utils/businessCode";
import TripManageModal from "./TripManageModal";

const PAGE_SIZE = 10;

// Bốn ô lọc phải cao bằng nhau: CustomDateTimeInput tự áp `min-h-11` cho nút của
// nó, nên ô tìm kiếm và dropdown cũng phải khai cùng chiều cao, không thì hàng
// lọc bị so le.
const filterControlClass = `${inputClass} min-h-11`;

// Thứ tự hiển thị trong dropdown lọc — bám đúng union OperatorTripStatus của BE.
const tripStatuses: OperatorTripStatus[] = [
  "SCHEDULED",
  "BOARDING",
  "IN_PROGRESS",
  "COMPLETED",
  "DISRUPTED",
  "CANCELLED",
];

// Các trạng thái được đếm riêng cho hàng thẻ số liệu (mỗi cái 1 request pageSize=1,
// chỉ lấy `totalItems`). Đếm lại theo `reloadVersion` thôi — KHÔNG theo bộ lọc/trang,
// nếu không mỗi lần gõ ô tìm kiếm là bắn thêm 3 request.
const summaryStatuses: OperatorTripStatus[] = [
  "IN_PROGRESS",
  "SCHEDULED",
  "DISRUPTED",
];

const emptyPage: PagedResult<OperatorTripListItem> = {
  items: [],
  page: 1,
  pageSize: PAGE_SIZE,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

/**
 * Class (width + padding ngang) của từng cột, tách theo hai layout.
 *
 * Bảng dùng `table-fixed` nên tổng width phải đúng 100% ở CẢ hai trường hợp; để
 * lệch là trình duyệt co giãn theo tỉ lệ và cột hẹp nhất lãnh đủ. `min-w` phải
 * NHỎ HƠN bề ngang vùng nội dung (~1220px ở màn 1536px), nếu không bảng tự rộng
 * hơn khung và sinh thanh cuộn ngang dù từng cột vẫn vừa.
 *
 * Số % dưới đây quy ra từ bề rộng ĐO ĐƯỢC trong chính app (không phải ước
 * lượng), ở bảng hẹp nhất 1200px — trừ padding của ô rồi mới so:
 *
 * | Nội dung                          | Đo được |
 * | --------------------------------- | ------- |
 * | `TRIP-20260824-M5Q7WV3D` mono 12px | 146px   |
 * | Dòng phụ tuyến (mã · A → B)        | ~260px  |
 * | Chữ trong nút mở boarding          | 113px   |
 * | Chuỗi ngày giờ                     | 109px   |
 * | Tên tài xế                         | 89px    |
 * | Biển số                            | 70px    |
 * | Badge trạng thái                   | 77px    |
 *
 * Cột Tuyến là cột duy nhất KHÔNG BAO GIỜ đủ chỗ (dòng phụ ~260px), nên nó là
 * nơi nhận mọi phần dôi ra; các cột khác chỉ cần vừa đủ nội dung của chúng.
 */
const columnClasses = {
  /**
   * Bản OPERATOR_ADMIN — có cột Thao tác. Ngân sách ở 1200px:
   *
   * - `tripCode` 14% = 168px, padding 16 (`px-2`) → 152px cho chuỗi 146px. Ở
   *   `px-3` thì 14% chỉ còn 144px lọt lòng và mã bị cắt — nên phần width nhả
   *   ra cho cột Tài xế được bù lại bằng chính padding, không phải bằng chỗ
   *   đọc mã. 14% + `px-2` là sàn thật sự của cột này.
   * - `route` 19%: không đủ cho dòng phụ nhưng là con số lớn nhất lấy được sau
   *   khi mọi cột khác đã ở mức tối thiểu.
   * - `vehicle` 8% = 96px, padding 24 → 72px cho biển số 70px. Sát, nhưng biển
   *   số Việt Nam không dài hơn được.
   * - `driver` 12% = 144px, padding 24 (`px-2 sm:px-3`) → 120px, so với 100px
   *   của bản 11% + `px-3 sm:px-4`. Tên tài xế đo được 89px là tên NGẮN; họ
   *   tên đầy đủ kiểu "Nguyễn Công Thành" tràn qua 100px và bị cắt mất họ, nên
   *   1% lấy từ `tripCode` cộng với padding hẹp hơn đều dồn vào đây.
   * - `actions` 16% = 192px, padding 24 → 168px cho nút 157px (chữ 113 + icon
   *   16 + gap 8 + padding trong 24). Hạ nữa là nút nong ô và bảng tràn ngang.
   * - `departure`/`arrival` 11% = 132px, padding 32 → 100px cho chuỗi 109px:
   *   thiếu ~9px nên ngày giờ xuống hai dòng. Chấp nhận có chủ đích — đây là
   *   nội dung duy nhất xuống dòng vẫn đọc bình thường.
   */
  withActions: {
    tripCode: "w-[14%] px-2",
    route: "w-[19%] px-3 sm:px-4",
    vehicle: "w-[8%] px-3",
    driver: "w-[12%] px-2 sm:px-3",
    departure: "w-[11%] px-3 sm:px-4",
    arrival: "w-[11%] px-3 sm:px-4",
    status: "w-[9%] px-2 sm:px-3",
    actions: "w-[16%] px-2 sm:px-3",
  },
  readOnly: {
    tripCode: "w-[16%] px-2 sm:px-3",
    route: "w-[22%] px-3 sm:px-5",
    vehicle: "w-[12%] px-3 sm:px-5",
    driver: "w-[17%] px-3 sm:px-4",
    departure: "w-[12%] px-3 sm:px-5",
    arrival: "w-[13%] px-3 sm:px-5",
    status: "w-[8%] px-3 sm:px-5",
    actions: "",
  },
} as const;

function statusClass(status: string) {
  switch (status) {
    case "IN_PROGRESS":
      return "bg-vr-50 text-vr-900";
    case "BOARDING":
      return "bg-sky-50 text-sky-800";
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-800";
    case "DISRUPTED":
      return "bg-amber-50 text-amber-800";
    case "CANCELLED":
      return "bg-red-50 text-red-800";
    case "SCHEDULED":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

/**
 * Giữ hay bỏ `Idempotency-Key` sau một lần mở boarding hỏng (handoff Manual
 * boarding §8).
 *
 * BE cache nguyên status + body của mọi response dưới 500 trong 24 giờ. Nên:
 * - chưa biết BE đã xử lý hay chưa (mất mạng, 5xx, request cùng key còn chạy)
 *   thì phải retry ĐÚNG key cũ, sinh key mới có thể mở boarding hai lần;
 * - đã có kết luận nghiệp vụ (TOO_EARLY, INVALID_TRANSITION, 403, 404) thì phải
 *   bỏ key: dùng lại chỉ replay đúng lỗi đã cache, người dùng bấm lại bao nhiêu
 *   lần cũng thấy y nguyên lỗi cũ dù chuyến đã vào cửa sổ boarding.
 */
function shouldKeepIdempotencyKey(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return true;
  if (error.status >= 500) return true;
  return error.code === "IDEMPOTENCY_REQUEST_PENDING";
}

// Cột mã chuyến đọc `trip.tripCode` do BE trả (`TRIP-20260824-M5Q7WV3D`), và
// hiện "-" khi row legacy chưa backfill. Tuyệt đối KHÔNG quay lại cách cũ là
// cắt 8 ký tự đầu `tripId` viết hoa: nó trông như mã nghiệp vụ nhưng không tra
// cứu được ở đâu, và search theo chuỗi đó thì BE không khớp row nào.
function routeLabel(trip: OperatorTripListItem) {
  if (trip.route.name) return trip.route.name;

  const endpoints = [trip.route.originName, trip.route.destinationName].filter(
    Boolean,
  );
  return endpoints.length > 0 ? endpoints.join(" → ") : "-";
}

export default function TripListPage() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  // Giữ tham chiếu t mới nhất để effect tải dữ liệu không refetch khi đổi ngôn ngữ
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [tripsPage, setTripsPage] =
    useState<PagedResult<OperatorTripListItem>>(emptyPage);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState("");
  // Mở boarding thủ công (handoff Manual boarding §10): chỉ OPERATOR_ADMIN, và
  // chỉ ở màn này — Trung tâm vận hành chỉ tải chuyến IN_PROGRESS/DISRUPTED nên
  // chuyến SCHEDULED không bao giờ xuất hiện ở đó.
  const [canOpenBoarding] = useState(
    () => getAuthUser()?.role === "OPERATOR_ADMIN",
  );
  const [boardingTripId, setBoardingTripId] = useState("");
  /**
   * Chuyến đang mở bảng quản lý (sửa thông tin / khoá ghế / huỷ chuyến).
   *
   * Giữ CẢ ĐỐI TƯỢNG chứ không chỉ id: modal cần tuyến + xe hiện tại để đổ sẵn
   * hai dropdown, mà `GET /v1/operator/trips` không lọc được theo một tripId
   * nên tải lại riêng một chuyến là không làm được.
   */
  const [manageTrip, setManageTrip] = useState<OperatorTripListItem | null>(
    null,
  );
  const [busyBoardingTripId, setBusyBoardingTripId] = useState("");
  const [boardingMessage, setBoardingMessage] = useState("");
  const [boardingError, setBoardingError] = useState("");
  // Một key cho mỗi chuyến, sinh ở lần bấm đầu và giữ nguyên qua các lần retry
  // của đúng chuyến đó (§8).
  const boardingKeys = useRef(new Map<string, string>());
  useToastFeedback({
    message: boardingMessage,
    error: listError || boardingError,
  });

  // Bỏ qua lượt chạy đầu: effect cũng chạy lúc mount và gọi `setPage(1)` dù người
  // dùng chưa gõ gì, đá người đang xem trang 2 về trang 1 (xem màn Bookings).
  const hasSearchChanged = useRef(false);
  useEffect(() => {
    if (!hasSearchChanged.current) {
      hasSearchChanged.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let isCurrent = true;

    async function loadTrips() {
      setIsLoading(true);
      setListError("");

      try {
        const result = await getOperatorTrips({
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(fromDate ? { from: fromDate } : {}),
          ...(toDate ? { to: toDate } : {}),
          page,
          pageSize: PAGE_SIZE,
          sortBy: "departureAt",
          sortDir: "desc",
        });

        if (isCurrent) setTripsPage(result);
      } catch (error) {
        if (!isCurrent) return;
        setTripsPage(emptyPage);
        setListError(
          error instanceof Error
            ? error.message
            : tRef.current("tripList.loadFailed"),
        );
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    void loadTrips();
    return () => {
      isCurrent = false;
    };
  }, [debouncedSearch, fromDate, page, reloadVersion, statusFilter, toDate]);

  useEffect(() => {
    let isCurrent = true;

    async function loadCounts() {
      // allSettled: thẻ số liệu là phụ trợ, một status lỗi không được phép làm
      // hỏng cả hàng thẻ (và cũng không đẩy toast — bảng chính mới báo lỗi).
      const results = await Promise.allSettled(
        summaryStatuses.map((status) =>
          getOperatorTrips({ status, page: 1, pageSize: 1 }),
        ),
      );

      if (!isCurrent) return;

      setStatusCounts(
        Object.fromEntries(
          results.map((result, index) => [
            summaryStatuses[index],
            result.status === "fulfilled" ? result.value.totalItems : 0,
          ]),
        ),
      );
    }

    void loadCounts();
    return () => {
      isCurrent = false;
    };
  }, [reloadVersion]);

  const cols = canOpenBoarding
    ? columnClasses.withActions
    : columnClasses.readOnly;

  const hasActiveFilter = Boolean(
    debouncedSearch || statusFilter || fromDate || toDate,
  );

  const totalLabel = useMemo(
    () => tripsPage.totalItems.toLocaleString("vi-VN"),
    [tripsPage.totalItems],
  );

  async function openBoarding(tripId: string) {
    const existingKey = boardingKeys.current.get(tripId);
    const idempotencyKey = existingKey ?? createIdempotencyKey();
    boardingKeys.current.set(tripId, idempotencyKey);

    setBusyBoardingTripId(tripId);
    setBoardingTripId("");
    setBoardingMessage("");
    setBoardingError("");

    try {
      await openOperatorTripBoarding(tripId, idempotencyKey);
      boardingKeys.current.delete(tripId);
      setBoardingMessage(t("tripList.boardingSuccess"));
      // Trạng thái mới lấy lại từ BE thay vì tự ép local: AutoBoardingJob hoặc
      // một tác nhân khác có thể đã đổi trạng thái trong lúc này (§11).
      setReloadVersion((value) => value + 1);
    } catch (error) {
      if (!shouldKeepIdempotencyKey(error)) {
        boardingKeys.current.delete(tripId);
      }
      setBoardingError(
        error instanceof Error ? error.message : t("tripList.boardingFailed"),
      );
      // §11: chuyến bị huỷ/đã chạy giữa chừng thì hàng đang hiển thị đã cũ —
      // tải lại thay vì ép trạng thái ở FE.
      if (
        error instanceof ApiRequestError &&
        error.code === "TRIP_INVALID_TRANSITION"
      ) {
        setReloadVersion((value) => value + 1);
      }
    } finally {
      setBusyBoardingTripId("");
    }
  }

  function resetFilters() {
    setSearchTerm("");
    setDebouncedSearch("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {t("tripList.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            {t("tripList.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadVersion((value) => value + 1)}
          disabled={isLoading}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiRefreshCw className={isLoading ? "animate-spin" : ""} />
          {tc("refresh")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FiTruck size={20} />}
          iconClassName="bg-cyan-50 text-cyan-700"
          label={
            hasActiveFilter
              ? t("tripList.matchedTrips")
              : t("tripList.totalTrips")
          }
          value={totalLabel}
          isLoading={isLoading}
        />
        <StatCard
          icon={<FiActivity size={20} />}
          iconClassName="bg-emerald-50 text-emerald-700"
          label={t("tripList.statuses.IN_PROGRESS")}
          value={(statusCounts.IN_PROGRESS ?? 0).toLocaleString("vi-VN")}
        />
        <StatCard
          icon={<FiCalendar size={20} />}
          iconClassName="bg-slate-100 text-slate-700"
          label={t("tripList.statuses.SCHEDULED")}
          value={(statusCounts.SCHEDULED ?? 0).toLocaleString("vi-VN")}
        />
        <StatCard
          icon={<FiAlertTriangle size={20} />}
          iconClassName="bg-amber-50 text-amber-700"
          label={t("tripList.statuses.DISRUPTED")}
          value={(statusCounts.DISRUPTED ?? 0).toLocaleString("vi-VN")}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_10rem_10rem]">
            <div>
              <label className={labelClass} htmlFor="trip-list-search">
                {t("tripList.searchLabel")}
              </label>
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="trip-list-search"
                  type="search"
                  placeholder={t("tripList.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className={`${filterControlClass} pl-10`}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t("tripList.statusLabel")}</label>
              <CustomSelect
                aria-label={t("tripList.statusLabel")}
                className={filterControlClass}
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t("tripList.allStatuses")}</option>
                {tripStatuses.map((status) => (
                  <option key={status} value={status}>
                    {t(`tripList.statuses.${status}`)}
                  </option>
                ))}
              </CustomSelect>
            </div>
            {/* Dùng CustomDateTimeInput như các màn khác thay cho `input[type=date]`
                gốc: input gốc hiển thị theo locale của trình duyệt (ra mm/dd/yyyy
                trên máy tiếng Anh) và mở lịch do trình duyệt vẽ, lệch hẳn với
                phần còn lại của app. Component chung luôn hiện YYYY-MM-DD, đúng
                định dạng gửi lên BE. */}
            <div>
              <label className={labelClass}>{t("tripList.fromLabel")}</label>
              <CustomDateTimeInput
                type="date"
                aria-label={t("tripList.fromLabel")}
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => {
                  setFromDate(event.target.value);
                  setPage(1);
                }}
                className={filterControlClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t("tripList.toLabel")}</label>
              <CustomDateTimeInput
                type="date"
                aria-label={t("tripList.toLabel")}
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => {
                  setToDate(event.target.value);
                  setPage(1);
                }}
                className={filterControlClass}
              />
            </div>
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3 text-sm font-semibold text-vr-900 hover:underline"
            >
              {t("tripList.clearFilters")}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table
            className={`w-full ${canOpenBoarding ? "min-w-[1200px]" : "min-w-[1080px]"} table-fixed whitespace-nowrap`}
            aria-busy={isLoading}
          >
            {/* Chỉ cột Tuyến căn trái (chuỗi dài, hai dòng, đọc theo mép trái);
                các cột còn lại căn giữa cả tiêu đề lẫn dữ liệu. */}
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className={`${cols.tripCode} py-3 text-left`}>
                  {t("tripList.tripCode")}
                </th>
                <th className={`${cols.route} py-3 text-left`}>
                  {t("tripList.route")}
                </th>
                <th className={`${cols.vehicle} py-3`}>
                  {t("tripList.vehicle")}
                </th>
                <th className={`${cols.driver} py-3`}>
                  {t("tripList.driver")}
                </th>
                <th className={`${cols.departure} py-3`}>
                  {t("tripList.departure")}
                </th>
                <th className={`${cols.arrival} py-3`}>
                  {t("tripList.arrivalEstimate")}
                </th>
                <th className={`${cols.status} py-3`}>{tc("status")}</th>
                {canOpenBoarding && (
                  <th className={`${cols.actions} sticky right-0 z-10 bg-gray-50 py-3`}>{tc("actions")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {tripsPage.items.map((trip) => (
                <tr
                  key={trip.tripId}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className={`${cols.tripCode} py-4 text-left`}>
                    {/* Mã chuyến là lối vào bảng quản lý: cột Thao tác đã kín
                        chỗ cho nút mở boarding (xem `columnClasses`), thêm nút
                        thứ hai vào đó là vỡ bảng ở 1200px. `title` đặt trên
                        `span` bên trong chứ KHÔNG trên nút — rule
                        `tbody td button[title]` trong App.css ép nút có title
                        về ô vuông 40px. */}
                    <button
                      type="button"
                      onClick={() => setManageTrip(trip)}
                      /* Chữ trong nút chỉ là mã chuyến nên tên gọi mặc định
                         không nói nút LÀM GÌ — người dùng trình đọc màn hình
                         chỉ nghe một dãy mã. `aria-label` (không phải `title`,
                         xem rule `tbody td button[title]` trong App.css) gánh
                         phần đó. */
                      aria-label={t("tripList.manage.openFor", {
                        code: displayBusinessCode(trip.tripCode),
                      })}
                      className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-vr-200"
                    >
                      <span
                        className={`block truncate font-mono text-xs tabular-nums underline decoration-dotted underline-offset-4 hover:text-vr-800 ${
                          displayBusinessCode(trip.tripCode) === "-"
                            ? "text-gray-400"
                            : "text-gray-800"
                        }`}
                        title={displayBusinessCode(trip.tripCode)}
                      >
                        {displayBusinessCode(trip.tripCode)}
                      </span>
                    </button>
                  </td>
                  <td className={`${cols.route} py-4 text-left text-sm font-medium text-gray-800`}>
                    <span className="block truncate" title={routeLabel(trip)}>
                      {routeLabel(trip)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-normal text-gray-500">
                      {trip.route.code && (
                        <span className="font-mono tabular-nums">
                          {trip.route.code}
                          {" · "}
                        </span>
                      )}
                      {trip.route.originName} → {trip.route.destinationName}
                    </span>
                  </td>
                  <td className={`${cols.vehicle} py-4 text-center text-sm text-gray-700`}>
                    {trip.vehicle.licensePlate || "-"}
                  </td>
                  <td className={`${cols.driver} py-4 text-center text-sm text-gray-700`}>
                    {trip.driver ? (
                      <>
                        <span className="block truncate">
                          {trip.driver.displayName}
                        </span>
                        {trip.driver.phone && (
                          <span className="mt-0.5 block text-xs text-gray-500">
                            {formatVietnamPhoneForDisplay(trip.driver.phone)}
                          </span>
                        )}
                      </>
                    ) : (
                      t("tripList.noDriver")
                    )}
                  </td>
                  <td className={`${cols.departure} py-4 text-center text-sm text-gray-700`}>
                    {formatDateTime(trip.departureAt)}
                  </td>
                  <td className={`${cols.arrival} py-4 text-center text-sm text-gray-700`}>
                    {formatDateTime(trip.arrivalEstimate)}
                  </td>
                  <td className={`${cols.status} py-4 text-center`}>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(trip.status)}`}
                    >
                      {t(`tripList.statuses.${trip.status}`, {
                        defaultValue: trip.status,
                      })}
                    </span>
                  </td>
                  {/* §10: nhà xe chỉ mở boarding cho chuyến còn SCHEDULED. Đã
                      BOARDING thì gọi lại chỉ là no-op nên không cho bấm nữa;
                      trạng thái khác không có thao tác nào ở màn này. Bước start
                      chuyến là của tài xế trên app tài xế, không dựng ở đây. */}
                  {canOpenBoarding && (
                    // Ghim: bảng min-w-[1200px] nên cột này nằm ngoài khung
                    // ngay ở desktop 1440px.
                    <td className={`${cols.actions} sticky right-0 z-10 bg-white py-4 text-center`}>
                      {trip.status === "SCHEDULED" ? (
                        // Nút có chữ, KHÔNG phải nút icon: đây là thao tác vận
                        // hành quan trọng nhất của màn này, để icon trần thì
                        // nghĩa nằm hết trong tooltip và chỉ ai rê chuột mới
                        // biết nút làm gì.
                        //
                        // Tuyệt đối không thêm `title` vào nút: rule chung
                        // `tbody td button[title]` trong App.css ép mọi nút có
                        // title về ô vuông 40px, chữ sẽ bị bóp mất. Chữ trong
                        // nút cũng chính là accessible name nên không cần
                        // `aria-label` (và trùng khớp đúng WCAG 2.5.3).
                        <button
                          type="button"
                          onClick={() => setBoardingTripId(trip.tripId)}
                          disabled={busyBoardingTripId === trip.tripId}
                          className="inline-flex min-h-9 max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-vr-200 bg-vr-50 px-3 py-2 text-xs font-semibold text-vr-900 transition hover:border-vr-300 hover:bg-vr-100 focus:outline-none focus:ring-2 focus:ring-vr-200 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <FiUserCheck aria-hidden="true" size={15} />
                          {t("tripList.boarding")}
                        </button>
                      ) : (
                        // Ô này trước đây chỉ hiện gạch ngang. Chuyến đã rời
                        // SCHEDULED vẫn còn việc để làm (xem sơ đồ ghế, huỷ
                        // chuyến đang BOARDING) nên chỗ trống đó dùng cho nút
                        // Quản lý — vừa đúng ngân sách 168px của cột.
                        <button
                          type="button"
                          onClick={() => setManageTrip(trip)}
                          className="inline-flex min-h-9 max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-vr-200 hover:bg-vr-50 hover:text-vr-900 focus:outline-none focus:ring-2 focus:ring-vr-200"
                        >
                          <FiSettings aria-hidden="true" size={15} />
                          {t("tripList.manage.open")}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {isLoading && tripsPage.items.length === 0 && (
                <tr>
                  <td
                    colSpan={canOpenBoarding ? 8 : 7}
                    className="px-5 py-10 text-center text-sm text-gray-500"
                  >
                    <span className="inline-flex items-center gap-2">
                      <FiRefreshCw className="animate-spin" />
                      {t("tripList.loading")}
                    </span>
                  </td>
                </tr>
              )}
              {!isLoading && tripsPage.items.length === 0 && (
                <tr>
                  <td
                    colSpan={canOpenBoarding ? 8 : 7}
                    className="px-5 py-10 text-center text-sm text-gray-500"
                  >
                    {hasActiveFilter
                      ? t("tripList.noResults")
                      : t("tripList.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={tripsPage.totalItems}
          totalPages={tripsPage.totalPages}
          hasNextPage={tripsPage.hasNextPage}
          hasPreviousPage={tripsPage.hasPreviousPage}
          onPageChange={setPage}
        />
      </div>

      <ConfirmModal
        open={Boolean(boardingTripId)}
        onClose={() => setBoardingTripId("")}
        onConfirm={() => void openBoarding(boardingTripId)}
        title={tc("confirm")}
        message={t("tripList.boardingConfirm")}
        confirmLabel={tc("confirm")}
        cancelLabel={tc("cancel")}
        tone="warning"
        busy={Boolean(busyBoardingTripId)}
      />

      <TripManageModal
        // Remount theo chuyến: modal giữ form nháp + kết quả xem trước huỷ, mở
        // sang chuyến khác mà không remount là mang số liệu chuyến cũ theo.
        key={manageTrip?.tripId ?? "none"}
        trip={manageTrip}
        canMutate={canOpenBoarding}
        onClose={() => setManageTrip(null)}
        onChanged={(successMessage) => {
          setBoardingMessage(successMessage);
          // Trạng thái mới lấy lại từ BE thay vì tự ép local — huỷ chuyến và
          // sửa xe đều có thể kéo theo thay đổi khác trên hàng.
          setReloadVersion((value) => value + 1);
        }}
      />
    </div>
  );
}
