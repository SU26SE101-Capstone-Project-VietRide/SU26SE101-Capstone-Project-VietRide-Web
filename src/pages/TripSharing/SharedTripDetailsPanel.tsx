import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  FiActivity,
  FiChevronDown,
  FiClock,
  FiLink,
  FiMapPin,
  FiNavigation,
  FiShield,
} from "react-icons/fi";

import type {
  SharedTripContext,
  SharedTripVehicleLocation,
} from "./tripShareApi";
import {
  destinationStopColor,
  originStopColor,
} from "./sharedTripVisualStyle";

type SharedTripDetailsPanelProps = {
  context: SharedTripContext;
  latestUpdate: string | null | undefined;
  locale: string;
  location: SharedTripVehicleLocation | null;
  revokedCopy: string | null;
};

function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatRelativeMinutes(
  seconds: number | null | undefined,
  unknownLabel: string,
  inMinutes: (count: number) => string,
): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return unknownLabel;
  }
  return inMinutes(Math.max(1, Math.round(seconds / 60)));
}

/** Information rail/sheet; the map stays mounted in its sibling on GPS ticks. */
const SharedTripDetailsPanel = memo(function SharedTripDetailsPanel({
  context,
  latestUpdate,
  locale,
  location,
  revokedCopy,
}: SharedTripDetailsPanelProps) {
  const { t } = useTranslation("tripShare");
  const route = context.route;
  const speedLabel =
    location?.speedKph === null || location?.speedKph === undefined
      ? t("metrics.notReported")
      : t("metrics.speedValue", {
          value: Math.max(0, Math.round(location.speedKph)),
        });
  const etaLabel = formatRelativeMinutes(
    context.eta?.remainingSeconds,
    t("eta.unknown"),
    (count) => t("eta.inMinutes", { count }),
  );

  return (
    <aside
      aria-label={t("metrics.sectionLabel")}
      className="relative z-10 mx-2 -mt-8 flex min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-[#007A76]/15 bg-white shadow-[0_20px_55px_-34px_rgba(0,86,83,0.5)] lg:mx-0 lg:mt-0 lg:h-full"
    >
      <div className="flex justify-center pb-1 pt-2.5 lg:hidden" aria-hidden="true">
        <span className="h-1 w-9 rounded-full bg-[#BBC9C8]" />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-5 pt-2 sm:px-5 lg:p-5">
        <section aria-labelledby="shared-trip-live-heading">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E7F8F7] text-[#007A76]">
              <FiNavigation className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#007A76]">
                {t("route.label")}
              </p>
              <h2
                id="shared-trip-live-heading"
                className="mt-0.5 text-pretty text-base font-extrabold tracking-[-0.02em] text-[#13211F]"
              >
                {t("route.liveTitle")}
              </h2>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#007A76]/20 bg-[#E7F8F7] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-bold text-[#435A57]">
              <FiClock className="h-4 w-4 text-[#007A76]" aria-hidden="true" />
              {t("eta.label")}
            </p>
            <span
              role="status"
              className="inline-flex max-w-[58%] items-center gap-1.5 text-right text-xs font-semibold text-[#005653]"
            >
              <span className="h-2 w-2 rounded-full bg-[#2AC1BC] ring-4 ring-[#2AC1BC]/15" aria-hidden="true" />
              {location?.recordedAt
                ? t("metrics.gpsAvailable")
                : t("metrics.waitingGps")}
            </span>
          </div>
          <p className="mt-3 text-pretty text-2xl font-black tracking-[-0.04em] text-[#13211F] tabular-nums">
            {etaLabel}
          </p>
          <p className="mt-1 text-xs font-medium text-[#435A57] tabular-nums">
            {formatDateTime(context.eta?.estimatedArrivalAt, locale)}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <section className="min-w-0 rounded-2xl border border-[#007A76]/10 bg-[#F4F8FA] p-3.5">
            <p className="flex items-center gap-2 text-xs font-semibold text-[#70817F]">
              <FiActivity className="h-4 w-4 text-[#9A6500]" aria-hidden="true" />
              {t("metrics.speed")}
            </p>
            <p className="mt-2 break-words text-base font-extrabold text-[#13211F] tabular-nums sm:text-lg">
              {speedLabel}
            </p>
          </section>

          <section className="min-w-0 rounded-2xl border border-[#007A76]/10 bg-[#F4F8FA] p-3.5">
            <p className="flex items-center gap-2 text-xs font-semibold text-[#70817F]">
              <FiClock className="h-4 w-4 text-[#627A77]" aria-hidden="true" />
              {t("metrics.lastUpdated")}
            </p>
            <p className="mt-2 break-words text-sm font-extrabold leading-6 text-[#13211F] tabular-nums">
              {formatDateTime(latestUpdate, locale)}
            </p>
          </section>
        </div>

        <section
          className="rounded-2xl border border-[#007A76]/15 bg-white p-4"
          aria-labelledby="shared-trip-route-heading"
        >
          <div className="flex items-center justify-between gap-3">
            <h3
              id="shared-trip-route-heading"
              className="text-sm font-extrabold text-[#13211F]"
            >
              {t("route.label")}
            </h3>
            <span className="text-xs font-semibold text-[#70817F]">
              {t(`tripStatus.${context.status}`, { defaultValue: context.status })}
            </span>
          </div>

          <div className="mt-4">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                style={{ backgroundColor: originStopColor }}
                aria-hidden="true"
              >
                <FiMapPin className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#70817F]">{t("route.origin")}</p>
                <p className="mt-0.5 break-words text-sm font-bold leading-5 text-[#13211F]">
                  {route.originName}
                </p>
              </div>
            </div>

            {route.stops.length > 0 ? (
              <details className="group ml-3.5 border-l border-[#007A76]/20 pl-5">
                <summary className="flex min-h-11 touch-manipulation cursor-pointer list-none items-center justify-between gap-3 py-2 text-sm font-semibold text-[#435A57] outline-none focus-visible:ring-2 focus-visible:ring-[#007A76] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                  <span>{t("route.intermediateStops", { count: route.stops.length })}</span>
                  <span className="shrink-0 motion-safe:transition-transform motion-safe:duration-200 group-open:rotate-180 motion-reduce:transform-none">
                    <FiChevronDown className="h-4 w-4" aria-hidden="true" />
                  </span>
                </summary>
                <ol className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pb-3 pr-1">
                  {route.stops.map((stop, index) => (
                    <li
                      key={`${stop.sequence}-${stop.name}`}
                      className="flex min-w-0 items-start gap-2.5 text-sm text-[#435A57] [content-visibility:auto]"
                    >
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-white text-[10px] font-bold"
                        style={{ borderColor: originStopColor, color: originStopColor }}
                        aria-hidden="true"
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 break-words leading-5">{stop.name}</span>
                    </li>
                  ))}
                </ol>
              </details>
            ) : (
              <div className="ml-3.5 h-5 border-l border-[#007A76]/20" aria-hidden="true" />
            )}

            <div className="flex min-w-0 items-start gap-3">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                style={{ backgroundColor: destinationStopColor }}
                aria-hidden="true"
              >
                <FiMapPin className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#70817F]">
                  {t("route.destination")}
                </p>
                <p className="mt-0.5 break-words text-sm font-bold leading-5 text-[#13211F]">
                  {route.destinationName}
                </p>
              </div>
            </div>
          </div>
        </section>

        <dl className="space-y-2.5 rounded-2xl bg-[#F4F8FA] p-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-[#70817F]">{t("metrics.tripStatus")}</dt>
            <dd className="text-right font-bold text-[#13211F]">
              {t(`tripStatus.${context.status}`, { defaultValue: context.status })}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-[#70817F]">
              <FiLink className="h-3.5 w-3.5" aria-hidden="true" />
              {t("link.label")}
            </dt>
            <dd className="max-w-[62%] text-right text-xs font-semibold leading-5 text-[#435A57] tabular-nums">
              {context.expiresAt
                ? t("link.expires", {
                    time: formatDateTime(context.expiresAt, locale),
                  })
                : t("link.unknownExpiry")}
            </dd>
          </div>
        </dl>

        {revokedCopy ? (
          <div
            className="rounded-xl border border-[#EBC300]/45 bg-[#FFF4BF] px-3.5 py-3 text-sm font-medium leading-5 text-[#795900]"
            role="status"
            aria-live="polite"
          >
            {revokedCopy}
          </div>
        ) : null}

        <footer className="rounded-2xl border border-[#007A76]/15 bg-white p-4">
          <div className="flex items-start gap-2.5 text-xs leading-5 text-[#435A57]">
            <FiShield className="mt-0.5 h-4 w-4 shrink-0 text-[#007A76]" aria-hidden="true" />
            <p>{t("privacy.note")}</p>
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-[#70817F]">
            <FiMapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {t("privacy.noLogin")}
          </p>
        </footer>
      </div>
    </aside>
  );
});

export default SharedTripDetailsPanel;
