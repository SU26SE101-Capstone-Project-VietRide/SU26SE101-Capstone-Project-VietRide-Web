import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
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

  return (
    <div className="flex h-screen bg-white">
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
        <main className="relative flex-1 overflow-auto bg-gray-50">
          <div className="p-6">
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
