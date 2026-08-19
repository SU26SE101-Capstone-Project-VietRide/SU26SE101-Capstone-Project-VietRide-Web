import { useEffect } from "react";
import { FiX } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import type { AdminActivityLog } from "../../../api/vietride";
import { formatIpAddress, getActionPresentation, getReadableMetadata } from "./activityLogPresentation";

type ActivityLogDetailsProps = {
  log: AdminActivityLog | null;
  onClose: () => void;
};

export function ActivityLogDetails({ log, onClose }: ActivityLogDetailsProps) {
  const { t, i18n } = useTranslation("admin");

  useEffect(() => {
    if (!log) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [log, onClose]);

  if (!log) return null;

  const action = getActionPresentation(log.action, i18n.language);
  const metadata = getReadableMetadata(log.metadata, i18n.language);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="activity-log-details-title">
      <button type="button" className="absolute inset-0 bg-slate-950/40" aria-label={t("activityLogs.close")} onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-medium text-vr-700">{t("activityLogs.detailsEyebrow")}</p>
            <h2 id="activity-log-details-title" className="mt-1 text-xl font-bold text-slate-900">{t("activityLogs.detailsTitle")}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={t("activityLogs.close")}><FiX size={20} /></button>
        </div>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">{t("activityLogs.logId")}</dt><dd className="mt-1 break-all font-mono text-sm text-slate-800">{log.id}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-slate-500">{t("activityLogs.action")}</dt><dd className="mt-2"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${action.badgeClassName}`}>{action.label}</span></dd></div>
          <div><dt className="text-xs font-semibold uppercase text-slate-500">{t("activityLogs.time")}</dt><dd className="mt-1 text-sm text-slate-800">{new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(log.createdAt))}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">{t("activityLogs.actor")}</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{log.actor.displayName}</dd><dd className="text-sm text-slate-600">{log.actor.email} · {log.actor.role}</dd><dd className="mt-1 break-all font-mono text-xs text-slate-500">{log.actor.id}</dd></div>
          <div><dt className="text-xs font-semibold uppercase text-slate-500">{t("activityLogs.ip")}</dt><dd className="mt-1 text-sm text-slate-800">{formatIpAddress(log.ipAddress)}</dd><dd className="mt-1 text-xs text-slate-500">{t("activityLogs.ipHint")}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">{t("activityLogs.userAgent")}</dt><dd className="mt-1 break-words text-sm text-slate-700">{log.userAgent || "—"}</dd></div>
        </dl>

        <section className="mt-8">
          <h3 className="text-sm font-bold text-slate-900">{t("activityLogs.metadata")}</h3>
          {metadata.length ? <dl className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">{metadata.map((item) => <div key={item.key} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]"><dt className="text-sm font-medium text-slate-600">{item.label}</dt><dd className="break-all text-sm text-slate-900">{item.value}</dd></div>)}</dl> : <p className="mt-2 text-sm text-slate-500">{t("activityLogs.noMetadata")}</p>}
        </section>

        <details className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">{t("activityLogs.rawJson")}</summary>
          <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(log.metadata, null, 2)}</pre>
        </details>
      </aside>
    </div>
  );
}


