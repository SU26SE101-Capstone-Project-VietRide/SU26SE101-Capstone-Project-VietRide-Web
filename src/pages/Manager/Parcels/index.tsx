import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckCircle,
  FiDollarSign,
  FiPackage,
  FiRefreshCw,
  FiSearch,
  FiTruck,
  FiXCircle,
} from "react-icons/fi";
import {
  cancelOperatorParcel,
  confirmOperatorParcelDelivery,
  getOperatorParcelReportSummary,
  getOperatorParcelRouteFares,
  getParcelDetail,
  reviewOperatorParcel,
  type OperatorParcelReportSummary,
  type ParcelDetail,
  type ParcelRouteFare,
} from "../../../api/vietride";
import { getAuthUser } from "../../../auth";
import CurrencyInput from "../../../components/CurrencyInput";
import CustomDateTimeInput from "../../../components/CustomDateTimeInput";
import { DetailItem } from "../../../components/DetailLayout";
import { formatDateTime } from "../../../utils/date";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIsoDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function formatMoney(value = 0) {
  return value.toLocaleString("vi-VN");
}

function formatDate(value?: string | null) {
  return formatDateTime(value);
}

function normalizeStatus(status?: string) {
  return status?.replaceAll("_", " ") || "-";
}

function isActionableReview(parcel: ParcelDetail | null) {
  return parcel?.status === "PENDING_OPERATOR_REVIEW";
}

function isPendingDeliveryConfirm(parcel: ParcelDetail | null) {
  return parcel?.status === "DELIVERED_PENDING_CONFIRM";
}

export default function ParcelsList() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const user = getAuthUser();
  const canMutate = user?.role === "OPERATOR_ADMIN";
  const [summary, setSummary] = useState<OperatorParcelReportSummary | null>(null);
  const [routeFares, setRouteFares] = useState<ParcelRouteFare[]>([]);
  const [fromDate, setFromDate] = useState(monthStartIsoDate());
  const [toDate, setToDate] = useState(todayIsoDate());
  const [parcelId, setParcelId] = useState("");
  const [selectedParcel, setSelectedParcel] = useState<ParcelDetail | null>(null);
  const [manualFee, setManualFee] = useState("50000");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pendingActionCount = useMemo(
    () =>
      (summary?.totalRejected ?? 0) +
      (selectedParcel?.status === "PENDING_OPERATOR_REVIEW" ? 1 : 0),
    [selectedParcel, summary],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [summaryResult, fareResult] = await Promise.all([
        getOperatorParcelReportSummary({
          from: fromDate,
          to: toDate,
        }),
        getOperatorParcelRouteFares({ page: 1, pageSize: 100 }),
      ]);

      setSummary(summaryResult);
      setRouteFares(fareResult.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("parcels.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, t, toDate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  async function runAction(action: () => Promise<void>) {
    setIsActionLoading(true);
    setError("");
    setMessage("");

    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("parcels.actionFailed"));
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleLookupParcel() {
    if (!parcelId.trim()) {
      setError(t("parcels.parcelIdRequired"));
      return;
    }

    const detail = await getParcelDetail(parcelId.trim());
    setSelectedParcel(detail);
    setMessage(t("parcels.detailLoaded"));
  }

  async function handleApproveReview() {
    if (!selectedParcel || !isActionableReview(selectedParcel)) {
      setError(t("parcels.reviewEmpty"));
      return;
    }

    const depositAmount = Number(manualFee);
    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      setError(t("parcels.reviewInvalidFee"));
      return;
    }

    await reviewOperatorParcel(selectedParcel.parcelId, {
      decision: "APPROVED",
      depositAmount,
      reason: reason.trim() || null,
      paymentMethod: "VNPAY",
    });
    setSelectedParcel(await getParcelDetail(selectedParcel.parcelId));
    setMessage(t("parcels.reviewApproveSuccess"));
  }

  async function handleRejectReview() {
    if (!selectedParcel || !isActionableReview(selectedParcel)) {
      setError(t("parcels.reviewEmpty"));
      return;
    }

    if (!reason.trim()) {
      setError(t("parcels.reviewReasonRequired"));
      return;
    }

    await reviewOperatorParcel(selectedParcel.parcelId, {
      decision: "REJECTED",
      reason: reason.trim(),
    });
    setSelectedParcel(await getParcelDetail(selectedParcel.parcelId));
    setMessage(t("parcels.reviewRejectSuccess"));
  }

  async function handleConfirmDelivery() {
    if (!selectedParcel || !isPendingDeliveryConfirm(selectedParcel)) {
      setError(t("parcels.deliveryNotPending"));
      return;
    }

    if (!note.trim()) {
      setError(t("parcels.deliveryNoteRequired"));
      return;
    }

    await confirmOperatorParcelDelivery(selectedParcel.parcelId, {
      note: note.trim(),
    });
    setSelectedParcel(await getParcelDetail(selectedParcel.parcelId));
    setMessage(t("parcels.deliverySuccess"));
  }

  async function handleCancelParcel() {
    if (!selectedParcel) {
      setError(t("parcels.reviewEmpty"));
      return;
    }

    if (!reason.trim()) {
      setError(t("parcels.cancelReasonRequired"));
      return;
    }

    await cancelOperatorParcel(selectedParcel.parcelId, {
      reason: reason.trim(),
      refundChoice: null,
    });
    setSelectedParcel(await getParcelDetail(selectedParcel.parcelId));
    setMessage(t("parcels.cancelSuccess"));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t("parcels.title")}
          </h1>
          <p className="mt-1 text-gray-600">{t("parcels.subtitle")}</p>
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

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Field
            label={t("parcels.fromDate")}
            value={fromDate}
            type="date"
            onChange={setFromDate}
          />
          <Field
            label={t("parcels.toDate")}
            value={toDate}
            type="date"
            onChange={setToDate}
          />
          <button
            type="button"
            onClick={() => void loadData()}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
          >
            <FiSearch size={16} />
            {t("parcels.loadReport")}
          </button>
        </div>
      </section>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<FiPackage />}
          label={t("parcels.todayOrders")}
          value={summary?.totalParcels ?? 0}
          isLoading={isLoading}
        />
        <MetricCard
          icon={<FiTruck />}
          label={t("parcels.inTransit")}
          value={summary?.totalLoaded ?? 0}
          isLoading={isLoading}
        />
        <MetricCard
          icon={<FiCheckCircle />}
          label={t("parcels.delivered")}
          value={summary?.totalDelivered ?? 0}
          isLoading={isLoading}
        />
        <MetricCard
          icon={<FiXCircle />}
          label={t("parcels.needsAction")}
          value={pendingActionCount}
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
        <main className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {t("parcels.reportSummary")}
                </h2>
                <p className="text-sm text-gray-500">
                  {t("parcels.reportSummaryHint")}
                </p>
              </div>
              <div className="rounded-lg bg-vr-50 px-3 py-2 text-sm font-bold text-vr-800">
                {formatMoney(summary?.totalRevenue)} VND
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info label={t("parcels.loaded")} value={summary?.totalLoaded ?? 0} />
              <Info
                label={t("parcels.rejected")}
                value={summary?.totalRejected ?? 0}
              />
              <Info
                label={t("parcels.returned")}
                value={summary?.totalReturned ?? 0}
              />
              <Info
                label={t("parcels.refunded")}
                value={`${formatMoney(summary?.totalRefunded)} VND`}
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-5">
              <h2 className="text-lg font-bold text-gray-900">
                {t("parcels.routeFares")}
              </h2>
              <p className="text-sm text-gray-500">
                {t("parcels.routeFaresHint")}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3">{t("parcels.route")}</th>
                    <th className="px-5 py-3">{t("parcels.sizeCategory")}</th>
                    <th className="px-5 py-3">{t("parcels.fee")}</th>
                    <th className="px-5 py-3">{t("parcels.validity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {routeFares.map((fare) => (
                    <tr
                      key={`${fare.routeId}-${fare.sizeCategory}`}
                      className="border-b border-gray-100 last:border-0"
                    >
                      <td className="px-5 py-4 font-mono text-sm text-gray-700">
                        {fare.routeId}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                        {fare.sizeCategory}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatMoney(fare.priceVnd)} VND
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {formatDate(fare.effectiveFrom)} -{" "}
                        {formatDate(fare.effectiveUntil)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isLoading && routeFares.length === 0 && (
              <p className="border-t border-gray-100 px-5 py-6 text-center text-sm text-gray-500">
                {t("parcels.noRouteFares")}
              </p>
            )}
          </section>
        </main>

        <aside className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">
              {t("parcels.lookupTitle")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t("parcels.lookupHint")}
            </p>
            <div className="mt-4 flex gap-2">
              <input
                className={inputClass}
                value={parcelId}
                placeholder="parcelId"
                onChange={(event) => setParcelId(event.target.value)}
              />
              <button
                type="button"
                onClick={() => void runAction(handleLookupParcel)}
                className="inline-flex items-center justify-center rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white hover:bg-vr-600"
              >
                <FiSearch size={16} />
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">
              {t("parcels.detailTitle")}
            </h2>
            {selectedParcel ? (
              <div className="mt-4 space-y-3">
                <Info label={t("parcels.orderCode")} value={selectedParcel.parcelCode} />
                <Info
                  label={tc("status")}
                  value={normalizeStatus(selectedParcel.status)}
                />
                <Info
                  label={t("parcels.recipient")}
                  value={selectedParcel.recipientName}
                />
                <Info
                  label={t("parcels.weightKg")}
                  value={`${selectedParcel.estimatedWeightKg} kg`}
                />
                <Info
                  label={t("parcels.fee")}
                  value={`${formatMoney(selectedParcel.depositAmount)} VND`}
                />
                <Info
                  label={t("parcels.route")}
                  value={`${selectedParcel.originStationName ?? "-"} → ${
                    selectedParcel.destinationStationName ?? "-"
                  }`}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                {t("parcels.reviewEmpty")}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">
              {t("parcels.operatorActions")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {canMutate
                ? t("parcels.operatorActionsHint")
                : t("parcels.staffReadOnlyHint")}
            </p>

            <div className="mt-4 space-y-3">
              <Field
                label={t("parcels.manualFee")}
                value={manualFee}
                type="number"
                currency
                onChange={setManualFee}
              />
              <div>
                <label className={labelClass}>{t("parcels.decisionReason")}</label>
                <textarea
                  className={`${inputClass} min-h-[88px]`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t("parcels.decisionReasonPlaceholder")}
                />
              </div>
              <div>
                <label className={labelClass}>{t("parcels.deliveryNotes")}</label>
                <textarea
                  className={`${inputClass} min-h-[72px]`}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={t("parcels.deliveryNotesPlaceholder")}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                disabled={!canMutate || isActionLoading || !isActionableReview(selectedParcel)}
                onClick={() => void runAction(handleApproveReview)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiCheckCircle size={16} />
                {t("parcels.approve")}
              </button>
              <button
                type="button"
                disabled={!canMutate || isActionLoading || !isActionableReview(selectedParcel)}
                onClick={() => void runAction(handleRejectReview)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiXCircle size={16} />
                {t("parcels.reject")}
              </button>
              <button
                type="button"
                disabled={
                  !canMutate ||
                  isActionLoading ||
                  !isPendingDeliveryConfirm(selectedParcel)
                }
                onClick={() => void runAction(handleConfirmDelivery)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiPackage size={16} />
                {t("parcels.confirmDelivery")}
              </button>
              <button
                type="button"
                disabled={!canMutate || isActionLoading || !selectedParcel}
                onClick={() => void runAction(handleCancelParcel)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiDollarSign size={16} />
                {t("parcels.cancelParcel")}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  isLoading,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{label}</p>
        <span className="text-vr-700">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">
        {isLoading ? "-" : value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  currency = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  currency?: boolean;
}) {
  const isCustomDateTime =
    type === "date" ||
    type === "datetime-local" ||
    type === "time" ||
    type === "month" ||
    type === "week";

  return (
    <div>
      <label className={labelClass}>{label}</label>
      {isCustomDateTime ? (
        <CustomDateTimeInput
          className={inputClass}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : currency ? (
        <CurrencyInput
          className={inputClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={inputClass}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return <DetailItem label={label} value={value} />;
}
