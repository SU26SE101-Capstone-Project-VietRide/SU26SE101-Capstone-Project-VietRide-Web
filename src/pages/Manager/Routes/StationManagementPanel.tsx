// Panel quản lý bến: tìm địa điểm, tạo bến mới và tự động gắn vào tuyến.
// Nội dung này được hiển thị bên trong StationManagementModal (luôn mở, không collapse).
import { useTranslation } from "react-i18next";
import { FiMapPin } from "react-icons/fi";
import CustomSelect from "../../../components/CustomSelect";
import Checkbox from "../../../components/form/Checkbox";
import PlacePicker, {
  type PlaceSelection,
} from "../../../components/PlacePicker";
import { inputClass, labelClass } from "../../../components/form/formClasses";
import type { AdminLocation } from "../../../api/vietride";
import type { UseStationManagementResult } from "./useStationManagement";
import { useOperatorSubscription } from "../../../contexts/operatorSubscriptionContext";

// Modal này chỉ làm một việc: tìm/tạo bến rồi gắn vào nhà xe. Trước đây còn một
// dropdown "Dùng làm bến đi/đến" nhưng nó vô tác dụng ở mọi nhánh — đang mở tuyến
// thì bến đi/đến bất biến (server chặn ROUTE_STATION_IMMUTABLE), còn chưa mở tuyến
// thì giá trị rơi vào `routeForm` mà không màn nào đọc (CreateRouteModal giữ state
// riêng). Chọn bến đi/đến làm ở đúng một chỗ: form tạo tuyến.
type StationManagementPanelProps = {
  canManageRoutes: boolean;
  locations: AdminLocation[];
  manager: UseStationManagementResult;
  onRunAction: (action: () => Promise<void>) => void;
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
  locations,
  manager,
  onRunAction,
}: StationManagementPanelProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const { hasModule } = useOperatorSubscription();
  const shuttleEnabled = hasModule("enableShuttle");

  return (
    <div className="space-y-4">
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
                  const stationExists = await manager.applyStationPlace(place);
                  // Bến đã có sẵn thì không phải khai địa giới nữa — bỏ luôn
                  // bước đoán tỉnh/thành để khỏi gọi API thừa.
                  if (!stationExists) {
                    await manager.selectProvince(provinceCode);
                  }
                });
              }}
            />

            {/* Ba nhánh loại trừ nhau, và nhánh "đang tra" phải có mặt: chưa biết
                bến đã tồn tại hay chưa mà vẽ sẵn form tạo thì lát nữa nó biến mất,
                người dùng không hiểu vì sao lúc thấy lúc không. */}
            {manager.stationPlaceDraft && manager.isResolvingStation && (
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                {t("routes.stationLookupRunning")}
              </p>
            )}

            {manager.stationPlaceDraft &&
              !manager.isResolvingStation &&
              manager.selectedStationId && (
                <p className="rounded-lg border border-vr-200 bg-vr-50 px-4 py-3 text-sm text-vr-900">
                  {t("routes.stationAlreadyOnSystem")}
                </p>
              )}

            {manager.stationPlaceDraft &&
              !manager.isResolvingStation &&
              !manager.selectedStationId && (
              <>
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {t("routes.stationNotOnSystem")}
                </p>
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
                {shuttleEnabled && <label
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
                </label>}
              </>
            )}
            <button
              type="button"
              onClick={() => onRunAction(manager.handleCreateAndAttachStation)}
              disabled={
                !manager.selectedStationPlace ||
                (!manager.selectedStationId && !manager.selectedLocationId)
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-vr-200 px-4 py-2 text-sm font-semibold text-vr-700 hover:bg-vr-50 disabled:opacity-50"
            >
              <FiMapPin size={16} />
              {/* Nhãn chỉ nói việc chính của từng nhánh: bến đã có trong hệ thống
                  thì "Gắn bến", chưa có thì "Tạo bến mới". Việc gắn vào nhà xe là
                  hệ quả đương nhiên của cả hai và đã nói ở phụ đề modal — nhét
                  "Tạo & gắn" vào nút làm người dùng tưởng còn bước gắn thứ hai. */}
              {manager.selectedStationId
                ? t("routes.attachStation")
                : t("routes.createStation")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
