import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { OperatorRoute } from "../../../api/vietride";
import Checkbox from "../../../components/form/Checkbox";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import { SearchInput } from "../../../components/ui/SearchInput";

type RouteMultiSelectProps = {
  routes: OperatorRoute[];
  selectedRouteIds: string[];
  onChange: (routeIds: string[]) => void;
};

export default function RouteMultiSelect({
  routes,
  selectedRouteIds,
  onChange,
}: RouteMultiSelectProps) {
  const { t } = useTranslation("manager");
  const [search, setSearch] = useState("");
  const filteredRoutes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return routes;
    }

    return routes.filter((route) =>
      [
        route.name,
        route.originStation?.name,
        route.destinationStation?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [routes, search]);

  const allFilteredRoutesSelected =
    filteredRoutes.length > 0 &&
    filteredRoutes.every((route) => selectedRouteIds.includes(route.id));

  function toggleRoute(routeId: string) {
    onChange(
      selectedRouteIds.includes(routeId)
        ? selectedRouteIds.filter((id) => id !== routeId)
        : [...selectedRouteIds, routeId],
    );
  }

  function toggleAllFilteredRoutes() {
    const filteredRouteIds = new Set(filteredRoutes.map((route) => route.id));

    if (allFilteredRoutesSelected) {
      onChange(
        selectedRouteIds.filter((routeId) => !filteredRouteIds.has(routeId)),
      );
      return;
    }

    onChange([
      ...selectedRouteIds,
      ...filteredRoutes
        .map((route) => route.id)
        .filter((routeId) => !selectedRouteIds.includes(routeId)),
    ]);
  }

  return (
    <div className="sm:col-span-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className={labelClass}>{t("vouchers.applicableRoutes")}</label>
        <button
          type="button"
          onClick={toggleAllFilteredRoutes}
          disabled={filteredRoutes.length === 0}
          className="self-start rounded-lg border border-vr-200 px-3 py-1.5 text-xs font-semibold text-vr-900 transition hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          {allFilteredRoutesSelected
            ? t("vouchers.clearSelectedRoutes")
            : t("vouchers.selectAllRoutes")}
        </button>
      </div>

      <SearchInput
        label={t("vouchers.searchRoutes")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("vouchers.searchRoutesPlaceholder")}
        inputClassName={`${inputClass} pl-9`}
        wrapperClassName="relative mt-2"
      />

      <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
        {routes.length > 0 && filteredRoutes.length > 0 ? (
          <div className="space-y-1">
            {filteredRoutes.map((route) => {
              const checked = selectedRouteIds.includes(route.id);

              return (
                <label
                  key={route.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                    checked
                      ? "bg-vr-50 text-vr-800"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onChange={() => toggleRoute(route.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {route.name}
                    </span>
                    {(route.originStation?.name ||
                      route.destinationStation?.name) && (
                      <span className="block truncate text-xs text-gray-500">
                        {route.originStation?.name ?? "?"} → {route.destinationStation?.name ?? "?"}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        ) : routes.length > 0 ? (
          <p className="px-3 py-2 text-sm text-gray-500">
            {t("vouchers.searchRoutesEmpty")}
          </p>
        ) : (
          <p className="px-3 py-2 text-sm text-gray-500">
            {t("vouchers.noRoutesAvailable")}
          </p>
        )}
      </div>

      <p className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-gray-500">
        <span>
          {selectedRouteIds.length > 0
            ? t("vouchers.selectedRoutes", { count: selectedRouteIds.length })
            : t("vouchers.allRoutesHint")}
        </span>
        {routes.length > 0 && (
          <span>
            {t("vouchers.voucherRouteSearchCount", {
              shown: filteredRoutes.length,
              total: routes.length,
            })}
          </span>
        )}
      </p>
    </div>
  );
}
