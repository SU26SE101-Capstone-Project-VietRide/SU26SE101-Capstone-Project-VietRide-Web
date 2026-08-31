import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertCircle,
  FiArrowRight,
  FiClock,
  FiRefreshCw,
  FiWifi,
  FiWifiOff,
} from "react-icons/fi";

import logo from "../../assets/Login/logo.svg";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import { Button } from "../../components/ui/Button";
import SharedTripDetailsPanel from "./SharedTripDetailsPanel";
import SharedTripMap from "./SharedTripMap";
import SharedTripReplacementNotice from "./SharedTripReplacementNotice";
import {
  destinationStopColor,
  originStopColor,
} from "./sharedTripVisualStyle";
import { captureTripShareTokenFromWindow } from "./tripShareToken";
import {
  isVehicleReplacementPending,
} from "./tripShareApi";
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

function connectionTone(state: SharedConnectionState): {
  chip: string;
  labelKey: string;
  Icon: typeof FiWifi;
  spin: boolean;
} {
  switch (state) {
    case "live":
      return {
        chip: "bg-[#E7F8F7] text-[#005653] ring-[#007A76]/20",
        labelKey: "status.live",
        Icon: FiWifi,
        spin: false,
      };
    case "connecting":
    case "loading":
      return {
        chip: "bg-[#FFF4BF] text-[#795900] ring-[#EBC300]/35",
        labelKey: state === "loading" ? "status.loading" : "status.connecting",
        Icon: FiRefreshCw,
        spin: true,
      };
    case "offline":
      return {
        chip: "bg-[#EEF7F7] text-[#435A57] ring-[#007A76]/15",
        labelKey: "status.offline",
        Icon: FiWifiOff,
        spin: false,
      };
    case "ended":
      return {
        chip: "bg-slate-100 text-slate-600 ring-slate-200",
        labelKey: "status.ended",
        Icon: FiClock,
        spin: false,
      };
    default:
      return {
        chip: "bg-[#FFDAD6] text-[#8C1D18] ring-[#BA1A1A]/20",
        labelKey: "status.error",
        Icon: FiAlertCircle,
        spin: false,
      };
  }
}

function TrackingSkeleton() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#EEF7F7]" aria-hidden="true">
      <div className="absolute -left-16 top-[40%] h-24 w-[78%] rotate-[-8deg] rounded-[50%] border-t-4 border-[#007D78]/35" />
      <div className="absolute right-[21%] top-[26%] h-4 w-4 rounded-full bg-[#9A6500] ring-4 ring-white motion-safe:animate-pulse" />
      <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-[#007A76]/15 bg-white p-4 shadow-[0_18px_42px_-28px_rgba(0,86,83,0.55)] sm:left-auto sm:w-80">
        <div className="h-3 w-24 rounded bg-[#D7E7E6] motion-safe:animate-pulse" />
        <div className="mt-3 h-4 w-3/4 rounded bg-[#BBC9C8] motion-safe:animate-pulse" />
        <div className="mt-2 h-3 w-1/2 rounded bg-[#D7E7E6] motion-safe:animate-pulse" />
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
  const latestUpdate =
    tracking.location?.recordedAt ?? tracking.context?.lastUpdatedAt;

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
  const replacementPending = isVehicleReplacementPending(
    tracking.context?.status,
  );

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#F4F8FA] text-[#13211F]">
      <a
        href="#trip-sharing-content"
        className="sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:not-sr-only focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#13211F] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#007A76]"
      >
        {t("actions.skipToContent")}
      </a>

      <header className="border-b border-[#007A76]/10 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={logo}
              alt={tc("brand")}
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 rounded-2xl bg-[#E7F8F7] object-contain p-1.5"
            />
            <div className="min-w-0">
              <p
                className="truncate text-base font-black tracking-[-0.03em] text-[#13211F]"
                translate="no"
              >
                {t("brand")}
              </p>
              <p className="truncate text-xs font-medium text-[#70817F] sm:text-sm">
                {t("subtitle")}
              </p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main
        id="trip-sharing-content"
        className="mx-auto w-full max-w-[1600px] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5 lg:px-8"
      >
        <section
          aria-labelledby="shared-trip-page-heading"
          className="mb-3 rounded-[1.5rem] border border-[#007A76]/15 bg-white px-4 py-4 shadow-[0_18px_48px_-36px_rgba(0,86,83,0.5)] sm:px-5 lg:mb-4 lg:px-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#007A76]">
                {t("route.label")}
              </p>
              <h1
                id="shared-trip-page-heading"
                className="mt-1 text-balance text-lg font-black tracking-[-0.03em] text-[#13211F] sm:text-xl"
              >
                {route ? t("route.liveTitle") : t("route.unknown")}
              </h1>
            </div>

            <div className="flex w-full min-w-0 flex-row items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end sm:gap-1.5">
              <span
                role="status"
                aria-live="polite"
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tone.chip}`}
              >
                {tone.spin ? (
                  <span className="motion-safe:animate-spin" aria-hidden="true">
                    <StatusIcon className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {t(tone.labelKey)}
              </span>
              <p className="text-right text-[11px] font-medium text-[#70817F] tabular-nums sm:text-xs">
                {t("metrics.lastUpdated")}: {formatDateTime(latestUpdate, locale)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-center gap-2 sm:gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#70817F]">{t("route.origin")}</p>
              <p className="mt-0.5 line-clamp-2 break-words text-sm font-bold leading-5 text-[#13211F]">
                {route?.originName ?? "—"}
              </p>
            </div>
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E7F8F7] text-[#007A76]"
              aria-hidden="true"
            >
              <FiArrowRight className="h-4 w-4" />
            </span>
            <div className="min-w-0 text-right">
              <p className="text-xs font-bold text-[#70817F]">{t("route.destination")}</p>
              <p className="mt-0.5 line-clamp-2 break-words text-sm font-bold leading-5 text-[#13211F]">
                {route?.destinationName ?? "—"}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-center gap-2 sm:gap-4" aria-hidden="true">
            <span className="h-1.5 rounded-full" style={{ backgroundColor: originStopColor }} />
            <span className="mx-auto h-2 w-2 rounded-full bg-[#007A76]" />
            <span className="h-1.5 rounded-full" style={{ backgroundColor: destinationStopColor }} />
          </div>
        </section>

        {replacementPending ? <SharedTripReplacementNotice /> : null}

        <div
          className={
            showMap
              ? "grid gap-3 lg:h-[calc(100dvh-12.5rem)] lg:min-h-[36rem] lg:grid-cols-[minmax(0,1fr)_23.5rem] lg:gap-4"
              : "lg:h-[calc(100dvh-12.5rem)] lg:min-h-[36rem]"
          }
        >
          <section
            className={`relative overflow-hidden rounded-[1.75rem] border border-[#007A76]/15 bg-[#EEF7F7] shadow-[0_22px_62px_-38px_rgba(0,86,83,0.52)] ${
              showMap
                ? "h-[56dvh] min-h-[26rem] lg:h-full lg:min-h-0"
                : "h-[62dvh] min-h-[30rem] lg:h-full lg:min-h-0"
            }`}
            aria-label={t("map.sectionLabel")}
            aria-busy={showLoading}
          >
            {showMap ? (
              <SharedTripMap context={tracking.context} location={tracking.location} />
            ) : showLoading ? (
              <TrackingSkeleton />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-7 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E7F8F7] text-[#007A76] ring-8 ring-white/70">
                  {showEnded ? (
                    <FiClock className="h-7 w-7" aria-hidden="true" />
                  ) : (
                    <FiAlertCircle className="h-7 w-7" aria-hidden="true" />
                  )}
                </div>
                <h2 className="mt-5 text-balance text-2xl font-black tracking-[-0.03em] text-[#13211F]">
                  {showEnded ? t("revoked.title") : t("errors.title")}
                </h2>
                <p className="mt-3 max-w-md text-pretty text-sm leading-6 text-[#435A57]">
                  {showEnded ? revokedCopy ?? t("revoked.tripEnded") : errorCopy}
                </p>
                {canRetry && tracking.connection === "error" ? (
                  <Button
                    variant="primary"
                    className="mt-6 min-h-11 touch-manipulation"
                    onClick={tracking.retry}
                    leadingIcon={<FiRefreshCw className="h-4 w-4" aria-hidden="true" />}
                  >
                    {t("actions.retry")}
                  </Button>
                ) : null}
              </div>
            )}
          </section>

          {showMap && tracking.context ? (
            <SharedTripDetailsPanel
              context={tracking.context}
              latestUpdate={latestUpdate}
              locale={locale}
              location={tracking.location}
              revokedCopy={revokedCopy}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
