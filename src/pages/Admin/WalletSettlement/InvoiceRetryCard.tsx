import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FiFileText, FiRefreshCw } from "react-icons/fi";
import { retryAdminInvoice } from "../../../api/vietride";

export default function InvoiceRetryCard() {
  const { t } = useTranslation("admin");
  const [invoiceId, setInvoiceId] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const normalizedInvoiceId = invoiceId.trim();
    if (!normalizedInvoiceId) {
      setError(
        t("walletSettlement.invoiceIdRequired", {
          defaultValue: "Vui lòng nhập mã hóa đơn.",
        }),
      );
      return;
    }

    setIsRetrying(true);
    setError("");
    setMessage("");
    try {
      const result = await retryAdminInvoice(normalizedInvoiceId);
      setMessage(
        t("walletSettlement.invoiceRetrySuccess", {
          defaultValue:
            "Đã đưa PDF vào hàng đợi (lần thử {{attempts}}, trạng thái {{status}}).",
          attempts: result.attemptsUsed,
          status: result.pdfGenerationStatus,
        }),
      );
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : t("walletSettlement.invoiceRetryFailed", {
              defaultValue: "Không thể yêu cầu tạo lại PDF hóa đơn.",
            }),
      );
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <FiFileText />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">
            {t("walletSettlement.invoiceRetryTitle", {
              defaultValue: "Tạo lại PDF hóa đơn",
            })}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("walletSettlement.invoiceRetryHint", {
              defaultValue:
                "Chỉ áp dụng cho hóa đơn DRAFT có PDF FAILED và chưa vượt quá số lần thử.",
            })}
          </p>
        </div>
      </div>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-4 flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={invoiceId}
          onChange={(event) => setInvoiceId(event.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-vr-500 focus:ring-2 focus:ring-vr-100"
          placeholder={t("walletSettlement.invoiceIdPlaceholder", {
            defaultValue: "UUID hóa đơn",
          })}
        />
        <button
          type="submit"
          disabled={isRetrying}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          <FiRefreshCw className={isRetrying ? "animate-spin" : ""} />
          {t("walletSettlement.invoiceRetryAction", {
            defaultValue: "Tạo lại PDF",
          })}
        </button>
      </form>
      {message && <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p>}
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
    </section>
  );
}
