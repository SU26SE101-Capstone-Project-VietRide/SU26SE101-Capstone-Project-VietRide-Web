import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiHelpCircle,
  FiInfo,
} from "react-icons/fi";
import type { ShuttleRoutePreviewResult } from "../../../api/vietride";
import { formatDateTime } from "../../../utils/date";

type ShuttleRoutePreviewPanelProps = {
  result: ShuttleRoutePreviewResult | null;
  loading?: boolean;
};

const STATUS_STYLE = {
  SAFE: {
    icon: FiCheckCircle,
    wrapper: "border-emerald-200 bg-emerald-50 text-emerald-900",
    detail: "text-emerald-800",
  },
  LATE_RISK: {
    icon: FiAlertTriangle,
    wrapper: "border-amber-300 bg-amber-50 text-amber-950",
    detail: "text-amber-900",
  },
  UNKNOWN: {
    icon: FiHelpCircle,
    wrapper: "border-slate-300 bg-slate-50 text-slate-900",
    detail: "text-slate-700",
  },
  NOT_APPLICABLE: {
    icon: FiInfo,
    wrapper: "border-blue-200 bg-blue-50 text-blue-900",
    detail: "text-blue-800",
  },
} as const;

/** Hiển thị đủ bốn trạng thái tư vấn; nullable field chỉ render khi có giá trị. */
export default function ShuttleRoutePreviewPanel({
  result,
  loading = false,
}: ShuttleRoutePreviewPanelProps) {
  const { t } = useTranslation("manager");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) {
      panelRef.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [result]);

  if (loading) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-lg border border-vr-100 bg-vr-50 px-3 py-2 text-sm text-vr-900"
      >
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-vr-200 border-t-vr-700" />
        {t("dispatch.routePreviewChecking")}
      </p>
    );
  }

  if (!result) return null;

  const style = STATUS_STYLE[result.status];
  const Icon = style.icon;

  return (
    <div
      ref={panelRef}
      role={result.status === "LATE_RISK" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${style.wrapper}`}
    >
      <p className="flex items-center gap-2 font-semibold">
        <Icon aria-hidden="true" />
        {t(`dispatch.routePreviewStatus.${result.status}`)}
      </p>

      <p className={`mt-1 text-xs leading-5 ${style.detail}`}>
        {t(`dispatch.routePreviewDescription.${result.status}`, {
          delay: result.delayMinutes ?? 0,
        })}
      </p>

      {(result.estimatedFinishAt || result.hardCutoffAt) && (
        <dl className="mt-3 grid gap-2 rounded-lg bg-white/70 p-3 sm:grid-cols-2">
          {result.estimatedFinishAt && (
            <div>
              <dt className="text-xs opacity-70">
                {t("dispatch.routePreviewEstimatedFinish")}
              </dt>
              <dd className="mt-0.5 font-semibold">
                {formatDateTime(result.estimatedFinishAt)}
              </dd>
            </div>
          )}
          {result.hardCutoffAt && (
            <div>
              <dt className="text-xs opacity-70">
                {t("dispatch.routePreviewHardCutoff")}
              </dt>
              <dd className="mt-0.5 font-semibold">
                {formatDateTime(result.hardCutoffAt)}
              </dd>
            </div>
          )}
        </dl>
      )}

      {result.basis === "GOONG" && (
        <p className={`mt-2 text-[11px] ${style.detail}`}>
          {t("dispatch.routePreviewBasisGoong")}
        </p>
      )}
    </div>
  );
}
