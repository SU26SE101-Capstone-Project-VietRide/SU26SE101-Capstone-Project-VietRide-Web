// Panel quản lý bến: chọn bến sẵn có / tìm và tạo bến mới rồi gắn vào tuyến.
// Nội dung này được hiển thị bên trong StationManagementModal (luôn mở, không collapse).
import { useTranslation } from "react-i18next";
import { FiCheckCircle, FiMapPin } from "react-icons/fi";
import CustomSelect from "../../../components/CustomSelect";
import PlacePicker, {
  type PlaceSelection,
} from "../../../components/PlacePicker";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import type { AdminLocation } from "../../../api/vietride";
import type { UseStationManagementResult } from "./useStationManagement";
import type { StationOption, StationRouteRole } from "./types";
import StationSearchBox from "./StationSearchBox";

type StationManagementPanelProps = {
  canManageRoutes: boolean;
  stations: StationOption[];
  locations: AdminLocation[];
  manager: UseStationManagementResult;
  onRunAction: (action: () => Promise<void>) => void;
  // Đang mở sẵn một tuyến đã tạo (selectedRouteId có giá trị) — bến đi/bến đến
  // của tuyến đó KHÔNG đổi được nữa (server chặn ROUTE_STATION_IMMUTABLE), nên
  // ẩn dropdown "Dùng làm bến đi/đến" để tránh vừa báo gắn bến thành công vừa
  // báo lỗi khoá bến đi/đến cùng lúc (2 toast trái ngược cho cùng 1 lần bấm).
  hasSelectedRoute: boolean;
};

function normalizeLocationName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(?:tinh|thanh pho|tp)\s+/, "");
}

function findMatchingLocationId(
  place: PlaceSelection,
  locations: AdminLocation[],
) {
  const placeLocationNames = [place.city, ...place.address.split(",")]
    .map(normalizeLocationName)
    .filter(Boolean);
  const matchingLocation = locations.find((location) =>
    placeLocationNames.includes(normalizeLocationName(location.name)),
  );

  return matchingLocation?.id ?? "";
}

export default function StationManagementPanel({
  canManageRoutes,
  stations,
  locations,
  manager,
  onRunAction,
  hasSelectedRoute,
}: StationManagementPanelProps) {
  const { t } = useTranslation("manager");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 p-4">
        <p className="text-sm font-bold text-gray-900">
          {t("routes.stationExistingTitle")}
        </p>
        <div className="mt-3 space-y-3">
          <StationSearchBox
            selectedStation={
              stations.find(
                (station) => station.id === manager.selectedStationId,
              ) ?? null
            }
            onClear={() => manager.handleSelectStation("")}
            onSelect={manager.handleSelectStationResult}
          />
          {canManageRoutes && (
            <>
              {!hasSelectedRoute && (
                <CustomSelect
                  className={inputClass}
                  value={manager.stationRouteRole}
                  onChange={(event) =>
                    manager.setStationRouteRole(
                      event.target.value as StationRouteRole,
                    )
                  }
                >
                  <option value="">{t("routes.stationRouteRoleNone")}</option>
                  <option value="origin">{t("routes.useAsOrigin")}</option>
                  <option value="destination">
                    {t("routes.useAsDestination")}
                  </option>
                </CustomSelect>
              )}
              {manager.selectedStationId && (
                <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={manager.stationSupportsShuttle}
                    onChange={(event) =>
                      manager.setStationSupportsShuttle(event.target.checked)
                    }
                    className="h-4 w-4 accent-vr-500"
                  />
                  {t("routes.supportsShuttle")}
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onRunAction(manager.handleAttachStation)}
                  disabled={!manager.selectedStationId}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50"
                >
                  <FiCheckCircle size={16} />
                  {t("routes.attachStation")}
                </button>
                {manager.selectedStationId && (
                  <button
                    type="button"
                    onClick={() =>
                      onRunAction(manager.handleConfirmShuttleSupport)
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-vr-200 px-4 py-2 text-sm font-semibold text-vr-700 hover:bg-vr-50"
                  >
                    <FiCheckCircle size={16} />
                    {t("routes.confirmShuttle")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {canManageRoutes && (
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm font-bold text-gray-900">
            {t("routes.stationCreateTitle")}
          </p>
          <div className="mt-3 space-y-3">
            <PlacePicker
              label={t("routes.stationName")}
              placeholder={t("routes.stationNamePlaceholder")}
              selectedPlace={manager.selectedStationPlace}
              onSelect={(place) => {
                manager.setSelectedLocationId(
                  findMatchingLocationId(place, locations),
                );
                onRunAction(() => manager.applyStationPlace(place));
              }}
            />
            {manager.stationPlaceDraft && !manager.selectedStationId && (
              <>
                <div>
                  <label className={labelClass}>
                    {t("routes.searchLocation")}
                  </label>
                  <CustomSelect
                    aria-label={t("routes.searchLocation")}
                    className={inputClass}
                    value={manager.selectedLocationId}
                    onChange={(event) =>
                      manager.setSelectedLocationId(event.target.value)
                    }
                  >
                    <option value="">{t("routes.selectSearchLocation")}</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name} · {location.code}
                      </option>
                    ))}
                  </CustomSelect>
                  <p className="mt-1 text-xs text-gray-500">
                    {t("routes.searchLocationHint")}
                  </p>
                </div>
                <label
                  htmlFor="station-supports-shuttle"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <input
                    id="station-supports-shuttle"
                    type="checkbox"
                    checked={manager.stationSupportsShuttle}
                    onChange={(event) =>
                      manager.setStationSupportsShuttle(event.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-vr-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">
                      {t("routes.supportsShuttle")}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {t("routes.supportsShuttleHint")}
                    </span>
                  </span>
                </label>
              </>
            )}
            <button
              type="button"
              onClick={() => onRunAction(manager.handleCreateAndAttachStation)}
              disabled={
                !manager.stationPlaceDraft ||
                Boolean(manager.selectedStationId) ||
                !manager.selectedLocationId
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-vr-200 px-4 py-2 text-sm font-semibold text-vr-700 hover:bg-vr-50 disabled:opacity-50"
            >
              <FiMapPin size={16} />
              {t("routes.createAndAttachStation")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
