// Màn gói dịch vụ của admin — hai tab:
//   • Gói dịch vụ: tạo/sửa/ngừng bán gói tiêu chuẩn (PlansTab, luồng cũ)
//   • Yêu cầu gói riêng: duyệt/từ chối yêu cầu của nhà xe (mới)
//
// Tab yêu cầu mang badge số đang chờ để admin thấy có việc mà không phải bấm vào,
// nên hàng đợi được tải ở đây rồi truyền xuống tab.
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useInRouterContext, useSearchParams } from "react-router-dom";
import { useToastFeedback } from "../../../hooks/useToastFeedback";
import PlansTab from "./PlansTab";
import CustomRequestsTab from "./CustomRequestsTab";
import { useCustomPlanRequests } from "./useCustomPlanRequests";

type PackagesTab = "plans" | "requests";

export default function AdminPackages() {
  // Phần lớn test component cũ render trang độc lập; production luôn ở trong
  // Router và đi qua wrapper này để nhận deep-link từ chuông thông báo.
  const isRouted = useInRouterContext();
  return isRouted ? <RoutedAdminPackages /> : <AdminPackagesContent />;
}

function RoutedAdminPackages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestId = searchParams.get("requestId")?.trim() || null;
  const routeTab: PackagesTab =
    requestId || searchParams.get("tab") === "requests" ? "requests" : "plans";

  const handleTabChange = useCallback(
    (nextTab: PackagesTab) => {
      const next = new URLSearchParams(searchParams);
      next.delete("requestId");
      if (nextTab === "requests") {
        next.set("tab", "requests");
      } else {
        next.delete("tab");
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleRequestIdConsumed = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("requestId");
    next.set("tab", "requests");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <AdminPackagesContent
      routeTab={routeTab}
      requestId={requestId}
      onTabChange={handleTabChange}
      onRequestIdConsumed={handleRequestIdConsumed}
    />
  );
}

type AdminPackagesContentProps = {
  routeTab?: PackagesTab;
  requestId?: string | null;
  onTabChange?: (tab: PackagesTab) => void;
  onRequestIdConsumed?: () => void;
};

function AdminPackagesContent({
  routeTab,
  requestId = null,
  onTabChange,
  onRequestIdConsumed,
}: AdminPackagesContentProps) {
  const { t } = useTranslation("admin");
  const [localTab, setLocalTab] = useState<PackagesTab>("plans");
  const tab = routeTab ?? localTab;
  const queue = useCustomPlanRequests(t);

  // Đếm số yêu cầu đang chờ ngay khi vào màn, kể cả khi admin chưa mở tab đó
  const { load } = queue;
  useEffect(() => {
    void load();
  }, [load]);

  useToastFeedback({ message: queue.message, error: queue.error });

  const tabClass = (value: PackagesTab) =>
    `inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
      tab === value
        ? "border-vr-800 text-vr-900"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`;

  const selectTab = (nextTab: PackagesTab) => {
    setLocalTab(nextTab);
    onTabChange?.(nextTab);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t("packages.title")}
        </h1>
        <p className="mt-1 text-gray-600">{t("packages.subtitleLong")}</p>
      </div>

      <div
        role="tablist"
        aria-label={t("packages.title")}
        className="flex gap-6 border-b border-gray-200"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "plans"}
          data-testid="admin-packages-tab-plans"
          onClick={() => selectTab("plans")}
          className={tabClass("plans")}
        >
          {t("packages.plansTab")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "requests"}
          data-testid="admin-packages-tab-requests"
          onClick={() => selectTab("requests")}
          className={tabClass("requests")}
        >
          {t("customPlans.requestsTab")}
          {queue.pendingCount > 0 ? (
            <span
              data-testid="pending-requests-count"
              className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800"
            >
              {queue.pendingCount}
            </span>
          ) : null}
        </button>
      </div>

      {tab === "plans" ? (
        <PlansTab />
      ) : (
        <CustomRequestsTab
          queue={queue}
          requestId={requestId}
          onRequestIdConsumed={onRequestIdConsumed}
        />
      )}
    </div>
  );
}
