import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCheck, FiFileText, FiRefreshCw, FiSearch } from "react-icons/fi";
import {
  approveRagDocument,
  getRagDocuments,
  getRagFeedback,
  getRagRuntimeConfigs,
  reloadRagRuntimeConfigs,
  type RagDocument,
  type RagFeedback,
  type RagRuntimeConfig,
} from "../../../api/vietride";
import { formatDateTime } from "../../../utils/date";

const statusClass: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PENDING_REVIEW: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
  ARCHIVED: "bg-slate-100 text-slate-600",
};

function feedbackTone(rating: number) {
  return rating > 0
    ? "bg-emerald-50 text-emerald-700"
    : "bg-rose-50 text-rose-700";
}

function formatConfigValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function normalizeRuntimeConfigs(value: unknown): RagRuntimeConfig[] {
  return Array.isArray(value) ? value : [];
}

export default function RagAudit() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [feedback, setFeedback] = useState<RagFeedback[]>([]);
  const [configs, setConfigs] = useState<RagRuntimeConfig[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const filtered = useMemo(
    () =>
      documents.filter((document) =>
        document.title.toLowerCase().includes(search.toLowerCase()),
      ),
    [documents, search],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [documentResult, feedbackResult, configResult] = await Promise.all([
        getRagDocuments({ page: 1, pageSize: 20, sortBy: "createdAt", sortDir: "desc" }),
        getRagFeedback({ page: 1, pageSize: 20, sortBy: "createdAt", sortDir: "desc" }),
        getRagRuntimeConfigs(),
      ]);

      setDocuments(documentResult.items);
      setFeedback(feedbackResult.items);
      setConfigs(normalizeRuntimeConfigs(configResult));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ragAudit.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  async function handleApproveDocument(id: string) {
    setError("");
    setMessage("");

    try {
      const approved = await approveRagDocument(id);
      setDocuments((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                title: approved.title || item.title,
                status: "APPROVED",
              }
            : item,
        ),
      );
      setMessage(t("ragAudit.statusUpdated", { title: approved.title || id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ragAudit.actionFailed"));
    }
  }

  async function handleReloadConfigs() {
    setError("");
    setMessage("");

    try {
      await reloadRagRuntimeConfigs();
      setConfigs(normalizeRuntimeConfigs(await getRagRuntimeConfigs()));
      setMessage(t("ragAudit.configReloaded"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ragAudit.actionFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("ragAudit.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-600">{t("ragAudit.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <FiRefreshCw size={16} />
          {tc("refresh")}
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-vr-200 bg-vr-50 px-4 py-3 text-sm font-medium text-vr-800">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {t("ragAudit.documents")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("ragAudit.documentsHint")}
              </p>
            </div>
            <div className="relative min-w-72">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-vr-500 focus:bg-white"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("ragAudit.searchPlaceholder")}
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600">
                  <th className="px-4 py-3">{tc("title")}</th>
                  <th className="px-4 py-3">{t("ragAudit.permission")}</th>
                  <th className="px-4 py-3">{tc("status")}</th>
                  <th className="px-4 py-3 text-center">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((document) => (
                  <tr
                    key={document.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <FiFileText className="mt-1 text-vr-600" />
                        <div>
                          <p className="font-semibold text-gray-900">
                            {document.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {document.fileType ?? document.documentType} -{" "}
                            {document.operatorId ?? "SYSTEM"}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-gray-400">
                            {document.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {document.accessLevel}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          statusClass[document.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {t(`ragAudit.status.${document.status}`, {
                          defaultValue: document.status.replaceAll("_", " "),
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
                          onClick={() => void handleApproveDocument(document.id)}
                          title={tc("approve")}
                          aria-label={tc("approve")}
                        >
                          <FiCheck size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-bold text-gray-900">
            {t("ragAudit.conversationAudit")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{t("ragAudit.auditHint")}</p>
          <div className="mt-4 space-y-3">
            {isLoading && (
              <p className="text-sm text-gray-500">{t("ragAudit.loading")}</p>
            )}
            {!isLoading && feedback.length === 0 && (
              <p className="text-sm text-gray-500">{t("ragAudit.noFeedback")}</p>
            )}
            {feedback.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-gray-100 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {item.comment || item.messageId}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.role ?? "-"} - {item.userId ?? "-"} -{" "}
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${feedbackTone(item.rating)}`}
                  >
                    {item.rating > 0 ? "+1" : "-1"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {t("ragAudit.runtimeConfig")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t("ragAudit.runtimeConfigHint")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleReloadConfigs()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw size={16} />
            {t("ragAudit.reloadConfig")}
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {configs.slice(0, 6).map((config) => (
            <div
              key={config.key}
              className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <p className="font-mono text-xs font-semibold text-gray-900">
                {config.key}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                {formatConfigValue(config.value)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
