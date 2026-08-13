import { useToastFeedback } from "../../../hooks/useToastFeedback";
// Modal tạo tuyến: thu thập đầy đủ field nghiệp vụ của route ngay từ lúc tạo.
// Chọn đủ 2 bến có tọa độ → tự tính đường (Google Routes) và gửi kèm pathPolyline
// khi tạo qua POST /routes/full — có polyline thì KHÔNG gửi manualMetrics (server
// tự tính, contract 12.1). Fallback haversine (thiếu key/lỗi mạng) → gửi manualMetrics.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckCircle,
  FiClock,
  FiGitBranch,
  FiLoader,
  FiMapPin,
  FiPlus,
  FiRepeat,
} from "react-icons/fi";
import CustomSelect from "../../../components/CustomSelect";
import Modal from "../../../components/Modal";
import { ApiRequestError } from "../../../api/client";
import {
  inputClass,
  labelClass,
} from "../../../components/form/formClasses";
import type {
  OperatorRoute,
  RouteManualMetrics,
} from "../../../api/vietride";
import { distanceKmBetween, requestRoadGeometry } from "./geometry";
import { encodeGooglePolyline, estimateCoachDurationMinutes } from "./polyline";
import DurationInput from "./DurationInput";
import { Input, NumberInput, StationSelect } from "./formControls";
import type { StationOption } from "./types";

export type CreateRouteBasics = {
  name: string;
  originStationId: string;
  destinationStationId: string;
  returnRouteId: string;
  baseFare: number;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  isActive: boolean;
  // Đường đã auto-tính (Google Routes) — gửi thẳng vào POST /routes/full
  pathPolyline?: string;
  // Chỉ gửi khi KHÔNG có polyline (fallback nhập ước lượng haversine)
  manualMetrics?: RouteManualMetrics;
};

type AutoMetrics = {
  // Cặp bến mà số liệu thuộc về — chỉ hiển thị/gửi khi khớp cặp đang chọn
  pairKey: string;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  // Polyline mã hóa từ Google Routes; rỗng khi rơi vào fallback haversine
  pathPolyline: string;
};

type CreateRouteModalProps = {
  open: boolean;
  onClose: () => void;
  routes: OperatorRoute[];
  stations: StationOption[];
  onSubmit: (basics: CreateRouteBasics) => Promise<void>;
  onOpenExistingRoute?: (routeId: string) => void;
};

const emptyBasics: CreateRouteBasics = {
  name: "",
  originStationId: "",
  destinationStationId: "",
  returnRouteId: "",
  baseFare: 0,
  totalDistanceKm: 0,
  estimatedDurationMinutes: 0,
  isActive: true,
};

export default function CreateRouteModal({
  open,
  onClose,
  routes,
  stations,
  onSubmit,
  onOpenExistingRoute,
}: CreateRouteModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [basics, setBasics] = useState<CreateRouteBasics>(emptyBasics);
  const [error, setError] = useState("");
  const [duplicateRouteId, setDuplicateRouteId] = useState("");
  useToastFeedback({ error });
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
    basics.baseFare >= 0 &&
    basics.totalDistanceKm >= 0 &&
    basics.estimatedDurationMinutes >= 0 &&
    !isCalculatingMetrics &&
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
        // requestRoadGeometry trả mảng phương án — modal giữ đơn giản, luôn dùng
        // phương án ĐẦU TIÊN (đề xuất chính của Google); đổi phương án làm sau
        // trong tab Thông tin
        const [firstOption] = await requestRoadGeometry(
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
          setBasics((current) =>
            `${current.originStationId}:${current.destinationStationId}` ===
            pairKey
              ? {
                  ...current,
                  totalDistanceKm: firstOption.totalDistanceKm,
                  estimatedDurationMinutes:
                    firstOption.estimatedDurationMinutes,
                }
              : current,
          );
          setComputedMetrics({
            pairKey,
            totalDistanceKm: firstOption.totalDistanceKm,
            estimatedDurationMinutes: firstOption.estimatedDurationMinutes,
            pathPolyline: encodeGooglePolyline(firstOption.points),
          });
        }
      } catch {
        if (!cancelled) {
          // Fallback: thiếu key/lỗi mạng → ước lượng đường chim bay, kèm hint nhập tay
          const distance = distanceKmBetween(origin, destination);
          const totalDistanceKm = Number(distance.toFixed(1));
          const estimatedDurationMinutes =
            estimateCoachDurationMinutes(distance);
          setBasics((current) =>
            `${current.originStationId}:${current.destinationStationId}` ===
            pairKey
              ? {
                  ...current,
                  totalDistanceKm,
                  estimatedDurationMinutes,
                }
              : current,
          );
          setComputedMetrics({
            pairKey,
            totalDistanceKm,
            estimatedDurationMinutes,
            pathPolyline: "",
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
    setBasics((prev) => {
      const next = { ...prev, [key]: value };

      if (
        (key === "originStationId" || key === "destinationStationId") &&
        prev[key] !== value
      ) {
        next.totalDistanceKm = 0;
        next.estimatedDurationMinutes = 0;
      }

      return next;
    });
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
      // Có polyline tự tính → gửi polyline, KHÔNG gửi manualMetrics (server tự
      // tính — contract 12.1). Fallback không polyline → gửi manualMetrics.
      await onSubmit(
        autoMetrics?.pathPolyline
          ? { ...basics, pathPolyline: autoMetrics.pathPolyline }
          : {
              ...basics,
              manualMetrics: {
                totalDistanceKm: basics.totalDistanceKm,
                estimatedDurationMinutes: basics.estimatedDurationMinutes,
              },
            },
      );
      resetForm();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "ROUTE_DUPLICATED") {
        setDuplicateRouteId(
          err.fields?.find((field) => field.field === "existingRouteId")?.message ?? "",
        );
        setError(err.message || t("routes.duplicateRoute"));
        return;
      }

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
      wide
      title={t("routes.createRouteModalTitle")}
      subtitle={t("routes.createRouteModalSubtitle")}
      icon={<FiGitBranch />}
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
          >
            {tc("cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-vr-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-vr-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <FiLoader className="animate-spin" size={16} />
            ) : (
              <FiPlus size={16} />
            )}
            {t("routes.createRoute")}
          </button>
        </>
      }
    >
      {/* Nội dung lỗi đã hiện qua toast (useToastFeedback ở trên) — banner ở đây chỉ
          còn giữ lại hành động điều hướng cho case trùng tuyến, không lặp lại thông điệp. */}
      {duplicateRouteId && onOpenExistingRoute && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            onClick={() => onOpenExistingRoute(duplicateRouteId)}
          >
            {t("routes.openExistingRoute")}
          </button>
        </div>
      )}

      <div className="space-y-5">
        <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-vr-700 shadow-sm ring-1 ring-gray-200">
              <FiMapPin aria-hidden="true" size={17} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                {t("routes.createRouteJourneySection")}
              </h3>
              <p className="mt-0.5 text-xs leading-5 text-gray-500">
                {t("routes.createRouteJourneyHint")}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <Input
              label={t("routes.routeName")}
              value={basics.name}
              onChange={(value) => updateBasics("name", value)}
              placeholder={t("routes.namePlaceholder")}
            />
            <div className="grid gap-4 sm:grid-cols-2">
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
                onChange={(value) =>
                  updateBasics("destinationStationId", value)
                }
              />
            </div>
          </div>
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <FiRepeat aria-hidden="true" size={17} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {t("routes.createRouteOperationsSection")}
                </h3>
                <p className="mt-0.5 text-xs leading-5 text-gray-500">
                  {t("routes.createRouteOperationsHint")}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>
                  {t("routes.returnRouteId")}
                </label>
                <CustomSelect
                  aria-label={t("routes.returnRouteId")}
                  className={inputClass}
                  allowWrap
                  value={basics.returnRouteId}
                  searchable
                  searchPlaceholder={tc("searchOptions", {
                    label: t("routes.returnRouteId"),
                  })}
                  emptyMessage={tc("noMatchingOptions")}
                  onChange={(event) =>
                    updateBasics("returnRouteId", event.target.value)
                  }
                >
                  <option value="">{t("routes.noReturnRoute")}</option>
                  {routes
                    .filter((route) => route.isActive)
                    .map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.name}
                      </option>
                    ))}
                </CustomSelect>
              </div>
              <NumberInput
                label={t("routes.baseFare")}
                value={basics.baseFare}
                onChange={(value) => updateBasics("baseFare", value)}
                currency
              />
    
            </div>
          </section>

          <section className="rounded-xl border border-vr-100 bg-vr-50/30 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vr-100 text-vr-800">
                <FiClock aria-hidden="true" size={17} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {t("routes.createRouteMetricsSection")}
                </h3>
                <p className="mt-0.5 text-xs leading-5 text-gray-500">
                  {t("routes.createRouteMetricsHint")}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <NumberInput
                label={t("routes.totalDistance")}
                value={basics.totalDistanceKm}
                onChange={(value) => updateBasics("totalDistanceKm", value)}
                disabled={
                  isCalculatingMetrics || Boolean(autoMetrics?.pathPolyline)
                }
              />
              <DurationInput
                label={t("routes.durationMinutes")}
                value={basics.estimatedDurationMinutes}
                onChange={(value) =>
                  updateBasics("estimatedDurationMinutes", value)
                }
                hourLabel={t("routes.hours")}
                minuteLabel={t("routes.minutes")}
                segmentedUnits
                disabled={
                  isCalculatingMetrics || Boolean(autoMetrics?.pathPolyline)
                }
              />
            </div>

            {isCalculatingMetrics ? (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                <FiLoader className="animate-spin" size={13} />
                {t("routes.autoMetricsCalculating")}
              </div>
            ) : metricsFallback ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                {t("routes.autoMetricsFallbackHint")}
              </div>
            ) : autoMetrics?.pathPolyline ? (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                <FiCheckCircle size={14} />
                {t("routes.autoMetricsBadge")}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </Modal>
  );
}
