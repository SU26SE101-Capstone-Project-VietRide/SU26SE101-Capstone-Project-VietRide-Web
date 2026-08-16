import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertCircle,
  FiArrowRight,
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
    <div className="absolute inset-0 overflow-hidden bg-gray-100" aria-hidden>
      <div className="absolute -left-16 top-[42%] h-20 w-[75%] rotate-[-8deg] rounded-[50%] border-t-[5px] border-vr-300" />
      <div className="absolute right-[22%] top-[28%] h-4 w-4 animate-pulse rounded-full bg-vr-400 ring-4 ring-white/80" />
      <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-gray-200 bg-white/85 p-4 shadow-sm backdrop-blur-sm">
        <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-gray-300" />
        <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-gray-200" />
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

  const speedLabel = useMemo(() => {
    const speed = tracking.location?.speedKph;
    if (speed === null || speed === undefined) return t("metrics.notReported");
    return t("metrics.speedValue", { value: Math.max(0, Math.round(speed)) });
  }, [t, tracking.location?.speedKph]);

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
  const canRetry = Boolean(token) &&
    tracking.errorCode !== "TRACKING_SHARE_TOKEN_INVALID" &&
    tracking.errorCode !== "TRACKING_SHARE_LINK_UNAVAILABLE";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-vr-500 text-slate-900">
      <header className="relative z-10 mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={logo}
            alt={tc("brand")}
            className="h-11 w-11 shrink-0 rounded-[1rem] bg-white/85 object-contain p-1"
          />
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold tracking-[-0.02em] text-white">
              {t("brand")}
            </p>
            <p className="truncate text-xs font-medium text-white/85">
              {t("subtitle")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            aria-live="polite"
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tone.chip}`}
          >
            <StatusIcon
              className={`h-3.5 w-3.5 ${tone.spin ? "animate-spin" : ""}`}
              aria-hidden
            />
            <span className="hidden sm:inline">{t(tone.labelKey)}</span>
          </span>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1440px] px-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] sm:px-5 lg:px-8">
        <article className="grid min-h-[calc(100dvh-5.6rem)] overflow-hidden rounded-[1.75rem] bg-slate-50 shadow-xl lg:grid-cols-[minmax(0,1.65fr)_minmax(21rem,0.75fr)]">
          <section className="relative min-h-[46dvh] overflow-hidden bg-gray-100 lg:min-h-0" aria-label={t("map.sectionLabel")}>
            {showMap ? (
              <SharedTripMap context={tracking.context} location={tracking.location} />
            ) : showLoading ? (
              <TrackingSkeleton />
            ) : (
              <div className="flex h-full min-h-[46dvh] flex-col items-center justify-center px-7 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-vr-100 text-vr-800">
                  {showEnded ? (
                    <FiClock className="h-7 w-7" aria-hidden />
                  ) : (
                    <FiAlertCircle className="h-7 w-7" aria-hidden />
                  )}
                </div>
                <h1 className="mt-4 text-balance text-2xl font-bold text-slate-900">
                  {showEnded ? t("revoked.title") : t("errors.title")}
                </h1>
                <p className="mt-3 max-w-md text-pretty text-sm leading-6 text-slate-600">
                  {showEnded ? revokedCopy ?? t("revoked.tripEnded") : errorCopy}
                </p>
                {canRetry && tracking.connection === "error" ? (
                  <button
                    type="button"
                    onClick={tracking.retry}
                    className="mt-6 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-vr-500 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-vr-600"
                  >
                    <FiRefreshCw className="h-4 w-4" aria-hidden />
                    {t("actions.retry")}
                  </button>
                ) : null}
              </div>
            )}

            {showMap ? (
              <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center lg:inset-x-5 lg:top-5">
                <div className="max-w-full rounded-xl border border-gray-200 bg-white/95 px-3.5 py-2 shadow-sm backdrop-blur-md">
                  <p className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <FiNavigation className="h-4 w-4 shrink-0 text-vr-700" aria-hidden />
                    <span className="truncate">
                      {tracking.context?.route.originName} → {tracking.context?.route.destinationName}
                    </span>
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="flex flex-col border-t border-gray-200 bg-white p-4 sm:p-5 lg:border-l lg:border-t-0 lg:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vr-100 text-vr-800">
                <FiNavigation className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-vr-800">{t("route.label")}</p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                  {tracking.context ? t("route.liveTitle") : t("route.unknown")}
                </h2>
              </div>
            </div>

            {tracking.context ? (
              // Chấm bến đi/bến đến dùng ĐÚNG màu pin trên bản đồ (mapRouteStyle)
              // để panel và bản đồ đọc ra cùng một thứ.
              <div className="mt-5 rounded-xl border border-vr-200 bg-vr-50 p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white"
                    style={{ backgroundColor: originStopColor }}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-500">{t("route.origin")}</p>
                    <p className="truncate text-sm font-bold text-slate-900">{tracking.context.route.originName}</p>
                  </div>
                </div>

                {/* Điểm dừng giữa tuyến — đánh số trùng với đĩa số trên bản đồ */}
                {tracking.context.route.stops.map((stop, index) => (
                  <div key={`${stop.sequence}-${stop.name}`}>
                    <div className="ml-[0.28rem] h-4 border-l border-dashed border-vr-300" />
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 bg-white text-[9px] font-bold"
                        style={{ borderColor: originStopColor, color: originStopColor }}
                      >
                        {index + 1}
                      </span>
                      <p className="min-w-0 truncate text-sm text-slate-700">{stop.name}</p>
                    </div>
                  </div>
                ))}

                <div className="ml-[0.28rem] h-5 border-l border-dashed border-vr-300" />
                <div className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white"
                    style={{ backgroundColor: destinationStopColor }}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-500">{t("route.destination")}</p>
                    <p className="truncate text-sm font-bold text-slate-900">{tracking.context.route.destinationName}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-vr-200 bg-vr-50 px-4 py-3 text-sm text-slate-600">
                <FiArrowRight className="h-4 w-4 shrink-0 text-vr-800" aria-hidden />
                <span>{showLoading ? t("status.loading") : t("route.unavailable")}</span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-gray-200 bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-semibold text-gray-500">{t("eta.label")}</p>
                <p className="mt-1 text-sm font-extrabold tabular-nums">
                  {formatRelativeMinutes(
                    tracking.context?.eta?.remainingSeconds ?? null,
                    t("eta.unknown"),
                    (count) => t("eta.inMinutes", { count }),
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-600 tabular-nums">
                  {formatDateTime(tracking.context?.eta?.estimatedArrivalAt, locale)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-semibold text-gray-500">{t("metrics.speed")}</p>
                <p className="mt-1 text-sm font-extrabold tabular-nums">{speedLabel}</p>
                <p className="mt-1 text-xs text-slate-600 tabular-nums">
                  {tracking.location?.recordedAt
                    ? formatDateTime(tracking.location.recordedAt, locale)
                    : t("metrics.waitingGps")}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-gray-200 bg-slate-50 px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500">{t("metrics.tripStatus")}</p>
                    <p className="mt-1 text-sm font-extrabold">
                      {tracking.context?.status
                        ? t(`tripStatus.${tracking.context.status}`, {
                            defaultValue: tracking.context.status,
                          })
                        : "—"}
                    </p>
                  </div>
                  <FiClock className="mt-0.5 h-4 w-4 shrink-0 text-vr-700" aria-hidden />
                </div>
                <p className="mt-1.5 text-xs text-slate-600 tabular-nums">
                  {tracking.context?.expiresAt
                    ? t("link.expires", {
                        time: formatDateTime(tracking.context.expiresAt, locale),
                      })
                    : t("link.unknownExpiry")}
                </p>
              </div>
            </div>

            {revokedCopy && tracking.context ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900" role="status">
                {revokedCopy}
              </div>
            ) : null}

            <div className="mt-auto pt-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-vr-200 bg-vr-50 px-4 py-3 text-xs leading-5 text-slate-600">
                <FiShield className="mt-0.5 h-4 w-4 shrink-0 text-vr-800" aria-hidden />
                <p>{t("privacy.note")}</p>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500">
                <FiMapPin className="h-3.5 w-3.5" aria-hidden />
                {t("privacy.noLogin")}
              </p>
            </div>
          </aside>
        </article>
      </main>
    </div>
  );
}
