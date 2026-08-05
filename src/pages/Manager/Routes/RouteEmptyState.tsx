// Empty-state cột phải khi chưa chọn tuyến: hướng dẫn chọn/tạo tuyến, quản lý bến
import { useTranslation } from "react-i18next";
import { FiMap, FiMapPin, FiPlus } from "react-icons/fi";

type RouteEmptyStateProps = {
  canManageRoutes: boolean;
  onCreateRoute: () => void;
  onOpenStationManagement: () => void;
};

export default function RouteEmptyState({
  canManageRoutes,
  onCreateRoute,
  onOpenStationManagement,
}: RouteEmptyStateProps) {
  const { t } = useTranslation("manager");

  return (
    <main className="flex min-h-96 min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-vr-50 text-vr-700">
        <FiMap size={26} />
      </span>
      <h2 className="text-lg font-bold text-gray-900">
        {t("routes.emptyStateTitle")}
      </h2>
      <p className="max-w-md text-sm text-gray-500">
        {t("routes.emptyStateHint")}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {canManageRoutes && (
          <button
            type="button"
            onClick={onCreateRoute}
            className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
          >
            <FiPlus size={16} />
            {t("routes.newRoute")}
          </button>
        )}
        <button
          type="button"
          onClick={onOpenStationManagement}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <FiMapPin size={16} />
          {t("routes.stationManagement")}
        </button>
      </div>
    </main>
  );
}
