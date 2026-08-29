import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { Badge } from "../../../components/ui/Badge";
import Checkbox from "../../../components/form/Checkbox";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiArchive,
  FiArrowDown,
  FiArrowUp,
  FiBox,
  FiEdit2,
  FiLayers,
  FiMapPin,
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
  type ParcelRouteFareGroup,
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
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { RouteFarePicker, type RouteFarePickerOption } from "./RouteFarePicker";
import {
  buildFareSelection,
  buildGroupFareSelection,
  commonEffectiveWindow,
  configuredSizeCount,
  flattenFareGroup,
  hasMixedEffectiveWindows,
  buildNextFareSelection,
  createEmptyFarePrices,
  getRouteFareSummary,
  parcelSizeCategories,
  type FareEditorMode,
  type RouteFareStatus,
} from "./parcelFareHelpers";
import { Button } from "../../../components/ui/Button";
import { SearchInput } from "../../../components/ui/SearchInput";
// BE mặc định `sortBy=effectiveFrom&sortDir=desc` cho API list gom theo tuyến.
type FareSort = "priceAsc" | "priceDesc" | "effectiveAsc" | "effectiveDesc";
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
  const [summary, setSummary] = useState<OperatorParcelReportSummary | null>(
    null,
  );
  const [fareGroups, setFareGroups] = useState<ParcelRouteFareGroup[]>([]);
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [fromDate] = useState(monthStartIsoDate());
  const [toDate] = useState(todayIsoDate());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [farePage, setFarePage] = useState(1);
  const [fareSearch, setFareSearch] = useState("");
  const [debouncedFareSearch, setDebouncedFareSearch] = useState("");
  const [fareSizeFilter, setFareSizeFilter] = useState<"" | ParcelSizeCategory>(
    "",
  );
  const [fareStatusFilter, setFareStatusFilter] = useState<
    "" | ParcelRouteFareStatus
  >("");
  const [fareSort, setFareSort] = useState<FareSort>("effectiveDesc");
  const [fareTotalItems, setFareTotalItems] = useState(0);
  const [fareSummaries, setFareSummaries] = useState<
    ParcelRouteFareSummaryItem[]
  >([]);
  const [selectedRouteGroup, setSelectedRouteGroup] =
    useState<ParcelRouteFareGroup | null>(null);
  const [fareRouteId, setFareRouteId] = useState("");
  const [farePrices, setFarePrices] = useState(createEmptyFarePrices);
  const [fareEffectiveFrom, setFareEffectiveFrom] =
    useState(currentLocalDateTime);
  const [fareEffectiveUntil, setFareEffectiveUntil] = useState("");
  const [fareEditorMode, setFareEditorMode] =
    useState<FareEditorMode>("CREATE");
  const [editingGroup, setEditingGroup] = useState<ParcelRouteFareGroup | null>(
    null,
  );
  // Ô "Không giới hạn" cho mốc kết thúc. Handoff BE yêu cầu chọn RÕ RÀNG, nhất
  // là khi các mức đang lệch khoảng hiệu lực và form để trống phần thời gian —
  // lúc đó "trống" không được ngầm hiểu là không giới hạn.
  const [fareNoEndLimit, setFareNoEndLimit] = useState(false);
  // Bật khi bấm lưu trên tuyến có hiệu lực lệch nhau: phải xác nhận rằng cả
  // bốn mức sẽ bị chuẩn hoá về cùng một khoảng.
  const [isMixedWindowConfirmOpen, setIsMixedWindowConfirmOpen] =
    useState(false);
  const [isFareModalOpen, setIsFareModalOpen] = useState(false);
  const [isFareSaving, setIsFareSaving] = useState(false);
  const [fareMessage, setFareMessage] = useState("");
  const [fareError, setFareError] = useState("");
  const [routePickerQuery, setRoutePickerQuery] = useState("");
  const [debouncedRoutePickerQuery, setDebouncedRoutePickerQuery] =
    useState("");
  const [routePickerPage, setRoutePickerPage] = useState(1);
  const [routePickerRoutes, setRoutePickerRoutes] = useState<OperatorRoute[]>(
    [],
  );
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
      fareRouteId
        ? getRouteFareSummary(fareRouteId, flattenFareGroup(selectedRouteGroup))
        : null,
    [fareRouteId, selectedRouteGroup],
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

  const pendingActionCount = useMemo(
    () => summary?.totalRejected ?? 0,
    [summary],
  );
  // Search/sort/paging của bảng giá đã chuyển hẳn sang BE — `routeFares` chính
  // là một trang kết quả đã lọc và sắp xếp sẵn.
  const paginatedFareGroups = fareGroups;

  function toggleEffectiveSort() {
    setFareSort((current) =>
      current === "effectiveDesc" ? "effectiveAsc" : "effectiveDesc",
    );
    setFarePage(1);
  }

  const isPriceSort = fareSort === "priceAsc" || fareSort === "priceDesc";
  // Tuyến đang sửa có các mức lệch khoảng hiệu lực → cảnh báo trong form và
  // bắt xác nhận trước khi chuẩn hoá tất cả về một khoảng.
  const mixedWindowNotice = Boolean(
    editingGroup && hasMixedEffectiveWindows(editingGroup.fares),
  );

  const sizeHeaderMeta: Record<
    ParcelSizeCategory,
    { icon: typeof FiBox; colorClass: string }
  > = {
    SMALL: { icon: FiBox, colorClass: "bg-emerald-50 text-emerald-600" },
    MEDIUM: { icon: FiPackage, colorClass: "bg-cyan-50 text-cyan-600" },
    LARGE: { icon: FiArchive, colorClass: "bg-violet-50 text-violet-600" },
    EXTRA_LARGE: { icon: FiLayers, colorClass: "bg-amber-50 text-amber-600" },
  };

  function sortIcon(ascending: boolean) {
    return ascending ? (
      <FiArrowUp aria-hidden="true" size={14} />
    ) : (
      <FiArrowDown aria-hidden="true" size={14} />
    );
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
            sortBy:
              fareSort === "priceAsc" || fareSort === "priceDesc"
                ? "priceVnd"
                : "effectiveFrom",
            sortDir:
              fareSort === "priceAsc" || fareSort === "effectiveAsc"
                ? "asc"
                : "desc",
          }),
          // Tóm tắt theo tuyến cho ô chọn trong modal — thay cho việc tải toàn
          // bộ fare rồi tự group bằng getRouteFareSummary().
          getOperatorParcelRouteFareSummary(),
          fetchAllPages((params) => getOperatorRoutes(params)),
        ]);

      setSummary(summaryResult);
      setFareGroups(fareResult.items);
      setFareTotalItems(fareResult.totalItems);
      setFareSummaries(fareSummaryItems);
      setRoutes(routeItems);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tRef.current("parcels.loadFailed"),
      );
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

  // Tải bảng giá của tuyến đang soạn. API list nay gom theo tuyến nên lọc theo
  // `routeId` trả về đúng MỘT item chứa toàn bộ mức giá đã lưu.
  useEffect(() => {
    let ignore = false;

    if (!fareRouteId) {
      // Hoãn sang macrotask: gọi setState thẳng trong effect gây cascading render
      const clearTimer = window.setTimeout(
        () => setSelectedRouteGroup(null),
        0,
      );
      return () => window.clearTimeout(clearTimer);
    }

    void getOperatorParcelRouteFares({
      routeId: fareRouteId,
      page: 1,
      pageSize: 100,
    })
      .then((result) => {
        if (ignore) return;
        const group =
          result.items.find((item) => item.routeId === fareRouteId) ?? null;
        setSelectedRouteGroup(group);
        // Prefill form ngay khi có dữ liệu thật của tuyến vừa chọn
        if (!editingGroup) {
          applyFareSelection(
            buildFareSelection(
              getRouteFareSummary(fareRouteId, flattenFareGroup(group)),
            ),
          );
          return;
        }

        // Đang sửa: bảng chỉ là MỘT trang, nhưng bản thân item đã đủ mức giá của
        // tuyến. Làm mới giá theo dữ liệu vừa tải, không đụng vào ô ngày vì đó
        // là thứ người dùng đang sửa.
        if (group) {
          const selection = buildGroupFareSelection(group);
          setFareEditorMode(selection.mode);
          setFarePrices(selection.prices);
        }
      })
      .catch(() => {
        if (!ignore) setSelectedRouteGroup(null);
      });
    return () => {
      ignore = true;
    };
  }, [editingGroup, fareRouteId, fareMessage]);

  useEffect(() => {
    if (!isFareModalOpen || editingGroup) return;

    const timeoutId = window.setTimeout(() => {
      setDebouncedRoutePickerQuery(routePickerQuery.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [editingGroup, isFareModalOpen, routePickerQuery]);

  useEffect(() => {
    if (!isFareModalOpen || editingGroup) return;

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
  }, [
    debouncedRoutePickerQuery,
    editingGroup,
    isFareModalOpen,
    routePickerPage,
  ]);

  function applyFareSelection(
    selection: ReturnType<typeof buildFareSelection>,
  ) {
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
    setEditingGroup(null);
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
   * Sửa bảng giá của MỘT tuyến: mở đúng trình soạn 4 cỡ kiện như lúc tạo.
   *
   * Khi các mức của tuyến đang lệch khoảng hiệu lực, `buildGroupFareSelection`
   * trả mốc rỗng — đúng yêu cầu handoff BE là không tự lấy mốc của `SMALL` hay
   * của phần tử đầu tiên, người điều hành phải tự chọn một khoảng chung.
   */
  function handleEditFareGroup(group: ParcelRouteFareGroup) {
    const selection = buildGroupFareSelection(group);
    setEditingGroup(group);
    setFareRouteId(group.routeId);
    applyFareSelection(selection);
    // Tick sẵn "không giới hạn" khi bảng giá hiện tại đúng là không giới hạn.
    // Hiệu lực lệch nhau thì bỏ trống cả hai để bắt chọn lại.
    setFareNoEndLimit(
      !selection.hasMixedWindows &&
        commonEffectiveWindow(group.fares)?.effectiveUntil === null,
    );
    setFareError("");
    setFareMessage("");
    setIsFareModalOpen(true);
  }

  async function handleSaveFare(options?: { confirmedMixedWindow?: boolean }) {
    const isMixedWindowConfirmed = options?.confirmedMixedWindow ?? false;
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

    // Hiệu lực đang lệch nhau thì mốc kết thúc phải được chọn rõ ràng: một ngày
    // cụ thể, hoặc tích "không giới hạn". Bỏ trống là chưa quyết.
    if (mixedWindowNotice && !fareNoEndLimit && !fareEffectiveUntil) {
      setFareError(t("parcels.effectiveUntilRequired"));
      return;
    }

    // Lưu sẽ chuẩn hoá CẢ BỐN mức về cùng một khoảng — phải xác nhận trước.
    if (mixedWindowNotice && !isMixedWindowConfirmed) {
      setIsMixedWindowConfirmOpen(true);
      return;
    }

    const lockedFareWindow = locksBatchFareWindow
      ? selectedRouteFareSummary?.window
      : null;
    // Ô `datetime-local` chỉ có độ chính xác tới PHÚT. Mốc do BE sinh thường
    // có cả giây (vd 23:59:59), nên nếu cứ lấy thẳng giá trị form thì mỗi lần
    // lưu lại xén mất giây — kỳ giá âm thầm ngắn đi mà không ai đụng vào ô đó.
    // Người dùng KHÔNG sửa ô nào thì giữ nguyên chuỗi gốc của bảng giá.
    const editedWindow = editingGroup
      ? commonEffectiveWindow(editingGroup.fares)
      : null;
    const keepOriginal = (
      formValue: string,
      original: string | null | undefined,
    ) =>
      original && toLocalDateTime(original) === formValue ? original : null;

    const effectiveFromValue =
      lockedFareWindow?.effectiveFrom ??
      keepOriginal(fareEffectiveFrom, editedWindow?.effectiveFrom) ??
      fareEffectiveFrom;
    const effectiveUntilValue = lockedFareWindow
      ? lockedFareWindow.effectiveUntil
      : fareNoEndLimit
        ? null
        : (keepOriginal(fareEffectiveUntil, editedWindow?.effectiveUntil) ??
          (fareEffectiveUntil || null));
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
        ? (effectiveUntilDate?.toISOString() ?? null)
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
      setFareGroups(fareItems);
      const batchMessageKey: Record<FareEditorMode, string> = {
        CREATE: "parcels.batchFareCreated",
        UPDATE: "parcels.batchFareUpdated",
        COMPLETE: "parcels.batchFareCompleted",
        RENEW: "parcels.batchFareRenewed",
      };
      setFareMessage(t(batchMessageKey[fareEditorMode]));
      setEditingGroup(null);
      setIsFareModalOpen(false);
      setFareRouteId("");
      setFarePrices(createEmptyFarePrices());
      setFareEffectiveUntil("");
      setFareEffectiveFrom(currentLocalDateTime());
    } catch (err) {
      setFareError(
        err instanceof Error ? err.message : t("parcels.fareSaveFailed"),
      );
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
    !editingGroup &&
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
        <Button
          variant="secondary"
          onClick={() => void loadData()}
          disabled={isLoading}
        >
          <FiRefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          {tc("refresh")}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FiPackage />}
          label={t("parcels.todayOrders")}
          value={summary?.totalParcels ?? 0}
          iconClassName="bg-vr-50 text-vr-900"
        />
        <StatCard
          icon={<FiTruck />}
          label={t("parcels.inTransit")}
          value={summary?.totalLoaded ?? 0}
          iconClassName="bg-blue-50 text-blue-700"
        />
        <StatCard
          icon={<FiCheckCircle />}
          label={t("parcels.delivered")}
          value={summary?.totalDelivered ?? 0}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          icon={<FiXCircle />}
          label={t("parcels.needsAction")}
          value={pendingActionCount}
          iconClassName="bg-amber-50 text-amber-700"
        />
      </div>
      <ParcelQueue />

      {/* <div> chứ không phải <main>: layout đã có <main> bao ngoài, lồng
          thêm <main> nữa là hai landmark `main` trên cùng một trang. */}
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5">
            <div>
              <h2 className="text-[2rem] font-bold leading-tight tracking-[-0.04em] text-slate-900">
                {t("parcels.routeFares")}
              </h2>
              <p className="mt-1 text-[15px] text-slate-500">
                {t("parcels.routeFaresHint")}
              </p>
            </div>
          </div>
          <Modal
            open={isFareModalOpen}
            onClose={resetFareForm}
            title={
              editingGroup
                ? // Nhãn batch nói "bảng giá hiện tại" — sai khi sửa một kỳ giá
                  // đã hết hạn hoặc sắp hiệu lực, nên giữ nhãn trung tính.
                  t("parcels.editFare")
                : t(batchTitleKey[fareEditorMode])
            }
            subtitle={t("parcels.fareFormHint")}
            icon={<FiPackage size={20} />}
            wide
            footer={
              <>
                <Button variant="secondary" onClick={resetFareForm}>
                  {t("parcels.cancelEdit")}
                </Button>
                <Button
                  variant="primary"
                  disabled={isFareSaving}
                  onClick={() => void handleSaveFare()}
                >
                  {editingGroup ? <FiSave /> : <FiPlus />}
                  {t(batchActionKey[fareEditorMode])}
                </Button>
              </>
            }
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
                    disabled={Boolean(editingGroup)}
                    onQueryChange={handleRoutePickerQueryChange}
                    onSelect={handleSelectFareRoute}
                    onLoadMore={() =>
                      setRoutePickerPage((current) => current + 1)
                    }
                  />
                </div>
                <label>
                  <span className={labelClass}>
                    {t("parcels.effectiveFrom")}
                  </span>
                  <CustomDateTimeInput
                    type="datetime-local"
                    value={fareEffectiveFrom}
                    disabled={locksBatchFareWindow}
                    onChange={(event) =>
                      setFareEffectiveFrom(event.target.value)
                    }
                  />
                </label>
                {/* Checkbox để NGOÀI <label> của ô ngày: lồng vào trong thì
                      một label trỏ tới hai control, hỏng cả liên kết nhãn lẫn
                      truy cập bằng trình đọc màn hình. */}
                <div>
                  <label>
                    <span className={labelClass}>
                      {t("parcels.effectiveUntil")}
                    </span>
                    <CustomDateTimeInput
                      type="datetime-local"
                      value={fareNoEndLimit ? "" : fareEffectiveUntil}
                      disabled={locksBatchFareWindow || fareNoEndLimit}
                      onChange={(event) =>
                        setFareEffectiveUntil(event.target.value)
                      }
                    />
                  </label>
                  {/* Handoff BE: "không giới hạn" phải chọn được RÕ RÀNG. Khi
                        các mức đang lệch hiệu lực, form để trống nên ô rỗng
                        không được ngầm hiểu là vô hạn. */}
                  <span className="mt-2 block">
                    <Checkbox
                      checked={fareNoEndLimit}
                      disabled={locksBatchFareWindow}
                      onChange={(checked) => {
                        setFareNoEndLimit(checked);
                        if (checked) setFareEffectiveUntil("");
                      }}
                      label={t("parcels.noEndLimit")}
                    />
                  </span>
                </div>
              </div>
              {mixedWindowNotice && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <FiAlertTriangle
                      className="mt-0.5 shrink-0 text-amber-600"
                      size={18}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-amber-900">
                        {t("parcels.mixedEffectiveWindows")}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-amber-800">
                        {t("parcels.mixedEffectiveWindowsHint")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {!editingGroup &&
                selectedRouteFareSummary &&
                selectedRouteFareSummary.status !== "UNPRICED" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <FiAlertTriangle
                        className="mt-0.5 shrink-0 text-amber-600"
                        size={18}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-amber-900">
                          {t(
                            `parcels.routeFareNoticeTitles.${selectedRouteFareSummary.status}`,
                            {
                              count:
                                selectedRouteFareSummary.configuredSizeCount,
                            },
                          )}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-800">
                          {t(
                            `parcels.routeFareNotices.${selectedRouteFareSummary.status}`,
                          )}
                        </p>
                        {selectedRouteFareSummary.hasScheduledWindow && (
                          <p className="mt-2 text-xs font-medium text-amber-900">
                            {t("parcels.nextFareWindowAlreadyScheduled")}
                          </p>
                        )}
                        {!selectedRouteFareSummary.hasScheduledWindow &&
                          selectedRouteFareSummary.window?.effectiveUntil ===
                            null &&
                          selectedRouteFareSummary.window.temporalStatus ===
                            "ACTIVE" && (
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
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {parcelSizeCategories.map((sizeCategory) => (
                  <label key={sizeCategory}>
                    <span className={labelClass}>
                      {t(`parcels.sizeCategories.${sizeCategory}`)}
                    </span>
                    <CurrencyInput
                      value={farePrices[sizeCategory]}
                      onChange={(event) =>
                        setFarePrices((current) => ({
                          ...current,
                          [sizeCategory]: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="0"
                    />
                  </label>
                ))}
              </div>
            </div>
          </Modal>
          {/* Xác nhận chuẩn hoá hiệu lực — bắt buộc theo handoff BE trước khi
                gộp bốn mức đang lệch nhau về cùng một khoảng. */}
          <Modal
            open={isMixedWindowConfirmOpen}
            onClose={() => setIsMixedWindowConfirmOpen(false)}
            title={t("parcels.mixedEffectiveWindows")}
            icon={<FiAlertTriangle size={20} />}
            footer={
              <>
                <Button
                  variant="secondary"
                  onClick={() => setIsMixedWindowConfirmOpen(false)}
                >
                  {t("parcels.cancelEdit")}
                </Button>
                <Button
                  variant="primary"
                  disabled={isFareSaving}
                  onClick={() => {
                    setIsMixedWindowConfirmOpen(false);
                    void handleSaveFare({ confirmedMixedWindow: true });
                  }}
                >
                  {t("parcels.confirmNormalizeWindows")}
                </Button>
              </>
            }
          >
            <p className="text-sm leading-6 text-gray-700">
              {t("parcels.mixedEffectiveWindowsConfirm")}
            </p>
          </Modal>
          <div className="border-b border-slate-200 bg-white p-4">
            <div className="rounded-[28px] border border-[#bfe7ee] bg-[#f7fbfc] p-3 shadow-[inset_0_0_0_1px_rgba(191,231,238,0.2)]">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto] lg:items-center">
                <SearchInput
                  label={t("parcels.fareSearchPlaceholder")}
                  value={fareSearch}
                  onChange={(event) => {
                    setFareSearch(event.target.value);
                    setFarePage(1);
                  }}
                  placeholder={t("parcels.fareSearchPlaceholder")}
                  inputClassName="h-12 w-full rounded-[9999px] border border-[#a8dfe6] bg-white pl-11 pr-4 text-[15px] text-slate-700 shadow-[0_0_0_1px_rgba(168,223,230,0.16)] outline-none transition placeholder:text-slate-400 focus:border-vr-500 focus:ring-4 focus:ring-vr-100"
                  wrapperClassName="relative min-w-0"
                />
                <CustomSelect
                  value={fareSizeFilter}
                  onChange={(event) => {
                    setFareSizeFilter(
                      event.target.value as "" | ParcelSizeCategory,
                    );
                    setFarePage(1);
                  }}
                  className="h-12 w-full rounded-[9999px] border border-[#a8dfe6] bg-white px-4 py-3 text-[15px] text-slate-700 shadow-[0_0_0_1px_rgba(168,223,230,0.16)] outline-none transition focus:border-vr-500 focus:ring-4 focus:ring-vr-100"
                >
                  <option value="">{t("parcels.allSizeCategories")}</option>
                  {parcelSizeCategories.map((size) => (
                    <option key={size} value={size}>
                      {t("parcels.sizeCategories." + size)}
                    </option>
                  ))}
                </CustomSelect>
                {/* BE phân loại hiệu lực theo ngày neo; window không có ngày kết thúc không bao giờ là EXPIRED */}
                <CustomSelect
                  value={fareStatusFilter}
                  onChange={(event) => {
                    setFareStatusFilter(
                      event.target.value as "" | ParcelRouteFareStatus,
                    );
                    setFarePage(1);
                  }}
                  aria-label={t("parcels.fareStatusFilterLabel")}
                  className="h-12 w-full rounded-[9999px] border border-[#a8dfe6] bg-white px-4 py-3 text-[15px] text-slate-700 shadow-[0_0_0_1px_rgba(168,223,230,0.16)] outline-none transition focus:border-vr-500 focus:ring-4 focus:ring-vr-100"
                >
                  <option value="">{t("parcels.allFareStatuses")}</option>
                  <option value="ACTIVE">
                    {t("parcels.routeFareStatus.ACTIVE")}
                  </option>
                  <option value="SCHEDULED">
                    {t("parcels.routeFareStatus.SCHEDULED")}
                  </option>
                  <option value="EXPIRED">
                    {t("parcels.routeFareStatus.EXPIRED")}
                  </option>
                </CustomSelect>
                <button
                  type="button"
                  className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-teal-500 text-white shadow-sm transition hover:brightness-105"
                  aria-label={t("parcels.createFare")}
                  title={t("parcels.createFare")}
                  onClick={() => {
                    resetFareForm();
                    setIsFareModalOpen(true);
                  }}
                >
                  <FiPlus size={18} />
                </button>
              </div>
            </div>
          </div>
          <div className="w-full overflow-x-auto" tabIndex={0}>
            <table
              className="w-full table-fixed border-separate border-spacing-0"
              style={{ minWidth: "900px" }}
            >
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[40%]" />
                <col className="w-[24%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-left text-[11px] font-semibold text-slate-900">
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-[13px] font-bold tracking-[0.02em] text-slate-950">
                    {t("parcels.route")}
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="text-[13px] font-bold tracking-[0.02em] text-slate-950">
                        {t("parcels.fareTable")}
                      </div>
                      <div className="flex w-full items-center justify-center gap-3 text-[11px] font-semibold text-slate-800">
                        {parcelSizeCategories.map((size) => {
                          const meta = sizeHeaderMeta[size];
                          const Icon = meta.icon;

                          return (
                            <div
                              key={size}
                              className="flex min-w-[90px] items-center justify-center gap-1.5 text-center text-[13px] font-semibold text-slate-800"
                            >
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 ${meta.colorClass}`}
                              >
                                <Icon aria-hidden="true" size={12} />
                              </span>
                              <span>{t(`parcels.sizeCategories.${size}`)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </th>
                  <th className="border-b border-slate-200 px-2 py-3 text-center">
                    <button
                      type="button"
                      onClick={toggleEffectiveSort}
                      className="inline-flex items-center justify-center gap-1.5 text-[13px] font-bold tracking-[0.02em] text-slate-950 transition hover:text-vr-900"
                      title={t("parcels.effectiveWindow")}
                    >
                      {t("parcels.effectiveWindow")}
                      {isPriceSort
                        ? null
                        : sortIcon(fareSort === "effectiveAsc")}
                    </button>
                  </th>
                  <th className="border-b border-slate-200 px-2 py-3 text-center text-[13px] font-bold tracking-[0.02em] text-slate-950">
                    {tc("actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedFareGroups.map((group) => {
                  const routeName =
                    routes.find((route) => route.id === group.routeId)?.name ||
                    t("parcels.unnamedRoute");
                  const window = commonEffectiveWindow(group.fares);
                  const isMixed = hasMixedEffectiveWindows(group.fares);
                  const missingCount =
                    parcelSizeCategories.length -
                    configuredSizeCount(group.fares);

                  return (
                    <tr
                      key={group.routeId}
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      <td className="border-b border-slate-200 px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500">
                            <FiMapPin className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <div
                              className="truncate text-sm font-semibold text-slate-900"
                              title={routeName}
                            >
                              {routeName}
                            </div>
                            {missingCount > 0 && (
                              <div className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                {t("parcels.routeFareStatus.INCOMPLETE", {
                                  count: configuredSizeCount(group.fares),
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3 align-middle">
                        <div className="flex items-center justify-center gap-3">
                          {parcelSizeCategories.map((size) => {
                            const entry = group.fares.find(
                              (fare) => fare.sizeCategory === size,
                            );
                            const colorClass =
                              size === "SMALL"
                                ? "text-emerald-600"
                                : size === "MEDIUM"
                                  ? "text-cyan-600"
                                  : size === "LARGE"
                                    ? "text-violet-600"
                                    : "text-amber-600";
                            return (
                              <div
                                key={size}
                                className="flex min-w-[94px] items-center justify-center rounded-md text-center"
                              >
                                <div
                                  className={`text-[15px] font-bold tracking-[-0.04em] ${colorClass}`}
                                  style={{
                                    fontFeatureSettings: '"tnum" 1',
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  {entry ? formatMoney(entry.priceVnd) : "-"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3 align-middle">
                        {isMixed ? (
                          <div className="flex justify-start">
                            <Badge tone="warning">
                              {t("parcels.mixedEffectiveWindows")}
                            </Badge>
                          </div>
                        ) : window ? (
                          <div className="flex flex-col items-start gap-1 text-sm text-slate-700">
                            <span className="whitespace-nowrap font-medium text-slate-800">
                              {formatDate(window.effectiveFrom)}
                              {" → "}
                              {window.effectiveUntil
                                ? formatDate(window.effectiveUntil)
                                : t("parcels.noEndLimit")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="border-b border-slate-200 whitespace-nowrap px-4 py-3.5 text-center align-middle">
                        {canManageRouteFares ? (
                          <button
                            type="button"
                            onClick={() => handleEditFareGroup(group)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-vr-300 hover:bg-vr-50 hover:text-vr-900"
                            aria-label={t("parcels.editFare")}
                            title={t("parcels.editFare")}
                          >
                            <FiEdit2 size={16} />
                          </button>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!isLoading && fareGroups.length === 0 && (
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
