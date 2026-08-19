import { useMemo } from "react";
import { FiClock, FiFlag, FiMapPin } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import type {
  PublicTrip,
  TrackingEstimateQuality,
  TrackingEtaTarget,
} from "../../../api/vietride";

type EtaTimelineProps = {
  trip: PublicTrip | null;
  etaTargets: TrackingEtaTarget[];
};

type EtaTimelineItem = {
  key: string;
  kind: "STOP" | "STATION";
  name: string;
  eta: TrackingEtaTarget | null;
  plannedArrivalTime: string | null;
  plannedQuality?: TrackingEstimateQuality;
};

function targetKey(target: TrackingEtaTarget): string {
  return target.targetKind === "STOP"
    ? `STOP:${target.stopId}`
    : `STATION:${target.stationId}`;
}

function formatArrivalTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) return `${distanceMeters} m`;

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(distanceMeters / 1000)} km`;
}

export function EtaTimeline({ trip, etaTargets }: EtaTimelineProps) {
  const { t } = useTranslation("manager");

  const items = useMemo<EtaTimelineItem[]>(() => {
    if (!trip) {
      return etaTargets.map((eta, index) => ({
        key: targetKey(eta),
        kind: eta.targetKind,
        name:
          eta.stopName ??
          (eta.targetKind === "STOP"
            ? t("gps.intermediateStop", {
                sequence: eta.sequence ?? index + 1,
              })
            : t("gps.destinationStation")),
        eta,
        plannedArrivalTime: null,
      }));
    }

    const etaByTarget = new Map(
      etaTargets.map((eta) => [targetKey(eta), eta] as const),
    );
    const pendingStops = [...trip.stops]
      .filter((stop) => !stop.status || stop.status === "PENDING")
      .sort((left, right) => left.orderIndex - right.orderIndex);
    const plannedStopIds = new Set(pendingStops.map((stop) => stop.stopId));

    const stopItems: EtaTimelineItem[] = pendingStops.map((stop) => {
      const key = `STOP:${stop.stopId}`;
      const dynamicEta = etaByTarget.get(key) ?? null;

      return {
        key,
        kind: "STOP",
        name:
          dynamicEta?.stopName ??
          stop.name ??
          t("gps.intermediateStop", { sequence: stop.orderIndex }),
        eta: dynamicEta,
        plannedArrivalTime: stop.estimatedArrivalTime,
        plannedQuality: trip.plannedEtaQuality,
      };
    });

    const extraRealtimeStops: EtaTimelineItem[] = etaTargets
      .filter(
        (eta): eta is Extract<TrackingEtaTarget, { targetKind: "STOP" }> =>
          eta.targetKind === "STOP" && !plannedStopIds.has(eta.stopId),
      )
      .map((eta, index) => ({
        key: targetKey(eta),
        kind: "STOP",
        name:
          eta.stopName ??
          t("gps.intermediateStop", {
            sequence: eta.sequence ?? pendingStops.length + index + 1,
          }),
        eta,
        plannedArrivalTime: null,
      }));

    const destinationKey = `STATION:${trip.destinationStation.id}`;
    const destinationEta = etaByTarget.get(destinationKey) ?? null;

    return [
      ...stopItems,
      ...extraRealtimeStops,
      {
        key: destinationKey,
        kind: "STATION",
        name: destinationEta?.stopName ?? trip.destinationStation.name,
        eta: destinationEta,
        plannedArrivalTime: trip.estimatedArrivalTime,
        plannedQuality: trip.plannedEtaQuality,
      },
    ];
  }, [etaTargets, t, trip]);

  return (
    <section
      className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white"
      aria-labelledby="trip-eta-timeline-title"
    >
      <div className="border-b border-gray-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-vr-50 text-vr-900">
            <FiClock size={16} aria-hidden="true" />
          </span>
          <div>
            <h3
              id="trip-eta-timeline-title"
              className="text-sm font-bold text-gray-900"
            >
              {t("gps.etaTimelineTitle")}
            </h3>
            <p className="text-xs text-gray-500">
              {t("gps.etaTimelineHint")}
            </p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-gray-500">
          {t("gps.etaTimelineEmpty")}
        </p>
      ) : (
        <ol className="divide-y divide-gray-100">
          {items.map((item, index) => {
            const arrivalTime =
              item.eta?.estimatedArrivalTime ?? item.plannedArrivalTime;
            const quality = item.eta?.estimateQuality ?? item.plannedQuality;
            const isRealtime = item.eta !== null;
            const isDestination = item.kind === "STATION";

            return (
              <li
                key={item.key}
                data-testid={`eta-target-${item.key}`}
                className="relative flex gap-3 px-4 py-3.5"
              >
                {index < items.length - 1 && (
                  <span
                    className="absolute bottom-0 left-[29px] top-10 w-px bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
                    isDestination
                      ? "bg-vr-800 text-white"
                      : "border-2 border-vr-200 bg-vr-50 text-vr-900"
                  }`}
                >
                  {isDestination ? (
                    <FiFlag size={13} aria-hidden="true" />
                  ) : (
                    <FiMapPin size={12} aria-hidden="true" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {item.name}
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          isRealtime
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isRealtime
                          ? t("gps.etaRealtime")
                          : t("gps.etaPlanned")}
                      </span>
                    </div>

                    <div className="shrink-0 text-right">
                      <time
                        dateTime={arrivalTime ?? undefined}
                        className="block text-sm font-bold tabular-nums text-gray-900"
                      >
                        {formatArrivalTime(arrivalTime)}
                      </time>
                      <span className="text-[11px] text-gray-500">
                        {t("gps.estimatedArrival")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                    {item.eta && (
                      <>
                        <span className="font-semibold text-vr-900">
                          {t("gps.etaMinutes", {
                            minutes: item.eta.etaMinutes,
                          })}
                        </span>
                        <span>{formatDistance(item.eta.distanceMeters)}</span>
                      </>
                    )}
                    {quality && (
                      <span>
                        {quality === "TRAFFIC_AWARE"
                          ? t("gps.etaTrafficAware")
                          : t("gps.etaFallbackQuality")}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

