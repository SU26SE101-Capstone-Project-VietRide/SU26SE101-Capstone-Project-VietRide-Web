// Modal tạo tuyến nhanh: chỉ gồm các field bắt buộc của createOperatorRoute
// (tên + bến đi + bến đến). Field nâng cao chỉnh sau trong tab Thông tin.
// Chọn đủ 2 bến có tọa độ → tự tính km/thời lượng (Google Routes, fallback haversine)
// và gửi kèm khi tạo — không bắt user nhập tay số liệu máy tính được.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiGitBranch, FiLoader, FiPlus } from "react-icons/fi";
import Modal from "../../../components/Modal";
import { distanceKmBetween, requestRoadGeometry } from "./geometry";
import { estimateCoachDurationMinutes } from "./polyline";
import { Input, StationSelect } from "./formControls";
import type { StationOption } from "./types";

export type CreateRouteBasics = {
  name: string;
  originStationId: string;
  destinationStationId: string;
  // Số liệu tự tính (nếu có) — prefill totalDistanceKm/estimatedDurationMinutes lúc tạo
  totalDistanceKm?: number;
  estimatedDurationMinutes?: number;
};

type AutoMetrics = {
  // Cặp bến mà số liệu thuộc về — chỉ hiển thị/gửi khi khớp cặp đang chọn
  pairKey: string;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
};

type CreateRouteModalProps = {
  open: boolean;
  onClose: () => void;
  stations: StationOption[];
  onSubmit: (basics: CreateRouteBasics) => Promise<void>;
};

const emptyBasics: CreateRouteBasics = {
  name: "",
  originStationId: "",
  destinationStationId: "",
};

export default function CreateRouteModal({
  open,
  onClose,
  stations,
  onSubmit,
}: CreateRouteModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [basics, setBasics] = useState<CreateRouteBasics>(emptyBasics);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [computedMetrics, setComputedMetrics] = useState<AutoMetrics | null>(
    null,
  );
  const [calculatingPairKey, setCalculatingPairKey] = useState("");
  const [failedPairKey, setFailedPairKey] = useState("");
  // Chỉ tính lại khi CẶP bến đổi — tránh gọi lặp Google Routes
  const lastCalculatedPairRef = useRef("");
  // Trạng thái auto-fill suy ra từ cặp bến đang chọn — không cần setState đồng bộ trong effect
  const originStation = stations.find(
    (station) => station.id === basics.originStationId,
  );
  const destinationStation = stations.find(
    (station) => station.id === basics.destinationStationId,
  );
  const metricsPairKey =
    originStation &&
    destinationStation &&
    originStation.id !== destinationStation.id
      ? `${originStation.id}:${destinationStation.id}`
      : "";
  const pairHasCoordinates = Boolean(
    metricsPairKey &&
      originStation?.latitude &&
      originStation?.longitude &&
      destinationStation?.latitude &&
      destinationStation?.longitude,
  );
  const autoMetrics =
    metricsPairKey && computedMetrics?.pairKey === metricsPairKey
      ? computedMetrics
      : null;
  const isCalculatingMetrics =
    Boolean(metricsPairKey) && calculatingPairKey === metricsPairKey;
  const metricsFallback =
    Boolean(metricsPairKey) &&
    (!pairHasCoordinates || failedPairKey === metricsPairKey);
  const canSubmit =
    Boolean(basics.name.trim()) &&
    Boolean(basics.originStationId) &&
    Boolean(basics.destinationStationId) &&
    basics.originStationId !== basics.destinationStationId &&
    !isSubmitting;

  useEffect(() => {
    if (
      !metricsPairKey ||
      !pairHasCoordinates ||
      !originStation ||
      !destinationStation ||
      lastCalculatedPairRef.current === metricsPairKey
    ) {
      return;
    }

    lastCalculatedPairRef.current = metricsPairKey;
    const pairKey = metricsPairKey;
    const origin = originStation;
    const destination = destinationStation;
    let cancelled = false;
    void (async () => {
      setCalculatingPairKey(pairKey);

      try {
        const result = await requestRoadGeometry(
          [
            { latitude: origin.latitude, longitude: origin.longitude },
            {
              latitude: destination.latitude,
              longitude: destination.longitude,
            },
          ],
          t("routes.routingFailed"),
        );

        if (!cancelled) {
          setComputedMetrics({
            pairKey,
            totalDistanceKm: result.totalDistanceKm,
            estimatedDurationMinutes: result.estimatedDurationMinutes,
          });
        }
      } catch {
        if (!cancelled) {
          // Fallback: thiếu key/lỗi mạng → ước lượng đường chim bay, kèm hint nhập tay
          const distance = distanceKmBetween(origin, destination);
          setComputedMetrics({
            pairKey,
            totalDistanceKm: Number(distance.toFixed(1)),
            estimatedDurationMinutes: estimateCoachDurationMinutes(distance),
          });
          setFailedPairKey(pairKey);
        }
      } finally {
        if (!cancelled) {
          setCalculatingPairKey((current) =>
            current === pairKey ? "" : current,
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    destinationStation,
    metricsPairKey,
    originStation,
    pairHasCoordinates,
    t,
  ]);

  function updateBasics<K extends keyof CreateRouteBasics>(
    key: K,
    value: CreateRouteBasics[K],
  ) {
    setBasics((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setBasics(emptyBasics);
    setError("");
    setComputedMetrics(null);
    setCalculatingPairKey("");
    setFailedPairKey("");
    lastCalculatedPairRef.current = "";
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    setError("");
    setIsSubmitting(true);

    try {
      // Gửi kèm số liệu tự tính (nếu có) để tuyến mới không bị 0 km / 0 phút
      await onSubmit(
        autoMetrics
          ? {
              ...basics,
              totalDistanceKm: autoMetrics.totalDistanceKm,
              estimatedDurationMinutes: autoMetrics.estimatedDurationMinutes,
            }
          : basics,
      );
      resetForm();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("routes.actionFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t("routes.createRouteModalTitle")}
      subtitle={t("routes.createRouteModalSubtitle")}
      icon={<FiGitBranch />}
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600 disabled:opacity-50"
          >
            <FiPlus size={16} />
            {t("routes.createRoute")}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label={t("routes.routeName")}
          value={basics.name}
          onChange={(value) => updateBasics("name", value)}
          placeholder={t("routes.namePlaceholder")}
        />
        <StationSelect
          label={t("routes.originStationId")}
          stations={stations}
          value={basics.originStationId}
          placeholder={t("routes.selectOriginStation")}
          onChange={(value) => updateBasics("originStationId", value)}
        />
        <StationSelect
          label={t("routes.destinationStationId")}
          stations={stations}
          value={basics.destinationStationId}
          placeholder={t("routes.selectDestinationStation")}
          onChange={(value) => updateBasics("destinationStationId", value)}
        />
        {(isCalculatingMetrics || autoMetrics || metricsFallback) && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            {isCalculatingMetrics ? (
              <span className="flex items-center gap-2">
                <FiLoader className="animate-spin" size={12} />
                {t("routes.autoMetricsCalculating")}
              </span>
            ) : (
              <>
                {autoMetrics && (
                  <p className="text-sm font-semibold text-gray-800">
                    {autoMetrics.totalDistanceKm} {t("routes.kmUnit")} ·{" "}
                    {Math.floor(autoMetrics.estimatedDurationMinutes / 60)}{" "}
                    {t("routes.hours")}{" "}
                    {autoMetrics.estimatedDurationMinutes % 60}{" "}
                    {t("routes.minutes")}
                  </p>
                )}
                <p
                  className={`mt-1 ${
                    metricsFallback ? "text-amber-600" : "text-gray-500"
                  }`}
                >
                  {metricsFallback
                    ? t("routes.autoMetricsFallbackHint")
                    : t("routes.autoMetricsBadge")}
                </p>
              </>
            )}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
