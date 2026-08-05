// Hook cục bộ: state + thao tác tuyến thay thế (tối đa 2 tuyến/tuyến chính)
import { useCallback, useState } from "react";
import {
  createAlternativeRoute,
  deleteAlternativeRoute,
  updateAlternativeRoute,
  type AlternativeRoute,
  type AlternativeRouteRequest,
  type OperatorStop,
} from "../../../api/vietride";
import {
  alternativeRouteToForm,
  emptyAlternativeRouteForm,
} from "./routeFormUtils";
import type { FeedbackScope, TranslateFn } from "./types";

type UseAlternativeRoutesParams = {
  selectedRouteId: string;
  originStationId: string;
  stops: OperatorStop[];
  setError: (message: string) => void;
  showMessage: (scope: FeedbackScope, message: string) => void;
  t: TranslateFn;
};

export function useAlternativeRoutes({
  selectedRouteId,
  originStationId,
  stops,
  setError,
  showMessage,
  t,
}: UseAlternativeRoutesParams) {
  const [alternativeRoutes, setAlternativeRoutes] = useState<AlternativeRoute[]>([]);
  const [selectedAlternativeRouteId, setSelectedAlternativeRouteId] = useState("");
  const [alternativeForm, setAlternativeForm] =
    useState<AlternativeRouteRequest>(emptyAlternativeRouteForm);
  const [alternativeStopId, setAlternativeStopId] = useState("");
  const [alternativeStopDuration, setAlternativeStopDuration] = useState(0);
  const [alternativeStopDistance, setAlternativeStopDistance] = useState(0);

  // Đồng bộ danh sách tuyến thay thế sau khi load — identity ổn định để loadData phụ thuộc được
  const applyAlternatives = useCallback((items: AlternativeRoute[]) => {
    setAlternativeRoutes(items);
    const nextAlternative = items[0];
    setSelectedAlternativeRouteId(nextAlternative?.id ?? "");
    setAlternativeForm(
      nextAlternative
        ? alternativeRouteToForm(nextAlternative)
        : emptyAlternativeRouteForm,
    );
  }, []);

  const resetAlternatives = useCallback(() => {
    setAlternativeRoutes([]);
    setSelectedAlternativeRouteId("");
    setAlternativeForm(emptyAlternativeRouteForm);
  }, []);

  function startNewAlternative() {
    setSelectedAlternativeRouteId("");
    setAlternativeForm(emptyAlternativeRouteForm);
  }

  function handleSelectAlternativeRoute(alternativeRouteId: string) {
    setSelectedAlternativeRouteId(alternativeRouteId);
    const alternative = alternativeRoutes.find((item) => item.id === alternativeRouteId);
    setAlternativeForm(alternative ? alternativeRouteToForm(alternative) : emptyAlternativeRouteForm);
    setAlternativeStopId("");
  }

  function updateAlternative<K extends keyof AlternativeRouteRequest>(
    key: K,
    value: AlternativeRouteRequest[K],
  ) {
    setAlternativeForm((current) => ({ ...current, [key]: value }));
  }

  function handleAddAlternativeStop() {
    const stop = stops.find((item) => item.id === alternativeStopId);
    if (!stop) {
      setError(t("routes.alternativeStopRequired"));
      return;
    }
    if (alternativeForm.stops.some((item) => item.stopId === stop.id)) {
      setError(t("routes.alternativeDuplicateStop"));
      return;
    }
    setAlternativeForm((current) => ({
      ...current,
      stops: [...current.stops, {
        stopId: stop.id,
        orderIndex: current.stops.length + 1,
        estimatedDurationFromOriginMinutes: alternativeStopDuration,
        distanceFromOriginKm: alternativeStopDistance,
      }],
    }));
    setAlternativeStopId("");
    setAlternativeStopDuration(0);
    setAlternativeStopDistance(0);
  }

  function handleRemoveAlternativeStop(stopId: string) {
    setAlternativeForm((current) => ({
      ...current,
      stops: current.stops
        .filter((item) => item.stopId !== stopId)
        .map((item, index) => ({ ...item, orderIndex: index + 1 })),
    }));
  }

  async function handleCreateAlternativeRoute() {
    if (!selectedRouteId) {
      setError(t("routes.selectRouteFirst"));
      return;
    }
    if (alternativeRoutes.length >= 2) {
      setError(t("routes.alternativeLimitReached"));
      return;
    }
    if (!alternativeForm.name.trim()) {
      setError(t("routes.alternativeNameRequired"));
      return;
    }
    if (!alternativeForm.destinationStationId) {
      setError(t("routes.alternativeDestinationRequired"));
      return;
    }
    if (alternativeForm.destinationStationId === originStationId) {
      setError(t("routes.alternativeDestinationInvalid"));
      return;
    }
    const created = await createAlternativeRoute(selectedRouteId, alternativeForm);
    setAlternativeRoutes((current) => [...current, created]);
    setSelectedAlternativeRouteId(created.id);
    setAlternativeForm(alternativeRouteToForm(created));
    showMessage("alternative", t("routes.alternativeCreated"));
  }

  async function handleUpdateAlternativeRoute() {
    if (!selectedAlternativeRouteId) {
      setError(t("routes.selectAlternativeFirst"));
      return;
    }
    const updated = await updateAlternativeRoute(selectedAlternativeRouteId, alternativeForm);
    setAlternativeRoutes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setAlternativeForm(alternativeRouteToForm(updated));
    showMessage("alternative", t("routes.alternativeUpdated"));
  }

  async function handleDeleteAlternativeRoute() {
    if (!selectedAlternativeRouteId) {
      setError(t("routes.selectAlternativeFirst"));
      return;
    }
    await deleteAlternativeRoute(selectedAlternativeRouteId);
    const remaining = alternativeRoutes.filter((item) => item.id !== selectedAlternativeRouteId);
    const nextAlternative = remaining[0];
    setAlternativeRoutes(remaining);
    setSelectedAlternativeRouteId(nextAlternative?.id ?? "");
    setAlternativeForm(nextAlternative ? alternativeRouteToForm(nextAlternative) : emptyAlternativeRouteForm);
    showMessage("alternative", t("routes.alternativeDeleted"));
  }

  return {
    alternativeRoutes,
    selectedAlternativeRouteId,
    alternativeForm,
    alternativeStopId,
    setAlternativeStopId,
    alternativeStopDuration,
    setAlternativeStopDuration,
    alternativeStopDistance,
    setAlternativeStopDistance,
    applyAlternatives,
    resetAlternatives,
    startNewAlternative,
    handleSelectAlternativeRoute,
    updateAlternative,
    handleAddAlternativeStop,
    handleRemoveAlternativeStop,
    handleCreateAlternativeRoute,
    handleUpdateAlternativeRoute,
    handleDeleteAlternativeRoute,
  };
}

export type UseAlternativeRoutesResult = ReturnType<typeof useAlternativeRoutes>;
