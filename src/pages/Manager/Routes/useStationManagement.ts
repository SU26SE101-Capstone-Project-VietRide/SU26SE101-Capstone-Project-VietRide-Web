// Hook cục bộ: state + thao tác tìm/tạo/gắn bến của màn Routes
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  attachOperatorStation,
  createOperatorStation,
  getPublicLocations,
  isNearbyStationWarning,
  searchStations,
  type AdminLocation,
} from "../../../api/vietride";
import type { PlaceSelection } from "../../../components/PlacePicker";
import { mergeStations } from "./routeFormUtils";
import type { FeedbackScope, StationOption, TranslateFn } from "./types";

// Hook chỉ lo tìm/tạo/gắn bến vào NHÀ XE. Việc chọn bến nào làm bến đi/bến đến
// thuộc về form tuyến (CreateRouteModal), không phải ở đây: bến đi/đến của tuyến
// đã tạo là bất biến (server chặn ROUTE_STATION_IMMUTABLE), còn tuyến chưa tạo
// thì form tạo tuyến tự giữ lựa chọn của nó.
type UseStationManagementParams = {
  stations: StationOption[];
  setStations: Dispatch<SetStateAction<StationOption[]>>;
  setError: (message: string) => void;
  showMessage: (scope: FeedbackScope, message: string) => void;
  t: TranslateFn;
};

// Vi\u1ec7c \u0111o\u00e1n t\u1ec9nh/th\u00e0nh t\u1eeb \u0111\u1ecba ch\u1ec9 Google n\u1eb1m \u1edf StationManagementPanel
// (`findMatchingProvinceCode`) \u2014 hook kh\u00f4ng t\u1ef1 \u0111o\u00e1n n\u1eefa. Tr\u01b0\u1edbc \u0111\u00e2y c\u1ea3 hai n\u01a1i
// c\u00f9ng \u0111o\u00e1n, v\u00e0 l\u01b0\u1ee3t \u0111o\u00e1n c\u1ee7a panel ch\u1ea1y sau n\u00ean lu\u00f4n ghi \u0111\u00e8 l\u01b0\u1ee3t c\u1ee7a hook: hook
// t\u1ed1n th\u00eam 2 request `GET /v1/locations` m\u00e0 k\u1ebft qu\u1ea3 b\u1ecb v\u1ee9t.

export function useStationManagement({
  stations,
  setStations,
  setError,
  showMessage,
  t,
}: UseStationManagementParams) {
  const [stationPlaceDraft, setStationPlaceDraft] =
    useState<PlaceSelection | null>(null);
  // Station chỉ nhận Location **leaf** (phường/xã/đặc khu). `GET /v1/locations`
  // không kèm parentCode chỉ trả tỉnh/thành, nên phải chọn hai cấp: tỉnh trước
  // để lấy danh sách phường/xã trực thuộc, rồi mới chọn leaf gửi lên BE.
  const [selectedProvinceCode, setSelectedProvinceCode] = useState("");
  const [wards, setWards] = useState<AdminLocation[]>([]);
  const [isLoadingWards, setIsLoadingWards] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [stationSupportsShuttle, setStationSupportsShuttle] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState("");
  // Đang tra xem địa điểm vừa chọn đã có bến trên hệ thống chưa — chưa biết kết
  // quả thì panel không được vẽ nhánh nào cả, tránh nhấp nháy.
  const [isResolvingStation, setIsResolvingStation] = useState(false);

  const selectedStationPlace = useMemo<PlaceSelection | null>(() => {
    const station = stations.find((item) => item.id === selectedStationId);

    if (!station) {
      return stationPlaceDraft;
    }

    return {
      placeId: station.id,
      name: station.name,
      address:
        station.address ?? `${station.name}, ${station.city || station.ward}`,
      city: station.city,
      ward: station.ward ?? "",
      latitude: station.latitude,
      longitude: station.longitude,
    };
  }, [selectedStationId, stationPlaceDraft, stations]);

  function handleSelectStation(nextStationId: string) {
    setSelectedStationId(nextStationId);
    setStationSupportsShuttle(
      stations.find((station) => station.id === nextStationId)
        ?.supportsShuttle ?? false,
    );
  }

  function handleSelectStationResult(station: StationOption) {
    setStations((current) => mergeStations(current, [station]));
    setSelectedStationId(station.id);
    setStationSupportsShuttle(station.supportsShuttle ?? false);
  }

  /**
   * Chọn một địa điểm Google → tra xem bến đó ĐÃ CÓ trên hệ thống chưa.
   *
   * Trả về `true` khi khớp một bến có sẵn (nhà xe chỉ cần gắn), `false` khi là
   * bến mới (phải chọn phường/xã rồi tạo). Panel dựa vào giá trị này để quyết
   * định có chạy tiếp bước đoán tỉnh/thành hay không.
   *
   * Tra bến TRƯỚC rồi mới tới địa giới: trước đây làm ngược lại nên khối
   * "Tỉnh/Phường" kịp hiện ra và điền sẵn, xong lượt search về mới ẩn đi — người
   * dùng thấy form nhấp nháy mà không hiểu vì sao.
   */
  async function applyStationPlace(place: PlaceSelection) {
    setStationPlaceDraft(place);
    setSelectedStationId("");
    setStationSupportsShuttle(false);

    setSelectedProvinceCode("");
    setSelectedLocationId("");
    setWards([]);
    setIsResolvingStation(true);

    try {
      // Search theo contract mới: city = tỉnh/TP (Google admin_area_1 = place.province)
      const result = await searchStations({
        q: place.name,
        city: place.city,
        ward: place.ward,
      });

      // Kết quả tìm kiếm không phải hành động tạo/gắn bến — không cần toast.
      if (!result.length) {
        return false;
      }

      setStations((current) => mergeStations(current, result));
      setSelectedStationId(result[0]?.id ?? "");
      setStationSupportsShuttle(result[0]?.supportsShuttle ?? false);
      return true;
    } finally {
      setIsResolvingStation(false);
    }
  }

  async function handleAttachStation() {
    if (!selectedStationId) {
      setError(t("routes.stationRequired"));
      return;
    }

    const attached = await attachOperatorStation(selectedStationId);
    setStations((current) =>
      current.map((station) =>
        station.id === selectedStationId
          ? {
              ...station,
              stationId: attached.stationId ?? selectedStationId,
              operatorStationId: attached.id,
              supportsShuttle:
                attached.station?.supportsShuttle ?? stationSupportsShuttle,
            }
          : station,
      ),
    );
    showMessage("station", t("routes.stationAttached"));
  }

  async function selectProvince(provinceCode: string) {
    setSelectedProvinceCode(provinceCode);
    setSelectedLocationId("");
    setWards([]);
    if (!provinceCode) return;

    setIsLoadingWards(true);
    try {
      const result = await getPublicLocations({ parentCode: provinceCode });
      setWards(result.filter((location) => location.isActive));
    } finally {
      setIsLoadingWards(false);
    }
  }

  async function handleCreateAndAttachStation() {
    if (selectedStationId) {
      await handleAttachStation();
      return;
    }

    if (!stationPlaceDraft) {
      setError(t("routes.stationPlaceRequired"));
      return;
    }

    if (!selectedLocationId) {
      setError(t("routes.searchLocationRequired"));
      return;
    }

    // Không gửi city/ward: BE suy ra từ hierarchy của leaf và bỏ qua nếu client gửi.
    const created = await createOperatorStation({
      name: stationPlaceDraft.name,
      latitude: stationPlaceDraft.latitude,
      longitude: stationPlaceDraft.longitude,
      addressStreet: stationPlaceDraft.address,
      supportsShuttle: stationSupportsShuttle,
      locationId: selectedLocationId,
    });

    // 200 kèm warning = BE KHÔNG tạo và KHÔNG link vì đã có bến active trong
    // bán kính 100 m. Trước đây FE coi đây là thành công rồi dùng stationId
    // undefined. Giờ nạp các bến gần đó để người dùng chọn gắn thay vì tạo mới.
    if (isNearbyStationWarning(created)) {
      const nearby = created.nearbyStations ?? [];
      if (nearby.length > 0) {
        setStations((current) => mergeStations(current, nearby));
        setSelectedStationId(nearby[0].id);
        setStationSupportsShuttle(nearby[0].supportsShuttle ?? false);
        await attachOperatorStation(nearby[0].id);
        showMessage("station", t("routes.stationAttached"));
      } else {
        setError(t("routes.stationDuplicateNearby"));
      }
      return;
    }

    const ward = wards.find((item) => item.id === selectedLocationId);
    const createdStationId = created.station?.id ?? created.stationId ?? "";
    if (!createdStationId) {
      setError(t("routes.stationCreateFailed"));
      return;
    }

    const attached = await attachOperatorStation(createdStationId);
    const station = created.station ?? {
      id: createdStationId,
      name: stationPlaceDraft.name,
      city: ward?.parentName ?? stationPlaceDraft.city,
      ward: ward?.name ?? stationPlaceDraft.ward,
      latitude: stationPlaceDraft.latitude,
      longitude: stationPlaceDraft.longitude,
      address: stationPlaceDraft.address,
      supportsShuttle: stationSupportsShuttle,
    };

    setStations((current) =>
      mergeStations(current, [
        {
          ...station,
          stationId: attached.stationId ?? createdStationId,
          operatorStationId: attached.id,
        },
      ]),
    );
    setSelectedStationId(createdStationId);
    setSelectedLocationId("");
    setSelectedProvinceCode("");
    setWards([]);
    setStationSupportsShuttle(false);
    showMessage("station", t("routes.stationCreatedAndAttached"));
  }

  return {
    stationPlaceDraft,
    selectedProvinceCode,
    selectProvince,
    wards,
    isLoadingWards,
    selectedLocationId,
    setSelectedLocationId,
    stationSupportsShuttle,
    setStationSupportsShuttle,
    selectedStationId,
    isResolvingStation,
    selectedStationPlace,
    handleSelectStation,
    handleSelectStationResult,
    applyStationPlace,
    handleAttachStation,
    handleCreateAndAttachStation,
  };
}

export type UseStationManagementResult = ReturnType<
  typeof useStationManagement
>;
