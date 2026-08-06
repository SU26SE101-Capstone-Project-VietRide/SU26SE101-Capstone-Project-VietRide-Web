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
  setError: (message: string) => void;
  showMessage: (scope: FeedbackScope, message: string) => void;
  t: TranslateFn;
};

export function useStationManagement({
  stations,
  setStations,
  updateRoute,
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
        station.address ??
        `${station.name}, ${station.city}`,
      // PlaceSelection semantics Google: province = tỉnh/TP, city = ward-level
      city: station.ward ?? station.city,
      province: station.city,
      latitude: station.latitude,
      longitude: station.longitude,
    };
  }, [selectedStationId, stationPlaceDraft, stations]);

  function handleSelectStation(nextStationId: string) {
    setSelectedStationId(nextStationId);
    setStationSupportsShuttle(
      stations.find((station) => station.id === nextStationId)?.supportsShuttle ?? false,
    );
  }

  async function applyStationPlace(place: PlaceSelection) {
    setStationPlaceDraft(place);
    setSelectedStationId("");
    setStationSupportsShuttle(false);

    // Search theo contract mới: city = tỉnh/TP (Google admin_area_1 = place.province)
    const result = await searchStations({
      q: place.name,
      city: place.province || place.city,
    });

    if (!result.length) {
      showMessage("station", t("routes.platformStationNotFound"));
      return;
    }

    setStations((current) => mergeStations(current, result));
    setSelectedStationId(result[0]?.id ?? "");
    setStationSupportsShuttle(result[0]?.supportsShuttle ?? false);
    showMessage("station", t("routes.stationSearchFound", { count: result.length }));
  }

  function assignStationToRoute(stationId: string) {
    if (stationRouteRole === "origin") {
      updateRoute("originStationId", stationId);
      return;
    }

    if (stationRouteRole === "destination") {
      updateRoute("destinationStationId", stationId);
    }
  }

  async function handleConfirmShuttleSupport() {
    const selected = stations.find((station) => station.id === selectedStationId);
    if (!selected?.operatorStationId) {
      setError(t("routes.stationSelectForShuttle"));
      return;
    }
    await updateOperatorStation(selected.operatorStationId, { supportsShuttle: stationSupportsShuttle });
    setStations((current) => current.map((station) => station.id === selectedStationId ? { ...station, supportsShuttle: stationSupportsShuttle } : station));
    showMessage("station", t("routes.shuttleSupportSaved"));
  }

  async function handleAttachStation() {
    if (!selectedStationId) {
      setError(t("routes.stationRequired"));
      return;
    }

    await createOperatorStation({
      stationId: selectedStationId,
    });
    assignStationToRoute(selectedStationId);
    showMessage("station", t("routes.stationAttached"));
  }

  async function handleCreateAndAttachStation() {
    if (!stationPlaceDraft) {
      setError(t("routes.stationPlaceRequired"));
      return;
    }

    // Contract mới: city = tỉnh/TP (place.province), ward = xã/phường (place.city);
    // cả hai bắt buộc khi tạo Station mới
    const city =
      stationPlaceDraft.province.trim() || stationPlaceDraft.city.trim();
    const ward = stationPlaceDraft.city.trim();

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
      supportsShuttle:
        created.supportsShuttle ?? stationSupportsShuttle,
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
    applyStationPlace,
    handleConfirmShuttleSupport,
    handleAttachStation,
    handleCreateAndAttachStation,
  };
}

export type UseStationManagementResult = ReturnType<typeof useStationManagement>;
