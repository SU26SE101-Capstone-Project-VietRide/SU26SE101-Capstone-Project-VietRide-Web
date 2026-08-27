import { useToastFeedback } from "../../../hooks/useToastFeedback";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiArrowDown,
  FiArrowUp,
  FiEdit2,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiTruck,
  FiXCircle,
} from "react-icons/fi";
import {
  batchUpdateOperatorParcelRouteFares,
  getOperatorParcelReportSummary,
  getOperatorParcelRouteFares,
  getOperatorParcelRouteFareSummary,
  getOperatorRoutes,
  type OperatorParcelReportSummary,
  type OperatorRoute,
  type ParcelRouteFare,
  type ParcelSizeCategory,
  type ParcelRouteFareStatus,
  type ParcelRouteFareSummaryItem,
} from "../../../api/vietride";
import { fetchAllPages } from "../../../api/pagination";
import { getAuthUser } from "../../../auth";
import CurrencyInput from "../../../components/CurrencyInput";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import { StatCard } from "../../../components/StatCard";
import { formatCurrency } from "../../../utils/currency";
import Pagination from "../../../components/Pagination";
import { formatDateTime } from "../../../utils/date";
import ParcelQueue from "./ParcelQueue";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";
import { RouteFarePicker, type RouteFarePickerOption } from "./RouteFarePicker";
import {
  buildFareSelection,
  buildRouteFareSelection,
  buildNextFareSelection,
  createEmptyFarePrices,
  getRouteFareSummary,
  parcelSizeCategories,
  type FareEditorMode,
  type RouteFareStatus,
} from "./parcelFareHelpers";
import { Button } from "../../../components/ui/Button";
import { SearchInput } from "../../../components/ui/SearchInput";
type FareSort = "priceAsc" | "priceDesc";
const routePickerPageSize = 8;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIsoDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function currentLocalDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
function formatMoney(value = 0) {
  return formatCurrency(value);
}

function formatDate(value?: string | null) {
  return formatDateTime(value);
}


export default function ParcelsList() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const user = getAuthUser();
  const canManageRouteFares = user?.role === "OPERATOR_ADMIN";
  const [summary, setSummary] = useState<OperatorParcelReportSummary | null>(null);
  const [routeFares, setRouteFares] = useState<ParcelRouteFare[]>([]);
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [fromDate] = useState(monthStartIsoDate());
  const [toDate] = useState(todayIsoDate());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [farePage, setFarePage] = useState(1);
  const [fareSearch, setFareSearch] = useState("");
  const [debouncedFareSearch, setDebouncedFareSearch] = useState("");
  const [fareSizeFilter, setFareSizeFilter] = useState<"" | ParcelSizeCategory>("");
  const [fareStatusFilter, setFareStatusFilter] = useState<"" | ParcelRouteFareStatus>("");
  const [fareSort, setFareSort] = useState<FareSort>("priceAsc");
  const [fareTotalItems, setFareTotalItems] = useState(0);
  const [fareSummaries, setFareSummaries] = useState<ParcelRouteFareSummaryItem[]>([]);
  const [selectedRouteFares, setSelectedRouteFares] = useState<ParcelRouteFare[]>([]);
  const [fareRouteId, setFareRouteId] = useState("");
  const [farePrices, setFarePrices] = useState(createEmptyFarePrices);
  const [fareEffectiveFrom, setFareEffectiveFrom] = useState(currentLocalDateTime);
  const [fareEffectiveUntil, setFareEffectiveUntil] = useState("");
  const [fareEditorMode, setFareEditorMode] = useState<FareEditorMode>("CREATE");
  const [editingFare, setEditingFare] = useState<ParcelRouteFare | null>(null);
  const [isFareModalOpen, setIsFareModalOpen] = useState(false);
  const [isFareSaving, setIsFareSaving] = useState(false);
  const [fareMessage, setFareMessage] = useState("");
  const [fareError, setFareError] = useState("");
  const [routePickerQuery, setRoutePickerQuery] = useState("");
  const [debouncedRoutePickerQuery, setDebouncedRoutePickerQuery] = useState("");
  const [routePickerPage, setRoutePickerPage] = useState(1);
  const [routePickerRoutes, setRoutePickerRoutes] = useState<OperatorRoute[]>([]);
  const [routePickerTotal, setRoutePickerTotal] = useState(0);
  const [isRoutePickerLoading, setIsRoutePickerLoading] = useState(false);
  const routePickerRequestRef = useRef(0);
  useToastFeedback({ message: fareMessage, error: error || fareError });
  const pageSize = 10;

  const selectedFareRoute = useMemo(
    () => routes.find((route) => route.id === fareRouteId) ?? null,
    [fareRouteId, routes],
  );
  // Trình soạn giá cần TOÀN BỘ khung giá của tuyến đang chọn (để biết cửa sổ
  // hiệu lực và từng mức giá), mà `routeFares` giờ chỉ là một trang — nên hỏi
  // riêng theo `routeId` thay vì suy từ trang đang xem.
  const selectedRouteFareSummary = useMemo(
    () =>
      fareRouteId ? getRouteFareSummary(fareRouteId, selectedRouteFares) : null,
    [fareRouteId, selectedRouteFares],
  );
  // Badge trong ô chọn tuyến lấy từ endpoint summary của BE. Picker chỉ đọc
  // `status` và `configuredSizeCount` nên không cần dựng lại `window`.
  const routePickerOptions = useMemo<RouteFarePickerOption[]>(() => {
    const byRouteId = new Map(
      fareSummaries.map((item) => [item.routeId, item]),
    );
    return routePickerRoutes.map((route) => {
      const item = byRouteId.get(route.id);
      const configuredSizeCount = item?.configuredSizeCategories.length ?? 0;
      const status: RouteFareStatus =
        configuredSizeCount === 0
          ? "UNPRICED"
          : item?.hasActiveWindow
            ? configuredSizeCount < parcelSizeCategories.length
              ? "INCOMPLETE"
              : "ACTIVE"
            : item?.hasScheduledWindow
              ? "SCHEDULED"
              : "EXPIRED";

      return {
        route,
        summary: {
          status,
          configuredSizeCount,
          window: null,
          hasScheduledWindow: item?.hasScheduledWindow ?? false,
        },
      };
    });
  }, [fareSummaries, routePickerRoutes]);

  const pendingActionCount = useMemo(() => summary?.totalRejected ?? 0, [summary]);
  // Search/sort/paging của bảng giá đã chuyển hẳn sang BE — `routeFares` chính
  // là một trang kết quả đã lọc và sắp xếp sẵn.
  const paginatedRouteFares = routeFares;

  function toggleFareSort() {
    setFareSort((current) => current === "priceAsc" ? "priceDesc" : "priceAsc");
    setFarePage(1);
  }

  function fareSortIcon() {
    return fareSort === "priceAsc" ? <FiArrowUp aria-hidden="true" size={14} /> : <FiArrowDown aria-hidden="true" size={14} />;
  }

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [summaryResult, fareResult, fareSummaryItems, routeItems] =
        await Promise.all([
          getOperatorParcelReportSummary({ from: fromDate, to: toDate }),
          // Bảng giá: search/sort/status/paging đều server-side
          getOperatorParcelRouteFares({
            page: farePage,
            pageSize,
            ...(debouncedFareSearch ? { search: debouncedFareSearch } : {}),
            ...(fareSizeFilter
              ? { sizeCategory: fareSizeFilter as ParcelSizeCategory }
              : {}),
            ...(fareStatusFilter
              ? { status: fareStatusFilter as ParcelRouteFareStatus }
              : {}),
            sortBy: "priceVnd",
            sortDir: fareSort === "priceAsc" ? "asc" : "desc",
          }),
          // Tóm tắt theo tuyến cho ô chọn trong modal — thay cho việc tải toàn
          // bộ fare rồi tự group bằng getRouteFareSummary().
          getOperatorParcelRouteFareSummary(),
          fetchAllPages((params) => getOperatorRoutes(params)),
        ]);

      setSummary(summaryResult);
      setRouteFares(fareResult.items);
      setFareTotalItems(fareResult.totalItems);
      setFareSummaries(fareSummaryItems);
      setRoutes(routeItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : tRef.current("parcels.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [
    debouncedFareSearch,
    farePage,
    fareSizeFilter,
    fareSort,
    fareStatusFilter,
    fromDate,
    toDate,
  ]);

  // Ô tìm kiếm bảng giá giờ đi thẳng lên BE nên phải debounce.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFareSearch(fareSearch.trim());
      setFarePage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [fareSearch]);

  // Tải mọi khung giá của tuyến đang soạn. pageSize 100 là dư: mỗi tuyến chỉ có
  // tối đa 4 loại kích cỡ × vài cửa sổ hiệu lực.
  useEffect(() => {
    let ignore = false;

    if (!fareRouteId) {
      // Hoãn sang macrotask: gọi setState thẳng trong effect gây cascading render
      const clearTimer = window.setTimeout(() => setSelectedRouteFares([]), 0);
      return () => window.clearTimeout(clearTimer);
    }

    void getOperatorParcelRouteFares({ routeId: fareRouteId, page: 1, pageSize: 100 })
      .then((result) => {
        if (ignore) return;
        setSelectedRouteFares(result.items);
        // Prefill form ngay khi có dữ liệu thật của tuyến vừa chọn
        if (!editingFare) {
          applyFareSelection(
            buildFareSelection(getRouteFareSummary(fareRouteId, result.items)),
          );
          return;
        }

        // Đang sửa: bảng chỉ là MỘT trang nên có thể thiếu cỡ kiện của tuyến.
        // Điền nốt phần thiếu từ dữ liệu đầy đủ, nhưng không đụng vào ngày —
        // đó là ô người dùng đang sửa.
        const selection = buildRouteFareSelection(result.items, editingFare);
        setFareEditorMode(selection.mode);
        setFarePrices(selection.prices);
      })
      .catch(() => {
        if (!ignore) setSelectedRouteFares([]);
      });
    return () => {
      ignore = true;
    };
  }, [editingFare, fareRouteId, fareMessage]);

  useEffect(() => {
    if (!isFareModalOpen || editingFare) return;

    const timeoutId = window.setTimeout(() => {
      setDebouncedRoutePickerQuery(routePickerQuery.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [editingFare, isFareModalOpen, routePickerQuery]);

  useEffect(() => {
    if (!isFareModalOpen || editingFare) return;

    const requestId = ++routePickerRequestRef.current;
    void Promise.resolve()
      .then(() => {
        setIsRoutePickerLoading(true);
        return getOperatorRoutes({
          page: routePickerPage,
          pageSize: routePickerPageSize,
          search: debouncedRoutePickerQuery || undefined,
        });
      })
      .then((result) => {
        if (requestId !== routePickerRequestRef.current) return;

        setRoutePickerRoutes((current) => {
          if (routePickerPage === 1) return result.items;

          const byId = new Map(current.map((route) => [route.id, route]));
          result.items.forEach((route) => byId.set(route.id, route));
          return [...byId.values()];
        });
        setRoutePickerTotal(result.totalItems);
        setRoutes((current) => {
          const byId = new Map(current.map((route) => [route.id, route]));
          result.items.forEach((route) => byId.set(route.id, route));
          return [...byId.values()];
        });
      })
      .catch((reason: unknown) => {
        if (requestId === routePickerRequestRef.current) {
          setFareError(
            reason instanceof Error
              ? reason.message
              : tRef.current("parcels.routeSearchFailed"),
          );
        }
      })
      .finally(() => {
        if (requestId === routePickerRequestRef.current) {
          setIsRoutePickerLoading(false);
        }
      });

    return () => {
      if (requestId === routePickerRequestRef.current) {
        routePickerRequestRef.current += 1;
      }
    };
  }, [debouncedRoutePickerQuery, editingFare, isFareModalOpen, routePickerPage]);

  function applyFareSelection(selection: ReturnType<typeof buildFareSelection>) {
    setFareEditorMode(selection.mode);
    setFarePrices(selection.prices);
    setFareEffectiveFrom(toLocalDateTime(selection.effectiveFrom));
    setFareEffectiveUntil(toLocalDateTime(selection.effectiveUntil));
  }

  function handleRoutePickerQueryChange(query: string) {
    setRoutePickerQuery(query);
    setRoutePickerPage(1);
    setRoutePickerRoutes([]);
    setFareError("");
  }

  function handleSelectFareRoute(option: RouteFarePickerOption) {
    // Chỉ chọn tuyến ở đây. Giá được prefill trong effect bên dưới, sau khi tải
    // xong toàn bộ khung giá của tuyến — summary từ BE cố tình không mang theo
    // từng mức giá nên không đủ để điền form.
    setFareRouteId(option.route.id);
    setFareError("");
  }

  function handleCreateNextFareWindow() {
    if (!selectedRouteFareSummary) return;
    const selection = buildNextFareSelection(selectedRouteFareSummary);
    if (!selection) return;
    applyFareSelection(selection);
    setFareError("");
  }

  function resetFareForm() {
    setEditingFare(null);
    setFareRouteId("");
    setFarePrices(createEmptyFarePrices());
    setFareEffectiveFrom(currentLocalDateTime());
    setFareEffectiveUntil("");
    setFareEditorMode("CREATE");
    setRoutePickerQuery("");
    setDebouncedRoutePickerQuery("");
    setRoutePickerPage(1);
    setRoutePickerRoutes([]);
    setRoutePickerTotal(0);
    setIsRoutePickerLoading(false);
    routePickerRequestRef.current += 1;
    setFareError("");
    setFareMessage("");
    setIsFareModalOpen(false);
  }

  /**
   * Sửa từ một dòng bảng: mở ĐÚNG trình soạn 4 cỡ kiện như lúc tạo.
   *
   * Trước đây bút chì mở form một cỡ kiện, nên tạo thì đặt được cả 4 mức trong
   * một lần mà sửa thì phải mở lại bốn lần cho cùng một tuyến. Khung giá lấy
   * theo dòng được bấm (không phải khung "đang chọn" của tuyến) để không sửa
   * nhầm kỳ giá khác; tuyến và khung thời gian đều bị khoá — đổi hai thứ đó là
   * tạo kỳ giá mới, đã có luồng riêng.
   */
  function handleEditFare(fare: ParcelRouteFare) {
    setEditingFare(fare);
    setFareRouteId(fare.routeId);
    applyFareSelection(buildRouteFareSelection(routeFares, fare));
    setFareError("");
    setFareMessage("");
    setIsFareModalOpen(true);
  }

  async function handleSaveFare() {
    const batchItems = parcelSizeCategories.map((sizeCategory) => ({
      sizeCategory,
      priceVnd: Number(farePrices[sizeCategory]),
    }));
    const hasInvalidBatchPrice = batchItems.some(
      (item) => !Number.isFinite(item.priceVnd) || item.priceVnd <= 0,
    );

    if (!fareRouteId || !fareEffectiveFrom || hasInvalidBatchPrice) {
      setFareError(t("parcels.batchFareRequired"));
      return;
    }

    const lockedFareWindow = locksBatchFareWindow
      ? selectedRouteFareSummary?.window
      : null;
    // Ô `datetime-local` chỉ có độ chính xác tới PHÚT. Mốc do BE sinh thường
    // có cả giây (vd 23:59:59), nên nếu cứ lấy thẳng giá trị form thì mỗi lần
    // lưu lại xén mất giây — kỳ giá âm thầm ngắn đi mà không ai đụng vào ô đó.
    // Người dùng KHÔNG sửa ô nào thì giữ nguyên chuỗi gốc của bản ghi.
    const keepOriginal = (
      formValue: string,
      original: string | null | undefined,
    ) =>
      editingFare && original && toLocalDateTime(original) === formValue
        ? original
        : null;

    const effectiveFromValue =
      lockedFareWindow?.effectiveFrom ??
      keepOriginal(fareEffectiveFrom, editingFare?.effectiveFrom) ??
      fareEffectiveFrom;
    const effectiveUntilValue = lockedFareWindow
      ? lockedFareWindow.effectiveUntil
      : keepOriginal(fareEffectiveUntil, editingFare?.effectiveUntil) ??
        (fareEffectiveUntil || null);
    const effectiveFromDate = new Date(effectiveFromValue);
    const effectiveUntilDate = effectiveUntilValue
      ? new Date(effectiveUntilValue)
      : null;
    if (
      Number.isNaN(effectiveFromDate.getTime()) ||
      (effectiveUntilDate !== null &&
        (Number.isNaN(effectiveUntilDate.getTime()) ||
          effectiveUntilDate <= effectiveFromDate))
    ) {
      setFareError(t("parcels.invalidFareWindow"));
      return;
    }

    setIsFareSaving(true);
    setFareError("");
    setFareMessage("");
    try {
      const effectiveUntil = fareEffectiveUntil
        ? effectiveUntilDate?.toISOString() ?? null
        : null;
      const effectiveFrom = effectiveFromDate.toISOString();

      await batchUpdateOperatorParcelRouteFares(fareRouteId, {
        effectiveFrom,
        effectiveUntil,
        items: batchItems,
      });

      const fareItems = await fetchAllPages((params) =>
        getOperatorParcelRouteFares(params),
      );
      setRouteFares(fareItems);
      const batchMessageKey: Record<FareEditorMode, string> = {
        CREATE: "parcels.batchFareCreated",
        UPDATE: "parcels.batchFareUpdated",
        COMPLETE: "parcels.batchFareCompleted",
        RENEW: "parcels.batchFareRenewed",
      };
      setFareMessage(t(batchMessageKey[fareEditorMode]));
      setEditingFare(null);
      setIsFareModalOpen(false);
      setFareRouteId("");
      setFarePrices(createEmptyFarePrices());
      setFareEffectiveUntil("");
      setFareEffectiveFrom(currentLocalDateTime());
    } catch (err) {
      setFareError(err instanceof Error ? err.message : t("parcels.fareSaveFailed"));
    } finally {
      setIsFareSaving(false);
    }
  }
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const batchActionKey: Record<FareEditorMode, string> = {
    CREATE: "parcels.fareBatchActions.CREATE",
    UPDATE: "parcels.fareBatchActions.UPDATE",
    COMPLETE: "parcels.fareBatchActions.COMPLETE",
    RENEW: "parcels.fareBatchActions.RENEW",
  };
  const batchTitleKey: Record<FareEditorMode, string> = {
    CREATE: "parcels.fareBatchTitles.CREATE",
    UPDATE: "parcels.fareBatchTitles.UPDATE",
    COMPLETE: "parcels.fareBatchTitles.COMPLETE",
    RENEW: "parcels.fareBatchTitles.RENEW",
  };
  // KHÔNG khoá khi đang sửa một dòng: mốc hiệu lực là thứ người dùng cần sửa
  // (gia hạn, chữa ngày gõ nhầm). Khoá chỉ áp cho luồng TẠO khi đã chọn tuyến
  // có sẵn bảng giá — lúc đó khung giá do tuyến quyết định, không phải form.
  //
  // Việc này còn chữa một lỗi lưu: nhánh khoá lấy `selectedRouteFareSummary
  // .window` (khung "đang chọn" của tuyến) làm mốc ghi xuống, nên bấm sửa ở
  // dòng thuộc kỳ khác sẽ ghi đè nhầm kỳ. Không khoá thì save dùng đúng ngày
  // đang hiển thị trên form.
  const locksBatchFareWindow =
    !editingFare &&
    (fareEditorMode === "UPDATE" || fareEditorMode === "COMPLETE");
  const nextFareSelection = selectedRouteFareSummary
    ? buildNextFareSelection(selectedRouteFareSummary)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("parcels.title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("parcels.subtitle")}</p>
        </div>
        <Button variant="secondary" onClick={() => void loadData()} disabled={isLoading}>
          <FiRefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          {tc("refresh")}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<FiPackage />} label={t("parcels.todayOrders")} value={summary?.totalParcels ?? 0} iconClassName="bg-vr-50 text-vr-900" />
        <StatCard icon={<FiTruck />} label={t("parcels.inTransit")} value={summary?.totalLoaded ?? 0} iconClassName="bg-blue-50 text-blue-700" />
        <StatCard icon={<FiCheckCircle />} label={t("parcels.delivered")} value={summary?.totalDelivered ?? 0} iconClassName="bg-emerald-50 text-emerald-700" />
        <StatCard icon={<FiXCircle />} label={t("parcels.needsAction")} value={pendingActionCount} iconClassName="bg-amber-50 text-amber-700" />
      </div>
      <ParcelQueue />

      {/* <div> chứ không phải <main>: layout đã có <main> bao ngoài, lồng
          thêm <main> nữa là hai landmark `main` trên cùng một trang. */}
      <div className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-5">
              <h2 className="text-lg font-bold text-gray-900">
                {t("parcels.routeFares")}
              </h2>
              <p className="text-sm text-gray-500">
                {t("parcels.routeFaresHint")}
              </p>
            </div>
            {canManageRouteFares && (
              <div className="flex justify-end border-b border-gray-100 bg-gray-50/60 p-4">
                <Button variant="primary" onClick={() => { resetFareForm(); setIsFareModalOpen(true); }}>
                  <FiPlus size={16} />{t("parcels.createFare")}
                </Button>
              </div>
            )}
            <Modal
              open={isFareModalOpen}
              onClose={resetFareForm}
              title={
                editingFare
                  // Nhãn batch nói "bảng giá hiện tại" — sai khi sửa một kỳ giá
                  // đã hết hạn hoặc sắp hiệu lực, nên giữ nhãn trung tính.
                  ? t("parcels.editFare")
                  : t(batchTitleKey[fareEditorMode])
              }
              subtitle={t("parcels.fareFormHint")}
              icon={<FiPackage size={20} />}
              wide
              footer={<>
                <Button variant="secondary" onClick={resetFareForm}>{t("parcels.cancelEdit")}</Button>
                <Button variant="primary" disabled={isFareSaving} onClick={() => void handleSaveFare()}>
                  {editingFare ? <FiSave /> : <FiPlus />}
                  {t(batchActionKey[fareEditorMode])}
                </Button>
              </>}
            >
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <span className={labelClass}>{t("parcels.route")}</span>
                    <RouteFarePicker
                      selectedRoute={selectedFareRoute}
                      options={routePickerOptions}
                      query={routePickerQuery}
                      totalItems={routePickerTotal}
                      isLoading={isRoutePickerLoading}
                      hasMore={routePickerRoutes.length < routePickerTotal}
                      disabled={Boolean(editingFare)}
                      onQueryChange={handleRoutePickerQueryChange}
                      onSelect={handleSelectFareRoute}
                      onLoadMore={() =>
                        setRoutePickerPage((current) => current + 1)
                      }
                    />
                  </div>
                  <label><span className={labelClass}>{t("parcels.effectiveFrom")}</span><CustomDateTimeInput type="datetime-local" value={fareEffectiveFrom} disabled={locksBatchFareWindow} onChange={(event) => setFareEffectiveFrom(event.target.value)} className={inputClass} /></label>
                  <label><span className={labelClass}>{t("parcels.effectiveUntil")}</span><CustomDateTimeInput type="datetime-local" value={fareEffectiveUntil} disabled={locksBatchFareWindow} onChange={(event) => setFareEffectiveUntil(event.target.value)} className={inputClass} /></label>
                </div>
                {!editingFare &&
                  selectedRouteFareSummary &&
                  selectedRouteFareSummary.status !== "UNPRICED" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                      <div className="flex items-start gap-3">
                        <FiAlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-amber-900">
                            {t(`parcels.routeFareNoticeTitles.${selectedRouteFareSummary.status}`, {
                              count: selectedRouteFareSummary.configuredSizeCount,
                            })}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-amber-800">
                            {t(`parcels.routeFareNotices.${selectedRouteFareSummary.status}`)}
                          </p>
                          {selectedRouteFareSummary.hasScheduledWindow && (
                            <p className="mt-2 text-xs font-medium text-amber-900">
                              {t("parcels.nextFareWindowAlreadyScheduled")}
                            </p>
                          )}
                          {!selectedRouteFareSummary.hasScheduledWindow &&
                            selectedRouteFareSummary.window?.effectiveUntil === null &&
                            selectedRouteFareSummary.window.temporalStatus === "ACTIVE" && (
                              <p className="mt-2 text-xs font-medium text-amber-900">
                                {t("parcels.nextFareWindowNeedsEnd")}
                              </p>
                            )}
                          {nextFareSelection && fareEditorMode !== "RENEW" && (
                            <button
                              type="button"
                              onClick={handleCreateNextFareWindow}
                              className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                            >
                              {t("parcels.createNextFareWindow")}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{parcelSizeCategories.map((sizeCategory) => <label key={sizeCategory}><span className={labelClass}>{t(`parcels.sizeCategories.${sizeCategory}`)}</span><CurrencyInput value={farePrices[sizeCategory]} onChange={(event) => setFarePrices((current) => ({ ...current, [sizeCategory]: event.target.value }))} className={inputClass} placeholder="0" /></label>)}</div>
              </div>
            </Modal>
            <div className="border-b border-gray-100 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <SearchInput
                  label={t("parcels.fareSearchPlaceholder")}
                  value={fareSearch}
                  onChange={(event) => { setFareSearch(event.target.value); setFarePage(1); }}
                  placeholder={t("parcels.fareSearchPlaceholder")}
                  inputClassName="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-vr-400 focus:ring-2 focus:ring-vr-100"
                  wrapperClassName="relative min-w-0 flex-1"
                />
                <CustomSelect value={fareSizeFilter} onChange={(event) => { setFareSizeFilter(event.target.value as "" | ParcelSizeCategory); setFarePage(1); }} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-vr-400 focus:ring-2 focus:ring-vr-100 lg:w-48">
                  <option value="">{t("parcels.allSizeCategories")}</option>
                  {parcelSizeCategories.map((size) => <option key={size} value={size}>{t("parcels.sizeCategories." + size)}</option>)}
                </CustomSelect>
                {/* BE phân loại hiệu lực theo ngày neo; window không có ngày kết thúc không bao giờ là EXPIRED */}
                <CustomSelect value={fareStatusFilter} onChange={(event) => { setFareStatusFilter(event.target.value as "" | ParcelRouteFareStatus); setFarePage(1); }} aria-label={t("parcels.fareStatusFilterLabel")} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-vr-400 focus:ring-2 focus:ring-vr-100 lg:w-48">
                  <option value="">{t("parcels.allFareStatuses")}</option>
                  <option value="ACTIVE">{t("parcels.routeFareStatus.ACTIVE")}</option>
                  <option value="SCHEDULED">{t("parcels.routeFareStatus.SCHEDULED")}</option>
                  <option value="EXPIRED">{t("parcels.routeFareStatus.EXPIRED")}</option>
                </CustomSelect>
              </div>
            </div>
            <div className="w-full overflow-x-auto" tabIndex={0}>
              <table className="w-full min-w-[1100px] table-fixed whitespace-nowrap">
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[17%]" />
                  <col className="w-[21%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="whitespace-nowrap px-4 py-3">{t("parcels.route")}</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center">{t("parcels.sizeCategory")}</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center"><button type="button" onClick={toggleFareSort} className="inline-flex items-center justify-center gap-1.5 font-semibold transition hover:text-vr-900" aria-label={t("parcels.fee")} title={fareSort === "priceAsc" ? t("parcels.priceHighToLow") : t("parcels.priceLowToHigh")}>{t("parcels.fee")}{fareSortIcon()}</button></th>
                    <th className="whitespace-nowrap px-4 py-3 text-center">{t("parcels.effectiveFrom")}</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center">{t("parcels.effectiveUntil")}</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center">{tc("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRouteFares.map((fare) => (
                    <tr
                      key={`${fare.routeId}-${fare.sizeCategory}-${fare.effectiveFrom}`}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="min-w-0 px-4 py-3 text-sm font-medium text-gray-900">
                        <span className="block truncate" title={routes.find((route) => route.id === fare.routeId)?.name || t("parcels.unnamedRoute")}>
                          {routes.find((route) => route.id === fare.routeId)?.name || t("parcels.unnamedRoute")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center text-sm font-semibold text-gray-900">
                        {t(`parcels.sizeCategories.${fare.sizeCategory}`)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center text-sm text-gray-700">
                        {formatMoney(fare.priceVnd)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center text-sm text-gray-700">
                        {formatDate(fare.effectiveFrom)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center text-sm text-gray-700">
                        {formatDate(fare.effectiveUntil)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-center">
                        {canManageRouteFares ? (
                          <button
                            type="button"
                            onClick={() => handleEditFare(fare)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:border-vr-300 hover:bg-vr-50 hover:text-vr-900"
                            aria-label={t("parcels.editFare")}
                            title={t("parcels.editFare")}
                          >
                            <FiEdit2 size={16} />
                          </button>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isLoading && routeFares.length === 0 && (
              <p className="border-t border-gray-100 px-5 py-6 text-center text-sm text-gray-500">
                {t("parcels.noRouteFares")}
              </p>
            )}
            <Pagination
              page={farePage}
              pageSize={pageSize}
              totalItems={fareTotalItems}
              onPageChange={setFarePage}
            />
          </section>
      </div>
    </div>
  );
}
