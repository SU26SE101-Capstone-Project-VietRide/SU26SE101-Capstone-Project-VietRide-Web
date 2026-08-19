import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "../components/Sidebar";
import { menuLabelKeyFor } from "../components/sidebarMenu";
import Topbar from "../components/Topbar";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import AssistantBubble from "../components/AssistantBubble";
import { OperatorSubscriptionProvider } from "../contexts/OperatorSubscriptionProvider";
import { useOperatorSubscription } from "../contexts/operatorSubscriptionContext";

function ManagerLayoutContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation(["nav", "common"]);
  const { isLoading } = useOperatorSubscription();
  // Chỉ OPERATOR_ADMIN vào được nhánh /manager (PrivateRoute chặn từ App.tsx),
  // nên không còn nhánh vai trò nào để rẽ.
  const role = "OPERATOR_ADMIN" as const;
  const { pathname } = useLocation();
  const labelKey = menuLabelKeyFor(role, pathname);
  useDocumentTitle(labelKey ? t(labelKey) : null, t("common:brand"));

  return (
    <div className="flex h-screen bg-white">
      {/* Phần tử focus ĐẦU TIÊN của trang. Không có nó, người dùng bàn phím
          phải Tab qua toàn bộ menu trước khi tới được nội dung. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-vr-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {t("common:skipToContent")}
      </a>
      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          userName={t("layout.managerDashboard")}
        />

        {/*
          `relative` bắt buộc: main là vùng cuộn duy nhất của content. Không có
          nó, mọi element `position: absolute` trong page (vd class `sr-only`
          của Tailwind) lấy containing block là viewport nên KHÔNG bị
          overflow-auto cắt — chúng kéo dài chiều cao document và đẻ ra thanh
          cuộn thứ hai của cả cửa sổ trình duyệt.
        */}
        <main id="main-content" tabIndex={-1} className="relative flex-1 overflow-auto bg-gray-50">
          <div className="mx-auto max-w-[1440px] p-6">
            {isLoading ? (
              <p className="text-sm text-gray-500">
                {t("common:pageLoading")}
              </p>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
      <AssistantBubble />
    </div>
  );
}

export default function ManagerLayout() {
  // Chỉ OPERATOR_ADMIN vào được nhánh /manager (PrivateRoute chặn từ App.tsx),
  // nên không còn nhánh vai trò nào để rẽ.
  const role = "OPERATOR_ADMIN" as const;

  return (
    <OperatorSubscriptionProvider role={role}>
      <ManagerLayoutContent />
    </OperatorSubscriptionProvider>
  );
}
