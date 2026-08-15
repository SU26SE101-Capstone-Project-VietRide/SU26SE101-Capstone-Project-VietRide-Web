import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiFileText,
  FiRefreshCw,
  FiSearch,
  FiUploadCloud,
} from "react-icons/fi";
import {
  getRagDocuments,
  getRagFeedback,
  type RagDocument,
  type RagDocumentParams,
  type RagFeedback,
} from "../../../api/vietride";
import CustomSelect from "../../../components/CustomSelect";
import Pagination from "../../../components/Pagination";
import { formatDateTime } from "../../../utils/date";
import { RagDocumentUploadModal } from "./RagDocumentUploadModal";

const statusClass: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  PENDING_REVIEW: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
  ARCHIVED: "bg-slate-100 text-slate-600",
  PROCESSING: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-rose-50 text-rose-700",
};

// Đúng enum của ListDocumentsQuerySchema bên service RAG. Zod strip key lạ chứ
// không báo lỗi, nên giá trị sai sẽ im lặng trả về dữ liệu chưa lọc.
const DOCUMENT_STATUSES = [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
] as const;
const INGEST_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
] as const;
const ACCESS_LEVELS = ["PUBLIC", "OPERATOR", "ADMIN"] as const;
const DOCUMENT_CATEGORIES = [
  "CUSTOMER_SUPPORT",
  "OPERATOR_POLICY",
  "PLATFORM_ADMIN",
] as const;
const DOCUMENT_TYPES = ["FAQ", "POLICY", "SOP", "GUIDE", "TERMS"] as const;

const filterClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100";

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
  const [statusFilter, setStatusFilter] = useState("");
  const [ingestStatusFilter, setIngestStatusFilter] = useState("");
  const [accessLevelFilter, setAccessLevelFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [totalFeedback, setTotalFeedback] = useState(0);
  const pageSize = 10;
  const feedbackPageSize = 10;
  // Hai bảng chạy song song trong `loadData` nên phải đếm request riêng, dùng
  // chung một bộ đếm thì bảng này sẽ vô hiệu hoá response của bảng kia.
  const startDocumentsRequest = useLatestRequest();
  const startFeedbackRequest = useLatestRequest();

  // tRef để load callback không phụ thuộc `t` (tránh refetch khi đổi ngôn ngữ)
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const loadDocuments = useCallback(async () => {
    const isLatest = startDocumentsRequest();
    setError("");

    try {
      const documentResult = await getRagDocuments({
        page,
        pageSize,
        search,
        sortBy: "createdAt",
        sortDir: "desc",
        ...(statusFilter
          ? { status: statusFilter as RagDocumentParams["status"] }
          : {}),
        ...(ingestStatusFilter
          ? { ingestStatus: ingestStatusFilter as RagDocumentParams["ingestStatus"] }
          : {}),
        ...(accessLevelFilter
          ? { accessLevel: accessLevelFilter as RagDocumentParams["accessLevel"] }
          : {}),
        ...(categoryFilter
          ? { category: categoryFilter as RagDocumentParams["category"] }
          : {}),
        ...(documentTypeFilter
          ? { documentType: documentTypeFilter as RagDocumentParams["documentType"] }
          : {}),
      });

      if (!isLatest()) return;
      setDocuments(documentResult.items);
      setTotalDocuments(documentResult.totalItems);
    } catch (err) {
      if (!isLatest()) return;
      setError(
        err instanceof Error ? err.message : tRef.current("ragAudit.loadFailed"),
      );
    }
  }, [
    accessLevelFilter,
    categoryFilter,
    documentTypeFilter,
    ingestStatusFilter,
    page,
    search,
    startDocumentsRequest,
    statusFilter,
  ]);

  // Feedback có pagination riêng, độc lập với page/search của bảng documents.
  const loadFeedback = useCallback(async () => {
    const isLatest = startFeedbackRequest();
    setIsFeedbackLoading(true);
    try {
      const feedbackResult = await getRagFeedback({
        page: feedbackPage,
        pageSize: feedbackPageSize,
        sortBy: "createdAt",
        sortDir: "desc",
      });

      if (!isLatest()) return;
      setFeedback(feedbackResult.items);
      setTotalFeedback(feedbackResult.totalItems);
    } catch (err) {
      if (!isLatest()) return;
      setError(
        err instanceof Error ? err.message : tRef.current("ragAudit.loadFailed"),
      );
    } finally {
      if (isLatest()) setIsFeedbackLoading(false);
    }
  }, [feedbackPage, startFeedbackRequest]);

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

          {/*
            Năm bộ lọc này BE đã hỗ trợ sẵn từ đầu nhưng màn chưa dựng UI — bảng
            hiện cột trạng thái và cấp truy cập mà không lọc được theo chúng.
          */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <CustomSelect
              aria-label={t("ragAudit.filterStatus")}
              className={filterClass}
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("ragAudit.filterStatus")}</option>
              {DOCUMENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`ragAudit.status.${value}`, {
                    defaultValue: value.replaceAll("_", " "),
                  })}
                </option>
              ))}
            </CustomSelect>
            <CustomSelect
              aria-label={t("ragAudit.filterIngestStatus")}
              className={filterClass}
              value={ingestStatusFilter}
              onChange={(event) => {
                setIngestStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("ragAudit.filterIngestStatus")}</option>
              {INGEST_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {tc(`enumLabels.${value}`, { defaultValue: value })}
                </option>
              ))}
            </CustomSelect>
            <CustomSelect
              aria-label={t("ragAudit.filterAccessLevel")}
              className={filterClass}
              value={accessLevelFilter}
              onChange={(event) => {
                setAccessLevelFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("ragAudit.filterAccessLevel")}</option>
              {ACCESS_LEVELS.map((value) => (
                <option key={value} value={value}>
                  {tc(`enumLabels.${value}`, { defaultValue: value })}
                </option>
              ))}
            </CustomSelect>
            <CustomSelect
              aria-label={t("ragAudit.filterCategory")}
              className={filterClass}
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("ragAudit.filterCategory")}</option>
              {DOCUMENT_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {t(`ragAudit.categories.${value}`, {
                    defaultValue: value.replaceAll("_", " "),
                  })}
                </option>
              ))}
            </CustomSelect>
            <CustomSelect
              aria-label={t("ragAudit.filterDocumentType")}
              className={filterClass}
              value={documentTypeFilter}
              onChange={(event) => {
                setDocumentTypeFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("ragAudit.filterDocumentType")}</option>
              {DOCUMENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`ragAudit.documentTypes.${value}`, {
                    defaultValue: value,
                  })}
                </option>
              ))}
            </CustomSelect>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1180px] whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600">
                  <th className="w-[28%] px-4 py-3">{tc("title")}</th>
                  <th className="w-[13%] px-4 py-3 text-center">{t("ragAudit.permission")}</th>
                  <th className="w-[13%] px-4 py-3 text-center">{t("ragAudit.category")}</th>
                  <th className="w-[12%] px-4 py-3 text-center">{t("ragAudit.documentType")}</th>
                  <th className="w-[14%] px-4 py-3 text-center">{t("ragAudit.ingestStatus")}</th>
                  <th className="w-[12%] px-4 py-3 text-center">{tc("status")}</th>
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
                    <td className="px-4 py-3 text-center text-gray-700">
                      {t("ragAudit.categories." + document.category, {
                        defaultValue: document.category.replaceAll("_", " "),
                      })}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {t("ragAudit.documentTypes." + document.documentType, {
                        defaultValue: document.documentType,
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {document.ingestStatus ? (
                        <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (statusClass[document.ingestStatus] ?? "bg-gray-100 text-gray-600")}>
                          {tc("enumLabels." + document.ingestStatus, {
                            defaultValue: document.ingestStatus,
                          })}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
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
            {isFeedbackLoading && (
              <p className="text-sm text-gray-500">{t("ragAudit.loading")}</p>
            )}
            {!isFeedbackLoading && feedback.length === 0 && (
              <p className="text-sm text-gray-500">
                {t("ragAudit.noFeedback")}
              </p>
            )}
            {feedback.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-gray-100 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500">
                      {t("ragAudit.conversationRole")}
                    </span>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-vr-700">
                      {tc("roles." + (item.conversation?.role ?? item.role ?? ""), {
                        defaultValue: item.conversation?.role ?? item.role ?? "-",
                      })}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDateTime(item.message?.createdAt ?? item.createdAt)}
                    </span>
                  </div>
                  <span
                    className={"shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold " + feedbackTone(item.rating)}
                  >
                    {item.rating > 0 ? "+1" : "-1"}
                  </span>
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("ragAudit.assistantResponse")}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-800">
                  {item.message?.content || item.comment || t("ragAudit.noResponse")}
                </p>
              </article>
            ))}
          </div>
          <Pagination
            page={feedbackPage}
            pageSize={feedbackPageSize}
            totalItems={totalFeedback}
            onPageChange={setFeedbackPage}
          />
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
