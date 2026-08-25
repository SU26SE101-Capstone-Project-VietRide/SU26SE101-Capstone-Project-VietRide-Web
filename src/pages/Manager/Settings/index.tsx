// Màn cấu hình nhà xe — chia tab thay vì xếp chồng thành một trang dài:
//   • Phụ thu theo dịp   → /v1/operator/fare-surcharges
//   • Chính sách hoàn vé → /v1/operator/profile (BE gộp trong hồ sơ nhà xe)
//   • Bồi thường hàng hoá → /v1/operator/policies/parcel-compensation
//
// Mỗi tab tự tải dữ liệu của mình khi được mở, nên vào màn chỉ gọi API của tab
// đang hiện — không nạp cả ba.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useOperatorSubscription } from "../../../contexts/operatorSubscriptionContext";
import FareSurchargeTab from "./FareSurchargeTab";
import CancellationPolicyTab from "./CancellationPolicyTab";
import ParcelCompensationTab from "./ParcelCompensationTab";

type SettingsTab = "surcharge" | "cancellation" | "parcelCompensation";

export default function ManagerSettings() {
  const { t } = useTranslation("manager");
  const { hasModule } = useOperatorSubscription();
  const [tab, setTab] = useState<SettingsTab>("surcharge");

  // Bồi thường hàng hoá chỉ có nghĩa với nhà xe mua gói có module Parcel.
  const showParcelCompensation = hasModule("enableParcel");

  const tabs: { value: SettingsTab; labelKey: string }[] = [
    { value: "surcharge", labelKey: "settings.tabs.surcharge" },
    { value: "cancellation", labelKey: "settings.tabs.cancellation" },
    ...(showParcelCompensation
      ? [
          {
            value: "parcelCompensation" as const,
            labelKey: "settings.tabs.parcelCompensation",
          },
        ]
      : []),
  ];

  const tabClass = (value: SettingsTab) =>
    `inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
      tab === value
        ? "border-vr-800 text-vr-900"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t("settings.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-600">{t("settings.subtitle")}</p>
      </div>

      <div
        role="tablist"
        aria-label={t("settings.title")}
        className="flex gap-6 overflow-x-auto border-b border-gray-200"
      >
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            data-testid={`manager-settings-tab-${item.value}`}
            onClick={() => setTab(item.value)}
            className={tabClass(item.value)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      {tab === "surcharge" ? <FareSurchargeTab /> : null}
      {tab === "cancellation" ? <CancellationPolicyTab /> : null}
      {tab === "parcelCompensation" && showParcelCompensation ? (
        <ParcelCompensationTab />
      ) : null}
    </div>
  );
}
