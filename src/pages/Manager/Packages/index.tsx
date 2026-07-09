import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiBox,
  FiShoppingCart,
  FiCheck,
  FiTrendingUp,
} from "react-icons/fi";
import Modal from "../../../components/Modal";
import Pagination from "../../../components/Pagination";
import {
  packages as mockPackages,
  operatorSubscriptions,
  packagePurchases,
  type Package,
} from "../../../data/mockData";
import { formatDateOnly, formatDateTime } from "../../../utils/date";

function formatNumber(n: number) {
  return n.toLocaleString();
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-vr-500 focus:outline-none focus:ring-1 focus:ring-vr-500/35";

const CURRENT_OPERATOR_ID = "op1";

export default function ManagerPackages() {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [formData, setFormData] = useState({
    months: 3,
    voucherCode: "",
    paymentMethod: "wallet" as "wallet" | "qr_code",
  });
  const [historyPage, setHistoryPage] = useState(1);
  const pageSize = 8;

  const subscription = operatorSubscriptions.find(
    (s) => s.operatorId === CURRENT_OPERATOR_ID,
  );
  const currentPackage = subscription?.currentPackageId
    ? mockPackages.find((p) => p.id === subscription.currentPackageId)
    : null;

  const purchaseHistory = packagePurchases.filter(
    (p) => p.operatorId === CURRENT_OPERATOR_ID,
  );
  const paginatedPurchaseHistory = useMemo(
    () =>
      purchaseHistory.slice(
        (historyPage - 1) * pageSize,
        historyPage * pageSize,
      ),
    [historyPage, purchaseHistory],
  );

  const handlePurchaseClick = (pkg: Package) => {
    setSelectedPackage(pkg);
    setFormData({ months: 3, voucherCode: "", paymentMethod: "wallet" });
    setPurchaseOpen(true);
  };

  const handlePurchase = () => {
    if (!selectedPackage) return;

    const basePrice = selectedPackage.price;
    const totalPrice = (basePrice * formData.months) / selectedPackage.duration;
    let discount = 0;

    if (formData.voucherCode === "PKG100K") {
      discount = 100000;
    } else if (formData.voucherCode === "SUMMER20") {
      discount = Math.floor(totalPrice * 0.2);
    }

    const finalPrice = totalPrice - discount;
    const method =
      formData.paymentMethod === "wallet"
        ? t("packages.wallet")
        : t("packages.qrCode");

    alert(
      t("packages.purchaseAlert", {
        name: selectedPackage.name,
        months: formData.months,
        base: formatNumber(totalPrice),
        discount: formatNumber(discount),
        total: formatNumber(finalPrice),
        method,
      }),
    );
    setPurchaseOpen(false);
  };

  const purchaseStatusLabel = (status: string) => {
    if (status === "completed") return t("packages.success");
    if (status === "pending") return t("packages.processing");
    return t("packages.cancelled");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t("packages.title")}
        </h1>
        <p className="mt-1 text-gray-600">{t("packages.subtitle")}</p>
      </div>

      {subscription && subscription.status === "active" && currentPackage && (
        <div className="rounded-lg border border-vr-200 bg-vr-50/70 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <FiBox className="text-2xl text-vr-700" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {t("packages.currentPackage", { name: currentPackage.name })}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {t("packages.expiresWithDays", {
                    date: formatDateOnly(subscription.expiryDate),
                    n: subscription.remainingDays,
                  })}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">{t("packages.vehiclesUsed")}</p>
                    <p className="font-semibold text-gray-900">
                      {subscription.totalVehiclesUsed}/
                      {currentPackage.maxVehicles}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">{t("packages.routesUsed")}</p>
                    <p className="font-semibold text-gray-900">
                      {subscription.totalRoutesUsed}/{currentPackage.maxRoutes}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">{t("packages.duration")}</p>
                    <p className="font-semibold text-gray-900">
                      {t("packages.daysCount", {
                        n: subscription.remainingDays,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <FiCheck className="text-3xl text-emerald-600" />
          </div>
        </div>
      )}

      {subscription && subscription.status === "none" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <p className="text-yellow-900 font-semibold">
            {t("packages.noSubscription")}
          </p>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          {t("packages.available")}
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockPackages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">
                    {t("packages.packageLabel")}
                  </p>
                  <h3 className="text-lg font-bold text-gray-900">
                    {pkg.name}
                  </h3>
                </div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    pkg.active
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {pkg.active ? tc("active") : tc("inactive")}
                </span>
              </div>

              <p className="mb-4 text-sm text-gray-600">{pkg.description}</p>

              <div className="mb-6 border-b border-gray-200 pb-6">
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-vr-600">
                    {formatNumber(pkg.price)}
                  </span>
                  <span className="ml-2 text-gray-600">
                    {t("packages.priceDuration", { n: pkg.duration })}
                  </span>
                </div>
              </div>

              <div className="mb-6 space-y-3">
                <div className="flex items-center gap-3">
                  <FiBox size={16} className="shrink-0 text-vr-500" />
                  <div>
                    <p className="text-xs text-gray-500">
                      {t("packages.vehicleCount")}
                    </p>
                    <p className="font-semibold text-gray-900">
                      {t("packages.maxVehicles", { n: pkg.maxVehicles })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FiTrendingUp size={16} className="shrink-0 text-vr-500" />
                  <div>
                    <p className="text-xs text-gray-500">
                      {t("packages.routesLabel")}
                    </p>
                    <p className="font-semibold text-gray-900">
                      {t("packages.maxRoutes", { n: pkg.maxRoutes })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6 flex-1">
                <p className="mb-2 text-xs font-medium text-gray-600">
                  {t("packages.features")}
                </p>
                {pkg.features && (
                  <ul className="space-y-1">
                    {pkg.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-gray-700"
                      >
                        <span className="mt-1 text-vr-500">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                onClick={() => handlePurchaseClick(pkg)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-vr-500 py-2 font-medium text-white transition-colors hover:bg-vr-600"
              >
                <FiShoppingCart className="text-lg" />
                {t("packages.buyPackage")}
              </button>
            </div>
          ))}
        </div>
      </div>

      {purchaseHistory.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            {t("packages.purchaseHistory")}
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    {t("packages.packageColumn")}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    {t("packages.duration")}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">
                    {tc("price")}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">
                    {t("packages.discount")}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900">
                    {t("packages.paidAmount")}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    {t("packages.payment")}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    {t("packages.voucherCode")}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    {tc("status")}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">
                    {t("packages.purchaseDate")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedPurchaseHistory.map((purchase) => {
                  const pkg = mockPackages.find(
                    (p) => p.id === purchase.packageId,
                  );
                  return (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {pkg?.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {t("packages.monthsCount", { n: purchase.months })}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatNumber(
                          purchase.totalPrice - purchase.discountAmount,
                        )}{" "}
                        VND
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {purchase.discountAmount > 0
                          ? `-${formatNumber(purchase.discountAmount)} VND`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatNumber(purchase.totalPrice)} VND
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                          {purchase.paymentMethod === "wallet"
                            ? t("packages.wallet")
                            : t("packages.qrCode")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {purchase.voucherCode || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            purchase.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : purchase.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {purchaseStatusLabel(purchase.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDateTime(purchase.purchasedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              page={historyPage}
              pageSize={pageSize}
              totalItems={purchaseHistory.length}
              onPageChange={setHistoryPage}
            />
          </div>
        </div>
      )}

      <Modal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        wide
        icon={<FiBox size={20} />}
        title={t("packages.purchaseTitle", {
          name: selectedPackage?.name || "",
        })}
        subtitle={selectedPackage?.description}
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
              onClick={handlePurchase}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-vr-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-vr-600"
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
              <div>
                <p className="text-xs font-medium text-gray-500">
                  {t("packages.packageColumn")}
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {selectedPackage?.name}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">
                  {t("packages.basePrice")}
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {formatNumber(selectedPackage?.price || 0)} VND /{" "}
                  {selectedPackage?.duration} {t("packages.monthsUnit")}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">
                  {t("packages.vehicleCount")}
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {selectedPackage
                    ? t("packages.maxVehicles", {
                        n: selectedPackage.maxVehicles,
                      })
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">
                  {t("packages.routesLabel")}
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {selectedPackage
                    ? t("packages.maxRoutes", { n: selectedPackage.maxRoutes })
                    : "-"}
                </p>
              </div>
            </div>
          </section>

          <section className="border-t border-gray-200 pt-5">
            <h3 className="text-base font-bold text-gray-900">
              {t("packages.packageDurationLabel")}
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[3, 6, 12].map((month) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => setFormData({ ...formData, months: month })}
                  className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                    formData.months === month
                      ? "border-vr-400 bg-vr-50 text-vr-900"
                      : "border-gray-200 bg-white text-gray-700 hover:border-vr-200 hover:bg-vr-50/60"
                  }`}
                >
                  {t("packages.monthsCount", { n: month })}
                </button>
              ))}
            </div>
            {selectedPackage && (
              <p className="mt-3 text-sm text-gray-600">
                {t("packages.totalPriceLabel")}{" "}
                <span className="font-semibold text-gray-900">
                  {formatNumber(
                    (selectedPackage.price * formData.months) /
                      selectedPackage.duration,
                  )}{" "}
                  VND
                </span>
              </p>
            )}
          </section>

          <section className="border-t border-gray-200 pt-5">
            <h3 className="text-base font-bold text-gray-900">
              {t("packages.voucherCodeOptional")}
            </h3>
            <input
              type="text"
              placeholder={t("packages.voucherPlaceholder")}
              className={`${inputClass} mt-3`}
              value={formData.voucherCode}
              onChange={(event) =>
                setFormData({ ...formData, voucherCode: event.target.value })
              }
            />
            <p className="mt-2 text-xs text-gray-500">
              {t("packages.availableVouchers")}
            </p>
          </section>

          <section className="border-t border-gray-200 pt-5">
            <h3 className="text-base font-bold text-gray-900">
              {t("packages.paymentMethod")}
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <PaymentOption
                checked={formData.paymentMethod === "wallet"}
                title={t("packages.payWithWallet")}
                description={t("packages.useWalletBalance")}
                onChange={() =>
                  setFormData({ ...formData, paymentMethod: "wallet" })
                }
              />
              <PaymentOption
                checked={formData.paymentMethod === "qr_code"}
                title={t("packages.qrCode")}
                description={t("packages.scanQrToPay")}
                onChange={() =>
                  setFormData({ ...formData, paymentMethod: "qr_code" })
                }
              />
            </div>
          </section>
        </div>
      </Modal>
    </div>
  );
}

function PaymentOption({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
        checked
          ? "border-vr-300 bg-vr-50 text-vr-900"
          : "border-gray-200 bg-white text-gray-700 hover:border-vr-200 hover:bg-vr-50/60"
      }`}
    >
      <input
        type="radio"
        name="payment"
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 border-gray-300 text-vr-600 focus:ring-vr-500"
      />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-xs text-gray-500">{description}</span>
      </span>
    </label>
  );
}
