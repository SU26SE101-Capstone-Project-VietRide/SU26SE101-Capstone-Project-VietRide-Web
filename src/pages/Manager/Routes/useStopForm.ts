// Hook cục bộ: form tạo/sửa điểm dừng (stop) của màn Routes
import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  createOperatorStop,
  getOperatorStop,
  updateOperatorStop,
  type OperatorStop,
  type OperatorStopRequest,
} from "../../../api/vietride";
import type { PlaceSelection } from "../../../components/PlacePicker";
import { emptyStopForm } from "./routeFormUtils";
import type { FeedbackScope, TranslateFn } from "./types";

type UseStopFormParams = {
  selectedStopId: string;
  setSelectedStopId: Dispatch<SetStateAction<string>>;
  setStops: Dispatch<SetStateAction<OperatorStop[]>>;
  setError: (message: string) => void;
  showMessage: (scope: FeedbackScope, message: string) => void;
  t: TranslateFn;
};

export function useStopForm({
  selectedStopId,
  setSelectedStopId,
  setStops,
  setError,
  showMessage,
  t,
}: UseStopFormParams) {
  const [stopForm, setStopForm] = useState<OperatorStopRequest>(emptyStopForm);

  const selectedStopPlace = useMemo<PlaceSelection | null>(() => {
    if (!stopForm.latitude || !stopForm.longitude) {
      return null;
    }

    return {
      placeId:
        stopForm.googlePlaceId || `${stopForm.latitude},${stopForm.longitude}`,
      name: stopForm.name,
      address: stopForm.address ?? "",
      city: "",
      province: "",
      latitude: stopForm.latitude,
      longitude: stopForm.longitude,
    };
  }, [stopForm]);

  function updateStop<K extends keyof OperatorStopRequest>(
    key: K,
    value: OperatorStopRequest[K],
  ) {
    setStopForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyStopPlace(place: PlaceSelection) {
    setStopForm((current) => ({
      ...current,
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      googlePlaceId: place.placeId,
    }));
  }

  async function handleCreateStop() {
    if (!stopForm.name.trim()) {
      setError(t("routes.stopRequired"));
      return;
    }

    if (!stopForm.latitude || !stopForm.longitude) {
      setError(t("routes.coordinatesRequired"));
      return;
    }

    const created = await createOperatorStop(stopForm);
    setStops((prev) => [created, ...prev]);
    setSelectedStopId(created.id);
    setStopForm(emptyStopForm);
    showMessage("stop", t("routes.stopCreated"));
  }

  async function handleUpdateStop() {
    if (!selectedStopId) {
      setError(t("routes.selectStopFirst"));
      return;
    }

    if (!stopForm.name.trim()) {
      setError(t("routes.stopRequired"));
      return;
    }

    const updated = await updateOperatorStop(selectedStopId, stopForm);
    setStops((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    showMessage("stop", t("routes.stopUpdated"));
  }

  async function handleSelectStop(stopId: string) {
    setSelectedStopId(stopId);

    if (!stopId) {
      setStopForm(emptyStopForm);
      return;
    }

    const stop = await getOperatorStop(stopId);
    setStops((prev) =>
      prev.some((item) => item.id === stop.id)
        ? prev.map((item) => (item.id === stop.id ? stop : item))
        : [stop, ...prev],
    );
    setStopForm({
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
      description: stop.description ?? "",
      address: stop.address ?? "",
      googlePlaceId: stop.googlePlaceId,
    });
  }

  return {
    stopForm,
    setStopForm,
    selectedStopPlace,
    updateStop,
    applyStopPlace,
    handleCreateStop,
    handleUpdateStop,
    handleSelectStop,
  };
}

export type UseStopFormResult = ReturnType<typeof useStopForm>;
