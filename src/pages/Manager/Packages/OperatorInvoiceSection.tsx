import { useToastFeedback } from "../../../hooks/useToastFeedback";
import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { FiCreditCard, FiDownload, FiEye } from "react-icons/fi";
import Modal from "../../../components/Modal";
import {
  getOperatorInvoices,
  getOperatorInvoice,
  downloadOperatorInvoice,
  type OperatorInvoice,
  type OperatorInvoiceDetail,
} from "../../../api/vietride";
import { formatDateOnly } from "../../../utils/date";
import Pagination from "../../../components/Pagination";
import { formatNumber } from "./subscriptionHelpers";
import InvoiceDetailContent from "./InvoiceDetailContent";
import { Badge } from "../../../components/ui/Badge";

export default function OperatorInvoiceSection() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedInvoiceId = searchParams.get("invoiceId");
  const [invoices, setInvoices] = useState<OperatorInvoice[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState("");
  const [error, setError] = useState("");
  useToastFeedback({ error });
  const [detail, setDetail] = useState<OperatorInvoiceDetail | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState("");
  const pageSize = 10;

  // Deep-link `?invoiceId=`: mở đúng hoá đơn đó một lần rồi dọn param.
  // `openInvoiceDetail` là function khai trong thân component nên identity đổi
  // mỗi render — giữ qua ref thay vì đưa vào deps, nếu không effect chạy lại
  // liên tục và mở lại modal. `setSearchParams` dùng dạng updater để không phải
  // phụ thuộc `searchParams`.
  const openInvoiceDetailRef =
    useRef<(invoiceId: string) => Promise<void>>(null);
  useEffect(() => {
    openInvoiceDetailRef.current = openInvoiceDetail;
  });

  useEffect(() => {
    if (!linkedInvoiceId) return;
    void openInvoiceDetailRef.current?.(linkedInvoiceId);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("invoiceId");
        return next;
      },
      { replace: true },
    );
  }, [linkedInvoiceId, setSearchParams]);

  useEffect(() => {
    let ignore = false;

    async function loadInvoices() {
      setLoading(true);
      setError("");

      try {
        // `search`: contains trên số hoá đơn; nếu chuỗi là UUID hợp lệ thì BE
        // còn OR-match chính xác `paymentId`.
        const result = await getOperatorInvoices({
          page,
          pageSize,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          sortBy: "createdAt",
          sortDir: "desc",
        });
        if (!ignore) {
          setInvoices(result.items);
          setTotalItems(result.totalItems);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : t("packages.invoiceLoadFailed"),
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadInvoices();
    return () => {
      ignore = true;
    };
  }, [debouncedSearch, page, t]);

  // Search đi thẳng lên BE nên phải debounce; đổi từ khoá thì về trang 1.
  // Bỏ qua lượt chạy đầu: effect này cũng chạy lúc mount và sau đó gọi
  // `setPage(1)` dù người dùng chưa gõ gì — ai bấm sang trang trong khoảng
  // debounce đầu tiên sẽ bị đá ngược về trang 1. Giá trị debounce lúc mount vốn
  // đã bằng ô nhập nên bỏ lượt này không làm lệch state.
  const hasFilterChanged = useRef(false);
  useEffect(() => {
    if (!hasFilterChanged.current) {
      hasFilterChanged.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  async function openInvoiceDetail(invoiceId: string) {
    setDetailLoadingId(invoiceId);
    setError("");
    try {
      setDetail(await getOperatorInvoice(invoiceId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("packages.invoiceDetailFailed"),
      );
    } finally {
      setDetailLoadingId("");
    }
  }

  async function downloadInvoice(invoiceId: string) {
    setDownloadingId(invoiceId);
    setError("");

    try {
      const result = await downloadOperatorInvoice(invoiceId);
      const link = document.createElement("a");
      link.href = result.downloadUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("packages.invoiceDownloadFailed"),
      );
    } finally {
      setDownloadingId("");
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-xl font-bold text-gray-900">
          {t("packages.invoices")}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {t("packages.invoicesHint")}
        </p>
        <input
          type="search"
          aria-label={t("packages.invoiceSearchLabel")}
          placeholder={t("packages.invoiceSearchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mt-3 h-12 w-full max-w-[760px] rounded-[9999px] border border-[#9edfe5] bg-white px-4 py-3 text-[15px] text-slate-700 shadow-[0_0_0_1px_rgba(158,223,229,0.18)] outline-none transition placeholder:text-slate-400 focus:border-vr-500 focus:ring-4 focus:ring-vr-100"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-center text-xs font-semibold uppercase text-gray-600">
              <th className="px-4 py-3 text-center">
                {t("packages.invoiceNumber")}
              </th>
              <th className="px-4 py-3 text-center">{t("packages.period")}</th>
              <th className="px-4 py-3 text-center">{t("packages.amount")}</th>
              <th className="px-4 py-3 text-center">
                {t("packages.invoiceStatus")}
              </th>
              <th className="px-4 py-3 text-center">
                {t("packages.invoiceFile")}
              </th>
              <th className="px-4 py-3 text-center">{t("packages.action")}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && invoices.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  {t("packages.noInvoices")}
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr
                  key={invoice.invoiceId}
                  className="border-t border-gray-100"
                >
                  <td className="px-4 py-3 text-center font-semibold">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {formatDateOnly(invoice.periodFrom)} -{" "}
                    {formatDateOnly(invoice.periodTo)}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">
                    {formatNumber(invoice.amount)} đ
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      tone={invoice.status === "ISSUED" ? "success" : "neutral"}
                    >
                      {tc(`enumLabels.${invoice.status}`, {
                        defaultValue: invoice.status,
                      })}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tc(`enumLabels.${invoice.pdfGenerationStatus}`, {
                      defaultValue: invoice.pdfGenerationStatus,
                    })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        disabled={detailLoadingId === invoice.invoiceId}
                        onClick={() =>
                          void openInvoiceDetail(invoice.invoiceId)
                        }
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-vr-900 hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title={t("packages.viewInvoice")}
                        aria-label={t("packages.viewInvoice")}
                      >
                        <FiEye />
                      </button>
                      <button
                        type="button"
                        disabled={
                          invoice.status !== "ISSUED" ||
                          invoice.pdfGenerationStatus !== "COMPLETED" ||
                          downloadingId === invoice.invoiceId
                        }
                        onClick={() => void downloadInvoice(invoice.invoiceId)}
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-vr-900 hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title={t("packages.downloadInvoice")}
                        aria-label={t("packages.downloadInvoice")}
                      >
                        <FiDownload />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={setPage}
      />
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        wide
        icon={<FiCreditCard size={20} />}
        title={t("packages.invoiceDetailTitle")}
        subtitle={detail?.invoiceNumber}
        footer={
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            {t("packages.close")}
          </button>
        }
      >
        {detail ? <InvoiceDetailContent detail={detail} /> : null}
      </Modal>
    </section>
  );
}
