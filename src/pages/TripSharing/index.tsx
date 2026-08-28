import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertCircle,
  FiChevronDown,
  FiClock,
  FiMapPin,
  FiNavigation,
  FiRefreshCw,
  FiShield,
  FiWifi,
  FiWifiOff,
} from "react-icons/fi";

import logo from "../../assets/Login/logo.svg";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import {
  destinationStopColor,
  originStopColor,
} from "../../components/mapRouteStyle";
import { Button } from "../../components/ui/Button";
import SharedTripMap from "./SharedTripMap";
import { captureTripShareTokenFromWindow } from "./tripShareToken";
import {
  useSharedTripTracking,
  type SharedConnectionState,
} from "./useSharedTripTracking";

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

function connectionTone(state: SharedConnectionState): {
  chip: string;
  labelKey: string;
  Icon: typeof FiWifi;
  spin: boolean;
} {
  switch (state) {
    case "live":
      return {
        chip: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
        labelKey: "status.live",
        Icon: FiWifi,
        spin: false,
      };
    case "connecting":
    case "loading":
      return {
        chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
        labelKey: state === "loading" ? "status.loading" : "status.connecting",
        Icon: FiRefreshCw,
        spin: true,
      };
    case "offline":
      return {
        chip: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
        labelKey: "status.offline",
        Icon: FiWifiOff,
        spin: false,
      };
    case "ended":
      return {
        chip: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
        labelKey: "status.ended",
        Icon: FiClock,
        spin: false,
      };
    default:
      return {
        chip: "bg-red-50 text-red-700 ring-1 ring-red-200",
        labelKey: "status.error",
        Icon: FiAlertCircle,
        spin: false,
      };
  }
}

function TrackingSkeleton() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-100" aria-hidden>
      <div className="absolute -left-16 top-[42%] h-20 w-[75%] rotate-[-8deg] rounded-[50%] border-t-4 border-vr-300" />
      <div className="absolute right-[22%] top-[28%] h-4 w-4 animate-pulse rounded-full bg-vr-700 ring-4 ring-white" />
      <div className="absolute bottom-4 left-4 right-4 max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-300" />
        <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}

/** Public guest page: /trip-sharing#token=v1.<grant>.<sig> — hash stripped after capture. */
export default function TripSharingPage() {
  const { t, i18n } = useTranslation("tripShare");
  const { t: tc } = useTranslation("common");
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? captureTripShareTokenFromWindow() : null,
  );

  useEffect(() => {
    document.title = t("documentTitle");

    const previousReferrer = document.querySelector<HTMLMetaElement>(
      'meta[name="referrer"]',
    );
    const referrerMeta = previousReferrer ?? document.createElement("meta");
    const previousReferrerContent = previousReferrer?.content;
    referrerMeta.name = "referrer";
    referrerMeta.content = "no-referrer";
    if (!previousReferrer) document.head.appendChild(referrerMeta);

    const robotsMeta = document.createElement("meta");
    robotsMeta.name = "robots";
    robotsMeta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(robotsMeta);

    return () => {
      if (previousReferrer && previousReferrerContent !== undefined) {
        previousReferrer.content = previousReferrerContent;
      } else {
        referrerMeta.remove();
      }
      robotsMeta.remove();
    };
  }, [t]);

  useEffect(() => {
    const sync = () => {
      const next = captureTripShareTokenFromWindow();
      if (next) setToken(next);
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const tracking = useSharedTripTracking(token);
  const tone = connectionTone(tracking.connection);
  const StatusIcon = tone.Icon;
  const locale = i18n.language?.startsWith("en") ? "en-US" : "vi-VN";
  const speed = tracking.location?.speedKph;
  const speedLabel =
    speed === null || speed === undefined
      ? t("metrics.notReported")
      : t("metrics.speedValue", { value: Math.max(0, Math.round(speed)) });
  const latestUpdate = tracking.location?.recordedAt ?? tracking.context?.lastUpdatedAt;

  const errorCopy = useMemo(() => {
    switch (tracking.errorCode) {
      case "TRACKING_SHARE_TOKEN_INVALID":
        return t("errors.invalidToken");
      case "TRACKING_SHARE_LINK_UNAVAILABLE":
        return t("errors.linkUnavailable");
      case "RATE_LIMITED":
        return t("errors.rateLimited");
      case "TRACKING_SHARE_RATE_LIMIT_UNAVAILABLE":
        return t("errors.temporarilyUnavailable");
      default:
        // Never render raw backend details on a public capability page.
        return t("errors.generic");
    }
  }, [t, tracking.errorCode]);

  const revokedCopy = useMemo(() => {
    switch (tracking.revokedReason) {
      case "EXPIRED":
        return t("revoked.expired");
      case "TRIP_ENDED":
        return t("revoked.tripEnded");
      case "ACCESS_UNAVAILABLE":
        return t("revoked.unavailable");
      case "REVOKED":
      default:
        return tracking.revokedReason ? t("revoked.revoked") : null;
    }
  }, [t, tracking.revokedReason]);

  const showMap = Boolean(tracking.context) && tracking.connection !== "error";
  const showLoading = tracking.connection === "loading";
  const showEnded = tracking.connection === "ended" && !tracking.context;
  const canRetry =
    Boolean(token) &&
    tracking.errorCode !== "TRACKING_SHARE_TOKEN_INVALID" &&
    tracking.errorCode !== "TRACKING_SHARE_LINK_UNAVAILABLE";
  const route = tracking.context?.route;

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={logo}
              alt={tc("brand")}
              className="h-10 w-10 shrink-0 rounded-xl bg-vr-50 object-contain p-1"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-[-0.02em] text-slate-900 sm:text-base">
                {t("brand")}
              </p>
              <p className="truncate text-xs font-medium text-slate-500">
                {t("subtitle")}
              </p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5 lg:px-8">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between lg:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-vr-800">
                {t("route.label")}
              </p>
              <h1 className="mt-1 truncate text-lg font-bold tracking-[-0.02em] text-slate-950 sm:text-xl">
                {route ? (
                  <>
                    {route.originName}
                    <span className="mx-2 text-slate-400" aria-hidden>
                      →
                    </span>
                    {route.destinationName}
                  </>
                ) : (
                  t("route.unknown")
                )}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:justify-end">
              <span
                role="status"
                aria-live="polite"
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tone.chip}`}
              >
                <StatusIcon
                  className={`h-3.5 w-3.5 ${tone.spin ? "motion-safe:animate-spin" : ""}`}
                  aria-hidden
                />
                {t(tone.labelKey)}
              </span>
              <div className="text-xs leading-5 text-slate-500">
                <span className="font-semibold text-slate-700">{t("metrics.lastUpdated")}</span>{" "}
                <span className="tabular-nums">{formatDateTime(latestUpdate, locale)}</span>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1.65fr)_minmax(21rem,0.75fr)]">
            <section
              className="relative h-[52dvh] min-h-[22rem] overflow-hidden bg-slate-100 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[34rem]"
              aria-label={t("map.sectionLabel")}
              aria-busy={showLoading}
            >
              {showMap ? (
                <SharedTripMap context={tracking.context} location={tracking.location} />
              ) : showLoading ? (
                <TrackingSkeleton />
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-7 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-vr-100 text-vr-900">
                    {showEnded ? (
                      <FiClock className="h-6 w-6" aria-hidden />
                    ) : (
                      <FiAlertCircle className="h-6 w-6" aria-hidden />
                    )}
                  </div>
                  <h2 className="mt-4 text-balance text-2xl font-bold text-slate-900">
                    {showEnded ? t("revoked.title") : t("errors.title")}
                  </h2>
                  <p className="mt-3 max-w-md text-pretty text-sm leading-6 text-slate-600">
                    {showEnded ? revokedCopy ?? t("revoked.tripEnded") : errorCopy}
                  </p>
                  {canRetry && tracking.connection === "error" ? (
                    <Button
                      variant="primary"
                      className="mt-6"
                      onClick={tracking.retry}
                      leadingIcon={<FiRefreshCw className="h-4 w-4" aria-hidden />}
                    >
                      {t("actions.retry")}
                    </Button>
                  ) : null}
                </div>
              )}
            </section>

            <aside className="flex flex-col border-t border-slate-200 p-4 sm:p-5 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[34rem] lg:overflow-y-auto lg:border-l lg:border-t-0 lg:p-6">
              <section aria-labelledby="shared-trip-route-heading">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vr-100 text-vr-900">
                    <FiNavigation className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-vr-800">{t("route.label")}</p>
                    <h2
                      id="shared-trip-route-heading"
                      className="mt-0.5 text-base font-bold text-slate-950"
                    >
                      {tracking.context ? t("route.liveTitle") : t("route.unknown")}
                    </h2>
                  </div>
                </div>

                {route ? (
                  <div className="mt-4">
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: originStopColor }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-500">{t("route.origin")}</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">
                          {route.originName}
                        </p>
                      </div>
                    </div>

                    {route.stops.length > 0 ? (
                      <details className="group ml-1.5 border-l border-slate-200 pl-5">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-sm font-semibold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-vr-700 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                          <span>{t("route.intermediateStops", { count: route.stops.length })}</span>
                          <FiChevronDown
                            className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180"
                            aria-hidden
                          />
                        </summary>
                        <ol className="space-y-2 pb-3">
                          {route.stops.map((stop, index) => (
                            <li
                              key={`${stop.sequence}-${stop.name}`}
                              className="flex items-start gap-2.5 text-sm text-slate-600"
                            >
                              <span
                                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-white text-[10px] font-bold"
                                style={{ borderColor: originStopColor, color: originStopColor }}
                                aria-hidden
                              >
                                {index + 1}
                              </span>
                              <span className="min-w-0 leading-5">{stop.name}</span>
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : (
                      <div className="ml-1.5 h-5 border-l border-slate-200" aria-hidden />
                    )}

                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: destinationStopColor }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-500">
                          {t("route.destination")}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">
                          {route.destinationName}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {showLoading ? t("status.loading") : t("route.unavailable")}
                  </p>
                )}
              </section>

              <section className="mt-5 border-t border-slate-200 pt-5" aria-label={t("metrics.sectionLabel")}>
                <div className="grid grid-cols-2 divide-x divide-slate-200">
                  <div className="pr-4">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <FiClock className="h-3.5 w-3.5 text-vr-800" aria-hidden />
                      {t("eta.label")}
                    </p>
                    <p className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] text-slate-950 tabular-nums">
                      {formatRelativeMinutes(
                        tracking.context?.eta?.remainingSeconds ?? null,
                        t("eta.unknown"),
                        (count) => t("eta.inMinutes", { count }),
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 tabular-nums">
                      {formatDateTime(tracking.context?.eta?.estimatedArrivalAt, locale)}
                    </p>
                  </div>

                  <div className="pl-4">
                    <p className="text-xs font-semibold text-slate-500">{t("metrics.speed")}</p>
                    <p className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] text-slate-950 tabular-nums">
                      {speedLabel}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {tracking.location?.recordedAt
                        ? t("metrics.gpsAvailable")
                        : t("metrics.waitingGps")}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">{t("metrics.tripStatus")}</dt>
                    <dd className="text-right font-semibold text-slate-900">
                      {tracking.context?.status
                        ? t(`tripStatus.${tracking.context.status}`, {
                            defaultValue: tracking.context.status,
                          })
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">{t("metrics.lastUpdated")}</dt>
                    <dd className="text-right font-semibold text-slate-900 tabular-nums">
                      {formatDateTime(latestUpdate, locale)}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">{t("link.label")}</dt>
                    <dd className="text-right text-xs leading-5 text-slate-600 tabular-nums">
                      {tracking.context?.expiresAt
                        ? t("link.expires", {
                            time: formatDateTime(tracking.context.expiresAt, locale),
                          })
                        : t("link.unknownExpiry")}
                    </dd>
                  </div>
                </dl>
              </section>

              {revokedCopy && tracking.context ? (
                <div
                  className="mt-4 border-l-2 border-amber-500 bg-amber-50 px-3 py-2.5 text-sm leading-5 text-amber-950"
                  role="status"
                >
                  {revokedCopy}
                </div>
              ) : null}

              <div className="mt-auto border-t border-slate-200 pt-4">
                <div className="flex items-start gap-2.5 text-xs leading-5 text-slate-600">
                  <FiShield className="mt-0.5 h-4 w-4 shrink-0 text-vr-800" aria-hidden />
                  <p>{t("privacy.note")}</p>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <FiMapPin className="h-3.5 w-3.5" aria-hidden />
                  {t("privacy.noLogin")}
                </p>
              </div>
            </aside>
          </div>
        </article>
      </main>
    </div>
  );
}
