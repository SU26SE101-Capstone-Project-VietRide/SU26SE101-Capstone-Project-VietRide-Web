import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheck,
  FiFileText,
  FiRefreshCw,
  FiSearch,
  FiUploadCloud,
} from "react-icons/fi";
import {
  approveRagDocument,
  getRagDocuments,
  getRagFeedback,
  type RagDocument,
  type RagFeedback,
} from "../../../api/vietride";
import Pagination from "../../../components/Pagination";
import { formatDateTime } from "../../../utils/date";
import { RagDocumentUploadModal } from "./RagDocumentUploadModal";

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

export default function RagAudit() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [feedback, setFeedback] = useState<RagFeedback[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const pageSize = 8;

  // tRef để load callback không phụ thuộc `t` (tránh refetch khi đổi ngôn ngữ)
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const documentResult = await getRagDocuments({
        page,
        pageSize,
        search,
        sortBy: "createdAt",
        sortDir: "desc",
      });

      setDocuments(documentResult.items);
      setTotalDocuments(documentResult.totalItems);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tRef.current("ragAudit.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  // Feedback không phụ thuộc page/search của bảng documents → chỉ load lúc mount
  const loadFeedback = useCallback(async () => {
    try {
      const feedbackResult = await getRagFeedback({
        page: 1,
        pageSize: 20,
        sortBy: "createdAt",
        sortDir: "desc",
      });

      setFeedback(feedbackResult.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tRef.current("ragAudit.loadFailed"),
      );
    }
  }, []);

  // Nút refresh tải lại cả hai
  const loadData = useCallback(
    () => Promise.all([loadDocuments(), loadFeedback()]),
    [loadDocuments, loadFeedback],
  );

  useEffect(() => {
    // Debounce 250ms để gõ tìm kiếm không bắn request mỗi phím
    const timeoutId = window.setTimeout(() => {
      void loadDocuments();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [loadDocuments]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadFeedback();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadFeedback]);

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

  useToastFeedback({ message, error });
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("ragAudit.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-600">{t("ragAudit.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FiRefreshCw size={16} />
            {tc("refresh")}
          </button>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
          >
            <FiUploadCloud size={16} />
            {t("ragAudit.uploadDocument")}
          </button>
        </div>
      </div>


      <div className="grid gap-5">
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
            <div className="relative w-full sm:w-72">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                aria-label={t("ragAudit.searchPlaceholder")}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-vr-500 focus:bg-white"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={t("ragAudit.searchPlaceholder")}
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600">
                  <th className="px-4 py-3">{tc("title")}</th>
                  <th className="px-4 py-3 text-center">{t("ragAudit.permission")}</th>
                  <th className="px-4 py-3 text-center">{tc("status")}</th>
                  <th className="px-4 py-3 text-center">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
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
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {tc(`enumLabels.${document.accessLevel}`, {
                        defaultValue: document.accessLevel,
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          statusClass[document.status] ??
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {t(`ragAudit.status.${document.status}`, {
                          defaultValue: document.status.replaceAll("_", " "),
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" disabled={document.status !== "PENDING_REVIEW" && document.status !== "PENDING"} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent" onClick={() => void handleApproveDocument(document.id)} title={document.status === "PENDING_REVIEW" || document.status === "PENDING" ? tc("approve") : t("ragAudit.alreadyProcessed")} aria-label={document.status === "PENDING_REVIEW" || document.status === "PENDING" ? tc("approve") : t("ragAudit.alreadyProcessed")}>
                          <FiCheck size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={totalDocuments}
            onPageChange={setPage}
          />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-bold text-gray-900">
            {t("ragAudit.conversationAudit")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("ragAudit.auditHint")}
          </p>
          <div className="mt-4 space-y-3">
            {isLoading && (
              <p className="text-sm text-gray-500">{t("ragAudit.loading")}</p>
            )}
            {!isLoading && feedback.length === 0 && (
              <p className="text-sm text-gray-500">
                {t("ragAudit.noFeedback")}
              </p>
            )}
            {feedback.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-gray-100 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {item.comment || t("ragAudit.noComment")}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.role ?? "-"} - {formatDateTime(item.createdAt)}
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

      <RagDocumentUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(document) => {
          setDocuments((current) => [document, ...current]);
          setTotalDocuments((current) => current + 1);
          setMessage(t("ragAudit.uploadSuccess"));
        }}
      />
    </div>
  );
}
