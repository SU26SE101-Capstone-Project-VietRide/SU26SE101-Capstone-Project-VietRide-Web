import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiArchive, FiCheck, FiFileText, FiSearch, FiX } from "react-icons/fi";

type RagStatus = "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";

type RagDocument = {
  id: string;
  title: string;
  fileType: string;
  permission: string;
  uploadedBy: string;
  status: RagStatus;
  updatedAt: string;
};

type ConversationLog = {
  id: string;
  user: string;
  intent: string;
  channel: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;
};

const initialDocuments: RagDocument[] = [
  { id: "RAG-001", title: "Operator onboarding handbook", fileType: "PDF", permission: "SYSTEM_ADMIN", uploadedBy: "admin@vietride.vn", status: "PENDING", updatedAt: "2026-07-01" },
  { id: "RAG-002", title: "Parcel delivery policy", fileType: "DOCX", permission: "OPERATOR_ADMIN", uploadedBy: "ops@vietride.vn", status: "APPROVED", updatedAt: "2026-06-29" },
  { id: "RAG-003", title: "Refund escalation script", fileType: "PDF", permission: "OPERATOR_STAFF", uploadedBy: "support@vietride.vn", status: "REJECTED", updatedAt: "2026-06-28" },
];

const logs: ConversationLog[] = [
  { id: "LOG-9821", user: "passenger_284", intent: "Refund policy question", channel: "Web chat", risk: "LOW", createdAt: "2026-07-01 09:12" },
  { id: "LOG-9822", user: "operator_11", intent: "Settlement dispute", channel: "Admin support", risk: "HIGH", createdAt: "2026-07-01 10:05" },
  { id: "LOG-9823", user: "driver_42", intent: "Route delay explanation", channel: "Mobile chat", risk: "MEDIUM", createdAt: "2026-07-01 11:20" },
];

const statusClass: Record<RagStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
  ARCHIVED: "bg-slate-100 text-slate-600",
};

const riskClass: Record<ConversationLog["risk"], string> = {
  LOW: "bg-emerald-50 text-emerald-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH: "bg-rose-50 text-rose-700",
};

export default function RagAudit() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const [documents, setDocuments] = useState(initialDocuments);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const filtered = useMemo(
    () =>
      documents.filter((document) =>
        document.title.toLowerCase().includes(search.toLowerCase()),
      ),
    [documents, search],
  );

  const setDocumentStatus = (id: string, status: RagStatus) => {
    const document = documents.find((item) => item.id === id);
    if (!document) return;

    if (status === "APPROVED" && document.status !== "PENDING") {
      setMessage(t("ragAudit.approvalBlocked"));
      return;
    }

    setDocuments((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, status, updatedAt: new Date().toISOString().slice(0, 10) }
          : item,
      ),
    );
    setMessage(t("ragAudit.statusUpdated", { title: document.title }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t("ragAudit.title")}</h1>
        <p className="mt-1 text-sm text-gray-600">{t("ragAudit.subtitle")}</p>
      </div>

      {message && (
        <div className="rounded-lg border border-vr-200 bg-vr-50 px-4 py-3 text-sm font-medium text-vr-800">
          {message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t("ragAudit.documents")}</h2>
              <p className="mt-1 text-sm text-gray-500">{t("ragAudit.documentsHint")}</p>
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
                  <tr key={document.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <FiFileText className="mt-1 text-vr-600" />
                        <div>
                          <p className="font-semibold text-gray-900">{document.title}</p>
                          <p className="text-xs text-gray-500">
                            {document.fileType} - {document.uploadedBy}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{document.permission}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[document.status]}`}>
                        {t(`ragAudit.status.${document.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50" onClick={() => setDocumentStatus(document.id, "APPROVED")} title={tc("approve")} aria-label={tc("approve")}>
                          <FiCheck size={16} />
                        </button>
                        <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50" onClick={() => setDocumentStatus(document.id, "REJECTED")} title={tc("reject")} aria-label={tc("reject")}>
                          <FiX size={16} />
                        </button>
                        <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-50" onClick={() => setDocumentStatus(document.id, "ARCHIVED")} title={t("ragAudit.archive")} aria-label={t("ragAudit.archive")}>
                          <FiArchive size={16} />
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
          <h2 className="text-lg font-bold text-gray-900">{t("ragAudit.conversationAudit")}</h2>
          <p className="mt-1 text-sm text-gray-500">{t("ragAudit.auditHint")}</p>
          <div className="mt-4 space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-gray-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{log.intent}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {log.user} - {log.channel} - {log.createdAt}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskClass[log.risk]}`}>
                    {t(`ragAudit.risk.${log.risk}`)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
