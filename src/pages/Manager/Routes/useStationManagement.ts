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
import type {
  FeedbackScope,
  StationOption,
  StationRouteRole,
  TranslateFn,
} from "./types";

type UseStationManagementParams = {
  stations: StationOption[];
  setStations: Dispatch<SetStateAction<StationOption[]>>;
  updateRoute: (
    key: "originStationId" | "destinationStationId",
    value: string,
  ) => void;
  // Đang mở sẵn một tuyến đã tạo — bến đi/bến đến của tuyến đó bất biến sau khi
  // tạo (server chặn ROUTE_STATION_IMMUTABLE qua updateRoute). Gán vai trò
  // bến đi/đến chỉ có ý nghĩa khi CHƯA có tuyến nào chọn (đang chờ tạo tuyến
  // mới) — assignStationToRoute tự bỏ qua khi cờ này bật, tránh vừa báo gắn
  // bến thành công vừa báo lỗi khoá bến đi/đến cho cùng một lần bấm.
  hasSelectedRoute: boolean;
  setError: (message: string) => void;
  showMessage: (scope: FeedbackScope, message: string) => void;
  t: TranslateFn;
};

function normalizeLocationLabel(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^(tinh|thanh pho|tp\.?|phuong|xa|thi tran|dac khu)\s+/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesLocationName(left: string, right: string) {
  const normalizedLeft = normalizeLocationLabel(left);
  const normalizedRight = normalizeLocationLabel(right);
  return Boolean(normalizedLeft && normalizedRight && (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)));
}

export function useStationManagement({
  stations,
  setStations,
  updateRoute,
  hasSelectedRoute,
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
  const [stationRouteRole, setStationRouteRole] =
    useState<StationRouteRole>("");
  const [selectedStationId, setSelectedStationId] = useState("");

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

  async function applyStationPlace(place: PlaceSelection) {
    setStationPlaceDraft(place);
    setSelectedStationId("");
    setStationSupportsShuttle(false);

    setSelectedProvinceCode("");
    setSelectedLocationId("");
    setWards([]);

    // Tự ánh xạ tỉnh/thành và phường/xã từ địa chỉ Google vào hierarchy của BE.
    if (place.city || place.ward) {
      const provinces = await getPublicLocations();
      const province = provinces.find((item) => matchesLocationName(item.name, place.city));
      if (province) {
        setSelectedProvinceCode(province.code);
        setIsLoadingWards(true);
        try {
          const result = await getPublicLocations({ parentCode: province.code });
          const activeWards = result.filter((location) => location.isActive);
          setWards(activeWards);
          const addressCandidates = [place.ward, ...place.address.split(",")].map((value) => value.trim()).filter(Boolean);
          const matchedWard = activeWards.find((ward) => addressCandidates.some((candidate) => matchesLocationName(ward.name, candidate)));
          setSelectedLocationId(matchedWard?.id ?? "");
        } finally {
          setIsLoadingWards(false);
        }
      }
    }

    // Search theo contract mới: city = tỉnh/TP (Google admin_area_1 = place.province)
    const result = await searchStations({
      q: place.name,
      city: place.city,
      ward: place.ward,
    });

    // Kết quả tìm kiếm không phải hành động tạo/gắn bến — không cần toast,
    // chưa tìm thấy nghĩa là quản trị viên sẽ tạo bến mới ngay bên dưới; kết
    // quả tìm thấy đã tự hiển thị qua danh sách/lựa chọn bến.
    if (!result.length) {
      return;
    }

    setStations((current) => mergeStations(current, result));
    setSelectedStationId(result[0]?.id ?? "");
    setStationSupportsShuttle(result[0]?.supportsShuttle ?? false);
  }

  function assignStationToRoute(stationId: string) {
    // Tuyến đang mở không đổi được bến đi/đến — bỏ qua thay vì gọi updateRoute
    // (sẽ luôn bị chặn + báo lỗi, xem comment ở UseStationManagementParams)
    if (hasSelectedRoute) {
      return;
    }

    if (stationRouteRole === "origin") {
      updateRoute("originStationId", stationId);
      return;
    }

    if (stationRouteRole === "destination") {
      updateRoute("destinationStationId", stationId);
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
    assignStationToRoute(selectedStationId);
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
        assignStationToRoute(nearby[0].id);
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
    assignStationToRoute(createdStationId);
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
    stationRouteRole,
    setStationRouteRole,
    selectedStationId,
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
