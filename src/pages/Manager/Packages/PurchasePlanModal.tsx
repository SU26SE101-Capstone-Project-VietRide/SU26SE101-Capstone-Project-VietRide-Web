import { useTranslation } from "react-i18next";
import { FiBox, FiCreditCard, FiShoppingCart } from "react-icons/fi";
import Modal from "../../../components/Modal";
import type {
  SubscriptionBillingPeriod,
  SubscriptionPlan,
} from "../../../api/vietride";
import { formatPrice } from "./subscriptionHelpers";
import { InfoItem } from "./packageDetails";
import { Button } from "../../../components/ui/Button";

type PurchasePlanModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedPlan: SubscriptionPlan | null;
  billingPeriod: SubscriptionBillingPeriod;
  onBillingPeriodChange: (period: SubscriptionBillingPeriod) => void;
  isUpgrading: boolean;
};

export default function PurchasePlanModal({
  open,
  onClose,
  onConfirm,
  selectedPlan,
  billingPeriod,
  onBillingPeriodChange,
  isUpgrading,
}: PurchasePlanModalProps) {
  const { t } = useTranslation("manager");
  const { t: tc } = useTranslation("common");

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      icon={<FiBox size={20} />}
      title={t("packages.purchaseTitle", {
        name: selectedPlan?.name || "",
      })}
      subtitle={selectedPlan?.description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isUpgrading}>
            <FiShoppingCart />
            {t("packages.confirmPurchase")}
          </Button>
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
                onClick={() => onBillingPeriodChange(period)}
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
              <FiCreditCard className="mt-0.5 shrink-0 text-vr-900" />
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
  );
}
