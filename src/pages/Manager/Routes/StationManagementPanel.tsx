// Panel quản lý bến: chọn bến sẵn có / tìm và tạo bến mới rồi gắn vào tuyến.
// Nội dung này được hiển thị bên trong StationManagementModal (luôn mở, không collapse).
import { useTranslation } from "react-i18next";
import { FiCheckCircle, FiMapPin } from "react-icons/fi";
import CustomSelect from "../../../components/CustomSelect";
import Checkbox from "../../../components/form/Checkbox";
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

// Đoán sẵn tỉnh/thành từ địa chỉ Google để mở sẵn danh sách phường/xã.
// Chỉ là gợi ý — người dùng vẫn phải tự chọn đúng phường/xã ở bước sau.
function findMatchingProvinceCode(
  place: PlaceSelection,
  locations: AdminLocation[],
) {
  const placeLocationNames = [place.city, ...place.address.split(",")]
    .map(normalizeLocationName)
    .filter(Boolean);
  const matchingLocation = locations.find((location) =>
    placeLocationNames.includes(normalizeLocationName(location.name)),
  );

  return matchingLocation?.code ?? "";
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
  const { t: tc } = useTranslation("common");

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
                const provinceCode = findMatchingProvinceCode(place, locations);
                onRunAction(async () => {
                  await manager.applyStationPlace(place);
                  await manager.selectProvince(provinceCode);
                });
              }}
            />
            {manager.stationPlaceDraft && !manager.selectedStationId && (
              <>
                {/* Bến chỉ nhận Location cấp phường/xã. Danh sách phường/xã
                    phải hỏi riêng theo tỉnh (GET /v1/locations?parentCode=),
                    nên phải chọn hai cấp thay vì một dropdown tỉnh như trước. */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>
                      {t("routes.stationProvince")}
                    </label>
                    <CustomSelect
                      aria-label={t("routes.stationProvince")}
                      className={inputClass}
                      value={manager.selectedProvinceCode}
                      searchable
                      searchPlaceholder={tc("searchOptions", {
                        label: t("routes.stationProvince"),
                      })}
                      emptyMessage={tc("noMatchingOptions")}
                      onChange={(event) =>
                        onRunAction(() =>
                          manager.selectProvince(event.target.value),
                        )
                      }
                    >
                      <option value="">
                        {t("routes.selectStationProvince")}
                      </option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.code}>
                          {location.name}
                        </option>
                      ))}
                    </CustomSelect>
                  </div>
                  <div>
                    <label className={labelClass}>
                      {t("routes.stationWard")}
                    </label>
                    <CustomSelect
                      aria-label={t("routes.stationWard")}
                      className={inputClass}
                      value={manager.selectedLocationId}
                      disabled={
                        !manager.selectedProvinceCode || manager.isLoadingWards
                      }
                      searchable
                      searchPlaceholder={tc("searchOptions", {
                        label: t("routes.stationWard"),
                      })}
                      emptyMessage={tc("noMatchingOptions")}
                      onChange={(event) =>
                        manager.setSelectedLocationId(event.target.value)
                      }
                    >
                      <option value="">
                        {manager.isLoadingWards
                          ? t("routes.loadingWards")
                          : t("routes.selectStationWard")}
                      </option>
                      {manager.wards.map((ward) => (
                        <option key={ward.id} value={ward.id}>
                          {ward.name}
                        </option>
                      ))}
                    </CustomSelect>
                  </div>
                  <p className="text-xs text-gray-500 sm:col-span-2">
                    {t("routes.searchLocationHint")}
                  </p>
                </div>
                <label
                  htmlFor="station-supports-shuttle"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <Checkbox
                    id="station-supports-shuttle"
                    checked={manager.stationSupportsShuttle}
                    onChange={manager.setStationSupportsShuttle}
                    className="mt-0.5"
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
