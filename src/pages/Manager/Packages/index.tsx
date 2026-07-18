import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FiBox, FiCheck, FiCreditCard, FiDownload, FiEye, FiShoppingCart, FiTrendingUp } from "react-icons/fi";
import Modal from "../../../components/Modal";
import {
  getOperatorSubscription,
  getOperatorSubscriptionPlans,
  getOperatorInvoices,
  getOperatorInvoice,
  downloadOperatorInvoice,
  upgradeOperatorSubscription,
  type OperatorSubscriptionDetail,
  type OperatorInvoice,
  type OperatorInvoiceDetail,
  type SubscriptionBillingPeriod,
  type SubscriptionPlan,
} from "../../../api/vietride";
import { formatDateOnly } from "../../../utils/date";
import Pagination from "../../../components/Pagination";

function formatNumber(n: number) {
  return n.toLocaleString("vi-VN");
}

function formatPrice(plan: SubscriptionPlan, billingPeriod: SubscriptionBillingPeriod) {
  const amount =
    billingPeriod === "YEARLY" ? plan.pricePerYear : plan.pricePerMonth;
  return `${formatNumber(amount)} VND`;
}

function planLimit(plan: SubscriptionPlan, key: keyof SubscriptionPlan["limits"]) {
  return plan.limits[key] ?? 0;
}

export default function ManagerPackages() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [subscription, setSubscription] =
    useState<OperatorSubscriptionDetail | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [billingPeriod, setBillingPeriod] =
    useState<SubscriptionBillingPeriod>("YEARLY");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const upgradeInFlightRef = useRef(false);

  const currentPlan = subscription?.plan ?? null;
  const activePlans = useMemo(
    () => plans.filter((plan) => plan.isActive),
    [plans],
  );

  const loadSubscriptionData = useCallback(async () => {
    const [subscriptionResult, planResult] = await Promise.all([
      getOperatorSubscription(),
      getOperatorSubscriptionPlans(),
    ]);
    setSubscription(subscriptionResult);
    setPlans(planResult);
    return subscriptionResult;
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialSubscriptionData() {
      try {
        await loadSubscriptionData();
      } catch (err) {
        if (isCurrent) {
          setError(err instanceof Error ? err.message : t("packages.loadFailed"));
        }
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    void loadInitialSubscriptionData();
    return () => {
      isCurrent = false;
    };
  }, [loadSubscriptionData, t]);

  useEffect(() => {
    const hasVnPayParams = Array.from(
      new URLSearchParams(window.location.search).keys(),
    ).some((key) => key.startsWith("vnp_"));
    if (!hasVnPayParams) return;

    window.location.replace(
      `/payments/return${window.location.search}${window.location.hash}`,
    );
  }, []);

  function openPurchase(plan: SubscriptionPlan) {
    if (plan.planId === currentPlan?.planId) {
      return;
    }

    if (plan.pricePerMonth <= 0 && plan.pricePerYear <= 0) {
      setError(t("packages.planNotPayable"));
      return;
    }

    setSelectedPlan(plan);
    setBillingPeriod(subscription?.billingPeriod ?? "YEARLY");
    setPurchaseOpen(true);
    setMessage("");
    setError("");
  }

  async function handleUpgrade() {
    if (!selectedPlan || upgradeInFlightRef.current) {
      return;
    }

    const payableAmount =
      billingPeriod === "YEARLY"
        ? selectedPlan.pricePerYear
        : selectedPlan.pricePerMonth;
    if (selectedPlan.planId === currentPlan?.planId || payableAmount <= 0) {
      setError(t("packages.planNotPayable"));
      return;
    }

    upgradeInFlightRef.current = true;
    setIsUpgrading(true);
    setError("");

    try {
      const result = await upgradeOperatorSubscription({
        planId: selectedPlan.planId,
        billingPeriod,
        paymentMethod: "VNPAY",
        returnUrl: `${window.location.origin}/payments/return`,
      });

      if (result.paymentRedirectUrl) {
        setMessage(t("packages.upgradePending"));
        window.location.assign(result.paymentRedirectUrl);
        return;
      }

      setError(t("packages.missingPaymentRedirect"));
    } catch (err) {
      const fallbackError =
        err instanceof Error ? err.message : t("packages.upgradeFailed");

      try {
        const refreshedSubscription = await loadSubscriptionData();
        if (
          refreshedSubscription.status === "PENDING_PAYMENT" ||
          refreshedSubscription.pendingUpgrade
        ) {
          setPurchaseOpen(false);
          setMessage(t("packages.paymentAlreadyPending"));
        } else {
          setError(fallbackError);
        }
      } catch {
        setError(fallbackError);
      }
    } finally {
      upgradeInFlightRef.current = false;
      setIsUpgrading(false);
    }
  }

  const canUpgrade = subscription?.status === "ACTIVE" || subscription?.status === "EXPIRED";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t("packages.title")}
        </h1>
        <p className="mt-1 text-gray-600">{t("packages.subtitle")}</p>
      </div>

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

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          {t("packages.loading")}
        </div>
      ) : null}

      {subscription && currentPlan ? (
        <div className="rounded-lg border border-vr-200 bg-vr-50/70 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <FiBox className="mt-1 text-2xl text-vr-700" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {t("packages.currentPackage", { name: currentPlan.name })}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {t("packages.expiresOn", {
                    date: formatDateOnly(subscription.expiresAt),
                  })}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase text-vr-700">
                  {subscription.status} · {subscription.billingPeriod}
                </p>
                <div className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
                  <UsageItem
                    label={t("packages.vehiclesUsed")}
                    used={subscription.usage.currentVehicles}
                    limit={planLimit(currentPlan, "maxVehicles")}
                  />
                  <UsageItem
                    label={t("packages.routesUsed")}
                    used={subscription.usage.currentRoutes}
                    limit={planLimit(currentPlan, "maxRoutes")}
                  />
                  <UsageItem
                    label={t("packages.tripsUsed")}
                    used={subscription.usage.currentTripsThisMonth}
                    limit={planLimit(currentPlan, "maxTripsPerMonth")}
                  />
                </div>
              </div>
            </div>
            <FiCheck className="text-3xl text-emerald-600" />
          </div>
          {subscription.pendingUpgrade ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>
                {t("packages.pendingPayment", {
                  paymentId: subscription.pendingUpgrade.paymentId,
                })}
              </span>
              {subscription.pendingUpgrade.paymentRedirectUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    window.location.assign(
                      subscription.pendingUpgrade?.paymentRedirectUrl ?? "",
                    )
                  }
                  className="cursor-pointer rounded-lg border border-amber-300 bg-white px-3 py-2 font-medium text-amber-800 transition-colors hover:bg-amber-100"
                >
                  {t("packages.continuePayment")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          {t("packages.available")}
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activePlans.map((plan) => (
            <div
              key={plan.planId}
              className="flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">
                    {t("packages.packageLabel")}
                  </p>
                  <h3 className="text-lg font-bold text-gray-900">
                    {plan.name}
                  </h3>
                </div>
                <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                  {tc("active")}
                </span>
              </div>

              <p className="mb-4 text-sm text-gray-600">
                {plan.description || "-"}
              </p>

              <div className="mb-6 border-b border-gray-200 pb-6">
                <p className="text-3xl font-bold text-vr-600">
                  {formatPrice(plan, billingPeriod)}
                </p>
                <p className="mt-1 text-sm text-gray-500">{billingPeriod}</p>
              </div>

              <div className="mb-6 space-y-3">
                <LimitRow
                  icon={<FiBox size={16} />}
                  label={t("packages.vehicleCount")}
                  value={t("packages.maxVehicles", {
                    n: planLimit(plan, "maxVehicles"),
                  })}
                />
                <LimitRow
                  icon={<FiTrendingUp size={16} />}
                  label={t("packages.routesLabel")}
                  value={t("packages.maxRoutes", {
                    n: planLimit(plan, "maxRoutes"),
                  })}
                />
                <LimitRow
                  icon={<FiTrendingUp size={16} />}
                  label={t("packages.tripsPerMonth")}
                  value={formatNumber(planLimit(plan, "maxTripsPerMonth"))}
                />
              </div>

              <div className="mb-6 flex-1">
                <p className="mb-2 text-xs font-medium text-gray-600">
                  {t("packages.features")}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(plan.modules).map(([key, enabled]) => (
                    <span
                      key={key}
                      className={`rounded-full px-2 py-1 font-semibold ${
                        enabled
                          ? "bg-vr-50 text-vr-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {key}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openPurchase(plan)}
                disabled={
                  !canUpgrade ||
                  Boolean(subscription?.pendingUpgrade) ||
                  plan.planId === currentPlan?.planId ||
                  (plan.pricePerMonth <= 0 && plan.pricePerYear <= 0)
                }
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-vr-500 py-2 font-medium text-white transition-colors hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiShoppingCart className="text-lg" />
                {plan.planId === currentPlan?.planId
                  ? t("packages.currentPlanButton")
                  : plan.pricePerMonth <= 0 && plan.pricePerYear <= 0
                    ? t("packages.notPayable")
                    : t("packages.buyPackage")}
              </button>
            </div>
          ))}
        </div>
      </div>

      <OperatorInvoiceSection />

      <Modal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        wide
        icon={<FiBox size={20} />}
        title={t("packages.purchaseTitle", {
          name: selectedPlan?.name || "",
        })}
        subtitle={selectedPlan?.description}
        footer={
          <>
            <button
              type="button"
              onClick={() => setPurchaseOpen(false)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleUpgrade()}
              disabled={isUpgrading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-vr-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiShoppingCart />
              {t("packages.confirmPurchase")}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="text-base font-bold text-gray-900">
              {t("packages.packageInfo")}
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <InfoItem
                label={t("packages.packageColumn")}
                value={selectedPlan?.name || "-"}
              />
              <InfoItem
                label={t("packages.basePrice")}
                value={
                  selectedPlan ? formatPrice(selectedPlan, billingPeriod) : "-"
                }
              />
            </div>
          </section>

          <section className="border-t border-gray-200 pt-5">
            <h3 className="text-base font-bold text-gray-900">
              {t("packages.billingPeriod")}
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(["MONTHLY", "YEARLY"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setBillingPeriod(period)}
                  className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                    billingPeriod === period
                      ? "border-vr-400 bg-vr-50 text-vr-900"
                      : "border-gray-200 bg-white text-gray-700 hover:border-vr-200 hover:bg-vr-50/60"
                  }`}
                >
                  {t(`packages.billing.${period}`)}
                </button>
              ))}
            </div>
          </section>

          <section className="border-t border-gray-200 pt-5">
            <h3 className="text-base font-bold text-gray-900">
              {t("packages.paymentMethod")}
            </h3>
            <div className="mt-4">
              <div className="flex items-start gap-3 rounded-lg border border-vr-400 bg-vr-50 p-4 text-left">
                <FiCreditCard className="mt-0.5 shrink-0 text-vr-600" />
                <span>
                  <span className="block font-semibold text-gray-900">
                    {t("packages.paymentMethods.VNPAY.title")}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {t("packages.paymentMethods.VNPAY.hint")}
                  </span>
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            {t("packages.vnpayNote")}
          </section>
        </div>
      </Modal>
    </div>
  );
}

function OperatorInvoiceSection() {
  const { t } = useTranslation("manager");
  const [invoices, setInvoices] = useState<OperatorInvoice[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState("");
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<OperatorInvoiceDetail | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState("");
  const pageSize = 8;

  useEffect(() => {
    let ignore = false;

    async function loadInvoices() {
      setLoading(true);
      setError("");

      try {
        const result = await getOperatorInvoices({
          page,
          pageSize,
          sortBy: "createdAt",
          sortDir: "desc",
        });
        if (!ignore) {
          setInvoices(result.items);
          setTotalItems(result.totalItems);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : t("packages.invoiceLoadFailed"));
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadInvoices();
    return () => {
      ignore = true;
    };
  }, [page, t]);

  async function openInvoiceDetail(invoiceId: string) {
    setDetailLoadingId(invoiceId);
    setError("");
    try {
      setDetail(await getOperatorInvoice(invoiceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("packages.invoiceDetailFailed"));
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
      setError(err instanceof Error ? err.message : t("packages.invoiceDownloadFailed"));
    } finally {
      setDownloadingId("");
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-xl font-bold text-gray-900">{t("packages.invoices")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("packages.invoicesHint")}</p>
      </div>
      {error && <div role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600"><th className="px-4 py-3">{t("packages.invoiceNumber")}</th><th className="px-4 py-3">{t("packages.period")}</th><th className="px-4 py-3">{t("packages.amount")}</th><th className="px-4 py-3">{t("packages.invoiceStatus")}</th><th className="px-4 py-3">PDF</th><th className="px-4 py-3 text-center">{t("packages.action")}</th></tr></thead>
          <tbody>{!loading && invoices.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">{t("packages.noInvoices")}</td></tr> : invoices.map((invoice) => <tr key={invoice.invoiceId} className="border-t border-gray-100"><td className="px-4 py-3 font-semibold">{invoice.invoiceNumber}</td><td className="px-4 py-3 text-gray-600">{formatDateOnly(invoice.periodFrom)} - {formatDateOnly(invoice.periodTo)}</td><td className="px-4 py-3 font-semibold">{formatNumber(invoice.amount)} đ</td><td className="px-4 py-3">{invoice.status}</td><td className="px-4 py-3">{invoice.pdfGenerationStatus}</td><td className="px-4 py-3"><div className="flex justify-center gap-2"><button type="button" disabled={detailLoadingId === invoice.invoiceId} onClick={() => void openInvoiceDetail(invoice.invoiceId)} className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-vr-700 hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-40" title={t("packages.viewInvoice")} aria-label={t("packages.viewInvoice")}><FiEye /></button><button type="button" disabled={invoice.status !== "ISSUED" || invoice.pdfGenerationStatus !== "COMPLETED" || downloadingId === invoice.invoiceId} onClick={() => void downloadInvoice(invoice.invoiceId)} className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-vr-700 hover:bg-vr-50 disabled:cursor-not-allowed disabled:opacity-40" title={t("packages.downloadInvoice")} aria-label={t("packages.downloadInvoice")}><FiDownload /></button></div></td></tr>)}</tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        wide
        icon={<FiCreditCard size={20} />}
        title={t("packages.invoiceDetailTitle")}
        subtitle={detail?.invoiceNumber}
        footer={
          <button type="button" onClick={() => setDetail(null)} className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            {t("packages.close")}
          </button>
        }
      >
        {detail ? <InvoiceDetailContent detail={detail} /> : null}
      </Modal>
    </section>
  );
}

function InvoiceDetailContent({ detail }: { detail: OperatorInvoiceDetail }) {
  const { t } = useTranslation("manager");
  const buyer = detail.buyerSnapshot;
  const address = [buyer.addressStreet, buyer.addressWard, buyer.addressDistrict, buyer.addressProvince]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2">
        <InfoItem label={t("packages.invoiceNumber")} value={detail.invoiceNumber} />
        <InfoItem label={t("packages.invoiceStatus")} value={detail.status} />
        <InfoItem label={t("packages.packageColumn")} value={detail.planName} />
        <InfoItem label={t("packages.amount")} value={`${formatNumber(detail.amount)} đ`} />
        <InfoItem label={t("packages.billingPeriod")} value={detail.billingPeriod} />
        <InfoItem label={t("packages.period")} value={`${formatDateOnly(detail.periodFrom)} - ${formatDateOnly(detail.periodTo)}`} />
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h3 className="mb-4 font-bold text-gray-900">{t("packages.buyerInfo")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoItem label={t("packages.buyerName")} value={buyer.name || "-"} />
          <InfoItem label={t("packages.taxCode")} value={buyer.taxCode || "-"} />
          <InfoItem label={t("packages.businessRegistrationNumber")} value={buyer.businessRegistrationNumber || "-"} />
          <InfoItem label={t("packages.contactEmail")} value={buyer.contactEmail || "-"} />
          <InfoItem label={t("packages.contactPhone")} value={buyer.contactPhone || "-"} />
          <InfoItem label={t("packages.address")} value={address || "-"} />
        </div>
      </section>
    </div>
  );
}

function UsageItem({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  return (
    <div>
      <p className="text-gray-600">{label}</p>
      <p className="font-semibold text-gray-900">
        {formatNumber(used)}/{formatNumber(limit)}
      </p>
    </div>
  );
}

function LimitRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-vr-500">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-gray-900">{value}</p>
    </div>
  );
}
