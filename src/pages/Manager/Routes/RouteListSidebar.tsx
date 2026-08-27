// Cột trái master–detail: danh sách tuyến + tìm kiếm client + nút tạo tuyến.
// Mobile (<lg) thu gọn thành CustomSelect + nút tạo để không chiếm màn hình.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { displayBusinessCode } from "../../../utils/businessCode";
import { FiPlus } from "react-icons/fi";
import CustomSelect from "../../../components/CustomSelect";
import { inputClass } from "../../../components/form/formClasses";
import type { OperatorRoute } from "../../../api/vietride";
import { Button } from "../../../components/ui/Button";
import { SearchInput } from "../../../components/ui/SearchInput";

type RouteListSidebarProps = {
  routes: OperatorRoute[];
  // Đang tải lần đầu mà chưa có dữ liệu (kể cả cache) → skeleton thay cho danh sách
  isLoading?: boolean;
  selectedRouteId: string;
  canManageRoutes: boolean;
  onSelectRoute: (routeId: string) => void;
  onCreateRoute: () => void;
};

export default function RouteListSidebar({
  routes,
  isLoading = false,
  selectedRouteId,
  canManageRoutes,
  onSelectRoute,
  onCreateRoute,
}: RouteListSidebarProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [search, setSearch] = useState("");
  const filteredRoutes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return routes;

    // Lọc theo cả mã tuyến: nhà xe quen gọi tuyến bằng mã hơn là bằng tên.
    return routes.filter(
      (route) =>
        route.name.toLowerCase().includes(query) ||
        (route.code ?? "").toLowerCase().includes(query),
    );
  }, [routes, search]);

  return (
    <aside className="min-w-0">
      {/* Mobile: dropdown gọn thay cho danh sách */}
      <div className="space-y-2 lg:hidden">
        <CustomSelect
          aria-label={t("routes.routeListTitle")}
          className={inputClass}
          value={selectedRouteId}
          searchable
          searchPlaceholder={t("routes.searchRoutePlaceholder")}
          emptyMessage={tc("noMatchingOptions")}
          onChange={(event) => onSelectRoute(event.target.value)}
        >
          <option value="">{t("routes.selectRoute")}</option>
          {routes.map((route) => (
            <option key={route.id} value={route.id}>
              {route.code ? `${route.code} · ` : ""}
              {route.name} · {route.totalDistanceKm} km
            </option>
          ))}
        </CustomSelect>
        {canManageRoutes && (
          <Button variant="primary" className="w-full" onClick={onCreateRoute}>
            <FiPlus size={16} />
            {t("routes.newRoute")}
          </Button>
        )}
      </div>

      {/* Desktop: danh sách tuyến cố định bên trái */}
      <div className="hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:block">
        <div className="space-y-3 border-b border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-900">
            {t("routes.routeListTitle")}
          </p>
          <SearchInput
            label={t("routes.searchRoutePlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("routes.searchRoutePlaceholder")}
            inputClassName={`${inputClass} pl-9`}
            // `block` là bắt buộc: <label> mặc định là inline, mà `space-y-3`
            // của khối cha dãn nhau bằng margin-top — margin dọc không ăn vào
            // phần tử inline nên ô tìm kiếm dính sát vào tiêu đề phía trên.
            wrapperClassName="relative block"
          />
          {canManageRoutes && (
            <Button variant="primary" className="w-full" onClick={onCreateRoute}>
              <FiPlus size={16} />
              {t("routes.newRoute")}
            </Button>
          )}
        </div>
        <ul
          aria-busy={isLoading}
          className="max-h-[calc(100vh-22rem)] space-y-1 overflow-y-auto p-2"
        >
          {/* Skeleton lúc tải lần đầu — "không có tuyến" CHỈ hiện khi đã load xong */}
          {isLoading &&
            Array.from({ length: 6 }, (_, index) => (
              <li
                key={index}
                aria-hidden="true"
                data-testid="route-list-skeleton-row"
                className="animate-pulse px-3 py-2"
              >
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="mt-1.5 h-3 w-1/2 rounded bg-gray-100" />
              </li>
            ))}
          {!isLoading && filteredRoutes.length === 0 && (
            <li className="px-3 py-4 text-sm text-gray-500">
              {t("routes.noRoutesFound")}
            </li>
          )}
          {filteredRoutes.map((route) => {
            const isActive = route.id === selectedRouteId;

            return (
              <li key={route.id}>
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSelectRoute(route.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left transition ${
                    isActive
                      ? "bg-vr-50 text-vr-900 ring-1 ring-vr-200"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span
                    className={`block truncate text-sm ${
                      isActive ? "font-bold" : "font-semibold"
                    }`}
                  >
                    {route.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    <span className="font-mono tabular-nums">
                      {displayBusinessCode(route.code)}
                    </span>{" "}
                    · {route.totalDistanceKm} km ·{" "}
                    {route.isActive
                      ? t("routes.activeRoute")
                      : t("routes.inactiveRoute")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
