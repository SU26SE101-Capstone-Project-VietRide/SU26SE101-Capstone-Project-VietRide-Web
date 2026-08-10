// Hook cục bộ: state + thao tác tìm/tạo/gắn bến của màn Routes
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  createOperatorStation,
  searchStations,
  updateOperatorStation,
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

  async function handleConfirmShuttleSupport() {
    const selected = stations.find(
      (station) => station.id === selectedStationId,
    );
    if (!selected?.stationId) {
      setError(t("routes.stationSelectForShuttle"));
      return;
    }
    await updateOperatorStation(selected.stationId, {
      supportsShuttle: stationSupportsShuttle,
    });
    setStations((current) =>
      current.map((station) =>
        station.id === selectedStationId
          ? { ...station, supportsShuttle: stationSupportsShuttle }
          : station,
      ),
    );
    showMessage("station", t("routes.shuttleSupportSaved"));
  }

  async function handleAttachStation() {
    if (!selectedStationId) {
      setError(t("routes.stationRequired"));
      return;
    }

    const created = await createOperatorStation({
      stationId: selectedStationId,
    });
    setStations((current) =>
      current.map((station) =>
        station.id === selectedStationId
          ? {
              ...station,
              stationId: created.stationId ?? selectedStationId,
              operatorStationId: created.id,
              supportsShuttle: created.supportsShuttle ?? stationSupportsShuttle,
            }
          : station,
      ),
    );
    assignStationToRoute(selectedStationId);
    showMessage("station", t("routes.stationAttached"));
  }

  async function handleCreateAndAttachStation() {
    if (!stationPlaceDraft) {
      setError(t("routes.stationPlaceRequired"));
      return;
    }

    const city = stationPlaceDraft.city.trim();
    const ward = stationPlaceDraft.ward.trim() || city;

    if (!city || !ward) {
      setError(t("routes.stationLocationRequired"));
      return;
    }

    if (!selectedLocationId) {
      setError(t("routes.searchLocationRequired"));
      return;
    }

    const created = await createOperatorStation({
      name: stationPlaceDraft.name,
      city,
      ward,
      latitude: stationPlaceDraft.latitude,
      longitude: stationPlaceDraft.longitude,
      addressStreet: stationPlaceDraft.address,
      supportsShuttle: stationSupportsShuttle,
      locationId: selectedLocationId,
    });

    const station = created.station ?? {
      id: created.stationId,
      name: created.name ?? stationPlaceDraft.name,
      city: created.city ?? city,
      ward: created.ward ?? ward,
      latitude: created.latitude ?? stationPlaceDraft.latitude,
      longitude: created.longitude ?? stationPlaceDraft.longitude,
      address: created.addressStreet ?? stationPlaceDraft.address,
      supportsShuttle: created.supportsShuttle ?? stationSupportsShuttle,
    };

    setStations((current) => mergeStations(current, [station]));
    setSelectedStationId(station.id);
    setSelectedLocationId("");
    setStationSupportsShuttle(false);
    assignStationToRoute(station.id);
    showMessage("station", t("routes.stationCreatedAndAttached"));
  }

  return {
    stationPlaceDraft,
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
    handleConfirmShuttleSupport,
    handleAttachStation,
    handleCreateAndAttachStation,
  };
}

export type UseStationManagementResult = ReturnType<
  typeof useStationManagement
>;
