// Header cột phải: tên tuyến đang chọn + nút Quản lý bến + thanh tab
// (style tab đồng bộ với WalletSettlement)
import { useTranslation } from "react-i18next";
import { FiMapPin } from "react-icons/fi";
import { routeTabs, type RouteTab } from "./routeFormUtils";

type RouteDetailHeaderProps = {
  routeName: string;
  activeTab: RouteTab;
  onSelectTab: (tab: RouteTab) => void;
  onOpenStationManagement: () => void;
};

export default function RouteDetailHeader({
  routeName,
  activeTab,
  onSelectTab,
  onOpenStationManagement,
}: RouteDetailHeaderProps) {
  const { t } = useTranslation("manager");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-lg font-bold text-gray-900">
          {routeName}
        </h2>
        <button
          type="button"
          onClick={onOpenStationManagement}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <FiMapPin size={16} />
          {t("routes.stationManagement")}
        </button>
      </div>

      <nav
        aria-label={t("routes.manageTitle")}
        className="flex flex-wrap gap-2 border-b border-gray-200"
      >
        {routeTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={activeTab === tab}
            onClick={() => onSelectTab(tab)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab
                ? "border-vr-500 text-vr-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t(`routes.tabs.${tab}`)}
          </button>
        ))}
      </nav>
    </>
  );
}
